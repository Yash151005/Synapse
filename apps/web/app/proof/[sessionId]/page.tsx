"use client";

/**
 * /proof/[sessionId]
 *
 * Public, zero-login cryptographic proof page.
 * Shareable URL — judges can verify every step on-chain.
 *
 * Shows: goal → task decomposition → agent hired → Stellar tx → memo proof
 */

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import {
  CheckCircle2, XCircle, ExternalLink, Loader2,
  GitBranch, Shield, Zap, Copy, CheckCheck,
} from "lucide-react";

type ReceiptRow = {
  id: string;
  task_id: string;
  agent_id: string;
  capability?: string;
  request_hash: string;
  stellar_tx_hash: string;
  stellar_ledger?: number;
  from_address: string;
  to_address: string;
  amount_usdc: number;
  status: string;
  created_at: string;
  latency_ms?: number;
  model_used?: string;
  request_payload?: { capability?: string; query?: string };
  response_payload?: { summary?: string };
};

type SessionRow = {
  id: string;
  goal: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  total_cost_usdc: number;
  narration_text?: string | null;
  plan?: { tasks?: Array<{ id: string; title: string; capability: string }> } | null;
};

type HorizonEntry = {
  hash: string;
  ledger: number;
  created_at: string;
  successful: boolean;
  fee_charged: string;
  memo_hex: string | null;
  memo_matches: boolean | null;
};

type ProofData = {
  session: SessionRow;
  receipts: ReceiptRow[];
  horizon: Record<string, HorizonEntry>;
  demo?: boolean;
};

