import type { PriceCheck, Stats, Verdict } from "./types";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

// localStorage key for the persistent session private key. Lets the same
// signer address be reused across refreshes (testnet-only — no real funds).
const PK_KEY = "priceguard_session_pk";

const env = (typeof import.meta !== "undefined" && (import.meta as any).env) || {};

// Hardcoded fallback for the deployed contract on GenLayer Studionet. The
// env var override exists for local dev / staging contracts; production
// always falls back here when no env var is set (e.g. on Vercel).
const HARDCODED_CONTRACT_ADDRESS = "0x697be330689157AA29ba9eA30666DE5Ae18C1820";

export const CONTRACT_ADDRESS: `0x${string}` =
  ((env.VITE_CONTRACT_ADDRESS as string) || HARDCODED_CONTRACT_ADDRESS) as `0x${string}`;

// MOCK_MODE is opt-in only via VITE_MOCK_MODE=true. Previously it auto-
// activated whenever the env var VITE_CONTRACT_ADDRESS was missing, which
// silently broke production deploys (Vercel without env vars) by routing
// every "submit" to a fake-transaction code path even though a real
// contract address was hardcoded above. Now: real contract always.
export const MOCK_MODE: boolean = env.VITE_MOCK_MODE === "true";

const RPC_URL: string | undefined = env.VITE_GENLAYER_RPC_URL;
const CHAIN_CONFIG = RPC_URL
  ? { ...studionet, rpcUrls: { default: { http: [RPC_URL] } } }
  : studionet;

const VERDICTS: Verdict[] = ["GREAT_DEAL", "FAIR_PRICE", "OVERPRICED", "SCAM_ALERT", "INSUFFICIENT_DATA"];

const SAMPLE_PRODUCTS = [
  { name: "Sony WH-1000XM5 Wireless Headphones", store: "Amazon", price: 329.99 },
  { name: "Apple AirPods Pro (2nd Gen)", store: "Best Buy", price: 199.0 },
  { name: "Levi's 501 Original Fit Jeans", store: "Levi.com", price: 59.5 },
  { name: "Dyson V15 Detect Cordless Vacuum", store: "Dyson", price: 749.99 },
  { name: "Generic 'iPhone 15 Pro' (suspicious listing)", store: "DealDepotXYZ", price: 199.99 },
  { name: "Nike Air Force 1 '07", store: "Nike", price: 115.0 },
  { name: "Bose QuietComfort Ultra", store: "Bose", price: 429.0 },
  { name: "LEGO Star Wars Millennium Falcon", store: "LEGO Shop", price: 849.99 },
];

const FACTORS_BY_VERDICT: Record<Verdict, string[]> = {
  GREAT_DEAL: ["below market average", "limited-time discount", "verified seller", "stock clearance"],
  FAIR_PRICE: ["matches market average", "standard MSRP", "trusted retailer"],
  OVERPRICED: ["above market average", "premium markup", "marketplace reseller"],
  SCAM_ALERT: ["unrealistically low", "unverified seller", "no return policy", "suspicious domain"],
  INSUFFICIENT_DATA: ["page blocked", "search captcha", "product not identifiable"],
};

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]!; }

