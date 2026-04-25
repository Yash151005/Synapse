"use client";

import type { Plan } from "@synapse/shared";

export interface AgentGraph3DProps {
  plan: Plan | null;
  activeTaskIds?: string[];
  agentNames?: Record<string, string>;
}

type Node = {
  id: string;
  label: string;
  capability: string;
  x: number;
  y: number;
  active: boolean;
};

function labelFor(value: string, max = 18) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function capabilityLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function AgentGraph3D({ plan, activeTaskIds = [], agentNames = {} }: AgentGraph3DProps) {
  const width = 720;
  const height = 260;
  const cx = width / 2;
  const cy = height / 2;
  const tasks = plan?.tasks ?? [];

  const nodes: Node[] = tasks.map((task, index) => {
    const total = Math.max(tasks.length, 1);
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
    const radiusX = tasks.length <= 2 ? 210 : 270;
    const radiusY = tasks.length <= 2 ? 68 : 92;
    return {
      id: task.id,
      label: agentNames[task.id] ?? capabilityLabel(task.capability),
      capability: capabilityLabel(task.capability),
      x: cx + Math.cos(angle) * radiusX,
      y: cy + Math.sin(angle) * radiusY,
      active: activeTaskIds.includes(task.id),
    };
  });

  if (!plan) {
    return (
      <div className="relative h-44 overflow-hidden rounded-md border border-white/8 bg-[radial-gradient(circle_at_50%_20%,rgba(13,180,201,0.18),rgba(0,0,0,0.2)_42%,rgba(0,0,0,0.32))]">
        <div className="absolute inset-0 opacity-60">
          <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-teal/40 bg-brand-teal/10 animate-pulse-soft" />
          <div className="absolute left-[18%] top-[35%] h-8 w-8 rounded-full border border-white/10 bg-white/5" />
          <div className="absolute right-[18%] top-[48%] h-8 w-8 rounded-full border border-white/10 bg-white/5" />
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
          <div>
            <p className="text-sm font-medium text-ink-high">Agent network is waiting</p>
            <p className="mt-1 text-xs text-ink-low">Run a goal to see hiring, routing, and payment paths.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-44 overflow-hidden rounded-md border border-white/8 bg-[radial-gradient(circle_at_50%_45%,rgba(123,95,255,0.18),rgba(13,180,201,0.12)_38%,rgba(0,0,0,0.34)_78%)]">
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2">
        <span className="rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-brand-teal">
          {nodes.length} agents
        </span>
        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] text-ink-low">
          live route
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <defs>
          <linearGradient id="agent-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(220,37,71,0.8)" />
            <stop offset="48%" stopColor="rgba(123,95,255,0.72)" />
            <stop offset="100%" stopColor="rgba(13,180,201,0.82)" />
          </linearGradient>
          <filter id="agent-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g opacity="0.25">
          <ellipse cx={cx} cy={cy} rx="286" ry="96" fill="none" stroke="rgba(247,247,248,0.24)" strokeDasharray="3 10" />
          <ellipse cx={cx} cy={cy} rx="184" ry="54" fill="none" stroke="rgba(13,180,201,0.28)" strokeDasharray="2 8" />
        </g>

        {nodes.map((node) => {
          const path = `M ${cx} ${cy} C ${(cx + node.x) / 2} ${cy - 42}, ${(cx + node.x) / 2} ${node.y + 42}, ${node.x} ${node.y}`;
          return (
            <g key={`route-${node.id}`}>
              <path d={path} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="8" strokeLinecap="round" />
              <path
                d={path}
                fill="none"
                stroke="url(#agent-edge)"
                strokeWidth={node.active ? 3.5 : 2}
                strokeLinecap="round"
                strokeDasharray="8 12"
                className="animate-flow"
              />
              <circle r={node.active ? 5 : 3.8} fill={node.active ? "#DC2547" : "#0DB4C9"} filter="url(#agent-glow)">
                <animateMotion dur={node.active ? "1.5s" : "2.6s"} repeatCount="indefinite" path={path} />
              </circle>
            </g>
          );
        })}

        <g filter="url(#agent-glow)">
          <circle cx={cx} cy={cy} r="38" fill="rgba(220,37,71,0.18)" className="animate-pulse-soft" />
          <circle cx={cx} cy={cy} r="25" fill="#DC2547" />
          <circle cx={cx} cy={cy} r="8" fill="#F7F7F8" opacity="0.9" />
        </g>
        <text x={cx} y={cy + 52} textAnchor="middle" fill="#F7F7F8" fontSize="15" fontWeight="700">
          Goal router
        </text>
        <text x={cx} y={cy + 68} textAnchor="middle" fill="rgba(247,247,248,0.55)" fontSize="11">
          plans + hires
        </text>
      </svg>

      {nodes.map((node) => (
        <div
          key={`card-${node.id}`}
          className="absolute w-[132px] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-black/45 px-2.5 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-md transition hover:z-20 hover:scale-[1.03]"
          style={{
            left: `${(node.x / width) * 100}%`,
            top: `${(node.y / height) * 100}%`,
            borderColor: node.active ? "rgba(220,37,71,0.6)" : "rgba(13,180,201,0.32)",
          }}
          title={`${node.label} · ${node.capability}`}
        >
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${node.active ? "bg-brand-crimson animate-pulse" : "bg-brand-teal"}`} />
            <span className="min-w-0 truncate text-xs font-semibold text-ink-high">{labelFor(node.label, 17)}</span>
          </div>
          <div className="mt-1 truncate text-[10px] text-ink-low">{node.capability}</div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
            <div className={`h-full ${node.active ? "w-full bg-brand-crimson" : "w-2/3 bg-brand-teal"} transition-all`} />
          </div>
        </div>
      ))}
    </div>
  );
}
