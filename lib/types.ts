export type ExplorerSmartContract = {
  isVerified: boolean;
  name: string | null;
  compilerVersion: string | null;
  optimizationEnabled: boolean | null;
  optimizationRuns: number | null;
  evmVersion: string | null;
  abi: string | null;
  sourceCode: string | null;
  filePath: string | null;
  additionalSources: Array<{ filePath: string; sourceCode: string }>;
  isProxy: boolean;
  implementationAddress: string | null;
  deployedBytecode: string | null;
  creationBytecode: string | null;
};

export type AddressInfo = {
  creationTransactionHash: string | null;
  isContract: boolean;
  transactionCount: string | null;
};

export type NormalizedTransaction = {
  hash: string;
  method: string;
  timestamp: string | null;
  blockNumber: number | null;
  from: string | null;
  to: string | null;
  status: string | null;
  value: string | null;
};

export type BytecodeAnalysis = {
  bytecodeSize: number;
  selectors: Array<{ selector: string; signatures: string[] }>;
  patterns: Array<{ standard: string; description: string; confidence: number }>;
  specialFlags: string[];
  strings: Array<{ offset: number; text: string }>;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  category: string;
  text: string;
};

export type RankedKnowledgeDocument = KnowledgeDocument & {
  score: number;
};

export type RetrievalMode = "local-lexical-rag";
