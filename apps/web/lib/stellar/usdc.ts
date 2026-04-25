// Native testnet XLM helpers. The file name stays stable to avoid
// a broad import churn while the settlement asset switches to XLM.

import { Asset } from "@stellar/stellar-sdk";

let _asset: Asset | null = null;

export function usdcAsset(): Asset {
  if (!_asset) {
    _asset = Asset.native();
  }
  return _asset;
}

/**
 * Read an XLM balance (as a number) for a given public key.
 */
export async function getUsdcBalance(publicKey: string): Promise<number> {
  const { horizon } = await import("./client");
  const acc = await horizon().loadAccount(publicKey);
  const balance = acc.balances.find((b) => b.asset_type === "native");
  return balance ? Number(balance.balance) : 0;
}

/**
 * Stellar amounts must be strings with at most 7 decimals. Anything beyond
 * gets rejected by Horizon. This normalizer is the canonical converter.
 */
export function toStellarAmount(usdc: number): string {
  if (!Number.isFinite(usdc) || usdc <= 0) {
    throw new Error(`[usdc] Invalid amount: ${usdc}`);
  }
  return usdc.toFixed(7);
}
