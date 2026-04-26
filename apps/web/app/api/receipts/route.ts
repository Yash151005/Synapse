// GET /api/receipts?sessionId=<uuid>
// Server-side read using the service-role key so RLS / key-format issues
// on the browser client can never block the Ledger Feed.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ receipts: [] });
  }

  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("receipts")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/receipts] query failed:", error.message);
      return NextResponse.json({ receipts: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ receipts: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ receipts: [], error: msg }, { status: 500 });
  }
}
