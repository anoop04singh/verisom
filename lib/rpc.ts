import { ethers } from "ethers";
import { appConfig } from "@/lib/config";

export function getProvider() {
  return new ethers.JsonRpcProvider(appConfig.rpcUrl);
}

export async function getDeployedBytecode(address: string) {
  const provider = getProvider();
  const bytecode = await provider.getCode(address);

  if (!bytecode || bytecode === "0x") {
    throw new Error("No deployed bytecode found for the target address.");
  }

  return bytecode;
}