function buildMockCheck(id: number, opts?: Partial<PriceCheck>): PriceCheck {
  const verdict = opts?.verdict ?? rand(VERDICTS);
  const sample = SAMPLE_PRODUCTS[id % SAMPLE_PRODUCTS.length]!;
  const fair = sample.price;
  let listed = fair;
  // Normal verdicts: high confidence (75-99). INSUFFICIENT_DATA: low (5-25)
  // mirroring what the contract emits when it can't determine the product.
  let confidence = 75 + Math.floor(Math.random() * 25);
  if (verdict === "GREAT_DEAL") listed = +(fair * (0.55 + Math.random() * 0.2)).toFixed(2);
  if (verdict === "OVERPRICED") listed = +(fair * (1.25 + Math.random() * 0.4)).toFixed(2);
  if (verdict === "SCAM_ALERT") listed = +(fair * (0.1 + Math.random() * 0.15)).toFixed(2);
  if (verdict === "INSUFFICIENT_DATA") {
    listed = 0;
    confidence = 5 + Math.floor(Math.random() * 20);
  }
  const savings =
    verdict === "INSUFFICIENT_DATA"
      ? 0
      : +(((fair - listed) / fair) * 100).toFixed(1);
  return {
    id,
    url: opts?.url ?? `https://example.com/product/${id}`,
    category: opts?.category ?? rand(["electronics", "clothing", "home", "beauty", "sports", "food"]),
    submitter: opts?.submitter ?? "0x" + Math.random().toString(16).slice(2, 10).padEnd(8, "0") + "abcd5678",
    verdict,
    confidence: opts?.confidence ?? confidence,
    product_name: opts?.product_name ?? (verdict === "INSUFFICIENT_DATA" ? "Unknown" : sample.name),
    listed_price: opts?.listed_price ?? listed,
    estimated_fair_price: verdict === "INSUFFICIENT_DATA" ? 0 : fair,
    savings_percent: savings,
    reasoning: reasoningFor(verdict, sample.name, listed, fair),
    price_factors: FACTORS_BY_VERDICT[verdict],
    store_name: opts?.store_name ?? sample.store,
    timestamp: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60),
  };
}

function reasoningFor(v: Verdict, name: string, listed: number, fair: number): string {
  switch (v) {
    case "GREAT_DEAL":
      return `AI validators reached consensus: at $${listed.toFixed(2)}, this ${name} is roughly ${(((fair - listed) / fair) * 100).toFixed(0)}% below the prevailing market price of $${fair.toFixed(2)}. Seller reputation and listing details check out — this is an authentic deal.`;
    case "FAIR_PRICE":
      return `Validators agree the listing reflects current market value. Pricing is consistent with other authorized retailers, and the seller has a clean reputation history.`;
    case "OVERPRICED":
      return `The listed price exceeds the typical market rate by a meaningful margin. While the listing appears legitimate, buyers can almost certainly find this item cheaper through alternative authorized retailers.`;
    case "SCAM_ALERT":
      return `Multiple red flags detected: pricing is dramatically below realistic market value, the seller lacks verifiable reputation signals, and listing metadata patterns match known fraudulent campaigns. Avoid this listing.`;
    case "INSUFFICIENT_DATA":
      return `Validators couldn't determine the listed or typical price for ${name} — the product page was blocked by bot detection and search results didn't surface clear pricing. Try the Manual Check tab with details you can see on the listing.`;
  }
}

// In-memory mock state
let mockChecks: PriceCheck[] = Array.from({ length: 6 }, (_, i) => buildMockCheck(i + 1));
let mockId = mockChecks.length;

function computeStats(checks: PriceCheck[]): Stats {
  const total = checks.length;
  const gd = checks.filter((c) => c.verdict === "GREAT_DEAL").length;
  const fp = checks.filter((c) => c.verdict === "FAIR_PRICE").length;
  const op = checks.filter((c) => c.verdict === "OVERPRICED").length;
  const sc = checks.filter((c) => c.verdict === "SCAM_ALERT").length;
  const ins = checks.filter((c) => c.verdict === "INSUFFICIENT_DATA").length;
  return {
    total_checks: total,
    total_great_deals: gd,
    total_fair: fp,
    total_overpriced: op,
    total_scams: sc,
    total_insufficient: ins,
    scam_rate: total ? +((sc / total) * 100).toFixed(1) : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// REAL GENLAYER INTEGRATION
// ─────────────────────────────────────────────────────────────────────

let _client: ReturnType<typeof createClient> | null = null;
let _account: ReturnType<typeof createAccount> | null = null;
let _clientWalletAddress: string | null = null;

function getAccount() {
  if (_account) return _account;
  // Persist the private key in localStorage so the same session signer is
  // reused across page refreshes. Without this, every refresh generates a
  // brand-new address and users think transactions are coming from "random
  // wallets". The key only ever pays for testnet gas; no real funds at risk.
  let pk: `0x${string}` | undefined;
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(PK_KEY);
    if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) {
      pk = stored as `0x${string}`;
    } else {
      // First time on this device — generate and persist a fresh key so the
      // same address is reused next refresh.
      pk = generatePrivateKey() as `0x${string}`;
      localStorage.setItem(PK_KEY, pk);
    }
  }
  _account = createAccount(pk);
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, _account.address);
  }
  return _account;
}

