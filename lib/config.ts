const DEFAULT_RPC_URL = "https://api.infra.testnet.somnia.network";
const DEFAULT_EXPLORER_BASE_URL = "https://shannon-explorer.somnia.network";
const DEFAULT_VERISOM_CONTRACT = "0x45e89Bae0eD991b63F8988d13EcEC1Ae0eEdDA77";

export const appConfig = {
  rpcUrl: process.env.SOMNIA_RPC_URL || DEFAULT_RPC_URL,
  explorerBaseUrl: process.env.SOMNIA_EXPLORER_BASE_URL || DEFAULT_EXPLORER_BASE_URL,
  verisomContractAddress: process.env.VERISOM_CONTRACT_ADDRESS || DEFAULT_VERISOM_CONTRACT,
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY || process.env.VERISOM_PRIVATE_KEY,
  chainName: process.env.CHAIN_NAME || "Somnia Testnet",
  pollIntervalMs: Number(process.env.VERISOM_POLL_INTERVAL_MS || 5000)
};

export function getExplorerApiV2BaseUrl() {
  return `${appConfig.explorerBaseUrl.replace(/\/$/, "")}/api/v2`;
}
