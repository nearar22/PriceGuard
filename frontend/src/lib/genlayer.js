import { createClient } from "genlayer-js";

// GenLayer Studio Network config
const CHAIN_CONFIG = {
  chainId: 61999,
  rpcUrl: "https://studio.genlayer.com/api",
};

// Will be set after deployment — paste your deployed address here
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";

let client = null;

export function getClient() {
  if (!client) {
    client = createClient({
      endpoint: CHAIN_CONFIG.rpcUrl,
    });
  }
  return client;
}

export function getContractAddress() {
  return CONTRACT_ADDRESS;
}

export async function callContractWrite(method, args = []) {
  const c = getClient();
  const result = await c.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
  });
  return result;
}

export async function callContractRead(method, args = []) {
  const c = getClient();
  const result = await c.readContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
  });
  return result;
}

export async function waitForTransaction(hash) {
  const c = getClient();
  return await c.waitForTransactionReceipt({ hash });
}

export { CHAIN_CONFIG };
