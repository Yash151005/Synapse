"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  History,
  Pause,
  Play,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDemoSession, getSessionReceipts, type DemoSession } from "@/lib/demo-data";
import { supabasePublicKey } from "@/lib/supabase/env";
import { shortHash, stellarTxUrl } from "@/lib/utils";

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
        setSession({ ...EMPTY_SESSION, id });
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
            ...EMPTY_SESSION,
            id,
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

  if (authLoading || !authSession) {
    return (
      <main className="min-h-screen bg-bg-base text-ink-high grid-bg">
        <div className="flex min-h-screen items-center justify-center">
          <div className="glass px-5 py-4 text-sm text-ink-mid">Loading session...</div>
        </div>
      </main>
    );
  }

  const verifiedReceipts = useMemo(
    () => session.receipts.filter((receipt) => receipt.requestHash === receipt.memoHash).length,
    [session.receipts],
  );

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
            <Summary label="cost" value={`$${session.totalCostUsdc.toFixed(6)}`} tone="mint" />
            <Summary label="receipts" value={`${verifiedReceipts}/${session.receipts.length}`} tone="violet" />
            <Summary label="risk" value={String(session.riskScore)} tone="amber" />
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
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
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {session.tasks.map((task, index) => (
                  <div key={task.id} className="grid gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3 md:grid-cols-[80px_1fr_auto] md:items-center">
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
                    <span className="font-mono text-sm text-brand-mint">${task.costUsdc.toFixed(4)}</span>
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
                    <span key={bookmark} className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-ink-mid">
                      {bookmark}
                    </span>
                  ))}
                </div>
              </div>
            </aside>
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
                session.receipts.map((receipt, index) => (
                  <div
                    key={receipt.id}
                    className={`grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center ${
                      index > 0 ? "border-t border-white/5" : ""
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ink-high">{receipt.agentName}</span>
                        <Badge tone="violet">{receipt.capability}</Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-ink-low">{receipt.taskId}</p>
                    </div>
                    <div className="font-mono text-xs">
                      <a
                        href={stellarTxUrl(receipt.stellarTxHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand-teal hover:underline"
                      >
                        {shortHash(receipt.stellarTxHash, 6, 6)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <p className="mt-1 text-ink-low">
                        ledger {receipt.stellarLedger ?? "pending"}
                      </p>
                    </div>
                    <div className="space-y-1 font-mono text-xs text-ink-low">
                      <p>req {shortHash(receipt.requestHash, 6, 6)}</p>
                      <p>res {shortHash(receipt.responseHash, 6, 6)}</p>
                      <p className={receipt.requestHash === receipt.memoHash ? "text-brand-mint" : "text-brand-amber"}>
                        memo {shortHash(receipt.memoHash, 6, 6)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg text-brand-mint">${receipt.amountUsdc.toFixed(6)}</p>
                      <Badge tone={receipt.status === "confirmed" ? "mint" : receipt.status === "held" ? "amber" : "teal"}>
                        {receipt.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

function buildDemoSession(id: string): SessionView {
  const session = getDemoSession(id);
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
    tasks: session.tasks,
    receipts,
  };
}

function normalizeSession(dbSession: DbSession, dbReceipts: DbReceipt[]): SessionView {
  const fallback = getDemoSession(dbSession.id);

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
    durationSeconds: fallback.durationSeconds,
    bookmarks: fallback.bookmarks,
    tasks: fallback.tasks,
    receipts: dbReceipts.map((receipt) => ({
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
    })),
  };
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

function ProofToggle({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-white/8 bg-white/[0.03] px-3 py-2">
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
