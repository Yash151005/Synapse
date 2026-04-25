// POST /api/stellar/pay
// Pays an agent in USDC on Stellar testnet, persists a receipt with the
// canonical request hash bound to the on-chain memo, and returns the tx.
//
// Body: { sessionId, agentId, taskId, amountUsdc, requestPayload, agentAddress, fromSecret? }
// - fromSecret defaults to the platform treasury (guest mode).
// - In Freighter mode, the orchestrator builds the tx, signs in-browser,
//   and posts the SIGNED XDR via /api/stellar/submit instead.

import { NextResponse } from "next/server";
import { z } from "zod";
import { payAgent, awaitConfirmation, hashRequest } from "@/lib/stellar";
import { stellarEnv } from "@/lib/stellar/env";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs"; // Stellar SDK is node-only

const Body = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  taskId: z.string().min(1),
  amountUsdc: z.number().positive().max(1),
  agentAddress: z.string().regex(/^G[A-Z2-7]{55}$/),
  requestPayload: z.unknown(),
  /** Optional: override source. Default = platform treasury. */
  fromSecret: z.string().optional(),
  /** Optional: model used by the agent, threaded into the receipt for analytics. */
  modelUsed: z.string().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body", details: String(e) }, { status: 400 });
  }

  const fromSecret = body.fromSecret ?? stellarEnv.treasurySecret;
  const requestHash = hashRequest(body.requestPayload);
  const supabase = supabaseAdmin();

  // 1. Insert pending receipt up-front so the UI gets the row immediately
  //    via Realtime, even before Horizon confirms.
  const { data: pendingReceipt, error: insertErr } = await supabase
    .from("receipts")
    .insert({
      session_id: body.sessionId,
      agent_id: body.agentId,
      task_id: body.taskId,
      amount_usdc: body.amountUsdc,
      request_hash: requestHash,
      stellar_tx_hash: "PENDING",
      stellar_ledger: null,
      from_address: "PENDING",
      to_address: body.agentAddress,
      status: "pending",
      request_payload: body.requestPayload as never,
      model_used: body.modelUsed ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !pendingReceipt) {
    return NextResponse.json(
      { error: "Failed to insert receipt", details: insertErr?.message },
      { status: 500 },
    );
  }

  // 2. Submit the payment.
  let result: Awaited<ReturnType<typeof payAgent>>;
  try {
    result = await payAgent({
      fromSecret,
      toAddress: body.agentAddress,
      amountUsdc: body.amountUsdc,
      requestPayload: body.requestPayload,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("receipts")
      .update({ status: "failed", stellar_tx_hash: "ERROR" })
      .eq("id", pendingReceipt.id);
    return NextResponse.json({ error: "Payment failed", details: msg }, { status: 502 });
  }

  // 3. Update receipt with the real on-chain tx data.
  const { error: updateErr } = await supabase
    .from("receipts")
    .update({
      stellar_tx_hash: result.txHash,
      stellar_ledger: result.ledger,
      from_address: result.fromAddress,
      to_address: result.toAddress,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", pendingReceipt.id);

  if (updateErr) {
    return NextResponse.json(
      { error: "Receipt persistence failed", txHash: result.txHash, details: updateErr.message },
      { status: 500 },
    );
  }

  // 4. Best-effort confirmation poll (non-blocking for the demo).
  awaitConfirmation(result.txHash).catch(() => {});

  return NextResponse.json({
    ok: true,
    receiptId: pendingReceipt.id,
    txHash: result.txHash,
    ledger: result.ledger,
    requestHash,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${result.txHash}`,
  });
}
