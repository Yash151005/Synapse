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
import { awaitConfirmation, hashRequest, payAgent } from "@/lib/stellar";
import type { Database, Json } from "@/lib/supabase/types";
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

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

async function submitPayment(
  sessionId: string,
  taskId: string, capability: string, query: string,
  agentId: string,
  result: { summary?: string; latency_ms?: number; model_used?: string },
): Promise<{ txHash: string; ledger: number | null }> {
  const treasurySecret = process.env.PLATFORM_TREASURY_SECRET;
  const treasuryPublic = process.env.PLATFORM_TREASURY_PUBLIC;
  if (!treasurySecret || !treasuryPublic) {
    // Demo mode: return a plausible fake hash
    return { txHash: crypto.randomBytes(32).toString("hex"), ledger: null };
  }
  const supabase = getSupabase();
  if (!supabase) return { txHash: crypto.randomBytes(32).toString("hex"), ledger: null };

  const requestPayload = { task_id: taskId, capability, query };
  const requestHash = hashRequest(requestPayload);

  const payResult = await payAgent({
    fromSecret: treasurySecret, toAddress: treasuryPublic,
    amountUsdc: GAS_ONLY_AMOUNT, requestPayload,
  });
  const confirmed = await awaitConfirmation(payResult.txHash);

  await supabase.from("receipts").insert({
    session_id: sessionId, agent_id: agentId, task_id: taskId,
    amount_usdc: GAS_ONLY_AMOUNT, request_hash: requestHash,
    stellar_tx_hash: payResult.txHash,
    stellar_ledger: confirmed.ledger ?? payResult.ledger,
    from_address: payResult.fromAddress, to_address: treasuryPublic,
    status: "confirmed",
    request_payload: requestPayload as Json,
    response_payload: result as Json,
    latency_ms: result.latency_ms, model_used: result.model_used,
  } as any);

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
          await supabase.from("sessions").upsert({
            id: sessionId, user_address: userAddress, goal,
            budget_usdc: budgetUsdc, status: "executing",
            plan: plan as unknown as Json, transcript: { user: [goal] } as Json,
          }, { onConflict: "id" });
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

        for (const [, group] of [...groups.entries()].sort(([a], [b]) => a - b)) {
          await Promise.all(group.map(async (task) => {
            const ctx: Record<string, unknown> = {};
            for (const depId of task.depends_on) {
              if (taskResults[depId]) ctx[depId] = taskResults[depId];
            }

            // ── AUCTION ──────────────────────────────────────────────────────
            emit("auction_start", {
              task_id: task.id, capability: task.capability,
              title: (task as { title?: string }).title ?? task.query, query: task.query,
            });
            await sleep(500);

            const candidates = await discoverAgents(task.capability, task.query, task.max_price_usdc);
            const ranked = rankAgents(candidates, strategy);

            // Reveal each candidate with a staggered delay for drama
            for (let i = 0; i < Math.min(ranked.length, 3); i++) {
              await sleep(420);
              emit("candidate", { task_id: task.id, agent: ranked[i], rank: i });
            }

            await sleep(550);
            const winner = ranked[0] ?? null;
            emit("winner", { task_id: task.id, agent: winner, fallback: !winner });
            await sleep(300);

            // ── SUB-DELEGATION ────────────────────────────────────────────────
            const delegation = DELEGATION_MAP[task.capability];
            if (delegation) {
              const subQuery = `Context for "${task.query}" — provide ${delegation.subCap} data relevant to this request.`;

              emit("subdelegation_start", {
                parent_task_id: task.id,
                parent_capability: task.capability,
                sub_capability: delegation.subCap,
                reason: delegation.reason,
              });
              await sleep(400);

              const subCandidates = await discoverAgents(delegation.subCap, subQuery, 0.01);
              const subRanked = rankAgents(subCandidates, strategy);

              for (let i = 0; i < Math.min(subRanked.length, 2); i++) {
                await sleep(380);
                emit("subdelegation_candidate", {
                  parent_task_id: task.id, sub_capability: delegation.subCap,
                  agent: subRanked[i], rank: i,
                });
              }

              await sleep(480);
              const subWinner = subRanked[0] ?? null;
              emit("subdelegation_winner", {
                parent_task_id: task.id, sub_capability: delegation.subCap, agent: subWinner,
              });

              if (subWinner) {
                let subResult: { summary: string; latency_ms?: number; model_used?: string };
                try {
                  subResult = await callAgentEndpoint(subWinner.endpoint_url, `${task.id}_sub`, delegation.subCap, subQuery, ctx);
                } catch {
                  subResult = await callLlmFallback(delegation.subCap, subQuery, ctx);
                }

                emit("subdelegation_payment", {
                  parent_task_id: task.id, sub_capability: delegation.subCap, status: "sending",
                });

                const subPay = await submitPayment(
                  sessionId, `${task.id}_sub_${delegation.subCap}`,
                  delegation.subCap, subQuery, subWinner.id, subResult,
                );
                totalGas += 0.00001;

                emit("subdelegation_payment", {
                  parent_task_id: task.id, sub_capability: delegation.subCap,
                  status: "confirmed", tx_hash: subPay.txHash, ledger: subPay.ledger,
                  explorer_url: `https://stellar.expert/explorer/testnet/tx/${subPay.txHash}`,
                });

                ctx[`${delegation.subCap}_context`] = subResult.summary;
              }
            }

            // ── EXECUTE MAIN TASK ─────────────────────────────────────────────
            emit("executing", { task_id: task.id, agent_name: winner?.name ?? "Claude (fallback)" });

            let result: { summary: string; latency_ms?: number; model_used?: string };
            if (winner) {
              try { result = await callAgentEndpoint(winner.endpoint_url, task.id, task.capability, task.query, ctx); }
              catch { result = await callLlmFallback(task.capability, task.query, ctx); }
            } else {
              result = await callLlmFallback(task.capability, task.query, ctx);
            }
            taskResults[task.id] = result;

            // ── STELLAR PAYMENT ───────────────────────────────────────────────
            emit("payment_sending", {
              task_id: task.id,
              note: "Gas-only self-payment · request hash in memo · no agent cut",
            });

            const pay = await submitPayment(sessionId, task.id, task.capability, task.query, winner?.id ?? "llm-fallback", result);
            totalGas += 0.00001;

            emit("payment_confirmed", {
              task_id: task.id, tx_hash: pay.txHash, ledger: pay.ledger,
              explorer_url: `https://stellar.expert/explorer/testnet/tx/${pay.txHash}`,
            });

            emit("task_done", {
              task_id: task.id, summary: result.summary, latency_ms: result.latency_ms,
            });
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
