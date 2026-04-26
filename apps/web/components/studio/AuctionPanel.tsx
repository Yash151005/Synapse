"use client";

/**
 * AuctionPanel — real-time agent auction visualization.
 *
 * Receives a flat array of StreamEvent objects (grows as SSE events arrive)
 * and derives per-task auction state from them. Each task card shows:
 *   - Capability badge + title
 *   - Up to 3 candidate agent cards appearing with staggered CSS animation
 *   - Winner highlighted with teal glow; losers fade out
 *   - Sub-delegation panel (purple) when parent hires a helper agent
 *   - Stellar tx hash link after payment confirmed
 *   - Result summary snippet when done
 */

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, ExternalLink, GitBranch, Loader2, Star, Zap } from "lucide-react";

export type StreamEvent = { type: string; [key: string]: unknown };

type AgentInfo = {
  id: string; name: string; price_usdc: number;
  reputation: number; similarity: number; total_jobs: number;
};

type SubDelegation = {
  sub_capability: string;
  reason: string;
  candidates: Array<{ agent: AgentInfo; rank: number }>;
  winner: AgentInfo | null;
  payment_status?: "sending" | "confirmed";
  tx_hash?: string;
  explorer_url?: string;
};

type TaskState = {
  task_id: string;
  capability: string;
  title: string;
  query: string;
  candidates: Array<{ agent: AgentInfo; rank: number }>;
  winner: AgentInfo | null;
  fallback: boolean;
  subdelegation: SubDelegation | null;
  phase: "auction" | "subdelegation" | "executing" | "payment" | "done";
  tx_hash?: string;
  explorer_url?: string;
  summary?: string;
  latency_ms?: number;
};

