"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import type { HorizonTxResponse } from "@/app/api/stellar/tx/[hash]/route";

type ReceiptRow = Database["public"]["Tables"]["receipts"]["Row"];

export interface TxFeedProps {
  sessionId: string | null;
}

function shortHash(hash: string, head = 6, tail = 6) {
  if (!hash || hash.length < head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

async function fetchHorizon(hash: string): Promise<HorizonTxResponse | null> {
  if (!hash || hash.length !== 64) return null;
  try {
    const res = await fetch(`/api/stellar/tx/${hash}`);
    if (!res.ok) return null;
    return res.json() as Promise<HorizonTxResponse>;
  } catch {
    return null;
  }
}

export function TxFeed({ sessionId }: TxFeedProps) {
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [horizon, setHorizon] = useState<Record<string, HorizonTxResponse>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  // Enrich new rows with Horizon data
  useEffect(() => {
    for (const row of rows) {
      const h = row.stellar_tx_hash;
      if (h && !fetchedRef.current.has(h)) {
        fetchedRef.current.add(h);
        void fetchHorizon(h).then((data) => {
          if (data) setHorizon((prev) => ({ ...prev, [h]: data }));
        });
      }
    }
  }, [rows]);

  // Supabase: initial load + realtime insert feed
  useEffect(() => {
    if (!sessionId) { setRows([]); return; }
    const supabase = supabaseBrowser();
    if (!supabase) return;

    void supabase
      .from("receipts")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as ReceiptRow[]));

    const channel = supabase
      .channel(`txfeed:${sessionId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "receipts",
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        setRows((prev) => [payload.new as ReceiptRow, ...prev]);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [sessionId]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">Ledger feed</p>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-mint animate-pulse" />
          <span className="text-[11px] text-ink-low">testnet · {rows.length} tx</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!sessionId ? (
          <p className="text-sm text-ink-low">Start a session to stream Stellar transactions.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-low">Waiting for confirmed XLM payments…</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const hz = horizon[row.stellar_tx_hash];
              // Memo verification: request_hash (hex) should match memo_hex from Horizon
              const memoMatch = hz?.memo_hex
                ? hz.memo_hex === row.request_hash
                : null;

              return (
                <li key={row.id} className="rounded-md border border-white/8 bg-black/20 p-3 text-xs">
                  {/* Line 1: hash + amount */}
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${row.stellar_tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-brand-teal hover:underline"
                    >
                      {shortHash(row.stellar_tx_hash)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="font-mono text-brand-mint">
                      gas only
                    </span>
                  </div>

                  {/* Line 2: from → to */}
                  <div className="mt-1 font-mono text-[11px] text-ink-low">
                    {shortHash(row.from_address, 5, 4)} → {shortHash(row.to_address, 5, 4)}
                  </div>

                  {/* Line 3: Horizon block data */}
                  {hz ? (
                    <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
                      <Row label="ledger" value={`#${hz.ledger.toLocaleString()}`} />
                      <Row label="fee" value={`${hz.fee_xlm} XLM`} />
                      <Row
                        label="block time"
                        value={new Date(hz.created_at).toLocaleTimeString([], {
                          hour: "2-digit", minute: "2-digit", second: "2-digit",
                        })}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-ink-low">status</span>
                        {hz.successful ? (
                          <span className="flex items-center gap-1 text-brand-mint">
                            <CheckCircle2 className="h-3 w-3" />confirmed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-brand-crimson">
                            <XCircle className="h-3 w-3" />failed
                          </span>
                        )}
                      </div>
                      {/* Memo proof */}
                      <div className="flex items-center justify-between">
                        <span className="text-ink-low">memo proof</span>
                        {memoMatch === null ? (
                          <span className="text-ink-low/50">no hash memo</span>
                        ) : memoMatch ? (
                          <span className="flex items-center gap-1 text-brand-mint">
                            <CheckCircle2 className="h-3 w-3" />matched
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-brand-amber">
                            <XCircle className="h-3 w-3" />mismatch
                          </span>
                        )}
                      </div>
                      {hz.memo_hex && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-ink-low">memo</span>
                          <span className="font-mono text-[10px] text-ink-low/70 truncate max-w-[120px]">
                            {hz.memo_hex.slice(0, 12)}…
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-low/50">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      fetching on-chain data…
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-low">{label}</span>
      <span className="font-mono text-ink-mid">{value}</span>
    </div>
  );
}
