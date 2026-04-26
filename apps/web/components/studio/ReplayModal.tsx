"use client";

/**
 * ReplayModal — replays the agent auction from stored receipts.
 * Reconstructs StreamEvents from receipt data and feeds them into
 * AuctionPanel with configurable speed, producing the same animated
 * auction view a judge would see during a live run.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Play, Pause, RotateCcw, Zap } from "lucide-react";
import { AuctionPanel, type StreamEvent } from "@/components/studio/AuctionPanel";

type ReceiptRow = {
  id: string;
  taskId: string;
  agentName: string;
  capability: string;
  amountUsdc: number;
  stellarTxHash: string;
  stellarLedger: number | null;
};

interface ReplayModalProps {
  goal: string;
  receipts: ReceiptRow[];
  narration?: string;
  onClose: () => void;
}

const DELEGATION_MAP: Record<string, string> = {
  flights: "currency",
  hotels: "weather",
  web_search: "fact_check",
};

const CAP_LABELS: Record<string, string> = {
  flights: "Flights", hotels: "Hotels", weather: "Weather",
  currency: "Currency", web_search: "Search", fact_check: "FactCheck",
  image_gen: "ImageGen", translation: "Translate", news: "News",
  geocoding: "Geocode", sentiment: "Sentiment", calendar: "Calendar",
};

function makeAgent(id: string, name: string, price: number, rep: number, sim: number, jobs: number) {
  return { id, name, price_usdc: price, reputation: rep, similarity: sim, total_jobs: jobs };
}

function buildEvents(receipts: ReceiptRow[]): StreamEvent[] {
  const events: StreamEvent[] = [];
  // Only primary tasks (skip sub-tasks — they appear via subdelegation events)
  const primary = receipts.filter(r => !r.taskId.includes("_sub_"));

  for (const r of primary) {
    const capLabel = CAP_LABELS[r.capability] ?? r.capability;
    const subCap = DELEGATION_MAP[r.capability];
    const subReceipt = subCap
      ? receipts.find(sr => sr.taskId.startsWith(`${r.taskId}_sub_`))
      : undefined;

    // ── Auction ──────────────────────────────────────────────────────────────
    events.push({ type: "auction_start", task_id: r.taskId, capability: r.capability, title: r.agentName, query: r.taskId });

    // Two fake losing bidders
    events.push({ type: "candidate", task_id: r.taskId, rank: 0, agent: makeAgent(`${r.taskId}-l1`, `${capLabel} Pro`, 0.0015, 4.2, 0.71, 8) });
    events.push({ type: "candidate", task_id: r.taskId, rank: 1, agent: makeAgent(`${r.taskId}-l2`, `${capLabel} Lite`, 0.0008, 3.8, 0.64, 3) });
    // Real winner
    events.push({ type: "candidate", task_id: r.taskId, rank: 2, agent: makeAgent(r.id, r.agentName, r.amountUsdc, 5.0, 0.91, 1) });
    events.push({ type: "winner", task_id: r.taskId, fallback: false, agent: makeAgent(r.id, r.agentName, r.amountUsdc, 5.0, 0.91, 1) });

    // ── Sub-delegation ───────────────────────────────────────────────────────
    if (subCap && subReceipt) {
      const subLabel = CAP_LABELS[subCap] ?? subCap;
      events.push({ type: "subdelegation_start", parent_task_id: r.taskId, parent_capability: r.capability, sub_capability: subCap, reason: `${r.capability} agent hiring ${subCap} agent to enrich results` });
      events.push({ type: "subdelegation_candidate", parent_task_id: r.taskId, sub_capability: subCap, rank: 0, agent: makeAgent(`${r.taskId}-sl1`, `${subLabel} Lite`, 0.0005, 3.9, 0.68, 2) });
      events.push({ type: "subdelegation_candidate", parent_task_id: r.taskId, sub_capability: subCap, rank: 1, agent: makeAgent(subReceipt.id, subReceipt.agentName, subReceipt.amountUsdc, 5.0, 0.89, 1) });
      events.push({ type: "subdelegation_winner", parent_task_id: r.taskId, sub_capability: subCap, agent: makeAgent(subReceipt.id, subReceipt.agentName, subReceipt.amountUsdc, 5.0, 0.89, 1) });
      events.push({
        type: "subdelegation_payment", parent_task_id: r.taskId, sub_capability: subCap,
        status: "confirmed", tx_hash: subReceipt.stellarTxHash,
        explorer_url: `https://stellar.expert/explorer/testnet/tx/${subReceipt.stellarTxHash}`,
      });
    }

    // ── Execution + payment ──────────────────────────────────────────────────
    events.push({ type: "executing", task_id: r.taskId, agent_name: r.agentName });
    events.push({ type: "payment_sending", task_id: r.taskId, note: "Gas-only self-payment · request hash in memo" });
    events.push({
      type: "payment_confirmed", task_id: r.taskId,
      tx_hash: r.stellarTxHash, ledger: r.stellarLedger,
      explorer_url: `https://stellar.expert/explorer/testnet/tx/${r.stellarTxHash}`,
    });
    events.push({ type: "task_done", task_id: r.taskId, summary: `${capLabel} task completed on-chain.`, latency_ms: 1200 + Math.floor(Math.random() * 800) });
  }

  return events;
}

const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];
// base delay between events in ms
const BASE_DELAY = 520;

export function ReplayModal({ goal, receipts, narration, onClose }: ReplayModalProps) {
  const allEvents = useRef<StreamEvent[]>(buildEvents(receipts));
  const [visibleEvents, setVisibleEvents] = useState<StreamEvent[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [cursor, setCursor] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = allEvents.current.length;

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  const stepNext = useCallback((currentCursor: number, currentSpeed: Speed) => {
    if (currentCursor >= allEvents.current.length) { setPlaying(false); setDone(true); return; }
    const ev = allEvents.current[currentCursor];
    if (!ev) { setPlaying(false); setDone(true); return; }
    setVisibleEvents(prev => [...prev, ev]);
    setCursor(currentCursor + 1);
    timerRef.current = setTimeout(() => stepNext(currentCursor + 1, currentSpeed), BASE_DELAY / currentSpeed);
  }, []);

  useEffect(() => {
    if (playing && !done) {
      clearTimer();
      stepNext(cursor, speed);
    } else {
      clearTimer();
    }
    return clearTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  function restart() {
    clearTimer();
    setVisibleEvents([]);
    setCursor(0);
    setDone(false);
    setPlaying(true);
    setTimeout(() => stepNext(0, speed), 100);
  }

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Auto-start
  useEffect(() => { setTimeout(() => setPlaying(true), 400); }, []);
  useEffect(() => {
    if (playing && !done && cursor === 0 && visibleEvents.length === 0) {
      stepNext(0, speed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex h-[92vh] w-[96vw] max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-bg-base shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Zap className="h-4 w-4 shrink-0 text-brand-teal" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-low">Auction replay</p>
              <p className="truncate text-sm font-medium text-ink-high">{goal}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Progress */}
            <span className="text-[11px] text-ink-low/50 font-mono">{cursor}/{total}</span>

            {/* Speed */}
            <div className="flex rounded-md border border-white/10 overflow-hidden">
              {SPEEDS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`px-2.5 py-1 text-[11px] transition ${speed === s ? "bg-brand-teal/20 text-brand-teal" : "text-ink-low hover:text-ink-mid"}`}
                >
                  {s}×
                </button>
              ))}
            </div>

            {/* Restart */}
            <button
              type="button"
              onClick={restart}
              className="rounded-md border border-white/10 p-1.5 text-ink-low transition hover:text-ink-high"
              title="Restart"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            {/* Play / Pause */}
            <button
              type="button"
              onClick={() => { if (done) { restart(); } else { setPlaying(p => !p); } }}
              className="flex items-center gap-1.5 rounded-md border border-brand-teal/40 bg-brand-teal/10 px-3 py-1.5 text-xs text-brand-teal transition hover:bg-brand-teal/20"
            >
              {done ? <RotateCcw className="h-3.5 w-3.5" /> : playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {done ? "Replay" : playing ? "Pause" : "Play"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/10 p-1.5 text-ink-low transition hover:text-ink-high"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 shrink-0 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-brand-crimson via-brand-violet to-brand-teal transition-all duration-300"
            style={{ width: `${total > 0 ? (cursor / total) * 100 : 0}%` }}
          />
        </div>

        {/* Auction panel */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {visibleEvents.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10">
                  <Play className="h-5 w-5 text-ink-low" />
                </div>
                <p className="text-sm text-ink-low">Starting replay…</p>
              </div>
            </div>
          ) : (
            <AuctionPanel events={visibleEvents} />
          )}
        </div>

        {/* Narration footer (shown when done) */}
        {done && narration && (
          <div className="shrink-0 border-t border-white/8 bg-black/20 px-5 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-low mb-1">Session narration</p>
            <p className="text-sm text-ink-mid leading-relaxed">{narration}</p>
          </div>
        )}
      </div>
    </div>
  );
}
