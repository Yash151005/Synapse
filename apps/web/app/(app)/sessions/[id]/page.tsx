/**
 * app/(app)/sessions/[id]/page.tsx — Session detail & verifiable receipt
 *
 * Shows entire session timeline with on-chain proof links.
 * This is where judges can verify every payment actually happened.
 */

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

interface SessionDetail {
  id: string;
  goal: string;
  status: string;
  total_cost_usdc: number;
  created_at: string;
  completed_at?: string;
  receipts: any[];
  narration_text: string;
}

export default function SessionPage({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );

        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", params.id)
          .single();

        if (sessionError) throw sessionError;

        const { data: receiptsData, error: receiptsError } = await supabase
          .from("receipts")
          .select("*, agents(name, slug, capability)")
          .eq("session_id", params.id)
          .order("created_at", { ascending: false });

        if (receiptsError) throw receiptsError;

        setSession({
          ...sessionData,
          receipts: receiptsData,
        });
      } catch (err) {
        console.error("Failed to load session:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <p className="text-ink-mid">Loading session…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <p className="text-ink-mid">Session not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-base via-bg-raised to-bg-sunken px-6 py-12">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="mb-4 text-4xl font-bold text-ink-high">
            Session {session.id.slice(0, 8)}
          </h1>
          <p className="mb-2 text-ink-mid">Goal: {session.goal}</p>
          <p className="text-sm text-ink-low">
            {new Date(session.created_at).toLocaleString()}
          </p>
        </div>

        {/* Cost Summary */}
        <div className="mb-8 rounded-2xl border border-ink-faint bg-bg-glass p-6 backdrop-blur-glass shadow-glass">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-ink-low">Total Cost</p>
              <p className="text-3xl font-bold text-brand-mint">
                ${session.total_cost_usdc.toFixed(6)}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-low">Status</p>
              <p className="text-lg font-semibold text-brand-teal capitalize">
                {session.status}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-low">Receipts</p>
              <p className="text-lg font-semibold text-brand-violet">
                {session.receipts.length}
              </p>
            </div>
          </div>
        </div>

        {/* Narration */}
        {session.narration_text && (
          <div className="mb-8 rounded-2xl border border-ink-faint bg-bg-glass p-6 backdrop-blur-glass">
            <p className="text-sm font-semibold uppercase tracking-wider text-ink-low mb-3">
              Result
            </p>
            <p className="text-lg text-ink-high italic">{session.narration_text}</p>
          </div>
        )}

        {/* Receipts Table */}
        <div>
          <h2 className="mb-6 text-2xl font-bold text-ink-high">
            On-Chain Receipts
          </h2>
          <div className="space-y-4">
            {session.receipts.map((receipt, i) => (
              <div
                key={i}
                className="rounded-lg border border-ink-faint bg-bg-sunken p-4"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-high">
                      {receipt.agents?.name || "Unknown Agent"}
                    </p>
                    <p className="text-sm text-ink-low">
                      {receipt.agents?.capability} · Task {receipt.task_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold text-brand-mint">
                      ${receipt.amount_usdc.toFixed(7)}
                    </p>
                    <p className="text-xs text-ink-low">USDC</p>
                  </div>
                </div>

                {/* On-chain proof */}
                <div className="mb-3 flex flex-col gap-2 text-sm">
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${receipt.stellar_tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-teal hover:underline"
                  >
                    View on stellar.expert ↗
                  </a>
                  <p className="font-mono text-xs text-ink-low">
                    {receipt.stellar_tx_hash}
                  </p>
                  {receipt.stellar_ledger && (
                    <p className="text-xs text-ink-low">
                      Ledger #{receipt.stellar_ledger}
                    </p>
                  )}
                </div>

                <p
                  className={`text-xs font-semibold ${
                    receipt.status === "confirmed"
                      ? "text-brand-mint"
                      : "text-brand-amber"
                  }`}
                >
                  {receipt.status.toUpperCase()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
