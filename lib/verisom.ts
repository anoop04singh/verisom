import { ethers } from "ethers";
import { appConfig } from "./config";
import { getProvider } from "./rpc";
import { VERISOM_ABI } from "./verisom-abi";

const STATUS_LABELS: Record<number, string> = {
  0: "None",
  1: "Pending",
  2: "Success",
  3: "Failed",
  4: "TimedOut"
};

function getReadOnlyContract() {
  return new ethers.Contract(appConfig.verisomContractAddress, VERISOM_ABI, getProvider());
}

function resolvePrivateKey(privateKey?: string, allowEnvPrivateKey = false) {
  if (privateKey) {
    return {
      privateKey,
      source: "input"
    } as const;
  }

  if (allowEnvPrivateKey && appConfig.agentPrivateKey) {
    return {
      privateKey: appConfig.agentPrivateKey,
      source: "env"
    } as const;
  }

  if (!allowEnvPrivateKey) {
    throw new Error(
      "Missing private key. In HTTP mode, agents must provide their own private key through tool arguments or chat-provided input."
    );
  }

  throw new Error(
    "Missing private key. Configure AGENT_PRIVATE_KEY in the agent connector environment or pass privateKey in the tool call."
  );
}

function getWritableContract(privateKey?: string, allowEnvPrivateKey = false) {
  const resolved = resolvePrivateKey(privateKey, allowEnvPrivateKey);
  const wallet = new ethers.Wallet(resolved.privateKey, getProvider());

  return {
    contract: new ethers.Contract(appConfig.verisomContractAddress, VERISOM_ABI, wallet),
    privateKeySource: resolved.source
  };
}

export async function submitVerisomRequest(input: {
  targetAddress: string;
  chainName: string;
  contractContext: string;
  privateKey?: string;
  allowEnvPrivateKey?: boolean;
}) {
  if (!ethers.isAddress(input.targetAddress)) {
    throw new Error("A valid target contract address is required.");
  }

  const { contract, privateKeySource } = getWritableContract(
    input.privateKey,
    input.allowEnvPrivateKey ?? false
  );
  const requiredDeposit = (await contract.getRequiredDeposit()) as bigint;
  const transaction = await contract.requestSafetyScore(
    ethers.getAddress(input.targetAddress),
    input.chainName,
    input.contractContext,
    {
      value: requiredDeposit
    }
  );

  const receipt = await transaction.wait();
  if (!receipt) {
    throw new Error("Transaction receipt was not returned.");
  }

  let requestId: bigint | null = null;

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "SafetyScoreRequested") {
        requestId = parsed.args.requestId as bigint;
        break;
      }
    } catch {
      // Ignore logs from other contracts.
    }
  }

  if (!requestId) {
    throw new Error("Could not parse SafetyScoreRequested from the receipt.");
  }

  return {
    requestId: requestId.toString(),
    transactionHash: transaction.hash,
    blockNumber: receipt.blockNumber,
    requiredDepositWei: requiredDeposit.toString(),
    privateKeySource
  };
}

export async function readVerisomRequestStatus(input: {
  requestId: string;
  startBlock?: number;
}) {
  const contract = getReadOnlyContract();
  const provider = getProvider();
  const requestId = BigInt(input.requestId);

  const [job, latestBlock] = await Promise.all([
    contract.auditJobs(requestId),
    provider.getBlockNumber()
  ]);

  let event: { transactionHash: string; blockNumber: number } | null = null;

  if (typeof input.startBlock === "number") {
    const events = await contract.queryFilter(
      contract.filters.SafetyScoreReceived(requestId),
      input.startBlock,
      latestBlock
    );

    if (events.length > 0) {
      const latestEvent = events[events.length - 1];
      event = {
        transactionHash: latestEvent.transactionHash,
        blockNumber: latestEvent.blockNumber
      };
    }
  }

  return {
    requestId: requestId.toString(),
    completed: Boolean(job.completed),
    status: STATUS_LABELS[Number(job.status)] ?? Number(job.status).toString(),
    rawScore: job.rawScore as string,
    parsedScore: (job.parsedScore as bigint).toString(),
    event
  };
}

export async function waitForVerisomRequestCompletion(input: {
  requestId: string;
  startBlock?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}) {
  const timeoutMs = input.timeoutMs ?? 10 * 60 * 1000;
  const pollIntervalMs = input.pollIntervalMs ?? appConfig.pollIntervalMs;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await readVerisomRequestStatus({
      requestId: input.requestId,
      startBlock: input.startBlock
    });

    if (status.completed) {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error("Timed out waiting for the VeriSom response.");
}
