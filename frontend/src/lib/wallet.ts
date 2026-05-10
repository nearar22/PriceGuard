// MetaMask wallet integration for GenLayer Studio testnet.
// Uses the MetaMask Snap that genlayer-js installs to sign GenVM transactions.

import { create } from "zustand";

type EthereumProvider = {
  isMetaMask?: boolean;
  isBraveWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isPhantom?: boolean;
  isBackpack?: boolean;
  isRabby?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

/** Identify any EVM wallet currently injected. GenLayer Studionet is an
 *  EVM-compatible chain, so any wallet that can do wallet_switchEthereumChain
 *  + eth_sendTransaction will work (MetaMask, Backpack, Phantom EVM, Rabby,
 *  Coinbase, Brave Wallet, Trust…).
 *
 *  Resolution order (so multi-wallet setups still pick a sane default):
 *    1. EIP-6963 — prefer MetaMask, then any other announced wallet
 *    2. window.ethereum.providers[] — same preference
 *    3. window.ethereum directly */
function nameForProvider(p: EthereumProvider, info?: { name?: string }): string {
  if (info?.name) return info.name;
  if (p.isMetaMask) return "MetaMask";
  if (p.isBackpack) return "Backpack";
  if (p.isPhantom) return "Phantom";
  if (p.isCoinbaseWallet) return "Coinbase Wallet";
  if (p.isBraveWallet) return "Brave Wallet";
  if (p.isRabby) return "Rabby";
  return "EVM Wallet";
}

async function findEvmProvider(): Promise<{ provider: EthereumProvider; name: string } | null> {
  if (typeof window === "undefined") return null;

  // EIP-6963: collect every announced provider, prefer MetaMask, fall back
  // to whichever is announced first.
  const announced: { info: { name?: string; rdns?: string }; provider: EthereumProvider }[] = [];
  const onAnnounce = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.provider) announced.push(detail);
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((r) => setTimeout(r, 150));
  window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);

  if (announced.length > 0) {
    const mm = announced.find(
      (a) => a.info?.rdns === "io.metamask" || /^MetaMask$/i.test(a.info?.name || ""),
    );
    const pick = mm ?? announced[0]!;
    return { provider: pick.provider, name: nameForProvider(pick.provider, pick.info) };
  }

  const eth = window.ethereum;
  if (!eth) return null;

  // Legacy multi-provider list: prefer MetaMask, fall back to first.
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    const mm = eth.providers.find((p) => p.isMetaMask);
    const pick = mm ?? eth.providers[0]!;
    return { provider: pick, name: nameForProvider(pick) };
  }

  return { provider: eth, name: nameForProvider(eth) };
}

/** Switch the wallet to GenLayer Studionet. If the chain isn't added yet,
 *  we add it first then switch. No Snap required. */
async function switchToStudionet(provider: EthereumProvider): Promise<void> {
  const { studionet } = await import("genlayer-js/chains");
  const chain: any = studionet;
  const chainIdHex = `0x${(chain.id as number).toString(16)}`;
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (String(current).toLowerCase() === chainIdHex.toLowerCase()) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (err: any) {
    // 4902 = unrecognized chain — add it then we're auto-switched.
    if (err?.code === 4902 || /unrecognized|not been added|not added/i.test(err?.message || "")) {
      const rpcUrls: string[] = chain.rpcUrls?.default?.http || [];
      // Use the current GenLayer Studio explorer (genlayer-js still ships with
      // the older genlayer-explorer.vercel.app baked in).
      const explorerUrl = "https://explorer-studio.genlayer.com";
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: chainIdHex,
          chainName: chain.name || "GenLayer Studionet",
          rpcUrls,
          nativeCurrency: chain.nativeCurrency || { name: "GLT", symbol: "GLT", decimals: 18 },
          blockExplorerUrls: [explorerUrl],
        }],
      });
    } else {
      throw err;
    }
  }
}

interface WalletState {
  address: `0x${string}` | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Internal: called when provider emits accountsChanged */
  _setAddress: (a: `0x${string}` | null) => void;
}

