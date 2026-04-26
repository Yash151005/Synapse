"use client";

import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import type { Plan } from "@synapse/shared";

interface NetworkModalProps {
  plan: Plan | null;
  activeTaskIds: string[];
  agentNames: Record<string, string>;
  onClose: () => void;
  sessionId?: string | null;
}

const CAP_COLORS: Record<string, { dot: string; border: string; text: string }> = {
  flights:     { dot: "bg-brand-amber",   border: "border-brand-amber/40",  text: "text-brand-amber" },
  hotels:      { dot: "bg-brand-violet",  border: "border-brand-violet/40", text: "text-brand-violet" },
  weather:     { dot: "bg-brand-teal",    border: "border-brand-teal/40",   text: "text-brand-teal" },
  currency:    { dot: "bg-brand-mint",    border: "border-brand-mint/40",   text: "text-brand-mint" },
  web_search:  { dot: "bg-brand-crimson", border: "border-brand-crimson/40",text: "text-brand-crimson" },
  fact_check:  { dot: "bg-brand-amber",   border: "border-brand-amber/40",  text: "text-brand-amber" },
  image_gen:   { dot: "bg-brand-violet",  border: "border-brand-violet/40", text: "text-brand-violet" },
  translation: { dot: "bg-brand-teal",    border: "border-brand-teal/40",   text: "text-brand-teal" },
  news:        { dot: "bg-brand-crimson", border: "border-brand-crimson/40",text: "text-brand-crimson" },
  geocoding:   { dot: "bg-brand-mint",    border: "border-brand-mint/40",   text: "text-brand-mint" },
  sentiment:   { dot: "bg-brand-amber",   border: "border-brand-amber/40",  text: "text-brand-amber" },
  calendar:    { dot: "bg-brand-violet",  border: "border-brand-violet/40", text: "text-brand-violet" },
};

function capLabel(v: string) { return v.replace(/_/g, " "); }

