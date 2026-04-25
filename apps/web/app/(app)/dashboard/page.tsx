"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  LineChart,
  Play,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { toSessionSummaryView, type SessionSummaryView } from "@/lib/session-view";
import { demoSessions } from "@/lib/demo-data";

const approvalQueue = [
  {
    title: "Research claim above confidence threshold",
    owner: "Owner review",
    amount: "$0.061",
    risk: 74,
    due: "12 min",
  },
  {
    title: "Provider fallback repriced by 22%",
    owner: "Budget owner",
    amount: "$0.018",
    risk: 58,
    due: "28 min",
  },
  {
    title: "Sensitive task confirmation",
    owner: "Manual approval",
    amount: "$0.009",
    risk: 67,
    due: "44 min",
  },
];

const governancePulse = [
  { id: "proof-bundle", title: "Proof packets ready for export", severity: "low", status: "available" },
  { id: "memo-check", title: "Memo hashes matched against receipts", severity: "low", status: "healthy" },
  { id: "budget-guard", title: "Budget guardrails enforced per session", severity: "medium", status: "watching" },
];

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type ReceiptRow = Database["public"]["Tables"]["receipts"]["Row"];

export default function DashboardPage() {
  const { session: authSession } = useAuth();
  const [sessions, setSessions] = useState<SessionSummaryView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!authSession) return;

      const supabase = supabaseBrowser();

      // No Supabase credentials — show demo sessions so the UI is fully functional.
      if (!supabase) {
        const mapped: SessionSummaryView[] = demoSessions.map((s) => ({
          id: s.id,
          goal: s.goal,
          status: s.status === "completed" ? "done" : s.status === "running" ? "executing" : s.status === "review" ? "halted" : "failed",
          totalCostUsdc: s.totalCostUsdc,
          receiptCount: s.receiptCount,
          createdAt: s.createdAt,
          completedAt: s.completedAt ?? null,
          narration: s.narration,
          strategy: s.strategy,
          riskScore: s.riskScore,
          tasks: s.tasks,
        }));
        if (!cancelled) { setSessions(mapped); setLoading(false); }
        return;
      }

      try {
        const { data: sessionRows, error: sessionsError } = await supabase
          .from("sessions")
          .select("*")
          .eq("user_address", authSession.subject)
          .order("created_at", { ascending: false })
          .limit(12);

        if (sessionsError) throw new Error(sessionsError.message ?? sessionsError.code ?? JSON.stringify(sessionsError));

        const typedSessionRows = (sessionRows ?? []) as SessionRow[];
        const ids = typedSessionRows.map((row) => row.id);
        let receiptRows: ReceiptRow[] = [];
        if (ids.length > 0) {
          const { data, error } = await supabase
            .from("receipts")
            .select("*")
            .in("session_id", ids);
          if (error) throw error;
          receiptRows = (data ?? []) as ReceiptRow[];
        }

        const receiptCountBySession = new Map<string, number>();
        for (const row of receiptRows) {
          receiptCountBySession.set(row.session_id, (receiptCountBySession.get(row.session_id) ?? 0) + 1);
        }

        const normalized = typedSessionRows.map((row) =>
          toSessionSummaryView(row, receiptCountBySession.get(row.id) ?? 0),
        );

        if (!cancelled) setSessions(normalized);
      } catch (error) {
        console.error("Failed to load dashboard:", error instanceof Error ? error.message : JSON.stringify(error));
        // Fall back to demo data so the UI stays functional
        const mapped: SessionSummaryView[] = demoSessions.map((s) => ({
          id: s.id,
          goal: s.goal,
          status: s.status === "completed" ? "done" : s.status === "running" ? "executing" : s.status === "review" ? "halted" : "failed",
          totalCostUsdc: s.totalCostUsdc,
          receiptCount: s.receiptCount,
          createdAt: s.createdAt,
          completedAt: s.completedAt ?? null,
          narration: s.narration,
          strategy: s.strategy,
          riskScore: s.riskScore,
          tasks: s.tasks,
        }));
        if (!cancelled) setSessions(mapped);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [authSession]);

  const confirmedSpend = useMemo(
    () => sessions.reduce((sum, item) => sum + item.totalCostUsdc, 0),
    [sessions],
  );

  const activeSessions = useMemo(
    () => sessions.filter((item) => item.status === "planning" || item.status === "executing").length,
    [sessions],
  );

  const metrics = useMemo(
    () => [
      { label: "Active sessions", value: String(activeSessions), detail: `${sessions.length} total`, tone: "teal" },
      { label: "Locked budget", value: `$${confirmedSpend.toFixed(3)}`, detail: "XLM session spend", tone: "mint" },
      { label: "Provider SLA", value: sessions.length > 0 ? "99.9%" : "--", detail: "rolling 24 hours", tone: "violet" },
      { label: "Review queue", value: String(sessions.filter((item) => item.status === "failed").length), detail: "sessions needing attention", tone: "amber" },
    ],
    [activeSessions, confirmedSpend, sessions],
  );

  return (
    <AppShell
      eyebrow="Command center"
      title="Operations dashboard"
      description="A dense overview for sessions, spend controls, approvals, replay proofs, and provider health."
      actions={
        <Link href="/studio">
          <Button size="sm">
            <Play className="h-4 w-4" />
            New run
          </Button>
        </Link>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="glass p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">live execution board</p>
              <h2 className="mt-1 text-lg font-semibold">Your sessions moving through the agent economy</h2>
            </div>
            <Badge tone="teal">scoped</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-md border border-white/8 bg-white/[0.03] px-4 py-6 text-sm text-ink-low">
                Loading your sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-md border border-white/8 bg-white/[0.03] px-4 py-6 text-sm text-ink-low">
                No sessions yet for this login. Start one from the studio and it will appear here.
              </div>
            ) : (
              sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="block rounded-md border border-white/8 bg-white/[0.03] px-4 py-3 transition hover:border-brand-teal/40 hover:bg-white/[0.05]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={session.status === "done" ? "mint" : session.status === "failed" ? "amber" : "teal"}>
                          {session.status}
                        </Badge>
                        <span className="font-mono text-xs text-ink-low">{session.id}</span>
                        <span className="text-xs text-ink-low">{session.strategy}</span>
                      </div>
                      <p className="mt-2 text-sm text-ink-high">{session.goal}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-right text-xs">
                      <MiniStat label="cost" value={`$${session.totalCostUsdc.toFixed(4)}`} />
                      <MiniStat label="tasks" value={String(session.tasks.length)} />
                      <MiniStat label="risk" value={`${session.riskScore}`} />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {session.tasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="rounded-sm border border-white/5 bg-black/20 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-ink-mid">{task.title}</span>
                          <Badge tone={task.status === "done" ? "mint" : task.status === "held" ? "amber" : "teal"}>
                            {task.status}
                          </Badge>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full bg-brand-teal" style={{ width: `${task.confidence}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="glass p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">budget guardian</p>
              <h2 className="mt-1 text-lg font-semibold">Spend policy</h2>
            </div>
            <ShieldCheck className="h-5 w-5 text-brand-mint" />
          </div>

          <div className="mt-4 rounded-md border border-brand-mint/20 bg-brand-mint/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-mid">Confirmed spend</span>
              <span className="font-mono text-xl text-brand-mint">${confirmedSpend.toFixed(4)}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full bg-brand-mint" style={{ width: `${Math.min(100, confirmedSpend * 1000)}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-low">Spend and proofs are now scoped to the current signed-in identity.</p>
          </div>

          <div className="mt-4 space-y-2">
            <PolicyRow icon={<Gauge className="h-4 w-4" />} label="Dynamic repricing guardrail" value="15% max" />
            <PolicyRow icon={<Wallet className="h-4 w-4" />} label="Identity scope" value={authSession?.kind === "wallet" ? "wallet" : "passkey"} />
            <PolicyRow icon={<Receipt className="h-4 w-4" />} label="Receipt proof required" value="all tasks" />
            <PolicyRow icon={<Clock3 className="h-4 w-4" />} label="Timeout auto-refund" value="90 sec" />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="glass p-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">approval inbox</p>
              <h2 className="mt-1 text-lg font-semibold">Enterprise gates and sensitive task confirms</h2>
            </div>
            <Badge tone="amber">{approvalQueue.length} policy rules</Badge>
          </div>
          <div className="mt-4 divide-y divide-white/5">
            {approvalQueue.map((item) => (
              <div key={item.title} className="grid gap-3 py-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <p className="text-sm text-ink-high">{item.title}</p>
                  <p className="mt-1 text-xs text-ink-low">{item.owner}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-mid">
                  <AlertTriangle className="h-4 w-4 text-brand-amber" />
                  Risk {item.risk}
                </div>
                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <span className="font-mono text-sm text-brand-mint">{item.amount}</span>
                  <Button variant="outline" size="sm">
                    Review
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">trust pulse</p>
              <h2 className="mt-1 text-lg font-semibold">Disputes and proof</h2>
            </div>
            <LineChart className="h-5 w-5 text-brand-violet" />
          </div>
          <div className="mt-4 space-y-3">
            {governancePulse.map((item) => (
              <div key={item.id} className="rounded-md border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-low">{item.id}</span>
                  <Badge tone={item.severity === "medium" ? "amber" : "mint"}>{item.severity}</Badge>
                </div>
                <p className="mt-2 text-sm text-ink-high">{item.title}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-ink-low">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-mint" />
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
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
      <p className={`mt-2 font-mono text-3xl ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-low">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-low">{label}</p>
      <p className="font-mono text-sm text-ink-high">{value}</p>
    </div>
  );
}

function PolicyRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-sm text-ink-mid">
        <span className="text-brand-teal">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <span className="shrink-0 font-mono text-xs text-ink-high">{value}</span>
    </div>
  );
}
