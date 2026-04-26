/**
 * POST /api/orchestrate/stream
 *
 * Server-Sent Events version of the orchestrator.
 * Emits real-time events for every stage so the client can animate
 * the agent auction, sub-delegation, payment confirmation, and narration.
 *
 * Event types (consumed by AuctionPanel + studio page):
 *   session_start | planning | plan | auction_start | candidate | winner
 *   subdelegation_start | subdelegation_candidate | subdelegation_winner
 *   subdelegation_payment | executing | payment_sending | payment_confirmed
 *   task_done | narrating | narration | done | error
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import type { Plan, Task } from "@synapse/shared";
import { AgentRequestSchema } from "@synapse/shared";
import { planGoal, narrate } from "@/lib/llm";
import { createClient } from "@supabase/supabase-js";
import { awaitConfirmation, hashRequest, payAgent, resetHorizon } from "@/lib/stellar";
import type { Database, Json } from "@/lib/supabase/types";
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { waitForApproval } from "@/lib/orchestrate/approval";

type TaskPlan = {
  task: Task;
  winner: AgentCandidate | null;
  delegation: {
    subQuery: string;
    subCap: string;
    reason: string;
    subWinner: AgentCandidate | null;
  } | null;
};

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const GAS_ONLY_AMOUNT = 0.0000001;

// Which capabilities auto-hire a helper sub-agent and why
const DELEGATION_MAP: Record<string, { subCap: string; reason: string }> = {
  flights: { subCap: "currency", reason: "flights agent hiring currency agent to convert budget to local fare prices" },
  hotels: { subCap: "weather", reason: "hotels agent hiring weather agent to verify destination conditions" },
  web_search: { subCap: "fact_check", reason: "search agent hiring fact_check agent to verify result accuracy" },
};

const RequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  goal: z.string().min(5).max(500),
  userAddress: z.string().optional(),
  budgetUsdc: z.number().positive().optional().default(0.05),
  strategy: z.enum(["balanced", "cheapest", "fastest"]).optional().default("balanced"),
});

type AgentCandidate = {
  id: string; name: string; endpoint_url: string;
  price_usdc: number; stellar_address: string;
  reputation: number; total_jobs: number; similarity: number;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) return null;
    const { data } = await res.json() as { data: Array<{ embedding: number[] }> };
    return data[0]?.embedding ?? null;
  } catch { return null; }
}

async function discoverAgents(capability: string, query: string, maxPrice: number): Promise<AgentCandidate[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const embedding = await embedText(`${capability} ${query}`);
  if (!embedding) return [];
  try {
    const { data, error } = await supabase.rpc("discover_agents", {
      query_embedding: embedding,
      capability_filter: capability,
      max_price: maxPrice,
      match_count: 3,
    });
    if (error || !data) return [];
    return (data as any[]).map(a => ({
      id: a.id, name: a.name, endpoint_url: a.endpoint_url,
      price_usdc: Number(a.price_usdc), stellar_address: a.stellar_address,
      reputation: Number(a.reputation ?? 0), total_jobs: Number(a.total_jobs ?? 0),
      similarity: Number(a.similarity ?? 0),
    }));
  } catch { return []; }
}

function rankAgents(agents: AgentCandidate[], strategy: string): AgentCandidate[] {
  return [...agents].sort((a, b) => {
    if (strategy === "cheapest") return a.price_usdc - b.price_usdc;
    if (strategy === "fastest") return b.total_jobs - a.total_jobs;
    return b.similarity - a.similarity || b.reputation - a.reputation;
  });
}

async function callAgentEndpoint(
  endpoint: string, taskId: string, capability: string, query: string,
  context: Record<string, unknown>,
): Promise<{ summary: string; data?: unknown; latency_ms?: number; model_used?: string }> {
  const req = AgentRequestSchema.parse({ task_id: taskId, capability, query, context });
  const res = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req), signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Agent ${capability} returned ${res.status}`);
  return res.json();
}

async function callLlmFallback(
  capability: string, query: string, context: Record<string, unknown>,
): Promise<{ summary: string; latency_ms: number; model_used: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { summary: `[Demo] ${capability} result for: ${query}`, latency_ms: 0, model_used: "demo" };
  const client = new Anthropic({ apiKey: key });
  const start = Date.now();
  const ctxNote = Object.keys(context).length > 0 ? `\n\nContext:\n${JSON.stringify(context, null, 2)}` : "";
  const res = await client.messages.create({
    model: "claude-sonnet-4-5-20250929", max_tokens: 600,
    system: `You are a specialized AI agent for capability: "${capability}". Execute accurately, no preamble.`,
    messages: [{ role: "user", content: `${query}${ctxNote}` }],
  });
  const summary = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map(c => c.text).join("").trim();
  return { summary, latency_ms: Date.now() - start, model_used: "claude-sonnet-4-5" };
}

// Stellar accounts use monotonically-incrementing sequence numbers. Concurrent
// payAgent calls would each read the same sequence number from Horizon, then
// the second submit would get tx_bad_seq (HTTP 400). This lock serializes all
// treasury payments so each one reads a freshly-incremented sequence.
let _paymentLock: Promise<void> = Promise.resolve();

async function submitPayment(
  sessionId: string,
  taskId: string, capability: string, query: string,
  agentId: string | null,
  result: { summary?: string; latency_ms?: number; model_used?: string },
): Promise<{ txHash: string; ledger: number | null }> {
  const treasurySecret = process.env.PLATFORM_TREASURY_SECRET;
  const treasuryPublic = process.env.PLATFORM_TREASURY_PUBLIC;
  if (!treasurySecret || !treasuryPublic) {
    return { txHash: crypto.randomBytes(32).toString("hex"), ledger: null };
  }
  const supabase = getSupabase();
  if (!supabase) return { txHash: crypto.randomBytes(32).toString("hex"), ledger: null };

  const requestPayload = { task_id: taskId, capability, query };
  const requestHash = hashRequest(requestPayload);

  // Guarantee the session row exists so the receipt FK insert never fails.
  // Uses ignoreDuplicates so an existing full session is never overwritten.
  const { error: sessGuardErr } = await supabase.from("sessions").upsert(
    { id: sessionId, goal: `${capability}: ${query}`.slice(0, 200), status: "executing" },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (sessGuardErr) {
    console.error("[submitPayment] session guard upsert failed:", sessGuardErr.message, sessGuardErr.details ?? "");
  }

  // Acquire the payment lock — wait for any in-flight payment to finish first.
  const PAY_TIMEOUT_MS = 30_000;
  const work = _paymentLock.then(async () => {
    // Retry up to 3 times on TLS / socket / sequence errors.
    let payResult: Awaited<ReturnType<typeof payAgent>> | undefined;
    const RETRY_ERR = /socket|tls|econnreset|etimedout|fetch failed|disconnected|400|bad_seq/i;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Wrap in a timeout so a hung Horizon connection doesn't stall the queue.
        payResult = await Promise.race([
          payAgent({ fromSecret: treasurySecret, toAddress: treasuryPublic, amountUsdc: GAS_ONLY_AMOUNT, requestPayload }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`[payAgent] timed out after ${PAY_TIMEOUT_MS}ms`)), PAY_TIMEOUT_MS)),
        ]);
        break;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt < 2 && RETRY_ERR.test(msg)) {
          console.warn(`[submitPayment] attempt ${attempt + 1} error (${msg}) — resetting horizon, retrying in ${(attempt + 1) * 800}ms`);
          resetHorizon();
          await new Promise(r => setTimeout(r, (attempt + 1) * 800));
        } else {
          throw err;
        }
      }
    }
    if (!payResult) throw new Error("[submitPayment] all retries exhausted");
    return payResult;
  });
  // Chain the lock: next caller waits for this work to finish, errors included.
  _paymentLock = work.then(() => {}, () => {});
  const payResult = await work;

  const confirmed = await awaitConfirmation(payResult.txHash);

  const { error: receiptErr } = await supabase.from("receipts").insert({
    session_id: sessionId,
    agent_id: agentId,
    task_id: taskId,
    amount_usdc: GAS_ONLY_AMOUNT, request_hash: requestHash,
    stellar_tx_hash: payResult.txHash,
    stellar_ledger: confirmed.ledger ?? payResult.ledger,
    from_address: payResult.fromAddress, to_address: treasuryPublic,
    status: "confirmed",
    request_payload: requestPayload as Json,
    response_payload: result as Json,
    latency_ms: result.latency_ms, model_used: result.model_used,
  } as any);

  if (receiptErr) {
    console.error("[submitPayment] receipt insert failed:", receiptErr.message, { taskId, agentId, sessionId });
  } else {
    console.log("[submitPayment] receipt saved:", { taskId, txHash: payResult.txHash, ledger: confirmed.ledger });
  }

  return { txHash: payResult.txHash, ledger: confirmed.ledger };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      const emit = (type: string, data: unknown) => {
        try {
          ctrl.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      };

      try {
        const raw = await request.json();
        const { sessionId: sid, goal, userAddress, budgetUsdc, strategy } = RequestSchema.parse(raw);
        const sessionId = sid ?? crypto.randomUUID();
        const supabase = getSupabase();

        emit("session_start", { session_id: sessionId, goal });
        emit("planning", { message: "Claude decomposing goal into parallel task groups…" });
        await sleep(200);

        let plan: Plan;
        try {
          plan = await planGoal(goal, { budgetUsdc });
        } catch {
          plan = {
            summary: goal,
            tasks: [{ id: "t1", capability: "web_search" as const, query: goal, max_price_usdc: 0.01, parallel_group: 0, depends_on: [] }],
            narration_template: "Completed: {{goal}}",
          };
        }

        emit("plan", { tasks: plan.tasks, summary: plan.summary, task_count: plan.tasks.length });

        if (supabase) {
          const { error: sessionErr } = await supabase.from("sessions").upsert({
            id: sessionId, user_address: userAddress ?? null, goal,
            budget_usdc: budgetUsdc, status: "executing",
            plan: plan as unknown as Json, transcript: { user: [goal] } as Json,
          }, { onConflict: "id" });
          if (sessionErr) {
            console.error("[orchestrate] sessions upsert failed:", sessionErr.message, sessionErr.details ?? "");
          }
        }

        const taskResults: Record<string, { summary: string; latency_ms?: number; model_used?: string }> = {};
        let totalGas = 0;

        // Group tasks by parallel_group
        const groups = new Map<number, Task[]>();
        for (const t of plan.tasks) {
          const g = t.parallel_group ?? 0;
          if (!groups.has(g)) groups.set(g, []);
          groups.get(g)!.push(t);
        }
        const sortedGroups = [...groups.entries()].sort(([a], [b]) => a - b);

        // ── PHASE 1: AUCTION (discover agents for every task, no execution yet) ──
        const taskPlans = new Map<string, TaskPlan>();

        for (const [, group] of sortedGroups) {
          await Promise.all(group.map(async (task) => {
            emit("auction_start", {
              task_id: task.id, capability: task.capability,
              title: (task as { title?: string }).title ?? task.query, query: task.query,
            });
            await sleep(500);

            const candidates = await discoverAgents(task.capability, task.query, task.max_price_usdc);
            const ranked = rankAgents(candidates, strategy);

            for (let i = 0; i < Math.min(ranked.length, 3); i++) {
              await sleep(420);
              emit("candidate", { task_id: task.id, agent: ranked[i], rank: i });
            }
            await sleep(550);
            const winner = ranked[0] ?? null;
            emit("winner", { task_id: task.id, agent: winner, fallback: !winner });
            await sleep(300);

            // Sub-delegation discovery
            let delegation: TaskPlan["delegation"] = null;
            const delegInfo = DELEGATION_MAP[task.capability];
            if (delegInfo) {
              const subQuery = `Context for "${task.query}" — provide ${delegInfo.subCap} data relevant to this request.`;
              emit("subdelegation_start", {
                parent_task_id: task.id, parent_capability: task.capability,
                sub_capability: delegInfo.subCap, reason: delegInfo.reason,
              });
              await sleep(400);
              const subCandidates = await discoverAgents(delegInfo.subCap, subQuery, 0.01);
              const subRanked = rankAgents(subCandidates, strategy);
              for (let i = 0; i < Math.min(subRanked.length, 2); i++) {
                await sleep(380);
                emit("subdelegation_candidate", {
                  parent_task_id: task.id, sub_capability: delegInfo.subCap, agent: subRanked[i], rank: i,
                });
              }
              await sleep(480);
              const subWinner = subRanked[0] ?? null;
              emit("subdelegation_winner", {
                parent_task_id: task.id, sub_capability: delegInfo.subCap, agent: subWinner,
              });
              delegation = { subQuery, subCap: delegInfo.subCap, reason: delegInfo.reason, subWinner };
            }

            taskPlans.set(task.id, { task, winner, delegation });
          }));
        }

        // ── PAYMENT APPROVAL GATE ─────────────────────────────────────────────
        const allPlans = [...taskPlans.values()];
        const totalPayments =
          allPlans.length +
          allPlans.filter(tp => tp.delegation?.subWinner).length;
        const totalXlm = totalPayments * GAS_ONLY_AMOUNT;

        emit("payment_approval_required", {
          session_id: sessionId,
          agents: allPlans.map(tp => ({
            task_id: tp.task.id,
            capability: tp.task.capability,
            agent_name: tp.winner?.name ?? "Claude (fallback)",
            agent_address: tp.winner?.stellar_address ?? null,
            amount_xlm: GAS_ONLY_AMOUNT,
            sub_agent: tp.delegation?.subWinner
              ? { capability: tp.delegation.subCap, name: tp.delegation.subWinner.name, amount_xlm: GAS_ONLY_AMOUNT }
              : null,
          })),
          total_xlm: totalXlm,
          total_payments: totalPayments,
        });

        const approved = await waitForApproval(sessionId, 120_000);
        if (!approved) {
          emit("error", { message: "Payment not approved. Session cancelled." });
          return;
        }
        emit("payment_approved", { session_id: sessionId });

        // ── PHASE 2: EXECUTE + PAY ────────────────────────────────────────────
        for (const [, group] of sortedGroups) {
          await Promise.all(group.map(async (task) => {
            const tp = taskPlans.get(task.id)!;
            const { winner, delegation } = tp;

            const ctx: Record<string, unknown> = {};
            for (const depId of task.depends_on) {
              if (taskResults[depId]) ctx[depId] = taskResults[depId];
            }

            // Execute + pay subdelegation first (its result feeds into main task context)
            if (delegation?.subWinner) {
              const { subWinner, subQuery, subCap } = delegation;
              let subResult: { summary: string; latency_ms?: number; model_used?: string };
              try {
                subResult = await callAgentEndpoint(subWinner.endpoint_url, `${task.id}_sub`, subCap, subQuery, ctx);
              } catch {
                subResult = await callLlmFallback(subCap, subQuery, ctx);
              }
              emit("subdelegation_payment", { parent_task_id: task.id, sub_capability: subCap, status: "sending" });
              const subPay = await submitPayment(sessionId, `${task.id}_sub_${subCap}`, subCap, subQuery, subWinner.id, subResult);
              totalGas += GAS_ONLY_AMOUNT;
              emit("subdelegation_payment", {
                parent_task_id: task.id, sub_capability: subCap,
                status: "confirmed", tx_hash: subPay.txHash, ledger: subPay.ledger,
                explorer_url: `https://stellar.expert/explorer/testnet/tx/${subPay.txHash}`,
              });
              ctx[`${subCap}_context`] = subResult.summary;
            }

            // Execute main task
            emit("executing", { task_id: task.id, agent_name: winner?.name ?? "Claude (fallback)" });
            let result: { summary: string; latency_ms?: number; model_used?: string };
            if (winner) {
              try { result = await callAgentEndpoint(winner.endpoint_url, task.id, task.capability, task.query, ctx); }
              catch { result = await callLlmFallback(task.capability, task.query, ctx); }
            } else {
              result = await callLlmFallback(task.capability, task.query, ctx);
            }
            taskResults[task.id] = result;

            // Pay
            emit("payment_sending", {
              task_id: task.id,
              note: "Gas-only self-payment · request hash in memo",
            });
            const pay = await submitPayment(sessionId, task.id, task.capability, task.query, winner?.id ?? null, result);
            totalGas += GAS_ONLY_AMOUNT;
            emit("payment_confirmed", {
              task_id: task.id, tx_hash: pay.txHash, ledger: pay.ledger,
              explorer_url: `https://stellar.expert/explorer/testnet/tx/${pay.txHash}`,
            });
            emit("task_done", { task_id: task.id, summary: result.summary, latency_ms: result.latency_ms });
          }));
        }

        // ── NARRATION ─────────────────────────────────────────────────────────
        emit("narrating", { message: "Synthesising narration…" });
        let narration = "";
        try {
          narration = await narrate({ goal, template: plan.narration_template, results: taskResults, totalCostUsdc: totalGas });
        } catch {
          narration = `Completed: ${goal}. Total gas: ${totalGas.toFixed(6)} XLM across ${plan.tasks.length} tasks.`;
        }
        emit("narration", { text: narration });

        if (supabase) {
          await supabase.from("sessions").update({
            status: "done", total_cost_usdc: totalGas,
            narration_text: narration, completed_at: new Date().toISOString(),
          }).eq("id", sessionId);
        }

        emit("done", {
          session_id: sessionId, total_gas_fees: totalGas,
          tasks_completed: plan.tasks.length,
          proof_url: `/proof/${sessionId}`,
        });

      } catch (err) {
        emit("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
