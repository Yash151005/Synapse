/**
 * /api/orchestrate
 *
 * Main entry point for voice-to-execution pipeline.
 *
 * Request:
 *   { goal: string, userAddress?: string, budgetUsdc?: number }
 *
 * Response:
 *   { sessionId, plan, taskResults[], totalCost, narration }
 *
 * Side effects:
 *   1. Persist session to Supabase
 *   2. Call Claude to decompose goal into tasks
 *   3. For each task, discover best agent + call endpoint
 *   4. For each executed task, sign Stellar payment
 *   5. Update receipts table with on-chain proof
 *   6. Generate narration combining results
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PlanSchema, type Plan, type Task, AgentRequestSchema } from "@synapse/shared";
import { planGoal, narrate } from "@/lib/llm";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { awaitConfirmation, hashRequest, payAgent } from "@/lib/stellar";
import type { Database, Json } from "@/lib/supabase/types";
import crypto from "node:crypto";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const OrchestrationRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  goal: z.string().min(5).max(500),
  userAddress: z.string().optional(),
  budgetUsdc: z.number().positive().optional().default(0.05),
  strategy: z.enum(["balanced", "cheapest", "fastest"]).optional().default("balanced"),
});

type OrchestrationRequest = z.infer<typeof OrchestrationRequestSchema>;

type StrategyMode = OrchestrationRequest["strategy"];

type AgentCandidate = {
  id: string;
  endpoint_url: string;
  price_usdc: number;
  stellar_address: string;
  reputation: number;
  total_jobs: number;
  similarity: number;
};

async function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function discoverCandidateAgents(
  capability: string,
  maxPrice: number,
  query: string,
): Promise<AgentCandidate[]> {
  const supabase = await getSupabase();

  // Embed the query
  const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: query,
    }),
  });

  if (!embedRes.ok) {
    throw new Error(`Embedding failed: ${embedRes.status}`);
  }

  const { data } = (await embedRes.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  const queryEmbedding = data[0]?.embedding;

  if (!queryEmbedding) {
    throw new Error("No embedding returned");
  }

  // Use pgvector RPC to find best agent
  const { data: agents, error } = await supabase.rpc("discover_agents", {
    query_embedding: queryEmbedding,
    capability_filter: capability,
    max_price: maxPrice,
    match_count: 3,
  });

  if (error || !agents || agents.length === 0) {
    throw new Error(`No agents found for ${capability}`);
  }

  return agents.map((agent) => ({
    id: agent.id,
    endpoint_url: agent.endpoint_url,
    price_usdc: Number(agent.price_usdc),
    stellar_address: agent.stellar_address,
    reputation: Number(agent.reputation ?? 0),
    total_jobs: Number(agent.total_jobs ?? 0),
    similarity: Number(agent.similarity ?? 0),
  }));
}

function rankCandidates(candidates: AgentCandidate[], strategy: StrategyMode): AgentCandidate[] {
  const ranked = [...candidates];

  if (strategy === "cheapest") {
    ranked.sort((a, b) => a.price_usdc - b.price_usdc || b.similarity - a.similarity);
    return ranked;
  }

  if (strategy === "fastest") {
    ranked.sort((a, b) => b.total_jobs - a.total_jobs || b.reputation - a.reputation || b.similarity - a.similarity);
    return ranked;
  }

  ranked.sort((a, b) => b.similarity - a.similarity || b.reputation - a.reputation || a.price_usdc - b.price_usdc);
  return ranked;
}

async function executeWithLlm(
  capability: string,
  query: string,
  context: Record<string, unknown>,
): Promise<{ summary: string; data?: unknown; latency_ms: number; model_used: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const anthropic = new Anthropic({ apiKey });
  const start = Date.now();
  const contextNote = Object.keys(context).length > 0
    ? `\n\nContext from prior tasks:\n${JSON.stringify(context, null, 2)}`
    : "";
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 600,
    system: `You are a specialized AI agent for the capability: "${capability}". Execute the task accurately and concisely. Return only the result — no preamble.`,
    messages: [{ role: "user", content: `${query}${contextNote}` }],
  });
  const summary = res.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();
  return { summary, latency_ms: Date.now() - start, model_used: "claude-sonnet-4-5" };
}

async function callAgentEndpoint(
  endpoint: string,
  taskId: string,
  capability: string,
  query: string,
  context: Record<string, unknown>,
  retries = 2,
): Promise<{ summary: string; data?: unknown; latency_ms?: number; model_used?: string }> {
  const req = AgentRequestSchema.parse({ task_id: taskId, capability, query, context });

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });

      if (!res.ok) {
        throw new Error(`Agent endpoint failed: ${res.status}`);
      }

      return res.json();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Unknown agent call error");
}

async function executeTaskWithPayment(
  task: Task,
  sessionId: string,
  agent: AgentCandidate,
  agentResults: Record<string, any>,
): Promise<void> {
  const treasurySecret = process.env.PLATFORM_TREASURY_SECRET;
  if (!treasurySecret) return; // skip payment in demo mode

  const supabase = await getSupabase();
  if (!supabase) return;

  // Prepare receipt data
  const requestPayload = {
    task_id: task.id,
    capability: task.capability,
    query: task.query,
  };
  const requestHash = hashRequest(requestPayload);

  // Execute payment
  const paymentResult = await payAgent({
    fromSecret: treasurySecret,
    toAddress: agent.stellar_address,
    amountUsdc: agent.price_usdc,
    requestPayload,
  });

  // Wait for confirmation
  const confirmedTx = await awaitConfirmation(paymentResult.txHash);

  // Insert receipt
  const { error: receiptError } = await supabase.from("receipts").insert({
    session_id: sessionId,
    agent_id: agent.id,
    task_id: task.id,
    amount_usdc: agent.price_usdc,
    request_hash: requestHash,
    stellar_tx_hash: paymentResult.txHash,
    stellar_ledger: confirmedTx.ledger ?? paymentResult.ledger,
    from_address: paymentResult.fromAddress,
    to_address: agent.stellar_address,
    status: "confirmed",
    request_payload: requestPayload as Json,
    response_payload: agentResults[task.id] as Json,
    latency_ms: agentResults[task.id]?.latency_ms,
    model_used: agentResults[task.id]?.model_used,
  });

  if (receiptError) {
    console.error("Receipt insert failed:", receiptError);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId: providedSessionId, goal, userAddress, budgetUsdc, strategy } =
      OrchestrationRequestSchema.parse(body);

    const supabase = await getSupabase();
    const sessionId = providedSessionId ?? crypto.randomUUID();

    // Demo mode: no Supabase or external keys configured — return a plausible mock.
    if (!supabase) {
      const demoSessionId = sessionId;
      const demoTasks = [
        { id: "task-demo-01", capability: "research", query: goal, title: "Research goal", status: "done", max_price_usdc: 0.01, parallel_group: 0, depends_on: [], result: { summary: `Demo research result for: ${goal}` } },
        { id: "task-demo-02", capability: "synthesis", query: goal, title: "Synthesise findings", status: "done", max_price_usdc: 0.01, parallel_group: 1, depends_on: ["task-demo-01"], result: { summary: "Demo synthesis complete." } },
      ];
      return NextResponse.json({
        sessionId: demoSessionId,
        plan: { tasks: demoTasks, narration_template: "Demo plan for: {{goal}}" },
        tasks: demoTasks,
        totalCostUsdc: 0.02,
        narration: `[Demo mode] Completed: ${goal}. Cost: $0.020000. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable live execution.`,
      });
    }

    // Insert session
    const { error: sessionError } = await supabase.from("sessions").insert({
      id: sessionId,
      user_address: userAddress,
      goal,
      budget_usdc: budgetUsdc,
      status: "planning",
      transcript: { user: [goal] },
    });

    if (sessionError) throw new Error(sessionError.message ?? sessionError.code ?? JSON.stringify(sessionError));

    // Plan
    let plan: Plan;
    try {
      plan = await planGoal(goal, { budgetUsdc });
    } catch (err) {
      await supabase.from("sessions").update({ status: "failed", error: String(err) }).eq("id", sessionId);
      throw err;
    }

    // Update session with plan
    await supabase.from("sessions").update({ plan, status: "executing" }).eq("id", sessionId);

    // Execute tasks in parallel groups
    const agentResults: Record<string, any> = {};
    let totalCostUsdc = 0;
    const agents: Record<string, any> = {};

    for (const group of getParallelGroups(plan.tasks)) {
      const groupPromises = group.map(async (task) => {
        try {
          const taskContext = task.depends_on.length > 0
            ? { from_tasks: task.depends_on.map((id) => agentResults[id]) }
            : {};

          // Try to discover real marketplace agents first
          let result: { summary: string; data?: unknown; latency_ms?: number; model_used?: string } | null = null;
          let selectedAgent: AgentCandidate | null = null;

          try {
            const candidates = await discoverCandidateAgents(
              task.capability,
              task.max_price_usdc,
              task.query,
            );
            const ranked = rankCandidates(candidates, strategy);

            for (const candidate of ranked) {
              try {
                result = await callAgentEndpoint(
                  candidate.endpoint_url,
                  task.id,
                  task.capability,
                  task.query,
                  taskContext,
                  2,
                );
                selectedAgent = candidate;
                break;
              } catch {
                // try next candidate
              }
            }
          } catch {
            // no agents in marketplace — fall through to LLM
          }

          // Fallback: execute via Claude when no marketplace agent is available
          if (!result) {
            result = await executeWithLlm(task.capability, task.query, taskContext);
            totalCostUsdc += 0.001; // nominal LLM cost
          } else if (selectedAgent) {
            agents[task.id] = selectedAgent;
            totalCostUsdc += selectedAgent.price_usdc;
            await executeTaskWithPayment(task, sessionId, selectedAgent, agentResults);
          }

          agentResults[task.id] = result;
        } catch (err) {
          console.error(`Task ${task.id} failed:`, err);
          agentResults[task.id] = { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      });

      await Promise.all(groupPromises);
    }

    // Generate narration
    let narrationText = "";
    try {
      narrationText = await narrate({
        goal,
        template: plan.narration_template,
        results: agentResults,
        totalCostUsdc,
      });
    } catch (err) {
      console.warn("Narration generation failed:", err);
      narrationText = `Completed: ${goal}. Cost: $${totalCostUsdc.toFixed(6)}.`;
    }

    // Update session as done
    await supabase.from("sessions").update({
      status: "done",
      total_cost_usdc: totalCostUsdc,
      narration_text: narrationText,
      completed_at: new Date().toISOString(),
    }).eq("id", sessionId);

    return NextResponse.json({
      sessionId,
      plan,
      tasks: plan.tasks.map((t) => ({
        ...t,
        result: agentResults[t.id],
      })),
      totalCostUsdc,
      narration: narrationText,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : typeof err === "object" && err !== null ? JSON.stringify(err) : String(err);
    console.error("[orchestrate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function getParallelGroups(tasks: Task[]): Task[][] {
  const groups: Map<number, Task[]> = new Map();
  for (const task of tasks) {
    const group = task.parallel_group ?? 0;
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(task);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([, tasks]) => tasks);
}
