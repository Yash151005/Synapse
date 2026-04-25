// POST /api/agents/discover
// Semantic + capability + price-ceiling search over the agent registry.
// Backed by the `discover_agents` Postgres function (pgvector cosine).

import { NextResponse } from "next/server";
import { z } from "zod";
import { embedText } from "@/lib/llm/openai";
import { isCapability } from "@synapse/shared";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Query = z.object({
  query: z.string().optional(),
  capability: z.string().optional(),
  maxPriceUsdc: z.coerce.number().positive().optional().default(0.02),
  limit: z.coerce.number().int().min(1).max(50).optional().default(24),
});

const Body = z.object({
  query: z.string().min(2),
  capability: z.string().optional(),
  maxPriceUsdc: z.number().positive().default(0.005),
  limit: z.number().int().min(1).max(10).default(3),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    query: url.searchParams.get("query") ?? undefined,
    capability: url.searchParams.get("capability") ?? undefined,
    maxPriceUsdc: url.searchParams.get("maxPriceUsdc") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { query, capability, maxPriceUsdc, limit } = parsed.data;
  if (capability && !isCapability(capability)) {
    return NextResponse.json({ error: `Unknown capability: ${capability}` }, { status: 400 });
  }

  if (!query || query.trim().length < 2) {
    const { data, error } = await supabaseAdmin()
      .from("agents")
      .select("id,name,slug,capability,description,endpoint_url,price_usdc,reputation,total_jobs,stellar_address")
      .lte("price_usdc", maxPriceUsdc)
      .order("reputation", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = capability ? data?.filter((a) => a.capability === capability) : data;
    return NextResponse.json(filtered ?? []);
  }

  const embedding = await embedText(query);
  const { data, error } = await supabaseAdmin().rpc("discover_agents", {
    query_embedding: embedding,
    capability_filter: capability ?? null,
    max_price: maxPriceUsdc,
    match_count: limit,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }
  const { query, capability, maxPriceUsdc, limit } = parsed.data;

  if (capability && !isCapability(capability)) {
    return NextResponse.json({ error: `Unknown capability: ${capability}` }, { status: 400 });
  }

  const embedding = await embedText(query);

  const { data, error } = await supabaseAdmin().rpc("discover_agents", {
    query_embedding: embedding,
    capability_filter: capability ?? null,
    max_price: maxPriceUsdc,
    match_count: limit,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ agents: data ?? [] });
}
