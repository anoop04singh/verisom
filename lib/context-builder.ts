import {
  BytecodeAnalysis,
  ExplorerSmartContract,
  NormalizedTransaction,
  RankedKnowledgeDocument,
  RetrievalMode
} from "./types";

type BuildContextInput = {
  address: string;
  chainName: string;
  auditFocus: string;
  contractProfile: ExplorerSmartContract | null;
  bytecodeAnalysis: BytecodeAnalysis | null;
  recentTransactions: NormalizedTransaction[];
  retrievedDocuments: RankedKnowledgeDocument[];
  retrievalMode: RetrievalMode;
  retrievalWarning?: string | null;
};

function summariseTransactions(transactions: NormalizedTransaction[]) {
  if (transactions.length === 0) {
    return "No recent transactions were returned by the explorer.";
  }

  const methodHistogram = new Map<string, number>();
  let failures = 0;

  for (const transaction of transactions) {
    methodHistogram.set(transaction.method, (methodHistogram.get(transaction.method) ?? 0) + 1);
    if (transaction.status && transaction.status !== "ok") {
      failures += 1;
    }
  }

  const topMethods = Array.from(methodHistogram.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([method, count]) => `${method}:${count}`)
    .join(", ");

  return `Recent transactions observed: ${transactions.length}. Failing transactions: ${failures}. Dominant methods: ${topMethods || "unknown"}.`;
}

export function buildContractContext(input: BuildContextInput) {
  const verified = Boolean(input.contractProfile?.isVerified && input.contractProfile.sourceCode);
  const sourceSection = verified
    ? [
        `Verified source is available.`,
        `Contract name: ${input.contractProfile?.name ?? "unknown"}.`,
        `Compiler version: ${input.contractProfile?.compilerVersion ?? "unknown"}.`,
        `Source files available: ${(input.contractProfile?.additionalSources.length ?? 0) + 1}.`
      ].join(" ")
    : [
        "Verified source is not available. Bytecode fallback was used.",
        `Bytecode size: ${input.bytecodeAnalysis?.bytecodeSize ?? 0} bytes.`,
        `Detected selector count: ${input.bytecodeAnalysis?.selectors.length ?? 0}.`,
        `Detected patterns: ${input.bytecodeAnalysis?.patterns.map((pattern) => `${pattern.standard} (${pattern.confidence}%)`).join(", ") || "none"}.`,
        `Special flags: ${input.bytecodeAnalysis?.specialFlags.join(", ") || "none"}.`
      ].join(" ");

  const retrievedEvidence = input.retrievedDocuments
    .map(
      (document, index) =>
        `[Evidence ${index + 1}] ${document.title} (${document.category}, similarity ${document.score.toFixed(3)}):\n${document.text}`
    )
    .join("\n\n");

  return [
    `Audit target: ${input.address}`,
    `Chain: ${input.chainName}`,
    `Audit focus: ${input.auditFocus}`,
    "",
    "Contract acquisition mode:",
    sourceSection,
    "",
    "Proxy / upgradeability:",
    input.contractProfile?.isProxy
      ? `Proxy indicators present. Implementation address hint: ${input.contractProfile.implementationAddress ?? "unknown"}.`
      : "No proxy indicator was surfaced by explorer metadata.",
    "",
    "Recent transaction summary:",
    summariseTransactions(input.recentTransactions),
    "",
    "Retrieval mode:",
    `Local lexical RAG retrieval was used to rank verified source, bytecode findings, metadata, and transaction evidence.${input.retrievalWarning ? ` ${input.retrievalWarning}` : ""}`,
    "",
    "Relevant retrieved evidence:",
    retrievedEvidence
  ].join("\n");
}
