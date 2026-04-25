import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Truncate a Stellar pubkey or tx hash for display: G...ABCD */
export function shortHash(hash: string, head = 4, tail = 4): string {
  if (!hash) return "";
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

/** Format USDC amount with up to 6 decimals, trimming trailing zeros except 2 */
export function formatUSDC(amount: number | string, opts?: { decimals?: number }): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  const d = opts?.decimals ?? 6;
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: d,
  });
}

/** Build a stellar.expert testnet URL for any tx hash */
export function stellarTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

/** Build a stellar.expert testnet URL for any account */
export function stellarAccountUrl(pubkey: string): string {
  return `https://stellar.expert/explorer/testnet/account/${pubkey}`;
}

/** Sleep helper used by mock agent endpoints to make latency visible */
export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