function getWalletAddress(): string | null {
  if (typeof window === "undefined") return null;
  return ((window as any).__priceguard_wallet_address as string | undefined) ?? null;
}

/** Whether the GenLayer Snap is installed in the connected wallet.
 *  Set by wallet.ts after a successful connect. When false, we sign with the
 *  local session account even if a wallet address is visible in the UI. */
function isSnapInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).__priceguard_snap_installed);
}

/** Build (or rebuild) the GenLayer client. Follows the official docs pattern:
 *  https://docs.genlayer.com/api-references/genlayer-js#using-with-a-wallet-provider-metamask
 *
 *  - Wallet connected AND Snap installed: createClient with BOTH
 *    `account: walletAddr` and `provider: window.ethereum`. The GenLayer Snap
 *    intercepts the provider's signing methods and produces GenVM-compatible
 *    signatures, so MetaMask shows a confirmation popup signed by the user.
 *  - Otherwise: createClient with the session-generated local account. */
function getClient() {
  const walletAddr = getWalletAddress();
  const mmProvider =
    typeof window !== "undefined"
      ? ((window as any).__priceguard_provider ?? (window as any).ethereum)
      : null;
  const useWallet = Boolean(walletAddr && mmProvider);
  const cacheKey = useWallet ? walletAddr! : "__session__";
  if (_client && _clientWalletAddress === cacheKey) return _client;

  if (useWallet) {
    _client = createClient({
      chain: CHAIN_CONFIG as any,
      account: walletAddr as `0x${string}`,
      provider: mmProvider,
    } as any);
  } else {
    _client = createClient({ chain: CHAIN_CONFIG as any, account: getAccount() } as any);
  }
  _clientWalletAddress = cacheKey;
  return _client;
}

/** Called by the wallet store whenever the connected address changes so the
 *  next call to getClient() rebuilds the client with the right account. */
export function setActiveWalletAddress(addr: string | null) {
  if (typeof window !== "undefined") {
    (window as any).__priceguard_wallet_address = addr;
  }
  _client = null;
  _clientWalletAddress = null;
}

/** Drop the cached client so the next getClient() builds a fresh one.
 *  Used between submissions to make sure nonce / signer state never leaks. */
function resetClient() {
  _client = null;
  _clientWalletAddress = null;
}

