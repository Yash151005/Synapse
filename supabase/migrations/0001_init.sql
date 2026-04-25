-- =====================================================================
-- Synapse — initial schema
-- pgvector for semantic agent discovery, Realtime for live UI feeds.
-- Run via Supabase SQL editor or `supabase db push`.
-- =====================================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- AGENTS — marketplace listings with semantic embeddings
-- ---------------------------------------------------------------------
create table if not exists public.agents (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique not null,
  description     text not null,
  capability      text not null,
  endpoint_url    text not null,
  price_usdc      numeric(20, 7) not null default 0.001,
  stellar_address text not null,
  reputation      numeric(3, 2) not null default 5.00,
  total_jobs      int not null default 0,
  total_earned_usdc numeric(20, 7) not null default 0,
  embedding       vector(1536),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists agents_capability_idx on public.agents (capability);
create index if not exists agents_price_idx on public.agents (price_usdc);
create index if not exists agents_embedding_idx
  on public.agents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ---------------------------------------------------------------------
-- SESSIONS — one row per voice command / orchestration run
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id                uuid primary key default gen_random_uuid(),
  user_address      text,                -- Freighter pubkey if connected, null = guest
  goal              text not null,
  transcript        jsonb,               -- { user: [...], agent: [...] }
  plan              jsonb,               -- decomposed task DAG (Plan zod type)
  status            text not null default 'planning'
                    check (status in ('planning', 'executing', 'done', 'failed', 'halted')),
  total_cost_usdc   numeric(20, 7) not null default 0,
  budget_usdc       numeric(20, 7),      -- optional ceiling from user
  duration_ms       int,
  narration_text    text,
  narration_audio_url text,
  error             text,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index if not exists sessions_status_idx  on public.sessions (status);
create index if not exists sessions_created_idx on public.sessions (created_at desc);

-- ---------------------------------------------------------------------
-- RECEIPTS — every Stellar payment, with cryptographic request binding
-- The `request_hash` matches the Stellar memo so anyone can verify
-- on-chain that a specific request was paid for.
-- ---------------------------------------------------------------------
create table if not exists public.receipts (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid references public.sessions(id) on delete cascade,
  agent_id          uuid references public.agents(id),
  task_id           text not null,
  amount_usdc       numeric(20, 7) not null,

  -- on-chain proof
  request_hash      text not null,          -- sha256(JSON.stringify(request))
  stellar_tx_hash   text not null,
  stellar_ledger    bigint,
  from_address      text not null,
  to_address        text not null,

  status            text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'failed')),

  request_payload   jsonb,
  response_payload  jsonb,
  latency_ms        int,
  model_used        text,                   -- e.g. 'llama-3.3-70b' / 'claude-sonnet-4-5'

  created_at        timestamptz not null default now(),
  confirmed_at      timestamptz
);

create index if not exists receipts_session_idx on public.receipts (session_id, created_at);
create index if not exists receipts_agent_idx   on public.receipts (agent_id, created_at desc);
create index if not exists receipts_tx_idx      on public.receipts (stellar_tx_hash);

-- ---------------------------------------------------------------------
-- VIEW: agent_stats — cheap rollup for marketplace cards
-- ---------------------------------------------------------------------
create or replace view public.agent_stats as
select
  a.id,
  a.name,
  a.slug,
  a.capability,
  a.price_usdc,
  a.reputation,
  a.total_jobs,
  a.total_earned_usdc,
  count(r.id) filter (where r.created_at > now() - interval '24 hours') as jobs_24h,
  coalesce(avg(r.latency_ms) filter (where r.created_at > now() - interval '24 hours'), 0)::int as avg_latency_24h_ms
from public.agents a
left join public.receipts r on r.agent_id = a.id and r.status = 'confirmed'
group by a.id;

-- ---------------------------------------------------------------------
-- TRIGGERS — keep agent rollups fresh when a receipt confirms
-- ---------------------------------------------------------------------
create or replace function public.bump_agent_stats() returns trigger
language plpgsql as $$
begin
  if (new.status = 'confirmed') and (tg_op = 'INSERT' or old.status <> 'confirmed') then
    update public.agents
       set total_jobs        = total_jobs + 1,
           total_earned_usdc = total_earned_usdc + new.amount_usdc,
           updated_at        = now()
     where id = new.agent_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_bump_agent_stats on public.receipts;
create trigger trg_bump_agent_stats
  after insert or update of status on public.receipts
  for each row execute function public.bump_agent_stats();

-- ---------------------------------------------------------------------
-- TRIGGERS — keep session.total_cost_usdc in sync
-- ---------------------------------------------------------------------
create or replace function public.bump_session_cost() returns trigger
language plpgsql as $$
begin
  update public.sessions
     set total_cost_usdc = (
       select coalesce(sum(amount_usdc), 0)
         from public.receipts
        where session_id = new.session_id
          and status in ('pending', 'confirmed')
     )
   where id = new.session_id;
  return new;
end$$;

drop trigger if exists trg_bump_session_cost on public.receipts;
create trigger trg_bump_session_cost
  after insert or update on public.receipts
  for each row execute function public.bump_session_cost();

-- ---------------------------------------------------------------------
-- REALTIME — UI subscribes to these for live feeds
-- ---------------------------------------------------------------------
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if not found then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.receipts;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.agents;

-- ---------------------------------------------------------------------
-- RLS — anonymous read of public marketplace data, writes via service role
-- (Anonymous users only — Synapse has no auth.)
-- ---------------------------------------------------------------------
alter table public.agents   enable row level security;
alter table public.sessions enable row level security;
alter table public.receipts enable row level security;

-- agents: anyone can read
drop policy if exists "agents_read_all" on public.agents;
create policy "agents_read_all" on public.agents
  for select using (true);

-- sessions: read-by-id (anyone with the URL); insert/update via service role only
drop policy if exists "sessions_read_all" on public.sessions;
create policy "sessions_read_all" on public.sessions
  for select using (true);

-- receipts: read-by-session-id (verifiable history)
drop policy if exists "receipts_read_all" on public.receipts;
create policy "receipts_read_all" on public.receipts
  for select using (true);

-- ---------------------------------------------------------------------
-- RPC — semantic agent discovery (cosine similarity + price ceiling)
-- ---------------------------------------------------------------------
create or replace function public.discover_agents(
  query_embedding vector(1536),
  capability_filter text default null,
  max_price numeric default 1.0,
  match_count int default 5
)
returns table (
  id uuid,
  name text,
  slug text,
  capability text,
  description text,
  endpoint_url text,
  price_usdc numeric,
  stellar_address text,
  reputation numeric,
  total_jobs int,
  similarity float
)
language sql stable as $$
  select
    a.id, a.name, a.slug, a.capability, a.description, a.endpoint_url,
    a.price_usdc, a.stellar_address, a.reputation, a.total_jobs,
    1 - (a.embedding <=> query_embedding) as similarity
  from public.agents a
  where (capability_filter is null or a.capability = capability_filter)
    and a.price_usdc <= max_price
    and a.embedding is not null
  order by a.embedding <=> query_embedding
  limit match_count;
$$;