export function NetworkModal({ plan, activeTaskIds, agentNames, onClose, sessionId }: NetworkModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const tasks = plan?.tasks ?? [];
  const W = 1100;
  const H = 580;
  const cx = W / 2;
  const cy = H / 2;

  const nodes = tasks.map((task, index) => {
    const total = Math.max(tasks.length, 1);
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
    const radiusX = tasks.length <= 2 ? 380 : tasks.length <= 4 ? 420 : 460;
    const radiusY = tasks.length <= 2 ? 160 : tasks.length <= 4 ? 200 : 220;
    const active = activeTaskIds.includes(task.id);
    const colors = CAP_COLORS[task.capability] ?? { dot: "bg-brand-teal", border: "border-brand-teal/40", text: "text-brand-teal" };
    return {
      id: task.id,
      label: agentNames[task.id] ?? capLabel(task.capability),
      capability: task.capability,
      capLabel: capLabel(task.capability),
      x: cx + Math.cos(angle) * radiusX,
      y: cy + Math.sin(angle) * radiusY,
      active,
      colors,
    };
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex h-[92vh] w-[96vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-bg-base shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="block h-5 w-5 rounded-xs bg-linear-to-br from-brand-crimson to-brand-violet shadow-[0_0_8px_rgba(220,37,71,0.4)]" />
            <span className="font-display text-base italic text-ink-high">Agent Network</span>
            {tasks.length > 0 && (
              <span className="rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2.5 py-0.5 text-xs text-brand-teal">
                {tasks.length} agent{tasks.length !== 1 ? "s" : ""} · live routing
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {sessionId && (
              <a
                href={`/proof/${sessionId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-brand-teal/30 bg-brand-teal/8 px-3 py-1.5 text-xs text-brand-teal hover:bg-brand-teal/15 transition"
              >
                <ExternalLink className="h-3 w-3" />
                View proof
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/10 p-2 text-ink-low transition hover:border-white/20 hover:text-ink-high"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">

          {/* Graph */}
          <div className="relative min-w-0 flex-1 bg-[radial-gradient(ellipse_at_50%_50%,rgba(123,95,255,0.12),rgba(13,180,201,0.08)_45%,rgba(0,0,0,0.0)_75%)]">
            {tasks.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <p className="text-base font-medium text-ink-mid">No plan yet</p>
                  <p className="mt-1 text-sm text-ink-low">Run a goal in Studio to see the agent network.</p>
                </div>
              </div>
            ) : (
              <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
                <defs>
                  <linearGradient id="nm-edge" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgba(220,37,71,0.85)" />
                    <stop offset="48%" stopColor="rgba(123,95,255,0.75)" />
                    <stop offset="100%" stopColor="rgba(13,180,201,0.88)" />
                  </linearGradient>
                  <filter id="nm-glow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="7" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="nm-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <radialGradient id="nm-hub" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(220,37,71,0.35)" />
                    <stop offset="100%" stopColor="rgba(220,37,71,0)" />
                  </radialGradient>
                </defs>

                {/* Orbit rings */}
                <g opacity="0.2">
                  <ellipse cx={cx} cy={cy} rx="470" ry="235" fill="none" stroke="rgba(247,247,248,0.2)" strokeDasharray="4 14" />
                  <ellipse cx={cx} cy={cy} rx="320" ry="145" fill="none" stroke="rgba(13,180,201,0.3)" strokeDasharray="3 10" />
                  <ellipse cx={cx} cy={cy} rx="160" ry="72" fill="none" stroke="rgba(123,95,255,0.25)" strokeDasharray="2 7" />
                </g>

                {/* Edges */}
                {nodes.map((node) => {
                  const path = `M ${cx} ${cy} C ${(cx + node.x) / 2} ${cy - 80}, ${(cx + node.x) / 2} ${node.y + 80}, ${node.x} ${node.y}`;
                  return (
                    <g key={`edge-${node.id}`}>
                      <path d={path} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />
                      <path
                        d={path}
                        fill="none"
                        stroke="url(#nm-edge)"
                        strokeWidth={node.active ? 4 : 2.5}
                        strokeLinecap="round"
                        strokeDasharray="10 16"
                        className="animate-flow"
                      />
                      {/* Travelling dot */}
                      <circle r={node.active ? 6 : 4} fill={node.active ? "#DC2547" : "#0DB4C9"} filter="url(#nm-glow-sm)">
                        <animateMotion dur={node.active ? "1.4s" : "2.8s"} repeatCount="indefinite" path={path} />
                      </circle>
                    </g>
                  );
                })}

                {/* Hub */}
                <circle cx={cx} cy={cy} r="72" fill="url(#nm-hub)" className="animate-pulse-soft" />
                <circle cx={cx} cy={cy} r="44" fill="rgba(220,37,71,0.22)" />
                <circle cx={cx} cy={cy} r="30" fill="#DC2547" filter="url(#nm-glow)" />
                <circle cx={cx} cy={cy} r="11" fill="#F7F7F8" opacity="0.92" />
                <text x={cx} y={cy + 64} textAnchor="middle" fill="#F7F7F8" fontSize="17" fontWeight="700">Goal router</text>
                <text x={cx} y={cy + 83} textAnchor="middle" fill="rgba(247,247,248,0.5)" fontSize="12">plans · hires · settles</text>
              </svg>
            )}

            {/* Agent cards overlaid on graph */}
            {nodes.map((node) => {
              const pctX = (node.x / W) * 100;
              const pctY = (node.y / H) * 100;
              return (
                <div
                  key={`card-${node.id}`}
                  className={`absolute w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-black/55 px-3 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:z-20 hover:scale-105 ${node.colors.border}`}
                  style={{ left: `${pctX}%`, top: `${pctY}%` }}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${node.active ? "bg-brand-crimson animate-pulse" : node.colors.dot}`} />
                    <span className="min-w-0 truncate text-sm font-semibold text-ink-high">{node.label}</span>
                  </div>
                  <span className={`mt-1 block text-[11px] ${node.colors.text}`}>{node.capLabel}</span>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
                    <div className={`h-full transition-all ${node.active ? "w-full bg-brand-crimson" : "w-2/3 " + node.colors.dot}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right sidebar — task list */}
          <div className="flex w-64 shrink-0 flex-col border-l border-white/8 bg-black/20">
            <div className="border-b border-white/8 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-low">Task breakdown</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {tasks.length === 0 ? (
                <p className="text-xs text-ink-low/50 text-center mt-8">No tasks yet</p>
              ) : (
                tasks.map((task, i) => {
                  const c = CAP_COLORS[task.capability] ?? { dot: "bg-brand-teal", border: "border-brand-teal/30", text: "text-brand-teal" };
                  const isActive = activeTaskIds.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      className={`rounded-lg border px-3 py-2.5 ${isActive ? "border-brand-crimson/30 bg-brand-crimson/5" : "border-white/8 bg-white/3"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-[9px] text-ink-low">{i + 1}</span>
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${c.border} ${c.text}`}>{task.capability}</span>
                        {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-crimson animate-pulse" />}
                      </div>
                      <p className="mt-1.5 text-xs text-ink-mid line-clamp-2 leading-relaxed">{task.query}</p>
                      {agentNames[task.id] && (
                        <p className="mt-1 text-[10px] text-ink-low/50">→ {agentNames[task.id]}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {/* Legend */}
            <div className="border-t border-white/8 px-4 py-3 space-y-1.5">
              <p className="text-[9px] uppercase tracking-[0.16em] text-ink-low/40 mb-2">Legend</p>
              <div className="flex items-center gap-2 text-[10px] text-ink-low">
                <span className="h-2 w-2 rounded-full bg-brand-teal" />
                Idle agent
              </div>
              <div className="flex items-center gap-2 text-[10px] text-ink-low">
                <span className="h-2 w-2 rounded-full bg-brand-crimson animate-pulse" />
                Active / executing
              </div>
              <div className="flex items-center gap-2 text-[10px] text-ink-low">
                <span className="block h-px w-4 bg-gradient-to-r from-brand-crimson via-brand-violet to-brand-teal" />
                Payment + hire path
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