// Parse strings like "$29.99", "29.99 USD", "Typically $150-500+" → first number.
function parsePriceString(s: unknown): number {
  if (typeof s === "number") return s;
  if (typeof s !== "string") return 0;
  const cleaned = s.replace(/,/g, "");
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

// Normalize a check object returned by the contract into the UI-friendly PriceCheck shape.
function normalizeContractCheck(raw: any, fallbackTimestamp?: number): PriceCheck {
  // Default to INSUFFICIENT_DATA (not FAIR_PRICE) for unknown/missing verdicts
  // — we should NEVER silently claim something is "fair" when we don't know.
  const verdictRaw = String(raw?.verdict ?? "INSUFFICIENT_DATA").toUpperCase().replace(/\s+/g, "_");
  const verdict = (VERDICTS.includes(verdictRaw as Verdict) ? verdictRaw : "INSUFFICIENT_DATA") as Verdict;
  const rawConfidence = raw?.confidence;
  const confidence =
    typeof rawConfidence === "number" && Number.isFinite(rawConfidence)
      ? Math.max(0, Math.min(100, Math.round(rawConfidence)))
      : undefined;
  return {
    id: raw?.id ?? Math.floor(Math.random() * 1e9),
    url: raw?.url || undefined,
    category: String(raw?.category ?? raw?._category ?? "other"),
    submitter: String(raw?.submitter ?? "0x0000000000000000000000000000000000000000"),
    verdict,
    confidence,
    product_name: String(raw?.product_name ?? "Unknown product"),
    listed_price: parsePriceString(raw?.listed_price),
    estimated_fair_price: parsePriceString(raw?.estimated_fair_price),
    savings_percent: Number(raw?.savings_percent ?? 0),
    reasoning: String(raw?.reasoning ?? ""),
    price_factors: Array.isArray(raw?.price_factors) ? raw.price_factors.map(String) : [],
    store_name: raw?.store_name ? String(raw.store_name) : undefined,
    timestamp: raw?.timestamp ?? fallbackTimestamp ?? Date.now(),
  };
}

// Pull a string value for `key` out of a payload that may be JSON, escaped-JSON,
// or even a Python-dict literal — using a tolerant regex.
function regexExtractString(blob: string, key: string): string | undefined {
  const patterns = [
    new RegExp(`\\\\?"${key}\\\\?"\\s*:\\s*\\\\?"((?:[^"\\\\]|\\\\.)*?)\\\\?"`, "i"),
    new RegExp(`'${key}'\\s*:\\s*'((?:[^'\\\\]|\\\\.)*?)'`, "i"),
  ];
  for (const re of patterns) {
    const m = blob.match(re);
    if (m && m[1] != null) {
      return m[1].replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\");
    }
  }
  return undefined;
}

function regexExtractNumber(blob: string, key: string): number | undefined {
  const m = blob.match(new RegExp(`\\\\?"${key}\\\\?"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "i"));
  return m ? parseFloat(m[1]!) : undefined;
}

function regexExtractArray(blob: string, key: string): string[] | undefined {
  const m = blob.match(new RegExp(`\\\\?"${key}\\\\?"\\s*:\\s*\\[((?:[^\\[\\]]|\\\\.)*?)\\]`, "i"));
  if (!m) return undefined;
  const items = m[1]!.split(/\s*,\s*/).map((s) =>
    s.trim().replace(/^\\?"/, "").replace(/\\?"$/, "").replace(/\\"/g, '"'),
  ).filter(Boolean);
  return items.length ? items : undefined;
}

/** Reconstruct a verdict object from raw blob text using regexes. */
function extractVerdictFromBlob(blob: string): any | null {
  if (!/verdict/i.test(blob)) return null;
  const verdict = regexExtractString(blob, "verdict");
  if (!verdict) return null;
  return {
    verdict,
    product_name: regexExtractString(blob, "product_name") ?? "Unknown product",
    listed_price: regexExtractString(blob, "listed_price") ?? "0",
    estimated_fair_price: regexExtractString(blob, "estimated_fair_price") ?? "0",
    savings_percent: regexExtractNumber(blob, "savings_percent") ?? 0,
    reasoning: regexExtractString(blob, "reasoning") ?? "",
    price_factors: regexExtractArray(blob, "price_factors") ?? [],
    _category: regexExtractString(blob, "_category") ?? regexExtractString(blob, "category"),
  };
}

// Recursively search any nested structure for an object containing "verdict".
// Handles plain objects, escaped JSON strings, Python-dict-like blobs, and base64.
function deepFindVerdict(obj: any, depth = 0, seen = new WeakSet()): any | null {
  if (depth > 12 || obj == null) return null;

  if (typeof obj === "object") {
    if (seen.has(obj)) return null;
    seen.add(obj);
    if (!Array.isArray(obj) && (obj as any).verdict && typeof (obj as any).verdict === "string") {
      return obj;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const f = deepFindVerdict(item, depth + 1, seen);
        if (f) return f;
      }
      return null;
    }
    for (const k of Object.keys(obj)) {
      const f = deepFindVerdict((obj as any)[k], depth + 1, seen);
      if (f) return f;
    }
    return null;
  }

  if (typeof obj === "string" && obj.length > 8 && /verdict/i.test(obj)) {
    // 1. Plain JSON parse.
    try {
      const p = JSON.parse(obj);
      const f = deepFindVerdict(p, depth + 1, seen);
      if (f) return f;
    } catch { /* not JSON, try other strategies */ }

    // 2. Base64-then-JSON.
    try {
      const decoded = atob(obj);
      if (/verdict/i.test(decoded)) {
        const p = JSON.parse(decoded);
        const f = deepFindVerdict(p, depth + 1, seen);
        if (f) return f;
      }
    } catch { /* not base64 */ }

    // 3. Regex extraction — works on Python dict literals AND escaped JSON.
    const reg = extractVerdictFromBlob(obj);
    if (reg) return reg;
  }
  return null;
}

/** Fetch a GenLayer transaction by hash via the typed SDK action. */
async function fetchTransactionStatus(txHash: string): Promise<any> {
  try {
    const c: any = getClient();
    if (typeof c.getTransaction === "function") {
      return await c.getTransaction({ hash: txHash as `0x${string}` });
    }
  } catch (e: any) {
    console.log("[fetchTransactionStatus] error:", e?.message);
  }
  return null;
}

/** Extract a verdict object from a GenLayer transaction receipt's
 *  consensus_data → leader_receipt[0]. We inspect both `result` (encoded
 *  return value) and `eq_outputs` (the LLM equivalence outputs which contain
 *  the JSON our prompt produced). */
function extractVerdictFromTransaction(tx: any): any | null {
  const receipt = tx?.consensus_data?.leader_receipt?.[0];
  if (!receipt) return null;

  // Direct return value of the contract method.
  const direct = receipt.result;
  if (typeof direct === "string") {
    const v = deepFindVerdict(direct) || extractVerdictFromBlob(direct);
    if (v) return v;
  }

  // Equivalence-principle outputs (this is where gl.eq_principle.prompt() lands).
  const eq = receipt.eq_outputs;
  if (eq) {
    const values = typeof eq === "object" ? Object.values(eq) : [];
    for (const val of values) {
      if (typeof val === "string") {
        const v = deepFindVerdict(val) || extractVerdictFromBlob(val);
        if (v) return v;
      } else if (typeof val === "object") {
        const v = deepFindVerdict(val);
        if (v) return v;
      }
    }
  }

  // Last-resort: walk the whole tx.
  return deepFindVerdict(tx);
}

// Map raw GenLayer status strings to the 5-stage progress used by the UI.
function mapStatusToStage(status: string): TxStage {
  const s = String(status || "").toUpperCase();
  if (s === "ACCEPTED" || s === "FINALIZED") return "Accepted";
  if (s === "REVEALING") return "Revealing";
  if (s === "COMMITTING" || s === "COMMITTED") return "Committing";
  if (s === "PROPOSING" || s === "PROPOSED") return "Proposing";
  if (s === "UNDETERMINED") return "Revealing"; // result is available, just no quorum
  return "Pending";
}

export async function getStats(): Promise<Stats> {
  if (MOCK_MODE) { await delay(150); return computeStats(mockChecks); }
  try {
    const client = getClient();
    const data: any = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_stats",
      args: [],
      stateStatus: "accepted",
    } as any);
    return {
      total_checks: Number(data?.total_checks ?? 0),
      total_great_deals: Number(data?.total_great_deals ?? 0),
      total_fair: Number(data?.total_fair ?? 0),
      total_overpriced: Number(data?.total_overpriced ?? 0),
      total_scams: Number(data?.total_scams ?? 0),
      total_insufficient: Number(data?.total_insufficient ?? 0),
      scam_rate: Number(data?.scam_rate ?? 0),
    };
  } catch (e: any) {
    console.warn("getStats failed, returning zeros:", e?.message);
    return { total_checks: 0, total_great_deals: 0, total_fair: 0, total_overpriced: 0, total_scams: 0, total_insufficient: 0, scam_rate: 0 };
  }
}

export async function getRecentChecks(count = 20): Promise<PriceCheck[]> {
  if (MOCK_MODE) {
    await delay(200);
    return [...mockChecks].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, count);
  }
  try {
    const client = getClient();
    const data: any = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_recent_checks",
      args: [count],
      stateStatus: "accepted",
    } as any);
    if (!Array.isArray(data)) return [];
    // Contract appends in chronological order; show newest first.
    return data.slice().reverse().map((c) => normalizeContractCheck(c));
  } catch (e: any) {
    console.warn("getRecentChecks failed:", e?.message);
    return [];
  }
}

export interface SubmitOptions {
  type: "url" | "manual";
  url?: string;
  product_name?: string;
  listed_price?: number;
  store_name?: string;
  category: string;
  onStage?: (stage: TxStage, elapsed: number) => void;
  onTxHash?: (hash: string) => void;
}

export type TxStage = "Pending" | "Proposing" | "Committing" | "Revealing" | "Accepted";
const STAGES: TxStage[] = ["Pending", "Proposing", "Committing", "Revealing", "Accepted"];

async function submitPriceCheckMock(opts: SubmitOptions): Promise<{ txHash: string; check: PriceCheck }> {
  const txHash = "0x" + Math.random().toString(16).slice(2).padEnd(64, "0").slice(0, 64);
  opts.onTxHash?.(txHash);
  const start = Date.now();
  for (let i = 0; i < STAGES.length - 1; i++) {
    opts.onStage?.(STAGES[i]!, Math.floor((Date.now() - start) / 1000));
    await delay(900 + Math.random() * 700);
  }
  mockId += 1;
  const verdict = pickVerdictForInput(opts);
  const check = buildMockCheck(mockId, {
    verdict,
    url: opts.url,
    category: opts.category,
    product_name: opts.product_name,
    listed_price: opts.listed_price,
    store_name: opts.store_name,
    submitter: getSessionAddress(),
  });
  mockChecks = [check, ...mockChecks];
  opts.onStage?.("Accepted", Math.floor((Date.now() - start) / 1000));
  return { txHash, check };
}

export async function submitPriceCheck(opts: SubmitOptions): Promise<{ txHash: string; check: PriceCheck }> {
  if (MOCK_MODE) return submitPriceCheckMock(opts);

  const client = getClient();
  const start = Date.now();
  const elapsed = () => Math.floor((Date.now() - start) / 1000);
  opts.onStage?.("Pending", 0);

  // 1. Submit transaction
  const args =
    opts.type === "url"
      ? [opts.url ?? "", opts.category]
      : [opts.product_name ?? "", String(opts.listed_price ?? ""), opts.store_name ?? "", opts.category];

  const fn = opts.type === "url" ? "check_price" : "check_price_manual";

  // Force-rebuild the client between submissions so nonce/state from a prior
  // tx never leaks into the next.
  resetClient();
  const freshClient = getClient();
  const walletAddr = getWalletAddress();

  // If a wallet is connected, make sure it's on GenLayer Studionet right
  // before signing — the user might have switched chains (e.g. to Ethereum,
  // Ink, etc.) between submissions. Manual switch (no Snap required).
  if (walletAddr && typeof window !== "undefined") {
    const provider = (window as any).__priceguard_provider ?? (window as any).ethereum;
    if (provider) {
      try {
        const chainIdHex = `0x${(studionet as any).id.toString(16)}`;
        const current = (await provider.request({ method: "eth_chainId" })) as string;
        if (String(current).toLowerCase() !== chainIdHex.toLowerCase()) {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
          });
        }
      } catch (e) {
        console.warn("[submit] chain switch failed before writeContract:", e);
      }
    }
  }
  // If a wallet is connected, the client was already built with that wallet's
  // address + provider — DON'T pass `account` here, let the client use its
  // own. Only the session-key path needs the account passed explicitly.
  const writeArgs: any = {
    address: CONTRACT_ADDRESS,
    functionName: fn,
    args,
    value: 0n,
  };
  if (!walletAddr) writeArgs.account = getAccount();

  console.log(
    "[submit] signer=",
    walletAddr || (writeArgs.account?.address ?? "(unknown)"),
    "wallet_connected=",
    Boolean(walletAddr),
    "contract=",
    CONTRACT_ADDRESS,
  );

  const txHash: string = (await freshClient.writeContract(writeArgs)) as unknown as string;

  console.log("[submit] txHash=", txHash);

  opts.onTxHash?.(txHash);
  opts.onStage?.("Proposing", elapsed());

  // 2. Get pre-submission stats baseline so the contract-read fallback can detect new checks.
  const baseTotal = await getStats().then((s) => s.total_checks).catch(() => 0);

  // 3. Run two strategies in parallel; first to find a result wins.
  const result = await new Promise<PriceCheck>((resolve, reject) => {
    let settled = false;
    const finish = (c: PriceCheck) => { if (!settled) { settled = true; resolve(c); } };
    const fail = (e: Error) => { if (!settled) { settled = true; reject(e); } };

    // Strategy A: poll JSON-RPC for tx data + deepFindVerdict.
    // Extended to 10 minutes — GenLayer txs that invoke gl.eq_principle.prompt()
    // (LLM-backed validators reaching consensus) can legitimately take 2-5 min
    // on Studionet during peak load.
    (async () => {
      const INTERVAL = 3000;
      const MAX = 600_000;
      const max = Math.floor(MAX / INTERVAL);
      let loggedShape = false;
      for (let i = 0; i < max && !settled; i++) {
        await delay(INTERVAL);
        try {
          const tx = await fetchTransactionStatus(txHash);
          const status = tx?.statusName || tx?.status || tx?.tx_status || "PENDING";
          opts.onStage?.(mapStatusToStage(String(status)), elapsed());
          if (!tx) continue;
          if (!loggedShape) {
            loggedShape = true;
            console.log("[strategy A] tx keys:", Object.keys(tx));
            console.log("[strategy A] statusName:", tx.statusName, "consensus_data:", !!tx.consensus_data);
            if (tx.consensus_data?.leader_receipt?.[0]) {
              const r = tx.consensus_data.leader_receipt[0];
              console.log("[strategy A] receipt keys:", Object.keys(r));
              console.log("[strategy A] execution_result:", r.execution_result);
            }
          }
          const found = extractVerdictFromTransaction(tx);
          if (found && found.verdict) {
            console.log(`[strategy A] ✓ verdict=${found.verdict} at ${elapsed()}s`);
            finish(normalizeContractCheck({
              ...found,
              url: opts.url,
              store_name: opts.store_name,
              category: opts.category,
              submitter: getActiveAddress(),
            }));
            return;
          }
        } catch (e: any) {
          console.log("[strategy A] poll error", e?.message);
        }
      }
    })();

    // Strategy B: poll get_recent_checks for new entries (catches the case
    // where the tx is ACCEPTED but its data structure doesn't yield to
    // deepFindVerdict — we just see total_checks tick up).
    (async () => {
      await delay(15_000);
      const POLL = 10_000;
      const TOTAL = 600_000; // 10 min
      const max = Math.floor(TOTAL / POLL);
      for (let i = 0; i < max && !settled; i++) {
        try {
          const stats = await getStats();
          if (stats.total_checks > baseTotal) {
            // Pull a window large enough to include every check that landed
            // since we started polling (in case the user submits multiple in
            // a row).
            const window = Math.max(5, stats.total_checks - baseTotal);
            const recent = await getRecentChecks(window);
            if (recent.length > 0) {
              // The contract returns checks oldest-first within the window,
              // so the user's just-submitted check is at the END. We also
              // require id >= baseTotal so we never accidentally surface a
              // pre-existing check (this was the root cause of users seeing
              // the wrong product's verdict).
              const myAddr = getActiveAddress().toLowerCase();
              const reversed = [...recent].reverse(); // newest first
              // Prefer: my own submission with id >= baseTotal.
              // Fallback: any submission with id >= baseTotal (handles
              // address-normalisation edge cases where the submitter string
              // doesn't compare equal — better stranding 1 in 1000 verdicts
              // by mismatching address than blocking the user forever).
              const mine =
                reversed.find(
                  (c) =>
                    Number(c?.id ?? -1) >= baseTotal &&
                    String(c?.submitter ?? "").toLowerCase() === myAddr,
                ) ||
                reversed.find((c) => Number(c?.id ?? -1) >= baseTotal);
              if (mine) {
                console.log(`[strategy B] ✓ new check on-chain (id=${mine.id}, baseTotal=${baseTotal})`);
                finish(mine as PriceCheck);
                return;
              }
              console.log(
                `[strategy B] total_checks=${stats.total_checks} but no check with id>=${baseTotal} yet, keep polling`,
              );
            }
          }
        } catch (e: any) {
          console.log("[strategy B] poll error", e?.message);
        }
        await delay(POLL);
      }
      if (!settled) {
        fail(new Error(
          "Transaction is taking longer than 10 minutes. It may still complete — " +
          "check the explorer link, and the registry will refresh automatically when validators reach consensus.",
        ));
      }
    })();
  });

  opts.onStage?.("Accepted", elapsed());
  return { txHash, check: result };
}

function pickVerdictForInput(opts: SubmitOptions): Verdict {
  if (opts.type === "manual" && opts.listed_price !== undefined) {
    if (opts.listed_price < 30) return "SCAM_ALERT";
    if (opts.listed_price > 1500) return "OVERPRICED";
  }
  if (opts.url) {
    if (/scam|cheap|deal-?depot|xyz/i.test(opts.url)) return "SCAM_ALERT";
    if (/amazon|bestbuy|apple|nike|sony/i.test(opts.url)) return Math.random() > 0.5 ? "GREAT_DEAL" : "FAIR_PRICE";
    // Unknown/obscure sites occasionally hit bot walls in real life — model that
    // in mock mode so the inconclusive path is exercised too.
    if (Math.random() < 0.15) return "INSUFFICIENT_DATA";
  }
  // Pick from the "real" verdicts; INSUFFICIENT_DATA is reserved for the URL path above.
  const real: Verdict[] = ["GREAT_DEAL", "FAIR_PRICE", "OVERPRICED", "SCAM_ALERT"];
  return rand(real);
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/** Returns the address that should be reported as transaction submitter:
 *  the connected MetaMask wallet if any, otherwise the session-generated key. */
export function getActiveAddress(): string {
  if (typeof window !== "undefined") {
    const w = (window as any).__priceguard_wallet_address as string | undefined;
    if (w) return w;
  }
  return getSessionAddress();
}

// Session "wallet"
const SESSION_KEY = "priceguard_address";
/** The actual address that signs transactions on this device. Always derived
 *  from the persistent session private key (localStorage) so it matches the
 *  `from` field that appears in the GenLayer explorer. */
export function getSessionAddress(): string {
  if (typeof window === "undefined") return "0x0000...0000";
  return getAccount().address;
}

export function truncateAddr(a: string) {
  if (!a) return "";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

// Explorer URL. Env override wins; otherwise default to the GenLayer Studio
// explorer (the chain config inside genlayer-js still points at the older
// genlayer-explorer.vercel.app, which is outdated).
const EXPLORER_BASE: string = (
  env.VITE_EXPLORER_URL ||
  "https://explorer-studio.genlayer.com"
).replace(/\/+$/, "");

export function explorerTxUrl(hash: string) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

export function explorerAddressUrl(addr: string) {
  return `${EXPLORER_BASE}/address/${addr}`;
}