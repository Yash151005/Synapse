// GET /api/stellar/fund
// Fund the platform treasury via Friendbot (testnet only).
// Safe to call repeatedly — checks balance first, skips if already funded.
// Call once before your first demo run.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HORIZON = "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";

export async function GET() {
  const publicKey = process.env.PLATFORM_TREASURY_PUBLIC;
  if (!publicKey) {
    return NextResponse.json({ error: "PLATFORM_TREASURY_PUBLIC not set" }, { status: 500 });
  }

  // Check current balance first
  try {
    const accountRes = await fetch(`${HORIZON}/accounts/${publicKey}`);
    if (accountRes.ok) {
      const account = await accountRes.json();
      const nativeBalance = account.balances?.find(
        (b: { asset_type: string; balance: string }) => b.asset_type === "native",
      )?.balance ?? "0";
      const xlm = parseFloat(nativeBalance);

      if (xlm >= 10) {
        return NextResponse.json({
          status: "already_funded",
          address: publicKey,
          balance_xlm: xlm.toFixed(7),
          message: `Treasury has ${xlm.toFixed(2)} XLM — no action needed.`,
        });
      }
    }
  } catch {
    // account not found — proceed to fund
  }

  // Fund via Friendbot
  const fbRes = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(publicKey)}`);
  if (!fbRes.ok) {
    const body = await fbRes.text();
    return NextResponse.json(
      { error: `Friendbot failed: ${body.slice(0, 200)}` },
      { status: 500 },
    );
  }

  const result = await fbRes.json();

  // Fetch updated balance
  let balance_xlm = "10000.0000000";
  try {
    const accountRes = await fetch(`${HORIZON}/accounts/${publicKey}`);
    if (accountRes.ok) {
      const account = await accountRes.json();
      balance_xlm =
        account.balances?.find(
          (b: { asset_type: string; balance: string }) => b.asset_type === "native",
        )?.balance ?? balance_xlm;
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    status: "funded",
    address: publicKey,
    balance_xlm,
    friendbot_tx: result.hash ?? result._links?.transaction?.href ?? "ok",
    explorer_url: `https://stellar.expert/explorer/testnet/account/${publicKey}`,
  });
}
