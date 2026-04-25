"use client";

// Browser Supabase client. Anonymous-only — Synapse has no auth.
// Realtime channels for receipts/sessions are subscribed against this.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { supabasePublicKey } from "./env";

type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;
let _client: BrowserClient | null = null;

export function supabaseBrowser(): BrowserClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = supabasePublicKey();
  if (!url || !key) return null;
  _client = createBrowserClient<Database>(url, key);
  return _client;
}
