import { BytecodeAnalysis, ExplorerSmartContract, KnowledgeDocument, NormalizedTransaction, RankedKnowledgeDocument, RetrievalMode } from "@/lib/types";
import { chunkText, excerpt } from "@/lib/utils";

type BuildKnowledgeInput = {
  address: string;
  chainName: string;
  auditFocus: string;
  contractProfile: ExplorerSmartContract | null;
  bytecodeAnalysis: BytecodeAnalysis | null;
  recentTransactions: NormalizedTransaction[];
  addressInfo: {
    creationTransactionHash: string | null;
    isContract: boolean;
    transactionCount: string | null;
  };
};

function buildDocuments(input: BuildKnowledgeInput): KnowledgeDocument[] {
  const documents: KnowledgeDocument[] = [];
  const { contractProfile, recentTransactions, bytecodeAnalysis, addressInfo } = input;

  documents.push({
    id: "overview",
    title: "Contract overview",
    category: "metadata",
    text: [
      `Target contract: ${input.address}`,
      `Chain: ${input.chainName}`,
      `Verified source available: ${Boolean(contractProfile?.isVerified)}`,
      `Contract name: ${contractProfile?.name ?? "unknown"}`,
      `Compiler version: ${contractProfile?.compilerVersion ?? "unknown"}`,
      `Proxy surface: ${contractProfile?.isProxy ? `yes (${contractProfile.implementationAddress ?? "unknown implementation"})` : "no obvious proxy surface"}`,
      `Creation transaction hash: ${addressInfo.creationTransactionHash ?? "unknown"}`,
      `Explorer transaction count: ${addressInfo.transactionCount ?? "unknown"}`
    ].join("\n")
  });

  if (contractProfile?.isVerified && contractProfile.sourceCode) {
    chunkText(contractProfile.sourceCode, 1600, 120)
      .slice(0, 8)
      .forEach((text, index) => {
        documents.push({
          id: `source-main-${index + 1}`,
          title: `Main source chunk ${index + 1}`,
          category: "verified-source",
          text
        });
      });

    contractProfile.additionalSources.slice(0, 4).forEach((source, index) => {
      documents.push({
        id: `source-extra-${index + 1}`,
        title: source.filePath,
        category: "verified-source",
        text: source.sourceCode
      });
    });
  }

  if (contractProfile?.abi) {
    documents.push({
      id: "abi",
      title: "Verified ABI",
      category: "verified-abi",
      text: contractProfile.abi
    });
  }

  if (bytecodeAnalysis) {
    documents.push({
      id: "bytecode-analysis",
      title: "Bytecode analysis",
      category: "bytecode",
      text: JSON.stringify(bytecodeAnalysis, null, 2)
    });
  }

  documents.push({
    id: "recent-transactions-summary",
    title: "Recent transaction summary",
    category: "transactions",
    text: recentTransactions
      .map(
        (transaction) =>
          `hash=${transaction.hash} method=${transaction.method} status=${transaction.status ?? "unknown"} block=${transaction.blockNumber ?? "unknown"} from=${transaction.from ?? "unknown"} to=${transaction.to ?? "unknown"} value=${transaction.value ?? "0"} timestamp=${transaction.timestamp ?? "unknown"}`
      )
      .join("\n")
  });

  recentTransactions.slice(0, 5).forEach((transaction, index) => {
    documents.push({
      id: `recent-tx-${index + 1}`,
      title: `Recent transaction ${index + 1}`,
      category: "transactions",
      text: JSON.stringify(transaction, null, 2)
    });
  });

  return documents;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((token) => token.length >= 3);
}

function rankLexically(documents: KnowledgeDocument[], query: string) {
  const queryTokens = tokenize(query);
  const queryCounts = new Map<string, number>();

  for (const token of queryTokens) {
    queryCounts.set(token, (queryCounts.get(token) ?? 0) + 1);
  }

  return documents
    .map((document) => {
      const docTokens = tokenize(`${document.title} ${document.category} ${document.text}`);
      const docCounts = new Map<string, number>();
      for (const token of docTokens) {
        docCounts.set(token, (docCounts.get(token) ?? 0) + 1);
      }

      let score = 0;
      for (const [token, count] of queryCounts.entries()) {
        const docCount = docCounts.get(token) ?? 0;
        if (docCount > 0) {
          score += Math.min(docCount, 4) * count;
        }
      }

      const titleTokens = tokenize(document.title);
      const titleOverlap = titleTokens.filter((token) => queryCounts.has(token)).length;
      score += titleOverlap * 2.5;

      if (document.category === "bytecode") {
        score += 1.5;
      }
      if (document.category === "transactions") {
        score += 1;
      }
      if (document.category === "verified-source" || document.category === "verified-abi") {
        score += 2;
      }
      if (document.category === "metadata") {
        score += 1.25;
      }

      return {
        ...document,
        score
      };
    })
    .sort((left, right) => right.score - left.score);
}

export async function buildKnowledgeBase(input: BuildKnowledgeInput) {
  const documents = buildDocuments(input);
  const query = [
    `Audit contract ${input.address} on ${input.chainName}.`,
    "Prioritize privileged access, upgradeability, arbitrary execution, asset movement, and recent transaction anomalies.",
    input.auditFocus
  ].join(" ");
  const retrievalMode: RetrievalMode = "local-lexical-rag";
  const warning = null;
  const ranked = rankLexically(documents, query);

  const retrieved = ranked.slice(0, 6);

  return {
    query,
    documents,
    retrievalMode,
    warning,
    retrieved: retrieved.map((document): RankedKnowledgeDocument => ({
      ...document
    })),
    preview: retrieved.map((document) => ({
      id: document.id,
      title: document.title,
      category: document.category,
      score: document.score,
      excerpt: excerpt(document.text)
    }))
  };
}
