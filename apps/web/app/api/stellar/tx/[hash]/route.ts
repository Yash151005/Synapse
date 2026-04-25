// GET /api/stellar/tx/[hash]
// Proxies Horizon testnet so the browser doesn't need to worry about CORS
// or the Horizon URL changing. Also normalises the response shape.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HORIZON = "https://horizon-testnet.stellar.org";

export type HorizonTxResponse = {
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  fee_xlm: string;
  fee_charged_stroops: number;
  successful: boolean;
  memo_type: string;
  memo_hex: string | null;   // raw memo decoded to hex (for request_hash comparison)
  operation_count: number;
  explorer_url: string;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;

  if (!hash || !/^[a-fA-F0-9]{64}$/.test(hash)) {
    return NextResponse.json({ error: "Invalid tx hash" }, { status: 400 });
  }

  try {
    const res = await fetch(`${HORIZON}/transactions/${hash}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Horizon returned ${res.status}` },
        { status: res.status },
      );
    }

    const tx = await res.json();

    // Decode memo to hex for client-side request_hash comparison.
    // The orchestrator stores sha256(request_payload) as hex in request_hash
    // and builds Memo.hash(Buffer.from(requestHash, 'hex')). Horizon returns
    // that memo as base64 of the same raw bytes.
    let memo_hex: string | null = null;
    if (tx.memo_type === "hash" && tx.memo) {
      const bytes = Buffer.from(tx.memo, "base64");
      memo_hex = bytes.toString("hex");
    }

    const body: HorizonTxResponse = {
      hash: tx.hash,
      ledger: tx.ledger,
      created_at: tx.created_at,
      source_account: tx.source_account,
      fee_charged_stroops: parseInt(tx.fee_charged, 10),
      fee_xlm: (parseInt(tx.fee_charged, 10) / 10_000_000).toFixed(7),
      successful: tx.successful,
      memo_type: tx.memo_type ?? "none",
      memo_hex,
      operation_count: tx.operation_count ?? 1,
      explorer_url: `https://stellar.expert/explorer/testnet/tx/${tx.hash}`,
    };

    return NextResponse.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