function shortHash(h: string, head = 8, tail = 6) {
  if (!h || h.length < head + tail + 3) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export default function ProofPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [data, setData] = useState<ProofData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/proof/${sessionId}`)
      .then(r => r.json())
      .then((d: ProofData | { error: string }) => {
        if ("error" in d) { setError(d.error); }
        else { setData(d); }
      })
      .catch(() => setError("Failed to load proof data"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base grid-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-ink-mid">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading proof…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-bg-base grid-bg flex items-center justify-center">
        <div className="rounded-xl border border-brand-crimson/30 bg-brand-crimson/5 px-8 py-6 text-center">
          <XCircle className="mx-auto h-8 w-8 text-brand-crimson mb-3" />
          <p className="text-sm text-ink-mid">{error ?? "Session not found"}</p>
          <Link href="/" className="mt-4 block text-xs text-brand-teal hover:underline">← Back to Synapse</Link>
        </div>
      </div>
    );
  }

  const { session, receipts, horizon } = data;
  const planTasks = (session.plan as { tasks?: Array<{ id: string; title: string; capability: string }> } | null)?.tasks ?? [];
  const allConfirmed = receipts.every(r => r.status === "confirmed");
  const allMemoMatch = receipts.every(r => {
    const hz = horizon[r.id];
    return !hz || hz.memo_matches !== false;
  });

  return (
    <div className="min-h-screen bg-bg-base grid-bg text-ink-high">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b border-white/5 bg-bg-raised/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="block h-4 w-4 rounded-xs bg-linear-to-br from-brand-crimson to-brand-violet shadow-[0_0_6px_rgba(220,37,71,0.4)]" />
            <span className="font-display text-base italic">Synapse</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/3 px-3 py-1">
              <Shield className="h-3 w-3 text-brand-teal" />
              <span className="text-[11px] text-brand-teal">Proof · testnet</span>
            </div>
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-ink-mid transition hover:text-ink-high"
            >
              {copied ? <CheckCheck className="h-3.5 w-3.5 text-brand-mint" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        {/* ── Session banner ── */}
        <div className="rounded-xl border border-white/8 bg-black/20 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-low mb-1">Goal</p>
              <p className="text-lg font-medium text-ink-high leading-snug">{session.goal}</p>
            </div>
            <div className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
              allConfirmed && allMemoMatch
                ? "border-brand-mint/30 bg-brand-mint/8 text-brand-mint"
                : "border-brand-amber/30 bg-brand-amber/8 text-brand-amber"
            }`}>
              {allConfirmed && allMemoMatch
                ? <><CheckCircle2 className="h-3.5 w-3.5" /> All proofs valid</>
                : <><Shield className="h-3.5 w-3.5" /> Partial proof</>
              }
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <Stat label="Tasks" value={String(planTasks.length || receipts.length)} />
            <Stat label="On-chain txs" value={String(receipts.length)} />
            <Stat label="Gas fees" value={`${(session.total_cost_usdc ?? 0).toFixed(6)} XLM`} />
          </div>
          {session.narration_text && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <p className="text-sm text-ink-mid leading-relaxed italic">"{session.narration_text}"</p>
            </div>
          )}
        </div>

        {/* ── How this works ── */}
        <div className="rounded-xl border border-brand-teal/15 bg-brand-teal/3 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-brand-teal" />
            <span className="text-xs font-medium text-brand-teal">How this proof works</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 text-[11px] text-ink-low">
            <ProofStep n={1} text="Each task's payload is SHA-256 hashed to produce a unique request fingerprint" />
            <ProofStep n={2} text="That hash is embedded as a Stellar Memo.hash in the on-chain XLM transaction" />
            <ProofStep n={3} text="Horizon confirms the memo matches — proving payment was bound to this exact AI request" />
          </div>
        </div>

        {/* ── Task proof chain ── */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-ink-mid uppercase tracking-[0.12em]">
            Proof chain · {receipts.length} transaction{receipts.length !== 1 ? "s" : ""}
          </h2>

          {receipts.length === 0 && (
            <div className="rounded-xl border border-white/8 bg-black/10 px-6 py-10 text-center">
              <p className="text-sm text-ink-low">No on-chain receipts yet — session may still be executing.</p>
            </div>
          )}

          {receipts.map((receipt, i) => {
            const hz = horizon[receipt.id];
            const planTask = planTasks.find(t => t.id === receipt.task_id);
            const capability = planTask?.capability ?? receipt.request_payload?.capability ?? "unknown";
            const title = planTask?.title ?? receipt.request_payload?.query ?? receipt.task_id;
            const summary = receipt.response_payload?.summary;
            const isSubTask = receipt.task_id?.includes("_sub_");

            return (
              <div key={receipt.id} className={`rounded-xl border transition-all ${
                isSubTask
                  ? "ml-8 border-brand-violet/20 bg-brand-violet/3"
                  : "border-white/8 bg-black/15"
              }`}>
                {/* Receipt header */}
                <div className="flex items-center gap-3 border-b border-white/5 px-5 py-3.5">
                  {isSubTask
                    ? <GitBranch className="h-4 w-4 shrink-0 text-brand-violet" />
                    : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] text-ink-low font-mono">{i + 1}</span>
                  }
                  <span className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-ink-mid">{capability}</span>
                  <span className="flex-1 truncate text-sm text-ink-high">{title}</span>
                  {isSubTask && <span className="shrink-0 text-[10px] text-brand-violet">sub-agent</span>}
                </div>

                {/* Summary */}
                {summary && (
                  <div className="border-b border-white/5 px-5 py-3">
                    <p className="text-sm text-ink-mid leading-relaxed">{summary}</p>
                  </div>
                )}

                {/* Proof grid */}
                <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
                  {/* Request hash */}
                  <ProofCell
                    label="Request hash (SHA-256)"
                    value={shortHash(receipt.request_hash ?? "", 10, 8)}
                    mono
                    tooltip="SHA-256 of the task payload — embedded as Stellar memo"
                  />

                  {/* Stellar tx */}
                  <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-ink-low mb-1">Stellar transaction</p>
                    {receipt.stellar_tx_hash ? (
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${receipt.stellar_tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 font-mono text-xs text-brand-teal hover:underline break-all"
                      >
                        {shortHash(receipt.stellar_tx_hash, 10, 8)}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-ink-low/50">pending</span>
                    )}
                  </div>

                  {/* Horizon verification */}
                  {hz ? (
                    <>
                      <ProofCell
                        label="Ledger"
                        value={`#${hz.ledger.toLocaleString()}`}
                        mono
                      />
                      <ProofCell
                        label="Block time"
                        value={new Date(hz.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "medium" })}
                      />
                      <ProofCell
                        label="Network fee"
                        value={`${(parseInt(hz.fee_charged) / 1e7).toFixed(5)} XLM`}
                        mono
                      />
                      <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-ink-low mb-1.5">Memo proof</p>
                        {hz.memo_matches === null ? (
                          <span className="text-xs text-ink-low/50">No hash memo</span>
                        ) : hz.memo_matches ? (
                          <span className="flex items-center gap-1.5 text-xs text-brand-mint">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Hash matched — payment bound to this request
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-brand-amber">
                            <XCircle className="h-3.5 w-3.5" />
                            Memo mismatch
                          </span>
                        )}
                      </div>
                    </>
                  ) : receipt.stellar_tx_hash && !receipt.stellar_tx_hash.startsWith("demo-") ? (
                    <div className="col-span-2 flex items-center gap-2 text-xs text-ink-low/50">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Fetching Horizon data…
                    </div>
                  ) : null}

                  {/* On-chain status */}
                  {hz && (
                    <div className="col-span-2 flex items-center gap-2">
                      {hz.successful
                        ? <span className="flex items-center gap-1.5 text-xs text-brand-mint"><CheckCircle2 className="h-3.5 w-3.5" />Confirmed on Stellar testnet</span>
                        : <span className="flex items-center gap-1.5 text-xs text-brand-crimson"><XCircle className="h-3.5 w-3.5" />Transaction failed</span>
                      }
                      {receipt.latency_ms && (
                        <span className="ml-auto text-[10px] text-ink-low/40">{receipt.latency_ms}ms agent latency</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-white/5 pt-6 pb-12 flex items-center justify-between text-[11px] text-ink-low/50">
          <span>Session ID: <span className="font-mono">{sessionId}</span></span>
          <Link href="/studio" className="flex items-center gap-1 text-brand-teal/70 hover:text-brand-teal transition">
            <Zap className="h-3 w-3" />Run new session
          </Link>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-low">{label}</p>
      <p className="mt-1 font-mono text-sm text-ink-high">{value}</p>
    </div>
  );
}

function ProofCell({ label, value, mono, tooltip }: { label: string; value: string; mono?: boolean; tooltip?: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5" title={tooltip}>
      <p className="text-[10px] uppercase tracking-wider text-ink-low mb-1">{label}</p>
      <p className={`text-xs text-ink-mid ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function ProofStep({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-2">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-brand-teal/30 text-[9px] text-brand-teal font-mono mt-0.5">{n}</span>
      <p>{text}</p>
    </div>
  );
}
