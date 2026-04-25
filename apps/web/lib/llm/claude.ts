// Claude — the planner. The orchestrator calls `planGoal()` and gets a
// validated Plan back, retrying once on JSON parse / schema failures.

import Anthropic from "@anthropic-ai/sdk";
import { PlanSchema, PLANNER_SYSTEM_PROMPT, type Plan } from "@synapse/shared";

const CLAUDE_PLANNER_MODEL = "claude-sonnet-4-5-20250929";
let _client: Anthropic | null = null;

function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("[claude] Missing ANTHROPIC_API_KEY");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function planGoal(
  goal: string,
  opts?: { budgetUsdc?: number; previousFailureMsg?: string },
): Promise<Plan> {
  const userMessage = [
    `Goal: ${goal}`,
    opts?.budgetUsdc ? `Budget ceiling: ${opts.budgetUsdc} USDC` : "",
    opts?.previousFailureMsg
      ? `Your previous response was rejected: ${opts.previousFailureMsg}. Return ONLY valid JSON.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await client().messages.create({
    model: CLAUDE_PLANNER_MODEL,
    max_tokens: 1500,
    system: PLANNER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = res.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("");

  const json = extractJson(text);
  const parsed = PlanSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `[claude] Plan failed schema validation: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

/**
 * Strip code fences, leading prose, etc. Claude is usually well-behaved
 * with the system prompt above, but defense-in-depth is cheap.
 */
function extractJson(s: string): unknown {
  const trimmed = s.trim();
  // already JSON?
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  // try fenced
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return JSON.parse(fenced[1].trim());
  // best-effort: first { ... last }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
  throw new Error(`[claude] Could not extract JSON from response: ${s.slice(0, 200)}`);
}

/**
 * Narrator: takes plan + agent results + template and produces final spoken text.
 */
export async function narrate(payload: {
  goal: string;
  template: string;
  results: Record<string, { summary: string; data?: unknown }>;
  totalCostUsdc: number;
}): Promise<string> {
  const { NARRATOR_SYSTEM_PROMPT } = await import("@synapse/shared");
  const userMessage = [
    `User goal: ${payload.goal}`,
    `Narration template: ${payload.template}`,
    `Agent results JSON: ${JSON.stringify(payload.results, null, 2)}`,
    `Total cost: $${payload.totalCostUsdc.toFixed(6)} USDC`,
  ].join("\n\n");

  const res = await client().messages.create({
    model: CLAUDE_PLANNER_MODEL,
    max_tokens: 400,
    system: NARRATOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  return res.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();
}
