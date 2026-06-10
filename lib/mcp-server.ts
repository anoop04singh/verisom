import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { analyzeTargetContract } from "./audit-pipeline";
import {
  buildInteractionAssessment,
  classifySomniaScore,
  combineAssessmentWithVerisomScore
} from "./interaction-assessment";
import {
  submitVerisomRequest,
  waitForVerisomRequestCompletion
} from "./verisom";

function formatScoreSummary(input: {
  targetAddress: string;
  recommendation: string;
  riskLevel: string;
  riskScore: number;
  somniaScore: string;
  scoreBand: string;
  scoreInterpretation: string;
  keyFindings: Array<{ title: string; severity: string; evidence: string }>;
  proceedGuidance: string;
}) {
  const lines = [
    `Target contract: ${input.targetAddress}`,
    `Somnia Agents score: ${input.somniaScore}`,
    `Score band: ${input.scoreBand}`,
    `Recommendation: ${input.recommendation}`,
    `Risk level: ${input.riskLevel}`,
    `Risk score: ${input.riskScore}`,
    `Interpretation: ${input.scoreInterpretation}`,
    "",
    "Key findings:"
  ];

  for (const finding of input.keyFindings) {
    lines.push(`- [${finding.severity}] ${finding.title}: ${finding.evidence}`);
  }

  lines.push("", `Guidance: ${input.proceedGuidance}`);

  return lines.join("\n");
}

function buildProceedGuidance(recommendation: string, intendedInteraction?: string) {
  const interaction = intendedInteraction?.trim()
    ? `for the intended interaction (${intendedInteraction})`
    : "for the intended interaction";

  if (recommendation === "allow") {
    return `Proceed ${interaction}, but still verify transaction parameters, token amounts, and approvals at execution time.`;
  }
  if (recommendation === "review") {
    return `Do not auto-execute ${interaction}. Require manual review of privileged functions, fund movement paths, and user-facing constraints before proceeding.`;
  }

  return `Do not proceed ${interaction} without deeper investigation or an alternative contract path.`;
}

