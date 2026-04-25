"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  Gavel,
  Lock,
  RefreshCw,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { contractModules } from "@/lib/demo-data";

const creationFlow = [
  "Select contract type",
  "Define payer, payee, cap, timeout, and success criteria",
  "Attach request and response hash binding rules",
  "Generate metadata and version hash",
  "Deploy to Stellar testnet",
  "Run verification transaction and activate",
];

const escrowEvents = [
  { label: "Session budget locked", value: "$0.050 USDC", icon: Lock },
  { label: "Task escrow allocated", value: "$0.009 USDC", icon: Wallet },
  { label: "Output hash submitted", value: "3 receipts", icon: Receipt },
  { label: "Release policy passed", value: "2 release, 1 hold", icon: CheckCircle2 },
];

export default function ContractsPage() {
  const router = useRouter();
  const [simulating, setSimulating] = useState(false);
  const [simDone, setSimDone] = useState(false);

  function simulateFlow() {
    setSimulating(true);
    setSimDone(false);
    setTimeout(() => { setSimulating(false); setSimDone(true); }, 2200);
  }

  return (
    <AppShell
      eyebrow="On-chain modules"
      title="Contract suite"
      description="Design escrow, budget locks, SLA enforcement, reputation, disputes, subscriptions, and revenue share contracts."
      actions={
        <Button
          size="sm"
          onClick={() => {
            localStorage.setItem("synapse.prefillGoal", "Draft a TaskEscrow contract with 0.050 USDC cap, 90s timeout, and hash-match release rule on Stellar testnet.");
            router.push("/studio");
          }}
        >
          <FileText className="h-4 w-4" />
          Draft contract
        </Button>
      }
    >
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">creation flow</p>
              <h2 className="mt-1 text-lg font-semibold">Contract creation workspace</h2>
            </div>
            <Badge tone="teal">versioned metadata</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {creationFlow.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-white/[0.05] font-mono text-xs text-brand-teal">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <p className="text-sm text-ink-high">{step}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-low">
                    {index === 0 && "Escrow, SLA, subscription, dispute-enabled, or revenue-share module."}
                    {index === 1 && "Terms are normalized before the UI can produce deployable metadata."}
                    {index === 2 && "Task payloads bind to memo hashes so receipts can be verified later."}
                    {index === 3 && "Version hash supports agent rollback and audit-friendly diffs."}
                    {index === 4 && "Testnet deployment is separated from production activation."}
                    {index === 5 && "A tiny verification transfer proves account, trustline, and memo behavior."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">module backlog</p>
              <h2 className="mt-1 text-lg font-semibold">Priority contracts</h2>
            </div>
            <Badge tone="amber">roadmap mapped</Badge>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {contractModules.map((module) => (
              <div key={module.name} className="rounded-md border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink-high">{module.name}</p>
                    <p className="mt-1 text-xs text-ink-low">Priority {module.priority}</p>
                  </div>
                  <Badge
                    tone={
                      module.status === "ready"
                        ? "mint"
                        : module.status === "simulated"
                          ? "teal"
                          : module.status === "blocked"
                            ? "crimson"
                            : "neutral"
                    }
                  >
                    {module.status}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-mid">{module.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {module.terms.map((term) => (
                    <span key={term} className="rounded-full border border-white/8 bg-bg-sunken px-2 py-1 text-[11px] text-ink-low">
                      {term}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-brand-teal">{module.nextAction}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="glass p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">task escrow simulation</p>
              <h2 className="mt-1 text-lg font-semibold">Release, split, or refund flow</h2>
            </div>
            <ShieldCheck className="h-5 w-5 text-brand-mint" />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {escrowEvents.map((event) => {
              const Icon = event.icon;
              return (
                <div key={event.label} className="rounded-md border border-white/8 bg-white/[0.03] p-3">
                  <Icon className="h-5 w-5 text-brand-teal" />
                  <p className="mt-3 text-sm text-ink-high">{event.label}</p>
                  <p className="mt-1 font-mono text-sm text-brand-mint">{event.value}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-white/8 bg-bg-sunken">
            <div className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[0.8fr_1fr_1fr_auto] md:items-center">
              <span className="font-mono text-ink-low">task-01</span>
              <span className="text-ink-high">Agent output accepted</span>
              <span className="text-ink-low">request hash matched memo hash</span>
              <Badge tone="mint">release</Badge>
            </div>
            <div className="grid gap-3 border-t border-white/5 px-4 py-3 text-sm md:grid-cols-[0.8fr_1fr_1fr_auto] md:items-center">
              <span className="font-mono text-ink-low">task-02</span>
              <span className="text-ink-high">Citation mismatch</span>
              <span className="text-ink-low">evidence pack attached</span>
              <Badge tone="amber">hold</Badge>
            </div>
            <div className="grid gap-3 border-t border-white/5 px-4 py-3 text-sm md:grid-cols-[0.8fr_1fr_1fr_auto] md:items-center">
              <span className="font-mono text-ink-low">task-03</span>
              <span className="text-ink-high">Provider timeout</span>
              <span className="text-ink-low">fallback selected after retry budget</span>
              <Badge tone="teal">reroute</Badge>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="glass p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">metadata preview</p>
                <h2 className="mt-1 text-lg font-semibold">TaskEscrow v0.3</h2>
              </div>
              <Database className="h-5 w-5 text-brand-violet" />
            </div>
            <pre className="mt-4 overflow-x-auto rounded-sm border border-white/8 bg-black/30 p-3 font-mono text-xs leading-relaxed text-ink-mid">
{`{
  "contract": "TaskEscrow",
  "network": "stellar-testnet",
  "cap": "0.0500000",
  "timeoutSec": 90,
  "releaseRule": "hash_match && success",
  "refundRule": "timeout || failed"
}`}
            </pre>
          </div>

          <div className="rounded-md border border-brand-amber/25 bg-brand-amber/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-brand-amber" />
              <div>
                <p className="text-sm font-medium text-ink-high">Open design question</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-mid">
                  Dispute contracts need a reviewer policy before automated split payouts can leave simulation.
                </p>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => router.push("/governance")}>
                  Open governance
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="glass p-4">
            <div className="flex items-center gap-2 text-sm text-ink-high">
              <Gavel className="h-4 w-4 text-brand-teal" />
              Dispute-enabled payout
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-low">
              Holds unsettled payout, links evidence hash, resolves to release, split, or refund, then updates reputation.
            </p>
            <Button
              className="mt-4 w-full"
              variant={simDone ? "success" : "outline"}
              disabled={simulating}
              onClick={simulateFlow}
            >
              {simulating ? "Simulating…" : simDone ? "Simulation complete ✓" : "Simulate flow"}
              <RefreshCw className={`h-4 w-4 ${simulating ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
