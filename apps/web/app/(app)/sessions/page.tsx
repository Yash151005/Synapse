"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock3,
  Download,
  FileText,
  GitCompare,
  History,
  Lock,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { toSessionSummaryView, type SessionSummaryView } from "@/lib/session-view";
import { demoSessions } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

type Filter = "all" | "done" | "executing" | "planning" | "failed" | "halted";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "done", label: "Completed" },
  { value: "executing", label: "Running" },
  { value: "planning", label: "Planning" },
  { value: "failed", label: "Failed" },
];

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type ReceiptRow = Database["public"]["Tables"]["receipts"]["Row"];

export default function SessionsArchivePage() {
  const router = useRouter();
  const { session: authSession } = useAuth();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [allSessions, setAllSessions] = useState<SessionSummaryView[]>([]);
  const [compareMsg, setCompareMsg] = useState<string | null>(null);

  function downloadJson(data: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      if (!authSession) return;

      const supabase = supabaseBrowser();

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
        if (!cancelled) { setAllSessions(mapped); setLoading(false); }
        return;
      }

      try {
        const { data: sessionRows, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("user_address", authSession.subject)
          .order("created_at", { ascending: false });

        if (sessionError) throw new Error(sessionError.message ?? sessionError.code ?? JSON.stringify(sessionError));

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

        if (!cancelled) setAllSessions(normalized);
      } catch (error) {
        console.error("Failed to load session archive:", error instanceof Error ? error.message : JSON.stringify(error));
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
        if (!cancelled) setAllSessions(mapped);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [authSession]);

  const sessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSessions.filter((session) => {
      const matchesFilter = filter === "all" || session.status === filter;
      const matchesQuery =
        q.length === 0 ||
        session.goal.toLowerCase().includes(q) ||
        session.id.toLowerCase().includes(q) ||
        session.tasks.some((task) => task.title.toLowerCase().includes(q) || task.capability.toLowerCase().includes(q));
      return matchesFilter && matchesQuery;
    });
  }, [allSessions, filter, query]);

  return (
    <AppShell
      eyebrow="Session replay"
      title="Archives and proof"
      description="Search your past sessions, replay task timelines, compare runs, manage privacy, and export proof packets."
      actions={
        <Button size="sm" variant="outline" onClick={() => downloadJson(allSessions, "synapse-sessions.json")}>
          <Download className="h-4 w-4" />
          Export JSON
        </Button>
      }
    >
      <section className="glass p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-ink-mid focus-within:border-brand-teal/60">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search goals, sessions, tasks..."
              className="min-w-0 flex-1 bg-transparent text-sm text-ink-high outline-none placeholder:text-ink-low"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  "shrink-0 rounded-sm border px-3 py-2 text-sm text-ink-mid transition hover:bg-white/[0.05]",
                  filter === item.value ? "border-brand-teal/40 bg-brand-teal/10 text-brand-teal" : "border-white/8 bg-white/[0.03]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {loading ? (
            <div className="glass p-4 text-sm text-ink-low">Loading your archive...</div>
          ) : sessions.length === 0 ? (
            <div className="glass p-4 text-sm text-ink-low">
              No sessions match this filter yet. Create one from the studio to build your archive.
            </div>
          ) : (
            sessions.map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="glass block p-4 transition hover:border-brand-teal/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={session.status === "done" ? "mint" : session.status === "failed" ? "amber" : "teal"}>
                        {session.status}
                      </Badge>
                      <span className="font-mono text-xs text-ink-low">{session.id}</span>
                      <span className="text-xs text-ink-low">{new Date(session.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold tracking-tight">{session.goal}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-mid">{session.narration}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-right text-xs">
                    <ArchiveStat label="cost" value={`$${session.totalCostUsdc.toFixed(4)}`} />
                    <ArchiveStat label="proofs" value={String(session.receiptCount)} />
                    <ArchiveStat label="risk" value={String(session.riskScore)} />
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  {session.tasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="rounded-sm border border-white/8 bg-bg-sunken px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-ink-mid">{task.capability}</span>
                        <Badge tone={task.risk === "low" ? "mint" : task.risk === "medium" ? "amber" : "crimson"}>{task.risk}</Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-ink-high">{task.title}</p>
                    </div>
                  ))}
                </div>
              </Link>
            ))
          )}
        </div>

        <aside className="space-y-4">
          <div className="glass p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">replay controls</p>
                <h2 className="mt-1 text-lg font-semibold">Time travel scrubber</h2>
              </div>
              <History className="h-5 w-5 text-brand-teal" />
            </div>
            <div className="mt-5 rounded-md border border-white/8 bg-bg-sunken p-3">
              <div className="flex items-center justify-between text-xs text-ink-low">
                <span>Playback speed</span>
                <span className="font-mono text-brand-mint">{speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.5}
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                className="mt-3 w-full accent-brand-teal"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const first = sessions[0];
                  if (first) router.push(`/sessions/${first.id}`);
                }}
              >
                <Play className="h-4 w-4" />
                Replay
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCompareMsg("Select two sessions from the list to compare them.");
                  setTimeout(() => setCompareMsg(null), 3000);
                }}
              >
                <GitCompare className="h-4 w-4" />
                Compare
              </Button>
            </div>
            {compareMsg && (
              <p className="mt-3 text-xs text-brand-teal">{compareMsg}</p>
            )}
          </div>

          <div className="glass p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">proof exports</p>
                <h2 className="mt-1 text-lg font-semibold">Judge mode</h2>
              </div>
              <ShieldCheck className="h-5 w-5 text-brand-mint" />
            </div>
            <div className="mt-4 space-y-2">
              <ExportOption
                icon={<FileText className="h-4 w-4" />}
                label="PDF packet"
                onClick={() => downloadJson({ type: "proof-packet", sessions: allSessions.slice(0, 3), exportedAt: new Date().toISOString() }, "synapse-proof-packet.json")}
              />
              <ExportOption
                icon={<Sparkles className="h-4 w-4" />}
                label="Annotated share link"
                onClick={() => {
                  void navigator.clipboard.writeText(`${window.location.origin}/sessions`);
                  setCompareMsg("Share link copied to clipboard!");
                  setTimeout(() => setCompareMsg(null), 2500);
                }}
              />
              <ExportOption
                icon={<Lock className="h-4 w-4" />}
                label="Privacy manifest"
                onClick={() => downloadJson({ privacyManifest: { dataOwner: "operator", retention: "30 days", pii: "none", exportedAt: new Date().toISOString() } }, "synapse-privacy-manifest.json")}
              />
            </div>
          </div>

          <div className="glass p-4">
            <div className="flex items-center gap-2 text-sm text-ink-high">
              <Clock3 className="h-4 w-4 text-brand-amber" />
              Plan revisions
            </div>
            <div className="mt-3 space-y-3">
              <Revision label="v1" text="Initial plan generated" />
              <Revision label="v2" text="Fallback agent selected after latency warning" />
              <Revision label="v3" text="Payment hold attached to disputed citation" />
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

function ArchiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-low">{label}</p>
      <p className="font-mono text-sm text-ink-high">{value}</p>
    </div>
  );
}

function ExportOption({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-sm border border-white/8 bg-white/3 px-3 py-2 text-sm text-ink-mid transition hover:bg-white/6">
      <span className="flex items-center gap-2">
        <span className="text-brand-teal">{icon}</span>
        {label}
      </span>
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

function Revision({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-sm border border-white/8 bg-white/[0.03] px-3 py-2">
      <span className="font-mono text-xs text-brand-teal">{label}</span>
      <p className="mt-1 text-xs text-ink-low">{text}</p>
    </div>
  );
}
