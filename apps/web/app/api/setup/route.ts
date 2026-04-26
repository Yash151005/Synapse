/**
 * GET /api/setup
 *
 * One-shot demo setup. Call once before your first live run.
 *
 * Steps:
 *   1. Fund platform treasury via Stellar Friendbot (testnet)
 *   2. Seed all 12 capability agents into the `agents` table
 *      - endpoint_url  = {APP_URL}/api/agents/{capability}
 *      - stellar_address = PLATFORM_TREASURY_PUBLIC (self-payment is valid on testnet)
 *      - embedding generated via OpenAI text-embedding-3-small
 *   3. Return a status report for every step
 *
 * Safe to call repeatedly — existing agents are upserted by slug.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CAPABILITIES, CAPABILITY_DESCRIPTIONS } from "@synapse/shared";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HORIZON = "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";

// ─── Step 1: Fund treasury ────────────────────────────────────────────────────

async function fundTreasury(publicKey: string): Promise<{ ok: boolean; balance_xlm: string; message: string }> {
  // Check current balance
  try {
    const res = await fetch(`${HORIZON}/accounts/${publicKey}`);
    if (res.ok) {
      const account = await res.json();
      const xlm = parseFloat(
        account.balances?.find((b: { asset_type: string }) => b.asset_type === "native")?.balance ?? "0",
      );
      if (xlm >= 10) {
        return { ok: true, balance_xlm: xlm.toFixed(7), message: `Already funded (${xlm.toFixed(2)} XLM)` };
      }
    }
  } catch { /* not found — fund below */ }

  const fb = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(publicKey)}`);
  if (!fb.ok) {
    const body = await fb.text();
    return { ok: false, balance_xlm: "0", message: `Friendbot failed: ${body.slice(0, 120)}` };
  }

  // Re-fetch balance
  try {
    const res = await fetch(`${HORIZON}/accounts/${publicKey}`);
    if (res.ok) {
      const account = await res.json();
      const xlm = parseFloat(
        account.balances?.find((b: { asset_type: string }) => b.asset_type === "native")?.balance ?? "10000",
      );
      return { ok: true, balance_xlm: xlm.toFixed(7), message: `Funded via Friendbot (${xlm.toFixed(2)} XLM)` };
    }
  } catch { /* ignore */ }

  return { ok: true, balance_xlm: "10000.0000000", message: "Funded via Friendbot" };
}

// ─── Embed one text ───────────────────────────────────────────────────────────

async function embed(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ─── Step 2: Seed agents ──────────────────────────────────────────────────────

type SeedResult = { capability: string; ok: boolean; message: string };

async function seedAgents(
  supabase: ReturnType<typeof createClient<Database>>,
  appUrl: string,
  stellarAddress: string,
): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  for (const cap of CAPABILITIES) {
    const name = `${cap.charAt(0).toUpperCase()}${cap.slice(1).replace(/_/g, " ")} Agent`;
    const description = CAPABILITY_DESCRIPTIONS[cap];
    const slug = `${cap.replace(/_/g, "-")}-agent`;
    const endpoint_url = `${appUrl}/api/agents/${cap}`;
    const embedText = `${name} ${description} capability:${cap}`;

    // Generate embedding (best-effort)
    const embedding = await embed(embedText);

    const { error } = await supabase
      .from("agents")
      .upsert(
        {
          name,
          slug,
          description,
          capability: cap,
          endpoint_url,
          price_usdc: 0.001,
          stellar_address: stellarAddress,
          reputation: 5.0,
          total_jobs: 0,
          embedding: embedding as unknown as number[],
          metadata: {
            sla_latency_ms: 2000,
            sla_success_pct: 95,
            maintenance_window: "Sun 02:00–04:00 UTC",
            version: "1.0.0",
            seeded: true,
          },
        },
        { onConflict: "slug", ignoreDuplicates: false },
      );

    if (error) {
      results.push({ capability: cap, ok: false, message: error.message ?? JSON.stringify(error) });
    } else {
      results.push({ capability: cap, ok: true, message: `Upserted → ${endpoint_url}` });
    }
  }

  return results;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const treasuryPublic = process.env.PLATFORM_TREASURY_PUBLIC;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const errors: string[] = [];

  if (!treasuryPublic) errors.push("PLATFORM_TREASURY_PUBLIC not set");
  if (!supabaseUrl || !supabaseKey) errors.push("Supabase credentials missing");

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }

  // Step 1: Fund
  const fundResult = await fundTreasury(treasuryPublic!);

  // Step 2: Seed agents
  const supabase = createClient<Database>(supabaseUrl!, supabaseKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const agentResults = await seedAgents(supabase, appUrl, treasuryPublic!);
  const seededOk = agentResults.filter((r) => r.ok).length;
  const seededFail = agentResults.filter((r) => !r.ok).length;

  return NextResponse.json({
    ok: fundResult.ok && seededFail === 0,
    treasury: {
      address: treasuryPublic,
      ...fundResult,
      explorer_url: `https://stellar.expert/explorer/testnet/account/${treasuryPublic}`,
    },
    agents: {
      seeded: seededOk,
      failed: seededFail,
      details: agentResults,
    },
    next_steps: [
      fundResult.ok ? null : "Fund treasury manually: https://friendbot.stellar.org/?addr=" + treasuryPublic,
      seededFail > 0 ? "Some agents failed to seed — check Supabase logs" : null,
      "Run a session in Studio — the orchestrator will now find real agents and submit real Stellar payments",
    ].filter(Boolean),
  });
}
