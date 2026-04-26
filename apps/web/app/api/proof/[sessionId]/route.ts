/**
 * GET /api/proof/[sessionId]
 *
 * Public — no auth required. Returns everything needed to render the
 * cryptographic proof page: session metadata, tasks, agent names, receipts,
 * and live Horizon verification for each Stellar tx.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type HorizonTx = {
  hash: string;
  ledger: number;
  created_at: string;
  successful: boolean;
  fee_charged: string;
  memo_type?: string;
  memo?: string;
};

async function fetchHorizonTx(hash: string): Promise<HorizonTx | null> {
  if (!hash || hash.startsWith("demo-") || hash.length !== 64) return null;
  try {
    const res = await fetch(`https://horizon-testnet.stellar.org/transactions/${hash}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<HorizonTx>;
  } catch { return null; }
}

function memoToHex(memoBase64: string): string {
  try {
    const buf = Buffer.from(memoBase64, "base64");
    return buf.toString("hex");
  } catch { return memoBase64; }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Demo mode
    return NextResponse.json({
      demo: true,
      session: { id: sessionId, goal: "Demo session — configure Supabase to see real data", status: "done", created_at: new Date().toISOString(), total_cost_usdc: 0 },
      receipts: [],
      horizon: {},
    });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [sessionRes, receiptsRes] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", sessionId).single(),
    supabase.from("receipts").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
  ]);

  if (sessionRes.error || !sessionRes.data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const receipts = receiptsRes.data ?? [];

  // Fetch Horizon data for all real tx hashes in parallel
  const horizonResults = await Promise.all(
    receipts.map(async (r) => {
      if (!r.stellar_tx_hash) return [r.id, null] as const;
      const tx = await fetchHorizonTx(r.stellar_tx_hash);
      if (!tx) return [r.id, null] as const;

      // Decode memo for proof verification
      const memoHex = tx.memo_type === "hash" && tx.memo ? memoToHex(tx.memo) : null;
      const memoMatches = memoHex ? memoHex === r.request_hash : null;

      return [r.id, { ...tx, memo_hex: memoHex, memo_matches: memoMatches }] as const;
    }),
  );

  const horizon = Object.fromEntries(horizonResults.filter(([, v]) => v !== null));

  return NextResponse.json({
    session: sessionRes.data,
    receipts,
    horizon,
  });
}
