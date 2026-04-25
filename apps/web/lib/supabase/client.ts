"use client";

// Browser Supabase client. Anonymous-only — Synapse has no auth.
// Realtime channels for receipts/sessions are subscribed against this.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

let _client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function supabaseBrowser() {
  if (_client) return _client;
  _client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return _client;
}
