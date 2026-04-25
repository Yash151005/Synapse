"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type ReceiptRow = Database["public"]["Tables"]["receipts"]["Row"];

export interface TxFeedProps {
  sessionId: string | null;
}

function shortHash(hash: string) {
  if (hash.length < 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
}

export function TxFeed({ sessionId }: TxFeedProps) {
  const [rows, setRows] = useState<ReceiptRow[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setRows([]);
      return;
    }

    const supabase = supabaseBrowser();

    const loadInitial = async () => {
      const { data } = await supabase
        .from("receipts")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as ReceiptRow[]);
    };

    loadInitial();

    const channel = supabase
      .channel(`receipts:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "receipts",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const incoming = payload.new as ReceiptRow;
          setRows((prev) => [incoming, ...prev]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const content = useMemo(() => {
    if (!sessionId) {
      return (
        <p className="text-sm text-ink-low">
          Start a session to stream Stellar transactions.
        </p>
      );
    }
    if (rows.length === 0) {
      return (
        <p className="text-sm text-ink-low">
          Waiting for confirmed XLM payments...
        </p>
      );
    }
    return (
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-sm border border-white/5 bg-white/2 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${r.stellar_tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-brand-teal hover:underline"
              >
                {shortHash(r.stellar_tx_hash)}
              </a>
              <span className="font-mono text-xs text-brand-mint">
                ${Number(r.amount_usdc).toFixed(6)}
              </span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-ink-low">
              {shortHash(r.from_address)} → {shortHash(r.to_address)}
            </div>
          </li>
        ))}
      </ul>
    );
  }, [rows, sessionId]);

  return (
    <div className="glass flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink-low">
          ledger feed
        </span>
        <span className="font-mono text-[11px] text-ink-low">testnet</span>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3">{content}</div>
    </div>
  );
}
