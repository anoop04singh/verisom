import { analyzeTargetContract } from "./audit-pipeline";

export type InteractionRecommendation = "allow" | "review" | "avoid";

export type AnalysisResult = Awaited<ReturnType<typeof analyzeTargetContract>>;

export type AssessmentFinding = {
  title: string;
  severity: "low" | "medium" | "high";
  evidence: string;
};

export type InteractionAssessment = {
  recommendation: InteractionRecommendation;
  shouldInteract: boolean;
  localRiskScore: number;
  localRiskLevel: "low" | "medium" | "high";
  reasons: string[];
  findings: AssessmentFinding[];
  intendedInteraction: string | null;
};

function countFailedTransactions(analysis: AnalysisResult) {
  return analysis.recentTransactions.filter(
    (transaction) => transaction.status && transaction.status !== "ok"
  ).length;
}

function hasFunction(functions: AnalysisResult["analysisInputs"]["contractFunctionsUsed"], pattern: RegExp) {
  return functions.find(
    (item) => pattern.test(item.identifier.toLowerCase()) || pattern.test(item.signature.toLowerCase())
  );
}

function pushFinding(
  findings: AssessmentFinding[],
  title: string,
  severity: AssessmentFinding["severity"],
  evidence: string
) {
  findings.push({ title, severity, evidence });
}

export function buildInteractionAssessment(
  analysis: AnalysisResult,
  intendedInteraction?: string
): InteractionAssessment {
  let localRiskScore = 0;
  const reasons: string[] = [];
  const findings: AssessmentFinding[] = [];
  const functions = analysis.analysisInputs.contractFunctionsUsed;

  if (!analysis.verified) {
    localRiskScore += 2;
    reasons.push("Source code is not verified, so the assessment relied on bytecode and explorer metadata.");
    pushFinding(
      findings,
      "Unverified contract",
      "medium",
      "The contract was analyzed through bytecode fallback rather than full verified source."
    );
  }

  if (analysis.contractProfile.isProxy) {
    localRiskScore += 2;
    reasons.push("Proxy or implementation indirection was detected, which increases upgrade and admin risk.");
    pushFinding(
      findings,
      "Upgradeable or proxied surface",
      "medium",
      "Explorer metadata indicates a proxy or implementation indirection layer."
    );
  }

  const specialFlags = new Set(analysis.bytecodeAnalysis?.specialFlags ?? []);
  if (specialFlags.has("delegatecall")) {
    localRiskScore += 3;
    reasons.push("Bytecode includes DELEGATECALL, which can redirect execution into other contracts.");
    pushFinding(
      findings,
      "Delegatecall present",
      "high",
      "Bytecode analysis detected DELEGATECALL, which can materially change the execution trust surface."
    );
  }
  if (specialFlags.has("selfdestruct")) {
    localRiskScore += 3;
    reasons.push("Bytecode includes SELFDESTRUCT, which is high risk for interaction safety.");
    pushFinding(
      findings,
      "Selfdestruct capability",
      "high",
      "Bytecode analysis detected SELFDESTRUCT."
    );
  }
  if (specialFlags.has("create2") || specialFlags.has("create")) {
    localRiskScore += 1;
    reasons.push("Bytecode can deploy contracts dynamically, which may expand the trust surface.");
    pushFinding(
      findings,
      "Factory behavior",
      "medium",
      "Bytecode analysis indicates contract creation opcodes are present."
    );
  }

  const upgradeableConfidence =
    analysis.bytecodeAnalysis?.patterns.find((pattern) => pattern.standard === "Upgradeable")
      ?.confidence ?? 0;
  if (upgradeableConfidence >= 50) {
    localRiskScore += 1;
    reasons.push("Upgradeable pattern indicators were found in bytecode analysis.");
  }

  const ownershipFunction = hasFunction(functions, /owner|transferownership|setowner|admin/);
  if (ownershipFunction) {
    localRiskScore += 1;
    pushFinding(
      findings,
      "Privileged ownership or admin controls",
      "medium",
      `Function surface includes ${ownershipFunction.signature}, indicating privileged control paths.`
    );
  }

  const pauseFunction = hasFunction(functions, /pause|unpause|freeze|blacklist|whitelist/);
  if (pauseFunction) {
    localRiskScore += 1;
    pushFinding(
      findings,
      "Operational control functions",
      "medium",
      `Function surface includes ${pauseFunction.signature}, which can restrict or alter user flows.`
    );
  }

  const mintFunction = hasFunction(functions, /mint|burn|rebase/);
  if (mintFunction) {
    localRiskScore += 1;
    pushFinding(
      findings,
      "Supply control functions",
      "medium",
      `Function surface includes ${mintFunction.signature}, which can change token supply or balances.`
    );
  }

  const upgradeFunction = hasFunction(functions, /upgrade|implementation|changeadmin/);
  if (upgradeFunction) {
    localRiskScore += 2;
    pushFinding(
      findings,
      "Upgrade control detected",
      "high",
      `Function surface includes ${upgradeFunction.signature}, indicating upgrade authority.`
    );
  }

  const fundSweepFunction = hasFunction(functions, /withdraw|sweep|rescue|claim|drain/);
  if (fundSweepFunction) {
    localRiskScore += 1;
    pushFinding(
      findings,
      "Fund movement authority",
      "medium",
      `Function surface includes ${fundSweepFunction.signature}, which may move or recover held assets.`
    );
  }

  const feeFunction = hasFunction(functions, /tax|fee|setfee|settax|maxwallet|maxtransaction/);
  if (feeFunction) {
    localRiskScore += 1;
    pushFinding(
      findings,
      "Tokenomics control",
      "medium",
      `Function surface includes ${feeFunction.signature}, which may affect transfer economics or transferability.`
    );
  }

  const failedTransactions = countFailedTransactions(analysis);
  if (failedTransactions > 0) {
    localRiskScore += 1;
    reasons.push(`Recent transaction history includes ${failedTransactions} failed transaction(s).`);
    pushFinding(
      findings,
      "Recent execution failures",
      failedTransactions >= 3 ? "medium" : "low",
      `${failedTransactions} recent transaction(s) reported non-ok status in explorer data.`
    );
  }

  if (analysis.recentTransactions.length === 0) {
    localRiskScore += 1;
    reasons.push("No recent transaction history was available from the explorer.");
  }

  if (analysis.verified && !analysis.contractProfile.isProxy) {
    localRiskScore = Math.max(0, localRiskScore - 1);
    reasons.push("Verified source is available without an obvious proxy layer, which reduces uncertainty.");
    if (findings.length === 0) {
      pushFinding(
        findings,
        "Lower structural uncertainty",
        "low",
        "Verified source is available and no obvious proxy layer was detected."
      );
    }
  }

  const recommendation: InteractionRecommendation =
    localRiskScore >= 6 ? "avoid" : localRiskScore >= 2 ? "review" : "allow";
  const localRiskLevel =
    recommendation === "allow" ? "low" : recommendation === "review" ? "medium" : "high";

  if (intendedInteraction) {
    reasons.push(`Planned interaction: ${intendedInteraction}.`);
  }

  return {
    recommendation,
    shouldInteract: recommendation === "allow",
    localRiskScore,
    localRiskLevel,
    reasons,
    findings,
    intendedInteraction: intendedInteraction ?? null
  };
}

