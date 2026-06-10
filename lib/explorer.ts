import { getExplorerApiV2BaseUrl } from "@/lib/config";
import { AddressInfo, ExplorerSmartContract, NormalizedTransaction } from "@/lib/types";

type BlockscoutAddressResponse = {
  creation_transaction_hash?: string | null;
  is_contract?: boolean;
};

type BlockscoutCountersResponse = {
  transactions_count?: string;
};

type BlockscoutSmartContractResponse = {
  is_verified?: boolean;
  name?: string | null;
  compiler_version?: string | null;
  optimization_enabled?: boolean | null;
  optimizations_runs?: number | null;
  evm_version?: string | null;
  abi?: string | null;
  source_code?: string | null;
  file_path?: string | null;
  additional_sources?: Array<{ file_path?: string; source_code?: string }>;
  is_changed_bytecode?: boolean;
  is_fully_verified?: boolean;
  is_verified_via_sourcify?: boolean;
  is_verified_via_eth_bytecode_db?: boolean;
  minimal_proxy_address_hash?: string | null;
  external_libraries?: Array<{ name: string; address_hash: string }>;
  deployed_bytecode?: string | null;
  creation_bytecode?: string | null;
};

type BlockscoutTransactionListResponse = {
  items?: Array<{
    hash?: string;
    method?: string | null;
    timestamp?: string | null;
    block_number?: number | null;
    status?: string | null;
    value?: string | null;
    from?: { hash?: string | null };
    to?: { hash?: string | null };
  }>;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Explorer request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as T;
}

export async function getAddressInfo(address: string): Promise<AddressInfo> {
  const baseUrl = getExplorerApiV2BaseUrl();
  const [info, counters] = await Promise.all([
    fetchJson<BlockscoutAddressResponse>(`${baseUrl}/addresses/${address}`),
    fetchJson<BlockscoutCountersResponse>(`${baseUrl}/addresses/${address}/counters`)
  ]);

  return {
    creationTransactionHash: info.creation_transaction_hash ?? null,
    isContract: Boolean(info.is_contract),
    transactionCount: counters.transactions_count ?? null
  };
}

export async function getSmartContract(address: string): Promise<ExplorerSmartContract | null> {
  const baseUrl = getExplorerApiV2BaseUrl();
  const response = await fetch(`${baseUrl}/smart-contracts/${address}`, {
    cache: "no-store"
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch smart contract metadata (${response.status}).`);
  }

  const payload = (await response.json()) as BlockscoutSmartContractResponse;

  return {
    isVerified: Boolean(payload.is_verified && payload.source_code),
    name: payload.name ?? null,
    compilerVersion: payload.compiler_version ?? null,
    optimizationEnabled: payload.optimization_enabled ?? null,
    optimizationRuns: payload.optimizations_runs ?? null,
    evmVersion: payload.evm_version ?? null,
    abi: payload.abi ?? null,
    sourceCode: payload.source_code ?? null,
    filePath: payload.file_path ?? null,
    additionalSources: (payload.additional_sources ?? [])
      .filter((item) => item.file_path && item.source_code)
      .map((item) => ({
        filePath: item.file_path as string,
        sourceCode: item.source_code as string
      })),
    isProxy: Boolean(payload.minimal_proxy_address_hash),
    implementationAddress: payload.minimal_proxy_address_hash ?? null,
    deployedBytecode: payload.deployed_bytecode ?? null,
    creationBytecode: payload.creation_bytecode ?? null
  };
}

export async function getRecentTransactions(address: string, limit = 10): Promise<NormalizedTransaction[]> {
  const baseUrl = getExplorerApiV2BaseUrl();
  const payload = await fetchJson<BlockscoutTransactionListResponse>(
    `${baseUrl}/addresses/${address}/transactions`
  );

  return (payload.items ?? []).slice(0, limit).map((item) => ({
    hash: item.hash ?? "",
    method: item.method ?? "contract_call",
    timestamp: item.timestamp ?? null,
    blockNumber: item.block_number ?? null,
    from: item.from?.hash ?? null,
    to: item.to?.hash ?? null,
    status: item.status ?? null,
    value: item.value ?? null
  }));
}
