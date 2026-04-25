"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { demoLedgerRows } from "@/lib/demo-data";
import { shortHash, stellarTxUrl } from "@/lib/utils";

function downloadCsv(rows: typeof demoLedgerRows, filename: string) {
  const headers = ["id","sessionId","agentName","capability","taskId","amountUsdc","status","stellarTxHash","ledger","releaseType","createdAt"];
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify((r as Record<string, unknown>)[h] ?? "")).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const payoutRows = [
  { provider: "AeroScout", balance: 0.042, cadence: "daily", holdback: "2%", status: "ready" },
  { provider: "ClaimCheck", balance: 0.018, cadence: "weekly", holdback: "8%", status: "review" },
  { provider: "Nimbus Now", balance: 0.109, cadence: "auto sweep", holdback: "0%", status: "ready" },
];

export default function LedgerPage() {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const firstReceipt = demoLedgerRows[0]!;
  const totalConfirmed = demoLedgerRows
    .filter((row) => row.status === "confirmed")
    .reduce((sum, row) => sum + row.amountUsdc, 0);
  const heldAmount = demoLedgerRows
    .filter((row) => row.status === "held" || row.status === "pending")
    .reduce((sum, row) => sum + row.amountUsdc, 0);

  return (
    <AppShell
      eyebrow="Payments and receipts"
      title="Ledger and proof center"
      description="Track task escrow, split payouts, refunds, hash-bound memo proofs, and provider payout readiness."
      actions={
        <Button size="sm" variant="outline" onClick={() => downloadCsv(demoLedgerRows, "synapse-ledger.csv")}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      }
    >
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryTile icon={<CircleDollarSign className="h-5 w-5" />} label="Confirmed spend" value={`$${totalConfirmed.toFixed(4)}`} tone="mint" />
        <SummaryTile icon={<Clock3 className="h-5 w-5" />} label="Held or pending" value={`$${heldAmount.toFixed(4)}`} tone="amber" />
        <SummaryTile icon={<Receipt className="h-5 w-5" />} label="Receipts indexed" value={String(demoLedgerRows.length)} tone="teal" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="glass p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">receipt feed</p>
              <h2 className="mt-1 text-lg font-semibold">Task-level USDC settlements</h2>
            </div>
            <div className="flex gap-2">
              <Badge tone="mint">hash memo</Badge>
              <Badge tone="teal">stellar testnet</Badge>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-white/8">
            <div className="hidden grid-cols-[1.3fr_0.9fr_0.8fr_0.7fr_auto] gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.14em] text-ink-low lg:grid">
              <span>agent and task</span>
              <span>transaction</span>
              <span>proof hashes</span>
              <span>amount</span>
              <span>status</span>
            </div>
            <div className="divide-y divide-white/5">
              {demoLedgerRows.map((row) => (
                <div key={row.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.3fr_0.9fr_0.8fr_0.7fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-high">{row.agentName}</span>
                      <Badge tone="violet">{row.capability}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-low">
                      {row.sessionId} / {row.taskId} / {row.releaseType}
                    </p>
                  </div>

                  <div className="font-mono text-xs">
                    <a
                      href={stellarTxUrl(row.stellarTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-brand-teal hover:underline"
                    >
                      {shortHash(row.stellarTxHash, 6, 6)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <p className="mt-1 text-ink-low">ledger {row.ledger}</p>
                  </div>

                  <div className="space-y-1 font-mono text-xs text-ink-low">
                    <p>req {shortHash(row.requestHash, 5, 5)}</p>
                    <p>res {shortHash(row.responseHash, 5, 5)}</p>
                    <p className={row.requestHash === row.memoHash ? "text-brand-mint" : "text-brand-amber"}>
                      memo {shortHash(row.memoHash, 5, 5)}
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-lg text-brand-mint">${row.amountUsdc.toFixed(6)}</p>
                    <p className="text-xs text-ink-low">USDC</p>
                  </div>

                  <Badge tone={row.status === "confirmed" ? "mint" : row.status === "held" ? "amber" : "teal"}>
                    {row.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="glass p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">verification panel</p>
                <h2 className="mt-1 text-lg font-semibold">Hash compare</h2>
              </div>
              <FileCheck2 className="h-5 w-5 text-brand-mint" />
            </div>
            <div className="mt-4 space-y-3">
              <ProofRow label="Request SHA-256" value={shortHash(firstReceipt.requestHash, 10, 10)} ok />
              <ProofRow label="Memo hash" value={shortHash(firstReceipt.memoHash, 10, 10)} ok />
              <ProofRow label="Response hash" value={shortHash(firstReceipt.responseHash, 10, 10)} ok />
            </div>
            <Button
              className="mt-4 w-full"
              variant={verified ? "outline" : "success"}
              onClick={() => setVerified((v) => !v)}
            >
              {verified ? "Verified ✓" : "Verify selected receipt"}
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="glass p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">payout schedule</p>
                <h2 className="mt-1 text-lg font-semibold">Provider balances</h2>
              </div>
              <Wallet className="h-5 w-5 text-brand-teal" />
            </div>
            <div className="mt-4 space-y-3">
              {payoutRows.map((row) => (
                <div key={row.provider} className="rounded-md border border-white/8 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-ink-high">{row.provider}</span>
                    <Badge tone={row.status === "ready" ? "mint" : "amber"}>{row.status}</Badge>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <p className="font-mono text-xl text-brand-mint">${row.balance.toFixed(3)}</p>
                      <p className="text-xs text-ink-low">{row.cadence}</p>
                    </div>
                    <p className="text-xs text-ink-low">holdback {row.holdback}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-brand-amber/25 bg-brand-amber/10 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-brand-amber" />
              <div>
                <p className="text-sm font-medium text-ink-high">Fee forecast</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-mid">
                  Current strategy is under cap. A 15% repricing move would trigger a user confirmation before settlement.
                </p>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => router.push("/governance")}>
                  View guardrail
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "mint" | "amber" | "teal";
}) {
  const color = tone === "mint" ? "text-brand-mint" : tone === "amber" ? "text-brand-amber" : "text-brand-teal";

  return (
    <div className="glass p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-sm bg-white/[0.04] ${color}`}>{icon}</div>
      <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-ink-low">{label}</p>
      <p className={`mt-1 font-mono text-3xl ${color}`}>{value}</p>
    </div>
  );
}

function ProofRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-sm border border-white/8 bg-black/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-low">{label}</span>
        {ok ? <CheckCircle2 className="h-4 w-4 text-brand-mint" /> : <Copy className="h-4 w-4 text-brand-amber" />}
      </div>
      <p className="mt-1 break-all font-mono text-xs text-ink-mid">{value}</p>
    </div>
  );
}
