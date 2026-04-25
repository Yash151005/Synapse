"use client";

import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  Gavel,
  History,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { governanceDisputes, policyControls } from "@/lib/demo-data";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const auditEvents = [
  { time: "10:31:12", actor: "system", event: "budget.locked", state: "cap 0.050 XLM" },
  { time: "10:31:18", actor: "TaskEscrow", event: "payment.released", state: "task-02 confirmed" },
  { time: "15:02:04", actor: "reviewer", event: "dispute.opened", state: "citation mismatch" },
  { time: "15:02:48", actor: "policy", event: "payout.held", state: "evidence required" },
];

const evidenceItems = [
  "original user goal",
  "planner DAG and revisions",
  "agent request payload",
  "agent response payload",
  "receipt tx hash",
  "request/response hash pair",
];

export default function GovernancePage() {
  function exportPack() {
    downloadJson({ disputes: governanceDisputes, auditEvents, policyControls, exportedAt: new Date().toISOString() }, "synapse-governance-pack.json");
  }

  return (
    <AppShell
      eyebrow="Trust and safety"
      title="Governance console"
      description="Review disputes, evidence packs, risk controls, audit trails, compliance exports, and sensitive task policies."
      actions={
        <Button size="sm" variant="outline" onClick={exportPack}>
          <Download className="h-4 w-4" />
          Export pack
        </Button>
      }
    >
      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="glass p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">dispute workflow</p>
              <h2 className="mt-1 text-lg font-semibold">Evidence, holds, arbitration, and resolution</h2>
            </div>
            <Badge tone="amber">{governanceDisputes.length} tracked</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {governanceDisputes.map((dispute) => (
              <div key={dispute.id} className="rounded-md border border-white/8 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-low">{dispute.id}</span>
                      <Badge tone={dispute.severity === "medium" ? "amber" : "mint"}>{dispute.severity}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink-high">{dispute.title}</p>
                    <p className="mt-1 text-xs text-ink-low">{dispute.sessionId} / due {dispute.due}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg text-brand-mint">{dispute.amountUsdc.toFixed(3)} XLM</p>
                    <p className="text-xs text-ink-low">{dispute.status}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-4">
                  <Step label="Flag" active done />
                  <Step label="Evidence" active done />
                  <Step label="Hold" active={dispute.status !== "resolved split"} done={dispute.status === "resolved split"} />
                  <Step label="Resolve" active={dispute.status === "resolved split"} done={dispute.status === "resolved split"} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="glass p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">evidence pack</p>
                <h2 className="mt-1 text-lg font-semibold">Auto-collected</h2>
              </div>
              <FileCheck2 className="h-5 w-5 text-brand-mint" />
            </div>
            <div className="mt-4 space-y-2">
              {evidenceItems.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-sm border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-ink-mid">
                  <CheckCircle2 className="h-4 w-4 text-brand-mint" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-brand-crimson/25 bg-brand-crimson/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-brand-crimson" />
              <div>
                <p className="text-sm font-medium text-ink-high">Sensitive task gate</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-mid">
                  Wallet transfers, regulated advice, hiring actions, and destructive tasks require explicit confirmation.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">policy controls</p>
              <h2 className="mt-1 text-lg font-semibold">Marketplace guardrails</h2>
            </div>
            <SlidersHorizontal className="h-5 w-5 text-brand-teal" />
          </div>

          <div className="mt-4 space-y-3">
            {policyControls.map((policy) => (
              <div key={policy.name} className="rounded-md border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-high">{policy.name}</p>
                  <Badge tone={policy.state === "on" ? "mint" : policy.state === "monitor" ? "teal" : "neutral"}>
                    {policy.state}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-low">{policy.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">audit trail</p>
              <h2 className="mt-1 text-lg font-semibold">Transparent state transitions</h2>
            </div>
            <History className="h-5 w-5 text-brand-violet" />
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-white/8">
            {auditEvents.map((event, index) => (
              <div
                key={`${event.time}-${event.event}`}
                className={`grid gap-3 px-4 py-3 text-sm md:grid-cols-[80px_100px_1fr_1fr] ${
                  index > 0 ? "border-t border-white/5" : ""
                }`}
              >
                <span className="font-mono text-ink-low">{event.time}</span>
                <span className="text-ink-mid">{event.actor}</span>
                <span className="font-mono text-brand-teal">{event.event}</span>
                <span className="text-ink-low">{event.state}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ExportCard
              icon={<Archive className="h-4 w-4" />}
              label="PDF proof"
              onClick={() => downloadJson({ type: "pdf-proof-stub", events: auditEvents, generatedAt: new Date().toISOString() }, "synapse-proof.json")}
            />
            <ExportCard
              icon={<ClipboardCheck className="h-4 w-4" />}
              label="JSON audit"
              onClick={() => downloadJson({ auditEvents, exportedAt: new Date().toISOString() }, "synapse-audit.json")}
            />
            <ExportCard
              icon={<Lock className="h-4 w-4" />}
              label="Privacy log"
              onClick={() => downloadJson({ privacyLog: { dataRetention: "30 days", piiFields: "none", exportedAt: new Date().toISOString() } }, "synapse-privacy-log.json")}
            />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <TrustCard icon={<ShieldCheck className="h-5 w-5" />} title="Endpoint risk scoring" body="Score providers with latency drift, error spikes, price changes, and dispute rate." />
        <TrustCard icon={<Gavel className="h-5 w-5" />} title="SLA templates" body="Standard policies for bronze, silver, gold, and enterprise-grade providers." />
        <TrustCard icon={<FileCheck2 className="h-5 w-5" />} title="Compliance exports" body="Bundle session, timeline, receipt, policy, and evidence records for review." />
      </section>
    </AppShell>
  );
}

function Step({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className={`rounded-sm border px-3 py-2 ${active ? "border-brand-teal/35 bg-brand-teal/10" : "border-white/8 bg-bg-sunken"}`}>
      <div className="flex items-center gap-2">
        {done ? <CheckCircle2 className="h-4 w-4 text-brand-mint" /> : <span className="h-2 w-2 rounded-full bg-ink-low" />}
        <span className="text-xs text-ink-mid">{label}</span>
      </div>
    </div>
  );
}

function ExportCard({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-sm border border-white/8 bg-white/3 px-3 py-2 text-left text-sm text-ink-mid transition hover:bg-white/6">
      <span className="flex items-center gap-2">
        <span className="text-brand-teal">{icon}</span>
        {label}
      </span>
    </button>
  );
}

function TrustCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="glass p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-white/[0.04] text-brand-mint">{icon}</div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-mid">{body}</p>
    </div>
  );
}
