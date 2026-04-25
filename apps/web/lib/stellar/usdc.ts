// Test-USDC asset helpers. Issued by us on testnet, mirrors the
// shape (4-letter alphanum) of mainnet USDC so judges' mental model
// transfers cleanly.

import { Asset } from "@stellar/stellar-sdk";
import { stellarEnv } from "./env";

let _asset: Asset | null = null;

export function usdcAsset(): Asset {
  if (!_asset) {
    _asset = new Asset(stellarEnv.usdcAssetCode, stellarEnv.usdcIssuerPublic);
  }
  return _asset;
}

/**
 * Read a USDC balance (as a number) for a given public key.
 * Returns 0 if the account has no USDC trustline.
 */
export async function getUsdcBalance(publicKey: string): Promise<number> {
  const { horizon } = await import("./client");
  const acc = await horizon().loadAccount(publicKey);
  const balance = acc.balances.find(
    (b) =>
      b.asset_type !== "native" &&
      "asset_code" in b &&
      b.asset_code === stellarEnv.usdcAssetCode &&
      "asset_issuer" in b &&
      b.asset_issuer === stellarEnv.usdcIssuerPublic,
  );
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
  // 7 decimals max, no exponential notation
  return usdc.toFixed(7);
}
