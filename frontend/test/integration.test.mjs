/**
 * Integration Test for PriceGuard on GenLayer
 *
 * Usage:
 *   Set env vars then run:
 *   VITE_CONTRACT_ADDRESS=0x... node test/integration.test.mjs
 */

import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS || "";

if (!CONTRACT_ADDRESS) {
  console.error("ERROR: Set VITE_CONTRACT_ADDRESS env var");
  process.exit(1);
}

const client = createClient({
  chain: studionet,
  account: createAccount(),
});

const PRODUCTS = [
  {
    name: "Sony PlayStation 5 Slim",
    price: "$449.99",
    store: "Best Buy",
    category: "electronics",
    expected: "FAIR_PRICE",
  },
  {
    name: "Apple AirPods Pro 2",
    price: "$29.99",
    store: "RandomShop",
    category: "electronics",
    expected: "SCAM_ALERT",
  },
  {
    name: "Samsung 55\" 4K TV",
    price: "$297.99",
    store: "Walmart",
    category: "electronics",
    expected: "GREAT_DEAL",
  },
];

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testReadMethods() {
  console.log("\n=== TESTING READ METHODS ===\n");

  try {
    const stats = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_stats",
      args: [],
      stateStatus: "accepted",
    });
    console.log("✅ get_stats:", JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error("❌ get_stats failed:", err.message);
  }

  try {
    const recent = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_recent_checks",
      args: [5],
      stateStatus: "accepted",
    });
    console.log("✅ get_recent_checks:", JSON.stringify(recent, null, 2));
  } catch (err) {
    console.error("❌ get_recent_checks failed:", err.message);
  }
}

async function testWriteMethods() {
  console.log("\n=== TESTING WRITE METHODS ===\n");

  for (const product of PRODUCTS) {
    console.log(`\nTesting: ${product.name} (${product.price})`);
    console.log(`Expected verdict: ${product.expected}`);

    try {
      const hash = await client.writeContract({
        account: client.account,
        address: CONTRACT_ADDRESS,
        functionName: "check_price_manual",
        args: [product.name, product.price, product.store, product.category],
        value: 0,
      });
      console.log(`  → Tx submitted: ${hash.slice(0, 20)}...`);

      const receipt = await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.FINALIZED,
        fullTransaction: false,
      });

      const result = receipt.result || receipt;
      console.log(`  → Result: ${JSON.stringify(result, null, 2)}`);

      if (result.verdict === product.expected) {
        console.log(`  ✅ PASS: Verdict matches expected (${product.expected})`);
      } else {
        console.log(`  ⚠️ DIFFERENT: Expected ${product.expected}, got ${result.verdict}`);
      }
    } catch (err) {
      console.error(`  ❌ FAILED: ${err.message}`);
    }

    await delay(2000); // Small delay between tests
  }
}

async function main() {
  console.log("=" .repeat(60));
  console.log("PriceGuard Integration Test");
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("Network:  ", studionet.name || "studionet");
  console.log("=" .repeat(60));

  await testReadMethods();
  await testWriteMethods();

  console.log("\n" + "=".repeat(60));
  console.log("Test complete!");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