export function AuctionPanel({ events }: { events: StreamEvent[] }) {
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const processedCount = useRef(0);

  useEffect(() => {
    const newEvents = events.slice(processedCount.current);
    if (newEvents.length === 0) return;
    processedCount.current = events.length;

    setTasks(prev => {
      const map = new Map(prev.map(t => [t.task_id, { ...t }]));

      for (const e of newEvents) {
        switch (e.type) {
          case "auction_start": {
            const id = e.task_id as string;
            if (!map.has(id)) {
              map.set(id, {
                task_id: id, capability: e.capability as string,
                title: e.title as string, query: e.query as string,
                candidates: [], winner: null, fallback: false,
                subdelegation: null, phase: "auction",
              });
            }
            break;
          }
          case "candidate": {
            const t = map.get(e.task_id as string);
            if (t && !t.candidates.find(c => c.agent.id === (e.agent as AgentInfo).id)) {
              map.set(t.task_id, { ...t, candidates: [...t.candidates, { agent: e.agent as AgentInfo, rank: e.rank as number }] });
            }
            break;
          }
          case "winner": {
            const t = map.get(e.task_id as string);
            if (t) map.set(t.task_id, { ...t, winner: e.agent as AgentInfo | null, fallback: !!e.fallback });
            break;
          }
          case "subdelegation_start": {
            const t = map.get(e.parent_task_id as string);
            if (t) map.set(t.task_id, {
              ...t, phase: "subdelegation",
              subdelegation: {
                sub_capability: e.sub_capability as string,
                reason: e.reason as string,
                candidates: [], winner: null,
              },
            });
            break;
          }
          case "subdelegation_candidate": {
            const t = map.get(e.parent_task_id as string);
            if (t?.subdelegation) {
              const sd = t.subdelegation;
              if (!sd.candidates.find(c => c.agent.id === (e.agent as AgentInfo).id)) {
                map.set(t.task_id, { ...t, subdelegation: { ...sd, candidates: [...sd.candidates, { agent: e.agent as AgentInfo, rank: e.rank as number }] } });
              }
            }
            break;
          }
          case "subdelegation_winner": {
            const t = map.get(e.parent_task_id as string);
            if (t?.subdelegation) map.set(t.task_id, { ...t, subdelegation: { ...t.subdelegation, winner: e.agent as AgentInfo | null } });
            break;
          }
          case "subdelegation_payment": {
            const t = map.get(e.parent_task_id as string);
            if (t?.subdelegation) map.set(t.task_id, {
              ...t, subdelegation: {
                ...t.subdelegation,
                payment_status: e.status as "sending" | "confirmed",
                tx_hash: e.tx_hash as string | undefined,
                explorer_url: e.explorer_url as string | undefined,
              },
            });
            break;
          }
          case "executing": {
            const t = map.get(e.task_id as string);
            if (t) map.set(t.task_id, { ...t, phase: "executing" });
            break;
          }
          case "payment_sending": {
            const t = map.get(e.task_id as string);
            if (t) map.set(t.task_id, { ...t, phase: "payment" });
            break;
          }
          case "payment_confirmed": {
            const t = map.get(e.task_id as string);
            if (t) map.set(t.task_id, {
              ...t, phase: "payment",
              tx_hash: e.tx_hash as string,
              explorer_url: e.explorer_url as string,
            });
            break;
          }
          case "task_done": {
            const t = map.get(e.task_id as string);
            if (t) map.set(t.task_id, {
              ...t, phase: "done",
              summary: e.summary as string,
              latency_ms: e.latency_ms as number | undefined,
            });
            break;
          }
        }
      }

      return [...map.values()];
    });
  }, [events]);

  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="rounded-full border border-white/10 p-4">
          <Zap className="h-5 w-5 text-ink-low/40" />
        </div>
        <p className="text-xs text-ink-low/50">Agent auction feed</p>
        <p className="text-[11px] text-ink-low/30">Starts when you run a session</p>
      </div>
    );
  }

  const doneCount = tasks.filter(t => t.phase === "done").length;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {doneCount > 0 && doneCount < tasks.length && (
        <div className="px-3 pt-2 pb-1">
          <span className="text-[10px] text-ink-low/40">{doneCount}/{tasks.length} tasks complete</span>
        </div>
      )}
      <div className="flex flex-col gap-2 px-3 py-2">
        {tasks.map(task => <TaskCard key={task.task_id} task={task} />)}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: TaskState }) {
  const isDone = task.phase === "done";
  const isActive = !isDone;

  // Collapsed done card — single row
  if (isDone) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-white/8 bg-black/10 px-2.5 py-2">
        <CapabilityBadge cap={task.capability} />
        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-low">{task.title}</span>
        {task.tx_hash ? (
          <a
            href={task.explorer_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-0.5 font-mono text-[10px] text-brand-teal hover:underline shrink-0"
          >
            {task.tx_hash.slice(0, 6)}…
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-mint" />
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border transition-all duration-500 ${
      isActive
        ? "border-brand-teal/30 bg-brand-teal/3 shadow-[0_0_14px_rgba(32,178,170,0.07)]"
        : "border-white/8 bg-black/10"
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <CapabilityBadge cap={task.capability} />
        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-mid">{task.title}</span>
        <PhaseIcon phase={task.phase} />
      </div>

      {/* Auction candidates */}
      {task.candidates.length > 0 && (
        <div className="px-3 py-2 space-y-1">
          {task.candidates.map((c, i) => (
            <CandidateCard
              key={c.agent.id}
              candidate={c}
              index={i}
              isWinner={task.winner?.id === c.agent.id}
              hasWinner={task.winner !== null}
            />
          ))}
          {task.fallback && !task.winner && (
            <div className="rounded border border-white/8 bg-white/3 px-2.5 py-1.5 text-[11px] text-ink-low/60">
              No marketplace agents — Claude fallback
            </div>
          )}
        </div>
      )}

      {/* Sub-delegation panel */}
      {task.subdelegation && (
        <SubDelegationPanel sub={task.subdelegation} parentCap={task.capability} />
      )}

      {/* Payment confirmed */}
      {task.tx_hash && (
        <div className="mx-3 mb-2.5 rounded border border-brand-mint/25 bg-brand-mint/5 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-brand-mint">
              <CheckCircle2 className="h-3 w-3" />
              <span>Stellar confirmed · gas only</span>
            </div>
            <a
              href={task.explorer_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-mono text-[10px] text-brand-teal hover:underline"
            >
              {task.tx_hash.slice(0, 8)}…{task.tx_hash.slice(-5)}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      )}

      {/* Result summary */}
      {task.summary && (
        <div className="border-t border-white/5 px-3 py-2">
          <p className="line-clamp-3 text-[11px] leading-relaxed text-ink-mid">{task.summary}</p>
          {task.latency_ms && (
            <p className="mt-1 text-[10px] text-ink-low/40">{task.latency_ms}ms</p>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  candidate, index, isWinner, hasWinner,
}: {
  candidate: { agent: AgentInfo; rank: number };
  index: number;
  isWinner: boolean;
  hasWinner: boolean;
}) {
  return (
    <div
      className={`rounded border px-2.5 py-2 transition-all duration-700 ${
        isWinner
          ? "border-brand-teal/50 bg-brand-teal/8 shadow-[0_0_10px_rgba(32,178,170,0.18)]"
          : hasWinner
          ? "border-white/5 bg-black/5 opacity-35"
          : "border-white/10 bg-white/3"
      }`}
      style={{ animationDelay: `${index * 120}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {isWinner && <Zap className="h-3 w-3 shrink-0 text-brand-teal" />}
          <span className="truncate text-xs font-medium text-ink-high">{candidate.agent.name}</span>
          {isWinner && (
            <span className="shrink-0 rounded border border-brand-teal/30 bg-brand-teal/15 px-1 text-[9px] text-brand-teal">
              HIRED
            </span>
          )}
        </div>
        <span className="shrink-0 font-mono text-[10px] text-ink-low">
          {(candidate.agent.similarity * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-ink-low">
        <span className="flex items-center gap-0.5">
          <Star className="h-2.5 w-2.5" />
          {candidate.agent.reputation.toFixed(1)}
        </span>
        <span>{candidate.agent.total_jobs} jobs</span>
        <span className="ml-auto font-mono text-ink-mid/80">{candidate.agent.price_usdc.toFixed(4)} XLM</span>
      </div>
    </div>
  );
}

function SubDelegationPanel({ sub, parentCap }: { sub: SubDelegation; parentCap: string }) {
  return (
    <div className="mx-3 mb-2 rounded border border-brand-violet/25 bg-brand-violet/3">
      <div className="flex items-center gap-2 border-b border-brand-violet/10 px-2.5 py-1.5">
        <GitBranch className="h-3 w-3 shrink-0 text-brand-violet" />
        <span className="text-[10px] text-brand-violet">
          <span className="font-mono">{parentCap}</span>
          {" "}agent hiring{" "}
          <span className="font-mono">{sub.sub_capability}</span>
          {" "}sub-agent
        </span>
      </div>
      <div className="px-2.5 py-2 space-y-1.5">
        <p className="text-[10px] italic text-ink-low/50">{sub.reason}</p>
        {sub.candidates.map((c, i) => (
          <CandidateCard
            key={c.agent.id}
            candidate={c}
            index={i}
            isWinner={sub.winner?.id === c.agent.id}
            hasWinner={sub.winner !== null}
          />
        ))}
        {sub.tx_hash && (
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1 text-[9px] text-brand-mint">
              <CheckCircle2 className="h-2.5 w-2.5" />
              sub-tx confirmed
            </div>
            <a
              href={sub.explorer_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-0.5 font-mono text-[9px] text-brand-teal hover:underline"
            >
              {sub.tx_hash.slice(0, 6)}…
              <ExternalLink className="h-2 w-2" />
            </a>
          </div>
        )}
        {sub.payment_status === "sending" && !sub.tx_hash && (
          <div className="flex items-center gap-1 text-[9px] text-ink-low/50">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            submitting sub-tx…
          </div>
        )}
      </div>
    </div>
  );
}

function PhaseIcon({ phase }: { phase: TaskState["phase"] }) {
  if (phase === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-brand-mint" />;
  if (phase === "executing" || phase === "payment" || phase === "subdelegation") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-teal" />;
  }
  return <span className="h-2 w-2 rounded-full bg-brand-amber animate-pulse" />;
}

const CAP_COLORS: Record<string, string> = {
  flights: "border-brand-amber/40 text-brand-amber",
  hotels: "border-brand-violet/40 text-brand-violet",
  weather: "border-brand-teal/40 text-brand-teal",
  currency: "border-brand-mint/40 text-brand-mint",
  web_search: "border-brand-crimson/40 text-brand-crimson",
  fact_check: "border-brand-amber/40 text-brand-amber",
  image_gen: "border-brand-violet/40 text-brand-violet",
  translation: "border-brand-teal/40 text-brand-teal",
  news: "border-brand-crimson/40 text-brand-crimson",
  geocoding: "border-brand-mint/40 text-brand-mint",
  sentiment: "border-brand-amber/40 text-brand-amber",
  calendar: "border-brand-violet/40 text-brand-violet",
};

function CapabilityBadge({ cap }: { cap: string }) {
  const color = CAP_COLORS[cap] ?? "border-white/20 text-ink-mid";
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${color}`}>
      {cap}
    </span>
  );
}
