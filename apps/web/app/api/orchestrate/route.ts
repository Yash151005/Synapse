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
import { createClient } from "@supabase/supabase-js";
import { executePayment, waitForConfirmation } from "@/lib/stellar";
import crypto from "node:crypto";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const OrchestrationRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  goal: z.string().min(5).max(500),
  userAddress: z.string().optional(),
  budgetUsdc: z.number().positive().optional().default(0.05),
});

type OrchestrationRequest = z.infer<typeof OrchestrationRequestSchema>;

async function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase credentials missing");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function discoverBestAgent(
  capability: string,
  maxPrice: number,
  query: string,
): Promise<{ id: string; endpoint_url: string; price_usdc: number; stellar_address: string }> {
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
    match_count: 1,
  });

  if (error || !agents || agents.length === 0) {
    throw new Error(`No agents found for ${capability}`);
  }

  const agent = agents[0];
  return {
    id: agent.id,
    endpoint_url: agent.endpoint_url,
    price_usdc: agent.price_usdc,
    stellar_address: agent.stellar_address,
  };
}

async function callAgentEndpoint(
  endpoint: string,
  taskId: string,
  capability: string,
  query: string,
  context: Record<string, unknown>,
): Promise<{ summary: string; data?: unknown; latency_ms?: number; model_used?: string }> {
  const req = AgentRequestSchema.parse({ task_id: taskId, capability, query, context });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(`Agent endpoint failed: ${res.status}`);
  }

  return res.json();
}

async function executeTaskWithPayment(
  task: Task,
  sessionId: string,
  agent: Awaited<ReturnType<typeof discoverBestAgent>>,
  agentResults: Record<string, any>,
): Promise<void> {
  const treasurySecret = process.env.PLATFORM_TREASURY_SECRET;
  if (!treasurySecret) throw new Error("PLATFORM_TREASURY_SECRET not set");

  const supabase = await getSupabase();

  // Prepare receipt data
  const requestPayload = {
    task_id: task.id,
    capability: task.capability,
    query: task.query,
  };
  const requestHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(requestPayload))
    .digest("hex");

  // Execute payment
  const paymentResult = await executePayment({
    fromSecret: treasurySecret,
    toAddress: agent.stellar_address,
    amountUsdc: agent.price_usdc,
    requestPayload,
  });

  // Wait for confirmation
  const confirmedTx = await waitForConfirmation(paymentResult.hash);

  // Insert receipt
  const { error: receiptError } = await supabase.from("receipts").insert({
    session_id: sessionId,
    agent_id: agent.id,
    task_id: task.id,
    amount_usdc: agent.price_usdc,
    request_hash: requestHash,
    stellar_tx_hash: paymentResult.hash,
    stellar_ledger: confirmedTx.ledger,
    from_address: confirmedTx.source_account,
    to_address: agent.stellar_address,
    status: "confirmed",
    request_payload: requestPayload,
    response_payload: agentResults[task.id],
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
    const { sessionId: providedSessionId, goal, userAddress, budgetUsdc } =
      OrchestrationRequestSchema.parse(body);

    const supabase = await getSupabase();
    const sessionId = providedSessionId ?? crypto.randomUUID();

    // Insert session
    const { error: sessionError } = await supabase.from("sessions").insert({
      id: sessionId,
      user_address: userAddress,
      goal,
      budget_usdc: budgetUsdc,
      status: "planning",
      transcript: { user: [goal] },
    });

    if (sessionError) throw sessionError;

    // Plan
    let plan: Plan;
    try {
      plan = await planGoal(goal, { budgetUsdc });
    } catch (err) {
      await supabase
        .from("sessions")
        .update({ status: "failed", error: String(err) })
        .eq("id", sessionId);
      throw err;
    }

    // Update session with plan
    await supabase
      .from("sessions")
      .update({ plan, status: "executing" })
      .eq("id", sessionId);

    // Execute tasks in parallel groups
    const agentResults: Record<string, any> = {};
    let totalCostUsdc = 0;
    const agents: Record<string, any> = {};

    for (const group of getParallelGroups(plan.tasks)) {
      const groupPromises = group.map(async (task) => {
        try {
          // Discover agent
          const agent = await discoverBestAgent(
            task.capability,
            task.max_price_usdc,
            task.query,
          );
          agents[task.id] = agent;

          // Call endpoint
          const result = await callAgentEndpoint(
            agent.endpoint_url,
            task.id,
            task.capability,
            task.query,
            task.depends_on
              ? { from_tasks: task.depends_on.map((id) => agentResults[id]) }
              : {},
          );

          agentResults[task.id] = result;
          totalCostUsdc += agent.price_usdc;

          // Execute payment
          await executeTaskWithPayment(task, sessionId, agent, agentResults);
        } catch (err) {
          console.error(`Task ${task.id} failed:`, err);
          agentResults[task.id] = { ok: false, error: String(err) };
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
    await supabase
      .from("sessions")
      .update({
        status: "done",
        total_cost_usdc: totalCostUsdc,
        narration_text: narrationText,
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

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
    console.error("[orchestrate]", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
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