export function createVerisomMcpServer(options?: {
  allowEnvPrivateKey?: boolean;
  transportMode?: "http" | "stdio";
}) {
  const allowEnvPrivateKey = options?.allowEnvPrivateKey ?? false;
  const server = new McpServer({
    name: "verisom-contract-score-mcp",
    version: "1.0.0"
  });

  server.registerTool(
    "score_contract_before_interaction",
    {
      title: "Score Contract Before Interaction",
      description:
        "Before an agent calls or transacts with a contract, get the Somnia Agents safety score and a final allow/review/avoid recommendation. The tool waits and returns the score directly.",
      inputSchema: {
        targetAddress: z.string().describe("Target EVM contract address."),
        chainName: z
          .string()
          .optional()
          .describe("Human-readable chain label. Defaults to Somnia Testnet."),
        intendedInteraction: z
          .string()
          .optional()
          .describe("Brief description of the contract call, approval, swap, or other intended interaction."),
        auditFocus: z
          .string()
          .optional()
          .describe("Optional extra concerns to prioritize in the context-building step."),
        privateKey: z
          .string()
          .optional()
          .describe(
            allowEnvPrivateKey
              ? "Optional private key. If omitted, the connector may use AGENT_PRIVATE_KEY from its own local environment."
              : "Private key required in HTTP mode. The agent should supply its own key from chat or tool arguments."
          ),
        timeoutMs: z
          .number()
          .optional()
          .describe("Optional timeout while waiting for the Somnia Agents result. Default is 10 minutes."),
        pollIntervalMs: z
          .number()
          .optional()
          .describe("Optional polling interval in milliseconds while waiting for the result.")
      },
      outputSchema: {
        targetAddress: z.string(),
        chainName: z.string(),
        somniaScore: z.number(),
        somniaStatus: z.string(),
        scoreBand: z.enum(["strong", "caution", "danger", "unknown"]),
        scoreInterpretation: z.string(),
        recommendation: z.enum(["allow", "review", "avoid"]),
        shouldInteract: z.boolean(),
        riskLevel: z.enum(["low", "medium", "high"]),
        riskScore: z.number(),
        reasons: z.array(z.string()),
        keyFindings: z.array(
          z.object({
            title: z.string(),
            severity: z.enum(["low", "medium", "high"]),
            evidence: z.string()
          })
        ),
        proceedGuidance: z.string(),
        localHeuristicRecommendation: z.enum(["allow", "review", "avoid"]),
        localHeuristicRiskLevel: z.enum(["low", "medium", "high"]),
        localHeuristicRiskScore: z.number(),
        verified: z.boolean(),
        sourceMode: z.enum(["verified-source", "bytecode-fallback"]),
        contractName: z.string().nullable(),
        compilerVersion: z.string().nullable(),
        proxyDetected: z.boolean(),
        implementationAddress: z.string().nullable(),
        retrievalMode: z.string(),
        recentTransactionCount: z.number(),
        privateKeySource: z.enum(["input", "env"]),
        oracleTransactionHash: z.string(),
        ragContextUsed: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            category: z.string(),
            score: z.number(),
            text: z.string()
          })
        ),
        contractFunctionsUsed: z.array(
          z.object({
            identifier: z.string(),
            signature: z.string(),
            source: z.enum(["verified-abi", "bytecode-selector"]),
            stateMutability: z.string().nullable()
          })
        ),
        recentTransactionsUsed: z.array(
          z.object({
            hash: z.string(),
            method: z.string(),
            timestamp: z.string().nullable(),
            blockNumber: z.number().nullable(),
            from: z.string().nullable(),
            to: z.string().nullable(),
            status: z.string().nullable(),
            value: z.string().nullable()
          })
        ),
        bytecodeSignalsUsed: z
          .object({
            patterns: z.array(
              z.object({
                standard: z.string(),
                description: z.string(),
                confidence: z.number()
              })
            ),
            specialFlags: z.array(z.string()),
            selectors: z.array(
              z.object({
                selector: z.string(),
                signatures: z.array(z.string())
              })
            )
          })
          .nullable(),
        contractContext: z.string()
      }
    },
    async ({
      targetAddress,
      chainName,
      intendedInteraction,
      auditFocus,
      privateKey,
      timeoutMs,
      pollIntervalMs
    }) => {
      const analysis = await analyzeTargetContract({
        targetAddress,
        chainName,
        auditFocus
      });

      const assessment = buildInteractionAssessment(analysis, intendedInteraction);
      const submission = await submitVerisomRequest({
        targetAddress: analysis.targetAddress,
        chainName: analysis.chainName,
        contractContext: analysis.contractContext,
        privateKey,
        allowEnvPrivateKey
      });

      const status = await waitForVerisomRequestCompletion({
        requestId: submission.requestId,
        startBlock: submission.blockNumber,
        timeoutMs,
        pollIntervalMs
      });

      const parsedScore = Number(status.parsedScore);
      const scoreProfile = classifySomniaScore(Number.isNaN(parsedScore) ? null : parsedScore);
      const finalRecommendation = combineAssessmentWithVerisomScore(
        assessment,
        Number.isNaN(parsedScore) ? null : parsedScore
      );
      const keyFindings = assessment.findings.length > 0
        ? assessment.findings.slice(0, 6)
        : [
            {
              title: "No standout high-risk structural signal detected",
              severity: "low" as const,
              evidence: "The local heuristic layer did not find a strong structural red flag beyond the Somnia score itself."
            }
          ];
      const proceedGuidance = buildProceedGuidance(finalRecommendation, intendedInteraction);

      const structuredContent = {
        targetAddress: analysis.targetAddress,
        chainName: analysis.chainName,
        somniaScore: parsedScore,
        somniaStatus: status.status,
        scoreBand: scoreProfile.band,
        scoreInterpretation: scoreProfile.interpretation,
        recommendation: finalRecommendation,
        shouldInteract: finalRecommendation === "allow",
        riskLevel: scoreProfile.riskLevel,
        riskScore: scoreProfile.riskScore,
        reasons: assessment.reasons,
        keyFindings,
        proceedGuidance,
        localHeuristicRecommendation: assessment.recommendation,
        localHeuristicRiskLevel: assessment.localRiskLevel,
        localHeuristicRiskScore: assessment.localRiskScore,
        verified: analysis.verified,
        sourceMode: analysis.contractProfile.sourceMode,
        contractName: analysis.contractProfile.name,
        compilerVersion: analysis.contractProfile.compilerVersion,
        proxyDetected: analysis.contractProfile.isProxy,
        implementationAddress: analysis.contractProfile.implementationAddress,
        retrievalMode: analysis.knowledgeBase.retrievalMode,
        recentTransactionCount: analysis.recentTransactions.length,
        privateKeySource: submission.privateKeySource,
        oracleTransactionHash: submission.transactionHash,
        ragContextUsed: analysis.analysisInputs.ragContextUsed,
        contractFunctionsUsed: analysis.analysisInputs.contractFunctionsUsed,
        recentTransactionsUsed: analysis.analysisInputs.recentTransactionsUsed,
        bytecodeSignalsUsed: analysis.analysisInputs.bytecodeSignalsUsed,
        contractContext: analysis.contractContext
      };

      return {
        content: [
          {
            type: "text",
            text: formatScoreSummary({
              targetAddress: analysis.targetAddress,
              somniaScore: status.parsedScore,
              recommendation: finalRecommendation,
              riskLevel: scoreProfile.riskLevel,
              riskScore: scoreProfile.riskScore,
              scoreBand: scoreProfile.band,
              scoreInterpretation: scoreProfile.interpretation,
              keyFindings,
              proceedGuidance
            })
          }
        ],
        structuredContent
      };
    }
  );

  return server;
}
