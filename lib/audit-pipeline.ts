import { ethers } from "ethers";
import { analyzeBytecode } from "@/lib/bytecode-analyzer";
import { buildContractContext } from "@/lib/context-builder";
import { getAddressInfo, getRecentTransactions, getSmartContract } from "@/lib/explorer";
import { buildKnowledgeBase } from "@/lib/rag";
import { getDeployedBytecode } from "@/lib/rpc";

type AnalyzeInput = {
  targetAddress: string;
  chainName?: string;
  auditFocus?: string;
};

function parseAbiFunctions(abi: string | null) {
  if (!abi) {
    return [] as Array<{
      identifier: string;
      signature: string;
      source: "verified-abi";
      stateMutability: string | null;
    }>;
  }

  try {
    const parsed = JSON.parse(abi) as Array<{
      type?: string;
      name?: string;
      inputs?: Array<{ type?: string }>;
      stateMutability?: string;
    }>;

    return parsed
      .filter((item) => item.type === "function" && item.name)
      .map((item) => {
        const inputTypes = (item.inputs ?? []).map((input) => input.type ?? "unknown").join(",");
        const signature = `${item.name}(${inputTypes})`;

        return {
          identifier: item.name as string,
          signature,
          source: "verified-abi" as const,
          stateMutability: item.stateMutability ?? null
        };
      });
  } catch {
    return [];
  }
}

function getContractFunctionsUsed(input: {
  abi: string | null;
  bytecodeAnalysis: ReturnType<typeof analyzeBytecode> | null;
}) {
  const abiFunctions = parseAbiFunctions(input.abi);
  if (abiFunctions.length > 0) {
    return abiFunctions;
  }

  return (input.bytecodeAnalysis?.selectors ?? []).map((selector) => ({
    identifier: selector.selector,
    signature: selector.signatures[0] ?? selector.selector,
    source: "bytecode-selector" as const,
    stateMutability: null
  }));
}

export async function analyzeTargetContract(input: AnalyzeInput) {
  if (!input.targetAddress || !ethers.isAddress(input.targetAddress)) {
    throw new Error("A valid target contract address is required.");
  }

  const targetAddress = ethers.getAddress(input.targetAddress);
  const chainName = input.chainName?.trim() || "Somnia Testnet";
  const auditFocus =
    input.auditFocus?.trim() ||
    "Review privilege, upgradeability, arbitrary execution, and transaction anomalies.";

  const [addressInfo, contractProfile, recentTransactions] = await Promise.all([
    getAddressInfo(targetAddress),
    getSmartContract(targetAddress),
    getRecentTransactions(targetAddress)
  ]);

  let bytecodeAnalysis = null;
  if (!contractProfile?.isVerified) {
    const bytecode = await getDeployedBytecode(targetAddress);
    bytecodeAnalysis = analyzeBytecode(bytecode);
  }

  const knowledgeBase = await buildKnowledgeBase({
    address: targetAddress,
    chainName,
    auditFocus,
    contractProfile,
    bytecodeAnalysis,
    recentTransactions,
    addressInfo
  });

  const contractContext = buildContractContext({
    address: targetAddress,
    chainName,
    auditFocus,
    contractProfile,
    bytecodeAnalysis,
    recentTransactions,
    retrievedDocuments: knowledgeBase.retrieved,
    retrievalMode: knowledgeBase.retrievalMode,
    retrievalWarning: knowledgeBase.warning
  });

  return {
    targetAddress,
    chainName,
    verified: Boolean(contractProfile?.isVerified),
    retrievalQuery: knowledgeBase.query,
    contractContext,
    contractProfile: {
      name: contractProfile?.name ?? null,
      compilerVersion: contractProfile?.compilerVersion ?? null,
      optimizationEnabled: contractProfile?.optimizationEnabled ?? null,
      optimizationRuns: contractProfile?.optimizationRuns ?? null,
      evmVersion: contractProfile?.evmVersion ?? null,
      isProxy: contractProfile?.isProxy ?? false,
      implementationAddress: contractProfile?.implementationAddress ?? null,
      sourceMode: contractProfile?.isVerified ? "verified-source" : "bytecode-fallback",
      sourceFiles: contractProfile?.isVerified
        ? 1 + (contractProfile.additionalSources.length ?? 0)
        : 0
    },
    addressInfo,
    bytecodeAnalysis,
    recentTransactions,
    analysisInputs: {
      ragContextUsed: knowledgeBase.retrieved.map((document) => ({
        id: document.id,
        title: document.title,
        category: document.category,
        score: document.score,
        text: document.text
      })),
      contractFunctionsUsed: getContractFunctionsUsed({
        abi: contractProfile?.abi ?? null,
        bytecodeAnalysis
      }),
      recentTransactionsUsed: recentTransactions,
      bytecodeSignalsUsed: bytecodeAnalysis
        ? {
            patterns: bytecodeAnalysis.patterns,
            specialFlags: bytecodeAnalysis.specialFlags,
            selectors: bytecodeAnalysis.selectors
          }
        : null,
      sourceArtifacts: contractProfile?.isVerified
        ? {
            primary: contractProfile.filePath && contractProfile.sourceCode
              ? {
                  filePath: contractProfile.filePath,
                  sourceCode: contractProfile.sourceCode
                }
              : null,
            additional: contractProfile.additionalSources
          }
        : null
    },
    knowledgeBase: {
      documentCount: knowledgeBase.documents.length,
      retrievalMode: knowledgeBase.retrievalMode,
      warning: knowledgeBase.warning,
      retrieved: knowledgeBase.preview
    }
  };
}