export function combineAssessmentWithVerisomScore(
  assessment: InteractionAssessment,
  parsedScore: number | null
) {
  if (parsedScore === null || Number.isNaN(parsedScore)) {
    return assessment.recommendation;
  }

  if (assessment.recommendation === "avoid") {
    return "avoid" as const;
  }

  if (parsedScore < 50) {
    return "avoid" as const;
  }
  if (parsedScore < 80) {
    return "review" as const;
  }

  return assessment.recommendation === "allow" ? "allow" : "review";
}

export function classifySomniaScore(score: number | null) {
  if (score === null || Number.isNaN(score)) {
    return {
      band: "unknown" as const,
      riskLevel: "high" as const,
      riskScore: 100,
      interpretation: "No Somnia Agents score was available."
    };
  }

  if (score >= 85) {
    return {
      band: "strong" as const,
      riskLevel: "low" as const,
      riskScore: 100 - score,
      interpretation: "The Somnia Agents score suggests comparatively lower observed risk."
    };
  }

  if (score >= 65) {
    return {
      band: "caution" as const,
      riskLevel: "medium" as const,
      riskScore: 100 - score,
      interpretation: "The Somnia Agents score suggests the contract should be reviewed before interaction."
    };
  }

  return {
    band: "danger" as const,
    riskLevel: "high" as const,
    riskScore: 100 - score,
    interpretation: "The Somnia Agents score suggests materially elevated interaction risk."
  };
}
