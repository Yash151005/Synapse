import type { Json } from "@/lib/supabase/types";

export type SessionTaskSummary = {
  id: string;
  title: string;
  capability: string;
  agent: string;
  confidence: number;
  costUsdc: number;
  status: "done" | "running" | "held" | "failed";
  risk: "low" | "medium" | "high";
};

export type SessionSummaryView = {
  id: string;
  goal: string;
  status: "planning" | "executing" | "done" | "failed" | "halted";
  totalCostUsdc: number;
  receiptCount: number;
  createdAt: string;
  completedAt: string | null;
  narration: string;
  strategy: "balanced" | "cheapest" | "fastest";
  riskScore: number;
  tasks: SessionTaskSummary[];
};

type SessionRow = {
  id: string;
  goal: string;
  status: "planning" | "executing" | "done" | "failed" | "halted";
  total_cost_usdc: number | string | null;
  plan: Json | null;
  narration_text: string | null;
  created_at: string;
  completed_at: string | null;
};

function toTitle(task: Record<string, unknown>) {
  const query = typeof task.query === "string" ? task.query : "Untitled task";
  return query.length > 84 ? `${query.slice(0, 84)}...` : query;
}

function toRisk(costUsdc: number): "low" | "medium" | "high" {
  if (costUsdc >= 0.005) return "high";
  if (costUsdc >= 0.002) return "medium";
  return "low";
}

function asTaskRecord(task: Json): Record<string, Json | undefined> | null {
  return task && typeof task === "object" && !Array.isArray(task)
    ? (task as Record<string, Json | undefined>)
    : null;
}

export function summarizePlanTasks(plan: Json | null, sessionStatus: SessionSummaryView["status"]): SessionTaskSummary[] {
  if (!plan || typeof plan !== "object" || !("tasks" in plan) || !Array.isArray(plan.tasks)) {
    return [];
  }

  return plan.tasks
    .map(asTaskRecord)
    .filter((task): task is Record<string, Json | undefined> => task !== null)
    .map((task, index) => {
      const costUsdc = Number(task.max_price_usdc ?? 0);
      const status: SessionTaskSummary["status"] =
        sessionStatus === "done"
          ? "done"
          : sessionStatus === "failed"
            ? "failed"
            : index === 0
              ? "running"
              : "held";

      return {
        id: typeof task.id === "string" ? task.id : `task-${index + 1}`,
        title: toTitle(task),
        capability: typeof task.capability === "string" ? task.capability : "unknown",
        agent: "Assigned during execution",
        confidence: sessionStatus === "done" ? 92 : 74,
        costUsdc,
        status,
        risk: toRisk(costUsdc),
      };
    });
}

export function deriveStrategy(plan: Json | null): SessionSummaryView["strategy"] {
  if (!plan || typeof plan !== "object" || !("tasks" in plan) || !Array.isArray(plan.tasks)) {
    return "balanced";
  }
  const costs = plan.tasks
    .map(asTaskRecord)
    .filter((task): task is Record<string, Json | undefined> => task !== null)
    .map((task) => Number(task.max_price_usdc ?? 0))
    .filter((value) => Number.isFinite(value));

  if (costs.length === 0) return "balanced";
  const maxCost = Math.max(...costs);
  const minCost = Math.min(...costs);
  if (maxCost <= 0.002) return "cheapest";
  if (minCost >= 0.004) return "fastest";
  return "balanced";
}

export function toSessionSummaryView(
  session: SessionRow,
  receiptCount: number,
): SessionSummaryView {
  const tasks = summarizePlanTasks(session.plan, session.status);
  const totalCostUsdc = Number(session.total_cost_usdc ?? 0);

  return {
    id: session.id,
    goal: session.goal,
    status: session.status,
    totalCostUsdc,
    receiptCount,
    createdAt: session.created_at,
    completedAt: session.completed_at,
    narration: session.narration_text ?? "Session completed without a narration payload.",
    strategy: deriveStrategy(session.plan),
    riskScore: Math.min(99, Math.round(totalCostUsdc * 10_000) + tasks.length * 6),
    tasks,
  };
}
