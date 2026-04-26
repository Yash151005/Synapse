"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  Gavel,
  History,
  Loader2,
  Maximize2,
  Network,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { PlanSchema, type Plan } from "@synapse/shared";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { AgentGraph3D } from "@/components/network/AgentGraph3D";
import { NetworkModal } from "@/components/network/NetworkModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { demoAgents, getDemoSession, getSessionReceipts, type DemoSession } from "@/lib/demo-data";
import { supabasePublicKey } from "@/lib/supabase/env";
import type { Json } from "@/lib/supabase/types";
import { shortHash, stellarTxUrl } from "@/lib/utils";
import type { HorizonTxResponse } from "@/app/api/stellar/tx/[hash]/route";

type ReceiptView = {
  id: string;
  agentName: string;
  capability: string;
  taskId: string;
  amountUsdc: number;
  status: string;
  stellarTxHash: string;
  stellarLedger: number | null;
  requestHash: string;
  responseHash: string;
  memoHash: string;
  createdAt: string;
};

type SessionView = {
  id: string;
  goal: string;
  status: string;
  totalCostUsdc: number;
  createdAt: string;
  completedAt?: string;
  narration: string;
  strategy: DemoSession["strategy"];
  riskScore: number;
  privacy: DemoSession["privacy"];
  durationSeconds: number;
  bookmarks: string[];
  plan: Plan | null;
  tasks: DemoSession["tasks"];
  receipts: ReceiptView[];
};

const EMPTY_SESSION: SessionView = {
  id: "unavailable",
  goal: "Session unavailable",
  status: "failed",
  totalCostUsdc: 0,
  createdAt: new Date(0).toISOString(),
  narration: "This session could not be loaded for the current identity.",
  strategy: "balanced",
  riskScore: 0,
  privacy: "private",
  durationSeconds: 0,
  bookmarks: [],
  plan: null,
  tasks: [],
  receipts: [],
};

type DbSession = {
  id: string;
  goal: string;
  status: string;
  total_cost_usdc: number | string | null;
  created_at: string;
  completed_at?: string | null;
  narration_text?: string | null;
  plan?: Json | null;
  duration_ms?: number | null;
};

