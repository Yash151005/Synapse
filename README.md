# Synapse

Voice-first agent marketplace that plans goals, hires specialist AI agents, and settles micropayments in USDC on Stellar with verifiable receipts.

## What Synapse Does

1. Accepts a user goal via voice or text.
2. Decomposes the goal into executable tasks.
3. Discovers the best agents by capability, price, and relevance.
4. Executes tasks in parallel where possible.
5. Settles payments on Stellar and records receipt proof.
6. Returns narrated results and a verifiable session timeline.

## Core Stack

- Frontend: Next.js 15, React 19, Tailwind
- Voice bridge: Fastify WebSocket service
- LLM routing: Claude (planning), Llama (execution), OpenAI Realtime (voice I/O)
- Data: Supabase Postgres + pgvector + Realtime
- Settlement: Stellar testnet + USDC + Freighter support

## Expanded Feature Backlog

### Voice and Studio

- Live transcript timeline with confidence indicators
- Multi-language speech in/out
- One-click rerun from voice command history
- Interrupt and replan mid-execution
- Session context carry-over mode
- Narration persona switcher (concise, technical, executive)
- Streaming planner decisions in UI
- Demo hotkeys and preset goals
- Accessibility mode (captions, reduced motion, high-contrast)
- Session bookmarking and clip export

### Planning and Orchestration

- Planner confidence and risk scoring per task
- Alternative plan generation and compare mode
- Strategy modes: cheapest, fastest, balanced
- Deadline-aware scheduling
- Automatic fallback agent routing
- Retry policies with backoff and circuit-breakers
- Partial-success completion handling
- Agent selection explainability panel
- Task dependency debugger
- Dynamic repricing guardrails

### Marketplace and Providers

- Capability taxonomy and advanced filters
- Verified provider badges and trust signals
- Benchmark cards (latency, success, cost)
- Region-aware routing controls
- Agent versioning and rollback
- Provider changelog and maintenance windows
- Provider onboarding wizard
- Featured collections by use case
- Marketplace leaderboards
- Health and SLA status badges

### Payments and Ledger

- Task-level escrow release
- Split payouts across multi-agent workflows
- Budget lock at session start
- Auto-refund on failure or timeout
- Fee sponsorship for onboarding users
- Live FX conversion in meter
- Fee forecast and cap warnings
- Hash-bound receipt proofs
- Guest wallet with safe spend limits
- Scheduled provider payout options

### Trust, Safety, Governance

- Reputation model across quality/cost/latency
- Dispute workflow with evidence packs
- Endpoint risk scoring and throttling
- Content safety policy checks
- Sensitive task confirmation mode
- Transparent audit trail for all state transitions
- Compliance export bundle
- SLA policy templates
- Governance policy controls
- Incident review dashboards

### Developer Platform

- Agent SDK and local simulator
- Contract-aware integration tests
- Sandbox mode with synthetic tasks
- Provider webhooks (task started/paid/failed)
- Provider analytics and earnings insights
- Billing and payout dashboard
- Staging to production promotion pipeline
- Endpoint health monitors and alerts
- Schema validation + generated API docs
- Capability starter templates

### Session and Replay

- Time-travel replay scrubber
- Judge proof mode
- Run-vs-run diffing
- Session cloning for deterministic demos
- Annotated share links
- PDF and JSON proof export
- Playback speed and focus filters
- Plan revision timeline
- Session privacy controls
- Searchable archives

## Application Flows

### 1) Voice Goal to Settled Session

1. Capture goal via voice/text.
2. Planner emits a task DAG under budget constraints.
3. Discovery resolves candidate agents.
4. Execution runs by dependency groups.
5. Payment layer settles each task and stores receipts.
6. Narration synthesizes outputs and returns final response.
7. Session replay/proof is available in history.

### 2) Provider Onboarding

1. Provider submits capability + endpoint + pricing.
2. Platform validates schema and test responses.
3. Wallet and payout address are configured.
4. Listing is created in agent registry.
5. Agent goes live with metrics and health monitoring.

### 3) Contract Creation Flow

1. Initiate contract draft from provider or admin flow.
2. Select contract type (escrow, SLA, subscription, dispute-enabled).
3. Define terms: payer/payee, cap, timeout, success criteria.
4. Attach request/response hash binding rules.
5. Generate and validate versioned contract metadata.
6. Deploy contract and store address in registry.
7. Execute verification transaction and activate.

### 4) Task Escrow Flow

1. Session budget contract locks spend ceiling.
2. Each task allocates escrow amount.
3. Agent executes and returns verifiable output.
4. Success criteria check runs.
5. Contract releases payment or returns refund.
6. Receipt event updates session and ledger feed.

### 5) Dispute Flow

1. User flags task outcome.
2. Evidence package is assembled automatically.
3. Temporary hold is placed on unsettled payout.
4. Rule-based review/arbitration resolves outcome.
5. Contract executes release, split, or refund.
6. Reputation and analytics are updated.

### 6) Provider Payout Flow

1. Confirmed balances accrue by task.
2. Provider requests payout or uses scheduled payouts.
3. Contract checks holdbacks/disputes.
4. Net payout is sent and logged.
5. Statement entries are generated.

### 7) Session Replay and Proof Flow

1. Open historical session.
2. Rehydrate timeline from persisted events.
3. Replay plan, task, payment, and narration states.
4. Deep-link each transaction to explorer.
5. Export proof packet.

## Contracts to Prioritize

1. Agent Registry Contract
2. Session Budget Contract
3. Task Escrow Contract
4. SLA Contract
5. Reputation Contract
6. Dispute Resolution Contract
7. Subscription Contract
8. Revenue Share Contract

## Quick Commands

```bash
pnpm install
pnpm stellar:bootstrap
pnpm agents:seed
pnpm dev:web
pnpm dev:bridge
```

## Status

Synapse is optimized for hackathon demo velocity with production-oriented architecture and verifiable on-chain settlement.

## Detailed Roadmap

For the complete proposed feature catalog, application flows, and contract rollout plan, see FEATURES.md.
