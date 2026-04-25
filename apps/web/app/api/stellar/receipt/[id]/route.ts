// GET /api/stellar/receipt/[id]
// Fetch one receipt with verification metadata. Used by the session timeline
// UI to render an expandable proof block per agent payment.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { stellarTxUrl } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin()
    .from("receipts")
    .select(
      "id, session_id, agent_id, task_id, amount_usdc, request_hash, stellar_tx_hash, stellar_ledger, from_address, to_address, status, request_payload, response_payload, latency_ms, model_used, created_at, confirmed_at",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...data,
    explorer_url: stellarTxUrl(data.stellar_tx_hash),
  });
}
