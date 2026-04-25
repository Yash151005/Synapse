import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CAPABILITIES } from "@synapse/shared";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PublishBody = z.object({
  name: z.string().min(3).max(80),
  description: z.string().min(10).max(500),
  capability: z.enum(CAPABILITIES),
  endpoint_url: z.string().url(),
  price_usdc: z.number().positive().max(1),
  stellar_address: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar pubkey"),
  sla_latency_ms: z.number().int().positive().default(1000),
  sla_success_pct: z.number().min(50).max(100).default(95),
  maintenance_window: z.string().default("Sun 02:00–04:00 UTC"),
  version: z.string().default("1.0.0"),
});

function makeSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base}-${Date.now().toString(36)}`;
}

async function generateEmbedding(text: string): Promise<number[] | null> {
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

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = PublishBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const slug = makeSlug(d.name);

  const embedText = `${d.name} ${d.description} capability:${d.capability}`;
  const embedding = await generateEmbedding(embedText);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // Demo mode — return a plausible fake ID so the UI completes
    return NextResponse.json({ id: crypto.randomUUID(), slug, demo: true });
  }

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inserted, error } = await supabase
    .from("agents")
    .insert({
      name: d.name,
      slug,
      description: d.description,
      capability: d.capability,
      endpoint_url: d.endpoint_url,
      price_usdc: d.price_usdc,
      stellar_address: d.stellar_address,
      reputation: 5.0,
      total_jobs: 0,
      embedding,
      metadata: {
        sla_latency_ms: d.sla_latency_ms,
        sla_success_pct: d.sla_success_pct,
        maintenance_window: d.maintenance_window,
        version: d.version,
      },
    })
    .select("id, slug")
    .single();

  if (error) {
    const msg = error.message ?? error.code ?? JSON.stringify(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id, slug: inserted.slug });
}