const STORAGE_KEY = "priceguard_wallet_connected";

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  connecting: false,
  error: null,

  _setAddress: (a) => set({ address: a }),

  connect: async () => {
    if (typeof window === "undefined") return;
    set({ connecting: true, error: null });

    // Pick whichever EVM wallet is available. GenLayer Studionet is EVM-
    // compatible, so any wallet (MetaMask, Backpack, Phantom, Rabby, Coinbase,
    // Brave, Trust…) that supports wallet_switchEthereumChain works.
    const picked = await findEvmProvider();
    if (!picked) {
      const msg =
        "No EVM wallet detected. Install MetaMask, Backpack, Rabby, or any EVM wallet, then reload the page.";
      set({ connecting: false, error: msg });
      throw new Error(msg);
    }
    const { provider, name: walletName } = picked;
    (window as any).__priceguard_provider = provider;
    (window as any).__priceguard_wallet_name = walletName;
    console.info("[wallet] selected provider:", walletName);

    // Step 1: Basic connection — always works with any EVM wallet.
    let addr: string;
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      addr = accounts?.[0] ?? "";
      if (!addr) throw new Error("No account returned by the wallet");
    } catch (e: unknown) {
      const raw = e as { code?: number; message?: string };
      let msg = raw?.message || "Wallet connection rejected";
      if (raw?.code === 4001) msg = "Connection rejected by user";
      else if (raw?.code === -32002) msg = "MetaMask is already processing a connection request — open the extension to approve it";
      console.error("[wallet] eth_requestAccounts failed:", e);
      set({ connecting: false, error: msg });
      throw new Error(msg);
    }

    // Step 2: Switch the wallet to GenLayer Studionet. We do this MANUALLY via
    //   wallet_switchEthereumChain / wallet_addEthereumChain instead of
    //   genlayer-js's client.connect(), because connect() also tries to
    //   install the GenLayer Snap (which fails on regular MetaMask without
    //   Flask). Manual switching needs no Snap and works on every MetaMask.
    try {
      await switchToStudionet(provider);
      console.info("[wallet] wallet is on GenLayer Studionet \u2014 ready to sign.");
    } catch (e: unknown) {
      const raw = e as { code?: number; message?: string };
      const msg = raw?.message || String(e);
      const userReject = raw?.code === 4001 || /reject|denied/i.test(msg);
      const userMsg = userReject
        ? "You declined to switch to GenLayer Studionet. Approve the network switch in MetaMask to continue."
        : `Couldn't switch to GenLayer Studionet: ${msg}`;
      sessionStorage.removeItem(STORAGE_KEY);
      set({ address: null, connecting: false, error: userMsg });
      throw new Error(userMsg);
    }
    (window as any).__priceguard_snap_installed = true;

    sessionStorage.setItem(STORAGE_KEY, "1");
    set({ address: addr as `0x${string}`, connecting: false, error: null });

    // Step 3: Subscribe to provider events so the UI stays in sync.
    const onAccountsChanged = (...args: unknown[]) => {
      const accs = (args[0] as string[]) ?? [];
      if (!accs[0]) {
        sessionStorage.removeItem(STORAGE_KEY);
        set({ address: null });
      } else {
        set({ address: accs[0] as `0x${string}` });
      }
    };
    const onChainChanged = () => {
      window.location.reload();
    };
    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
  },

  disconnect: () => {
    sessionStorage.removeItem(STORAGE_KEY);
    set({ address: null, error: null });
    // Note: MetaMask doesn't support programmatic disconnect; we just clear local state.
  },
}));

/** Auto-reconnect on page load if the user previously connected. */
export async function tryAutoReconnect() {
  if (typeof window === "undefined") return;
  if (!window.ethereum) return;
  if (sessionStorage.getItem(STORAGE_KEY) !== "1") return;
  try {
    const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
    if (accounts && accounts[0]) {
      useWalletStore.getState()._setAddress(accounts[0] as `0x${string}`);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function getWalletProvider(): EthereumProvider | undefined {
  return typeof window !== "undefined" ? window.ethereum : undefined;
}
