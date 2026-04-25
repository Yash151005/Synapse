// Hand-rolled Database type for the Supabase client. Mirrors 0001_init.sql.
// Regenerate with `supabase gen types typescript --linked` once the project
// is linked, but this hand-written version is enough for typechecking now.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string;
          capability: string;
          endpoint_url: string;
          price_usdc: number;
          stellar_address: string;
          reputation: number;
          total_jobs: number;
          total_earned_usdc: number;
          embedding: number[] | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["agents"]["Row"],
          "id" | "created_at" | "updated_at" | "reputation" | "total_jobs" | "total_earned_usdc"
        > & {
          id?: string;
          reputation?: number;
          total_jobs?: number;
          total_earned_usdc?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agents"]["Insert"]>;
      };
      sessions: {
        Row: {
          id: string;
          user_address: string | null;
          goal: string;
          transcript: Json | null;
          plan: Json | null;
          status: "planning" | "executing" | "done" | "failed" | "halted";
          total_cost_usdc: number;
          budget_usdc: number | null;
          duration_ms: number | null;
          narration_text: string | null;
          narration_audio_url: string | null;
          error: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["sessions"]["Row"],
          "id" | "created_at" | "total_cost_usdc"
        > & { id?: string; created_at?: string; total_cost_usdc?: number };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
      };
      receipts: {
        Row: {
          id: string;
          session_id: string;
          agent_id: string;
          task_id: string;
          amount_usdc: number;
          request_hash: string;
          stellar_tx_hash: string;
          stellar_ledger: number | null;
          from_address: string;
          to_address: string;
          status: "pending" | "confirmed" | "failed";
          request_payload: Json | null;
          response_payload: Json | null;
          latency_ms: number | null;
          model_used: string | null;
          created_at: string;
          confirmed_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["receipts"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["receipts"]["Insert"]>;
      };
    };
    Views: {
      agent_stats: {
        Row: {
          id: string;
          name: string;
          slug: string;
          capability: string;
          price_usdc: number;
          reputation: number;
          total_jobs: number;
          total_earned_usdc: number;
          jobs_24h: number;
          avg_latency_24h_ms: number;
        };
      };
    };
    Functions: {
      discover_agents: {
        Args: {
          query_embedding: number[];
          capability_filter?: string | null;
          max_price?: number;
          match_count?: number;
        };
        Returns: {
          id: string;
          name: string;
          slug: string;
          capability: string;
          description: string;
          endpoint_url: string;
          price_usdc: number;
          stellar_address: string;
          reputation: number;
          total_jobs: number;
          similarity: number;
        }[];
      };
    };
  };
}
