"use client";

import { Badge } from "@/components/ui/badge";
import type { Plan } from "@synapse/shared";

type TaskVisualState =
  | "pending"
  | "discovering"
  | "paying"
  | "executing"
  | "done"
  | "failed";

export interface PlanTreeProps {
  plan: Plan | null;
  taskStates: Record<string, TaskVisualState>;
}

function stateTone(state: TaskVisualState): "neutral" | "teal" | "crimson" | "violet" | "mint" {
  if (state === "discovering") return "teal";
  if (state === "paying") return "crimson";
  if (state === "executing") return "violet";
  if (state === "done") return "mint";
  return "neutral";
}

export function PlanTree({ plan, taskStates }: PlanTreeProps) {
  if (!plan) {
    return (
      <div className="glass flex h-full min-h-64 items-center justify-center px-6 py-10 text-center">
        <p className="text-sm text-ink-low">
          No active plan yet.
          <br />
          Speak a goal to generate a task graph.
        </p>
      </div>
    );
  }

  const sortedTasks = [...plan.tasks].sort((a, b) => {
    if (a.parallel_group === b.parallel_group) return a.id.localeCompare(b.id);
    return a.parallel_group - b.parallel_group;
  });

  return (
    <div className="glass h-full overflow-auto px-4 py-4">
      <p className="mb-3 text-sm text-ink-mid">{plan.summary}</p>
      <div className="space-y-3">
        {sortedTasks.map((task) => {
          const state = taskStates[task.id] ?? "pending";
          return (
            <div key={task.id} className="rounded-md border border-white/5 bg-white/2 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-xs text-ink-low">{task.id}</div>
                  <div className="mt-1 text-sm text-ink-high">{task.query}</div>
                </div>
                <Badge tone={stateTone(state)}>{state}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-ink-low">
                <span>{task.capability}</span>
                <span>·</span>
                <span className="font-mono">max ${task.max_price_usdc.toFixed(3)}</span>
                <span>·</span>
                <span>group {task.parallel_group}</span>
              </div>
              {task.depends_on.length > 0 ? (
                <div className="mt-2 text-xs text-ink-low">
                  depends on: <span className="font-mono">{task.depends_on.join(", ")}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
