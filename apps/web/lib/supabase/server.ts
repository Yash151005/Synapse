// Server-side Supabase clients.
//
// `supabaseServer()` — RLS-respecting, used inside server components for reads.
// `supabaseAdmin()` — service role, used by orchestrator + API routes for writes.
//                    NEVER import this from a client component.

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabasePublicKey } from "./env";
import type { Database } from "./types";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabasePublicKey()!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof cookieStore.set>[2];
          }>,
        ) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't set cookies — ignore. Middleware refreshes them.
          }
        },
      },
    },
  );
}

let _admin: ReturnType<typeof createClient<Database>> | null = null;

export function supabaseAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY missing. Required for orchestrator writes.",
    );
  }
  _admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
