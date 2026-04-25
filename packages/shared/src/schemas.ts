import { z } from "zod";
import { CAPABILITIES } from "./capabilities";

/**
 * Schemas shared by the planner, the orchestrator, and the UI.
 * The planner is forced to emit JSON matching `PlanSchema`; any other
 * shape is treated as a planner failure (retry once, then fail the session).
 */

const capabilityEnum = z.enum(CAPABILITIES);

// ---------------------------------------------------------------------
// PLAN — Claude's decomposition output
// ---------------------------------------------------------------------
export const TaskSchema = z.object({
  id: z.string().regex(/^t\d+$/, 'Task id must look like "t1", "t2", ...'),
  capability: capabilityEnum,
  query: z.string().min(2).max(400),
  /** Hard ceiling for this single task in USDC */
  max_price_usdc: z.number().positive().max(1).default(0.005),
  /** Task IDs whose output this depends on */
  depends_on: z.array(z.string()).default([]),
  /** Tasks with same group can execute concurrently */
  parallel_group: z.number().int().nonnegative().default(0),
});
export type Task = z.infer<typeof TaskSchema>;

export const PlanSchema = z.object({
  /**
   * One-line plain-English summary of the plan. If the planner needs
   * clarification, this string starts with "CLARIFY:" and tasks is empty.
   */
  summary: z.string().min(1),
  tasks: z.array(TaskSchema).max(6),
  /** Template for the spoken response — supports `{{t1.field}}` interpolations */
  narration_template: z.string(),
});
export type Plan = z.infer<typeof PlanSchema>;

// ---------------------------------------------------------------------
// AGENT REGISTRY
// ---------------------------------------------------------------------
export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  capability: capabilityEnum,
  endpoint_url: z.string().url(),
  price_usdc: z.number().positive(),
  stellar_address: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar pubkey"),
  reputation: z.number().min(0).max(5),
  total_jobs: z.number().int().nonnegative(),
});
export type Agent = z.infer<typeof AgentSchema>;

// ---------------------------------------------------------------------
// AGENT INVOCATION — request/response shape every agent endpoint uses
// ---------------------------------------------------------------------
export const AgentRequestSchema = z.object({
  task_id: z.string(),
  capability: capabilityEnum,
  query: z.string(),
  context: z.record(z.unknown()).optional(),
});
export type AgentRequest = z.infer<typeof AgentRequestSchema>;

export const AgentResponseSchema = z.object({
  task_id: z.string(),
  ok: z.boolean(),
  /** Plain-language summary suitable for narration */
  summary: z.string(),
  /** Structured payload for rich rendering (flights, maps, charts, etc.) */
  data: z.unknown().optional(),
  /** Latency in ms reported by the agent itself */
  latency_ms: z.number().int().nonnegative().optional(),
  /** Which model the agent ran (for the "Planned by Claude · Executed by Llama" badge) */
  model_used: z.string().optional(),
  error: z.string().optional(),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// ---------------------------------------------------------------------
// RECEIPTS — the on-chain proof contract
// ---------------------------------------------------------------------
export const ReceiptSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  task_id: z.string(),
  amount_usdc: z.number().positive(),
  request_hash: z.string().regex(/^[a-f0-9]{64}$/),
  stellar_tx_hash: z.string(),
  stellar_ledger: z.number().int().nullable(),
  from_address: z.string(),
  to_address: z.string(),
  status: z.enum(["pending", "confirmed", "failed"]),
  created_at: z.string(),
  confirmed_at: z.string().nullable().optional(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

// ---------------------------------------------------------------------
// SESSIONS — the row pulled by /sessions/[id]
// ---------------------------------------------------------------------
export const SessionStatusSchema = z.enum([
  "planning",
  "executing",
  "done",
  "failed",
  "halted",
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  user_address: z.string().nullable(),
  goal: z.string(),
  transcript: z.unknown().nullable(),
  plan: PlanSchema.nullable(),
  status: SessionStatusSchema,
  total_cost_usdc: z.number().nonnegative(),
  budget_usdc: z.number().nullable().optional(),
  duration_ms: z.number().int().nullable().optional(),
  narration_text: z.string().nullable().optional(),
  narration_audio_url: z.string().url().nullable().optional(),
  error: z.string().nullable().optional(),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
});
export type Session = z.infer<typeof SessionSchema>;

// ---------------------------------------------------------------------
// ORCHESTRATOR EVENTS — what flows over the WS to the UI
// ---------------------------------------------------------------------
export const OrchestratorEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session.created"), session_id: z.string().uuid(), goal: z.string() }),
  z.object({ type: z.literal("plan.ready"), session_id: z.string().uuid(), plan: PlanSchema }),
  z.object({
    type: z.literal("task.discovering"),
    session_id: z.string().uuid(),
    task_id: z.string(),
    capability: capabilityEnum,
  }),
  z.object({
    type: z.literal("task.matched"),
    session_id: z.string().uuid(),
    task_id: z.string(),
    agent_id: z.string().uuid(),
    agent_name: z.string(),
    price_usdc: z.number(),
  }),
  z.object({
    type: z.literal("payment.sent"),
    session_id: z.string().uuid(),
    task_id: z.string(),
    stellar_tx_hash: z.string(),
    amount_usdc: z.number(),
    from_address: z.string(),
    to_address: z.string(),
  }),
  z.object({
    type: z.literal("payment.confirmed"),
    session_id: z.string().uuid(),
    task_id: z.string(),
    stellar_ledger: z.number().int(),
  }),
  z.object({
    type: z.literal("task.executing"),
    session_id: z.string().uuid(),
    task_id: z.string(),
    model_used: z.string().optional(),
  }),
  z.object({
    type: z.literal("task.done"),
    session_id: z.string().uuid(),
    task_id: z.string(),
    response: AgentResponseSchema,
  }),
  z.object({
    type: z.literal("task.failed"),
    session_id: z.string().uuid(),
    task_id: z.string(),
    error: z.string(),
  }),
  z.object({
    type: z.literal("session.narrating"),
    session_id: z.string().uuid(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("session.done"),
    session_id: z.string().uuid(),
    duration_ms: z.number().int(),
    total_cost_usdc: z.number(),
  }),
  z.object({
    type: z.literal("session.failed"),
    session_id: z.string().uuid(),
    error: z.string(),
  }),
]);
export type OrchestratorEvent = z.infer<typeof OrchestratorEventSchema>;
