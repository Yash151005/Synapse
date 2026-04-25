"use client";

import type { Plan } from "@synapse/shared";

export interface AgentGraph3DProps {
  plan: Plan | null;
  activeTaskIds?: string[];
}

type Node = { id: string; label: string; x: number; y: number; r: number; center?: boolean };

export function AgentGraph3D({ plan, activeTaskIds = [] }: AgentGraph3DProps) {
  const size = 560;
  const cx = size / 2;
  const cy = size / 2;

  const tasks = plan?.tasks ?? [];

  const nodes: Node[] = [
    { id: "user", label: "User", x: cx, y: cy, r: 24, center: true },
    ...tasks.map((t, i) => {
      const angle = (Math.PI * 2 * i) / Math.max(tasks.length, 1);
      const radius = 170;
      return {
        id: t.id,
        label: t.capability,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        r: 14,
      };
    }),
  ];

  return (
    <div className="glass relative h-44 overflow-hidden">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        <defs>
          <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(123,95,255,0.5)" />
            <stop offset="100%" stopColor="rgba(13,180,201,0.5)" />
          </linearGradient>
        </defs>

        {nodes
          .filter((n) => !n.center)
          .map((n) => (
            <line
              key={`edge-${n.id}`}
              x1={cx}
              y1={cy}
              x2={n.x}
              y2={n.y}
              stroke="url(#edge)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              className="animate-flow"
            />
          ))}

        {nodes
          .filter((n) => !n.center)
          .map((n) => {
            const active = activeTaskIds.includes(n.id);
            return (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r + 7}
                  fill={active ? "rgba(220,37,71,0.18)" : "rgba(13,180,201,0.12)"}
                  className={active ? "animate-pulse-soft" : ""}
                />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={active ? "#DC2547" : "#0DB4C9"}
                />
              </g>
            );
          })}

        <circle cx={cx} cy={cy} r={34} fill="rgba(220,37,71,0.20)" className="animate-pulse-soft" />
        <circle cx={cx} cy={cy} r={24} fill="#DC2547" />
      </svg>

      {!plan ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
          <p className="text-xs text-ink-low">Agent graph appears after plan generation</p>
        </div>
      ) : null}
    </div>
  );
}