type DbReceipt = {
  id: string;
  task_id: string;
  amount_usdc: number | string;
  status: string;
  stellar_tx_hash: string;
  stellar_ledger?: number | null;
  request_hash?: string | null;
  response_hash?: string | null;
  created_at: string;
  agents?: {
    name?: string | null;
    capability?: string | null;
  } | null;
};

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { loading: authLoading, session: authSession } = useAuth();
  const [session, setSession] = useState<SessionView>(() => ({ ...EMPTY_SESSION, id }));
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [auctionRunning, setAuctionRunning] = useState(false);
  const [auctionComplete, setAuctionComplete] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [horizonData, setHorizonData] = useState<Record<string, HorizonTxResponse>>({});
  const fetchedTxRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !authSession) {
      router.replace(`/auth/login?next=${encodeURIComponent(`/sessions/${id}`)}`);
    }
  }, [authLoading, authSession, id, router]);

  useEffect(() => {
    let cancelled = false;

    async function fetchSession() {
      if (!authSession) return;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = supabasePublicKey();

      if (!supabaseUrl || !supabaseAnonKey) {
        setSession(buildDemoSession(id));
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", id)
          .eq("user_address", authSession.subject)
          .single();

        if (sessionError || !sessionData) {
          throw sessionError ?? new Error("Session not found");
        }

        const { data: receiptsData, error: receiptsError } = await supabase
          .from("receipts")
          .select("*, agents(name, slug, capability)")
          .eq("session_id", id)
          .order("created_at", { ascending: false });

        if (receiptsError) throw receiptsError;

        if (!cancelled) {
          setSession(normalizeSession(sessionData as DbSession, (receiptsData ?? []) as DbReceipt[]));
        }
      } catch (error) {
        console.error("Failed to load session:", error);
        if (!cancelled) {
          setSession({
            ...buildDemoSession(id),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchSession();

    return () => {
      cancelled = true;
    };
  }, [authSession, id]);

  // Enrich receipts with live Horizon data
  useEffect(() => {
    for (const receipt of session.receipts) {
      const hash = receipt.stellarTxHash;
      if (hash && hash.length === 64 && !fetchedTxRef.current.has(hash)) {
        fetchedTxRef.current.add(hash);
        void fetch(`/api/stellar/tx/${hash}`)
          .then((r) => r.ok ? r.json() : null)
          .then((data: HorizonTxResponse | null) => {
            if (data) setHorizonData((prev) => ({ ...prev, [hash]: data }));
          });
      }
    }
  }, [session.receipts]);

  useEffect(() => {
    if (!playing || session.tasks.length === 0) return;
    const id = window.setInterval(() => {
      setReplayIndex((current) => {
        if (current >= session.tasks.length + 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [playing, session.tasks.length]);

  const verifiedReceipts = useMemo(
    () => session.receipts.filter((receipt) => receipt.requestHash === receipt.memoHash).length,
    [session.receipts],
  );

  const agentNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const task of session.tasks) {
      if (task.agent && task.agent !== "Assigned during execution") {
        names[task.id] = task.agent;
      }
    }
    for (const receipt of session.receipts) {
      if (receipt.agentName && receipt.agentName !== "Unknown agent") {
        names[receipt.taskId] = receipt.agentName;
      }
    }
    return names;
  }, [session.receipts, session.tasks]);

  const activeTaskIds = useMemo(() => {
    const task = session.plan?.tasks[replayIndex - 1];
    if (task) return [task.id];
    if (session.status === "executing" || session.status === "planning") {
      return session.plan?.tasks.slice(0, 1).map((item) => item.id) ?? [];
    }
    return [];
  }, [replayIndex, session.plan, session.status]);

  const auctionRows = useMemo(() => {
    return session.tasks.map((task, taskIndex) => {
      const matchingAgents = demoAgents.filter((agent) => agent.capability === task.capability);
      const fallbackAgents = demoAgents.filter((agent) => agent.collection === "Research sprint").slice(0, 2);
      const bidders = (matchingAgents.length > 0 ? matchingAgents : fallbackAgents).slice(0, 3);
      const rows = bidders.map((agent, index) => {
        const latencyScore = Math.max(1, 100 - Math.round(agent.latencyMs / 20));
        const priceScore = Math.max(1, 100 - Math.round(agent.price_usdc * 9000));
        const reputationScore = Math.round(agent.reputation * 20);
        const score = Math.round(reputationScore * 0.45 + latencyScore * 0.3 + priceScore * 0.25) - index * 2;
        return {
          agent: agent.name,
          price: agent.price_usdc,
          latency: agent.latencyMs,
          reputation: agent.reputation,
          score,
          selected: agent.name === task.agent || index === 0,
        };
      });
      return {
        task,
        round: taskIndex + 1,
        bids: rows.sort((a, b) => b.score - a.score),
      };
    });
  }, [session.tasks]);

  function startReplay() {
    setReplayIndex(0);
    setPlaying(true);
  }

  function simulateAuction() {
    setAuctionRunning(true);
    setAuctionComplete(false);
    setTimeout(() => {
      setAuctionRunning(false);
      setAuctionComplete(true);
    }, 1200);
  }

  if (authLoading || !authSession) {
    return (
      <main className="min-h-screen bg-bg-base text-ink-high grid-bg">
        <div className="flex min-h-screen items-center justify-center">
          <div className="glass px-5 py-4 text-sm text-ink-mid">Loading session...</div>
        </div>
      </main>
    );
  }

  return (
    <AppShell
      eyebrow="Session detail"
      title={`Session ${session.id.slice(0, 14)}`}
      description={session.goal}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `synapse-proof-${session.id.slice(0, 8)}.json`; a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="h-4 w-4" />
          Proof packet
        </Button>
      }
    >
      {loading ? (
        <div className="glass flex min-h-48 items-center justify-center p-6 text-sm text-ink-mid">
          Loading session proof...
        </div>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <Summary label="status" value={session.status} tone="teal" />
            <Summary label="cost" value={`${session.totalCostUsdc.toFixed(6)} XLM`} tone="mint" />
            <Summary label="receipts" value={`${verifiedReceipts}/${session.receipts.length}`} tone="violet" />
            <Summary label="risk" value={String(session.riskScore)} tone="amber" />
          </section>

          <section className="mt-6 glass p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">agent network map</p>
                <h2 className="mt-1 text-lg font-semibold">Stored hiring graph</h2>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!session.plan}
                onClick={() => setShowNetworkModal(true)}
              >
                <Maximize2 className="h-4 w-4" />
                Full view
              </Button>
            </div>

            <div className="mt-4">
              {session.plan ? (
                <AgentGraph3D plan={session.plan} activeTaskIds={activeTaskIds} agentNames={agentNames} />
              ) : (
                <div className="flex h-44 items-center justify-center rounded-md border border-white/8 bg-bg-sunken text-center">
                  <div>
                    <Network className="mx-auto h-5 w-5 text-ink-low" />
                    <p className="mt-2 text-sm text-ink-mid">No stored network map for this session.</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section id="replay" className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">replay timeline</p>
                  <h2 className="mt-1 text-lg font-semibold">Plan, tasks, payments, and narration</h2>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPlaying((value) => !value)}>
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {playing ? "Pause" : "Replay"}
                  </Button>
                  <Button size="sm" onClick={startReplay}>
                    <RefreshCw className="h-4 w-4" />
                    Simulate
                  </Button>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {session.tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={`grid gap-3 rounded-md border p-3 transition md:grid-cols-[80px_1fr_auto] md:items-center ${
                      replayIndex === index + 1
                        ? "border-brand-teal/60 bg-brand-teal/10 shadow-[0_0_20px_rgba(13,180,201,0.12)]"
                        : replayIndex > index + 1
                          ? "border-brand-mint/25 bg-brand-mint/5"
                          : "border-white/8 bg-white/3"
                    }`}
                  >
                    <div className="font-mono text-xs text-ink-low">
                      +{Math.max(1, index * 11 + 4)}s
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={task.status === "done" ? "mint" : task.status === "held" ? "amber" : "teal"}>
                          {task.status}
                        </Badge>
                        <span className="text-sm text-ink-high">{task.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-low">
                        {task.agent} / {task.capability} / confidence {task.confidence}%
                      </p>
                    </div>
                    <span className="font-mono text-sm text-brand-mint">{task.costUsdc.toFixed(4)} XLM</span>
                  </div>
                ))}
              </div>

              {session.narration ? (
                <div className="mt-4 rounded-md border border-white/8 bg-bg-sunken p-4">
                  <div className="flex items-center gap-2 text-sm text-ink-high">
                    <History className="h-4 w-4 text-brand-teal" />
                    Narrated result
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-mid">{session.narration}</p>
                </div>
              ) : null}
            </div>

            <aside className="space-y-4">
              <div className="glass p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">proof controls</p>
                    <h2 className="mt-1 text-lg font-semibold">Judge mode</h2>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-brand-mint" />
                </div>
                <div className="mt-4 space-y-2">
                  <ProofToggle label="Hash-bound memo" enabled />
                  <ProofToggle label="Explorer links" enabled />
                  <ProofToggle label="Privacy manifest" enabled={session.privacy !== "shareable"} />
                  <ProofToggle label="Replay annotations" enabled />
                </div>
              </div>

              <div className="glass p-4">
                <div className="flex items-center gap-2 text-sm text-ink-high">
                  <Clock3 className="h-4 w-4 text-brand-amber" />
                  Runtime
                </div>
                <dl className="mt-3 grid gap-3 text-sm">
                  <DataRow label="Started" value={new Date(session.createdAt).toLocaleString()} />
                  <DataRow label="Completed" value={session.completedAt ? new Date(session.completedAt).toLocaleString() : "In review"} />
                  <DataRow label="Duration" value={`${session.durationSeconds}s`} />
                  <DataRow label="Strategy" value={session.strategy} />
                  <DataRow label="Privacy" value={session.privacy} />
                </dl>
              </div>

              <div className="glass p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-ink-low">bookmarks</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {session.bookmarks.map((bookmark) => (
                    <span key={bookmark} className="rounded-full border border-white/8 bg-white/3 px-3 py-1 text-xs text-ink-mid">
                      {bookmark}
                    </span>
                  ))}
                </div>
              </div>
            </aside>
          </section>

          <section id="auction" className="mt-6 glass p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">agent auction replay</p>
                <h2 className="mt-1 text-lg font-semibold">How Synapse selected agents</h2>
              </div>
              <Button size="sm" variant={auctionComplete ? "success" : "outline"} disabled={auctionRunning} onClick={simulateAuction}>
                {auctionRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : auctionComplete ? <CheckCircle2 className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
                {auctionRunning ? "Running auction..." : auctionComplete ? "Auction replayed" : "Simulate auction"}
              </Button>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {auctionRows.map(({ task, round, bids }) => {
                const winner = bids[0];
                return (
                  <div key={task.id} className="rounded-md border border-white/8 bg-bg-sunken p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-brand-teal">round {round} / {task.id}</p>
                        <h3 className="mt-1 text-sm font-semibold text-ink-high">{task.title}</h3>
                        <p className="mt-1 text-xs text-ink-low">{task.capability}</p>
                      </div>
                      <Badge tone="mint">
                        <BadgeCheck className="h-3 w-3" />
                        {winner?.agent ?? task.agent}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-2">
                      {bids.map((bid, index) => (
                        <div
                          key={`${task.id}-${bid.agent}`}
                          className={`rounded-sm border px-3 py-2 transition ${
                            index === 0
                              ? "border-brand-mint/35 bg-brand-mint/10"
                              : "border-white/8 bg-white/3"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm text-ink-high">{bid.agent}</p>
                              <p className="mt-0.5 text-xs text-ink-low">
                                {bid.price.toFixed(4)} XLM / {bid.latency}ms / rep {bid.reputation.toFixed(2)}
                              </p>
                            </div>
                            <span className="font-mono text-sm text-brand-mint">{bid.score}</span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                            <div className={index === 0 ? "h-full bg-brand-mint" : "h-full bg-brand-teal"} style={{ width: `${Math.min(100, bid.score)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-ink-low">
                      <Gavel className="h-3.5 w-3.5 text-brand-amber" />
                      Ranked by reputation, latency, price, and task capability match.
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-6 glass p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">on-chain receipts</p>
                <h2 className="mt-1 text-lg font-semibold">Verifiable payment timeline</h2>
              </div>
              <Badge tone="mint">{verifiedReceipts} memo matches</Badge>
            </div>

            <div className="mt-4 overflow-hidden rounded-md border border-white/8">
              {session.receipts.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-ink-low">No receipts recorded for this session yet.</div>
              ) : (
                session.receipts.map((receipt, index) => {
                  const hz = horizonData[receipt.stellarTxHash];
                  const memoMatch = hz?.memo_hex
                    ? hz.memo_hex === receipt.requestHash
                    : null;

                  return (
                    <div
                      key={receipt.id}
                      className={`px-4 py-4 text-sm ${index > 0 ? "border-t border-white/5" : ""}`}
                    >
                      {/* Top row */}
                      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-ink-high">{receipt.agentName}</span>
                            <Badge tone="violet">{receipt.capability}</Badge>
                            <Badge tone={receipt.status === "confirmed" ? "mint" : receipt.status === "held" ? "amber" : "teal"}>
                              {receipt.status}
                            </Badge>
                          </div>
                          <p className="mt-1 font-mono text-xs text-ink-low">{receipt.taskId}</p>
                        </div>
                        <div className="font-mono text-xs space-y-1">
                          <a
                            href={stellarTxUrl(receipt.stellarTxHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-brand-teal hover:underline"
                          >
                            {shortHash(receipt.stellarTxHash, 8, 8)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <p className="text-ink-low">
                            ledger {hz?.ledger ? `#${hz.ledger.toLocaleString()}` : (receipt.stellarLedger ? `#${receipt.stellarLedger}` : "pending")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-lg text-brand-mint">{receipt.amountUsdc.toFixed(6)} XLM</p>
                        </div>
                      </div>

                      {/* Horizon proof row */}
                      <div className="mt-3 grid gap-x-6 gap-y-1.5 rounded-md border border-white/5 bg-black/20 px-3 py-2 font-mono text-[11px] sm:grid-cols-2 lg:grid-cols-4">
                        {/* Tx confirmed time */}
                        <ProofCell
                          label="Block time"
                          value={hz ? new Date(hz.created_at).toLocaleString() : "—"}
                          loading={!hz}
                        />
                        {/* Fee */}
                        <ProofCell
                          label="Fee paid"
                          value={hz ? `${hz.fee_xlm} XLM` : "—"}
                          loading={!hz}
                        />
                        {/* Memo proof */}
                        <div>
                          <p className="text-ink-low">Memo proof</p>
                          {!hz ? (
                            <span className="flex items-center gap-1 text-ink-low/50">
                              <Loader2 className="h-3 w-3 animate-spin" /> checking…
                            </span>
                          ) : memoMatch === null ? (
                            <span className="text-ink-low">no hash memo</span>
                          ) : memoMatch ? (
                            <span className="flex items-center gap-1 text-brand-mint">
                              <CheckCircle2 className="h-3 w-3" /> matched
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-brand-amber">
                              <XCircle className="h-3 w-3" /> mismatch
                            </span>
                          )}
                        </div>
                        {/* On-chain status */}
                        <div>
                          <p className="text-ink-low">On-chain</p>
                          {!hz ? (
                            <span className="flex items-center gap-1 text-ink-low/50">
                              <Loader2 className="h-3 w-3 animate-spin" /> fetching…
                            </span>
                          ) : hz.successful ? (
                            <span className="flex items-center gap-1 text-brand-mint">
                              <CheckCircle2 className="h-3 w-3" /> confirmed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-brand-crimson">
                              <XCircle className="h-3 w-3" /> failed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Hash audit row */}
                      <div className="mt-2 grid gap-x-4 gap-y-1 font-mono text-[11px] text-ink-low sm:grid-cols-3">
                        <p>req <span className="text-ink-mid">{shortHash(receipt.requestHash, 8, 6)}</span></p>
                        <p>res <span className="text-ink-mid">{shortHash(receipt.responseHash, 8, 6)}</span></p>
                        <p className={memoMatch === true ? "text-brand-mint" : memoMatch === false ? "text-brand-amber" : ""}>
                          memo <span>{hz?.memo_hex ? shortHash(hz.memo_hex, 8, 6) : shortHash(receipt.memoHash, 8, 6)}</span>
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {showNetworkModal && (
            <NetworkModal
              plan={session.plan}
              activeTaskIds={activeTaskIds}
              agentNames={agentNames}
              sessionId={session.id}
              onClose={() => setShowNetworkModal(false)}
            />
          )}
        </>
      )}
    </AppShell>
  );
}

function buildDemoSession(id: string): SessionView {
  const session = getDemoSession(id);
  const plan = planFromDemoSession(session);
  const receipts = getSessionReceipts(session.id).map((receipt) => ({
    id: receipt.id,
    agentName: receipt.agentName,
    capability: receipt.capability,
    taskId: receipt.taskId,
    amountUsdc: receipt.amountUsdc,
    status: receipt.status,
    stellarTxHash: receipt.stellarTxHash,
    stellarLedger: receipt.ledger,
    requestHash: receipt.requestHash,
    responseHash: receipt.responseHash,
    memoHash: receipt.memoHash,
    createdAt: receipt.createdAt,
  }));

  return {
    id: session.id,
    goal: session.goal,
    status: session.status,
    totalCostUsdc: session.totalCostUsdc,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    narration: session.narration,
    strategy: session.strategy,
    riskScore: session.riskScore,
    privacy: session.privacy,
    durationSeconds: session.durationSeconds,
    bookmarks: session.bookmarks,
    plan,
    tasks: session.tasks,
    receipts,
  };
}

function normalizeSession(dbSession: DbSession, dbReceipts: DbReceipt[]): SessionView {
  const fallback = getDemoSession(dbSession.id);
  const receipts = dbReceipts.map((receipt) => ({
    id: receipt.id,
    agentName: receipt.agents?.name ?? "Unknown agent",
    capability: receipt.agents?.capability ?? "unknown",
    taskId: receipt.task_id,
    amountUsdc: Number(receipt.amount_usdc),
    status: receipt.status,
    stellarTxHash: receipt.stellar_tx_hash,
    stellarLedger: receipt.stellar_ledger ?? null,
    requestHash: receipt.request_hash ?? "missing-request-hash",
    responseHash: receipt.response_hash ?? "missing-response-hash",
    memoHash: receipt.request_hash ?? "missing-request-hash",
    createdAt: receipt.created_at,
  }));
  const storedPlan = parseStoredPlan(dbSession.plan);
  const plan = storedPlan ?? planFromReceipts(dbSession.goal, receipts);

  return {
    id: dbSession.id,
    goal: dbSession.goal,
    status: dbSession.status,
    totalCostUsdc: Number(dbSession.total_cost_usdc ?? 0),
    createdAt: dbSession.created_at,
    completedAt: dbSession.completed_at ?? undefined,
    narration: dbSession.narration_text ?? fallback.narration,
    strategy: fallback.strategy,
    riskScore: fallback.riskScore,
    privacy: fallback.privacy,
    durationSeconds: dbSession.duration_ms ? Math.round(dbSession.duration_ms / 1000) : fallback.durationSeconds,
    bookmarks: fallback.bookmarks,
    plan,
    tasks: plan ? tasksFromPlan(plan, dbSession.status, receipts) : fallback.tasks,
    receipts,
  };
}

function parseStoredPlan(plan: Json | null | undefined): Plan | null {
  const parsed = PlanSchema.safeParse(plan);
  return parsed.success ? parsed.data : null;
}

function planFromDemoSession(session: DemoSession): Plan {
  return {
    summary: session.goal,
    narration_template: session.narration,
    tasks: session.tasks.map((task, index) => ({
      id: task.id,
      capability: task.capability,
      query: task.title,
      max_price_usdc: Math.max(task.costUsdc, 0.00001),
      depends_on: [],
      parallel_group: index,
    })),
  };
}

function planFromReceipts(goal: string, receipts: ReceiptView[]): Plan | null {
  const seen = new Set<string>();
  const tasks = receipts
    .filter((receipt) => !receipt.taskId.includes("_sub_"))
    .filter((receipt) => {
      if (seen.has(receipt.taskId)) return false;
      seen.add(receipt.taskId);
      return true;
    })
    .map((receipt, index) => ({
      id: receipt.taskId,
      capability: receipt.capability as Plan["tasks"][number]["capability"],
      query: receipt.taskId,
      max_price_usdc: Math.max(receipt.amountUsdc, 0.00001),
      depends_on: [],
      parallel_group: index,
    }));

  if (tasks.length === 0) return null;
  return {
    summary: goal,
    narration_template: "Completed: {{goal}}",
    tasks,
  };
}

function tasksFromPlan(plan: Plan, status: SessionView["status"], receipts: ReceiptView[]): DemoSession["tasks"] {
  const receiptsByTask = new Map(receipts.map((receipt) => [receipt.taskId, receipt]));

  return plan.tasks.map((task, index) => {
    const receipt = receiptsByTask.get(task.id);
    const costUsdc = receipt?.amountUsdc ?? task.max_price_usdc ?? 0;
    return {
      id: task.id,
      title: task.query.length > 84 ? `${task.query.slice(0, 84)}...` : task.query,
      capability: task.capability,
      status: taskStatusFromSession(status, index),
      confidence: status === "done" ? 92 : 74,
      risk: riskFromCost(costUsdc),
      agent: receipt?.agentName && receipt.agentName !== "Unknown agent" ? receipt.agentName : "Assigned during execution",
      costUsdc,
    };
  });
}

function taskStatusFromSession(status: SessionView["status"], index: number): DemoSession["tasks"][number]["status"] {
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  return index === 0 ? "running" : "held";
}

function riskFromCost(costUsdc: number): DemoSession["tasks"][number]["risk"] {
  if (costUsdc >= 0.005) return "high";
  if (costUsdc >= 0.002) return "medium";
  return "low";
}

function Summary({ label, value, tone }: { label: string; value: string; tone: "teal" | "mint" | "violet" | "amber" }) {
  const color =
    tone === "mint"
      ? "text-brand-mint"
      : tone === "violet"
        ? "text-brand-violet"
        : tone === "amber"
          ? "text-brand-amber"
          : "text-brand-teal";

  return (
    <div className="glass px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">{label}</p>
      <p className={`mt-2 font-mono text-2xl ${color}`}>{value}</p>
    </div>
  );
}

function ProofCell({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div>
      <p className="text-ink-low">{label}</p>
      {loading ? (
        <span className="flex items-center gap-1 text-ink-low/50">
          <Loader2 className="h-3 w-3 animate-spin" />—
        </span>
      ) : (
        <span className="text-ink-mid">{value}</span>
      )}
    </div>
  );
}

function ProofToggle({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-white/8 bg-white/3 px-3 py-2">
      <span className="text-sm text-ink-mid">{label}</span>
      {enabled ? <CheckCircle2 className="h-4 w-4 text-brand-mint" /> : <FileCheck2 className="h-4 w-4 text-ink-low" />}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-low">{label}</dt>
      <dd className="text-right font-mono text-xs text-ink-mid">{value}</dd>
    </div>
  );
}
