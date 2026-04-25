# Synapse Feature Catalog (Complete Proposed List)

This document is the complete feature proposal baseline for Synapse.

Status legend:
- [x] Live now
- [~] In progress
- [ ] Proposed

## 1) Voice and Studio

- [x] Voice input via browser mic
- [x] Text fallback goal input
- [x] Push-to-talk interaction
- [x] Reactive voice orb visualization
- [x] Session narration text output
- [x] Basic narration playback
- [~] Quick demo goal presets
- [ ] Real-time transcript timeline with confidence heatmap
- [ ] Multi-language voice input and narration
- [ ] Voice command history with one-click rerun
- [ ] Interrupt-and-replan while tasks are running
- [ ] Context carry-over between sessions
- [ ] Narration persona switcher (concise, executive, technical)
- [ ] Live planner thought stream panel
- [ ] Demo hotkeys (run, replay, mute, reset)
- [ ] Accessibility mode (captions, reduced motion, high contrast)
- [ ] Session bookmarks and clip export

## 2) Planning and Orchestration

- [x] Goal decomposition into tasks
- [x] Parallel group execution support
- [x] Task dependency handling
- [x] Multi-LLM routing (planner vs executor)
- [x] Task-level execution results collection
- [~] Budget slider at run time
- [ ] Planner confidence score per task
- [ ] Risk flagging for uncertain tasks
- [ ] Alternate plan generation and compare mode
- [ ] Strategy modes (cheapest, fastest, balanced)
- [ ] Deadline-aware planning mode
- [ ] Automatic fallback agent routing
- [ ] Retry policy with backoff and circuit breaker
- [ ] Partial-success completion UX and policy
- [ ] Agent selection explainability panel
- [ ] Dynamic repricing and user confirmation policy

## 3) Marketplace and Provider Discovery

- [x] Agent listing grid
- [x] Capability and text search
- [x] Price and reputation display
- [~] Capability filters and sort controls
- [ ] Capability taxonomy and subcategory model
- [ ] Verified provider badges
- [ ] Provider benchmark cards (latency, success, cost)
- [ ] Region and data residency routing controls
- [ ] Agent versioning and rollback
- [ ] Provider changelog and maintenance windows
- [ ] Featured collections by workflow type
- [ ] Marketplace leaderboard views
- [ ] SLA and health status badges
- [ ] Provider onboarding wizard with staged validation
- [ ] Per-capability quality scorecards

## 4) Payments, Ledger, and Receipts

- [x] Task-level Stellar payment submission
- [x] Confirmation polling and receipt persistence
- [x] Explorer deep links in ledger feed
- [x] Request hash binding in memo pathway
- [~] Live cost meter UX
- [ ] Task-level escrow release contracts
- [ ] Session budget lock contract
- [ ] Split payouts for composite task bundles
- [ ] Auto-refund on timeout/failure rules
- [ ] Sponsor mode for onboarding users
- [ ] Live FX conversion in cost meter
- [ ] Fee forecast and cap warning panel
- [ ] Guest wallet with enforceable spend limits
- [ ] Scheduled and batched provider payouts
- [ ] Receipt verification panel with hash compare UI

## 5) Trust, Safety, and Governance

- [x] Basic validated request and response schema layer
- [ ] Composite reputation model (quality, latency, disputes)
- [ ] Dispute flow with evidence bundles
- [ ] Endpoint risk scoring and anomaly detection
- [ ] Content safety filter chain before narration
- [ ] Sensitive action confirmation gate
- [ ] Full audit log of state transitions
- [ ] Compliance export pack (session + receipt proof)
- [ ] SLA policy templates per provider tier
- [ ] Governance controls for marketplace policy
- [ ] Incident review and remediation dashboard

## 6) Developer Platform and Provider Experience

- [x] Capability endpoint contract via shared schemas
- [x] Seed script for demo agents
- [x] Bootstrap script for Stellar setup
- [ ] Agent SDK (typescript starter)
- [ ] Local simulator for provider endpoints
- [ ] Contract-aware integration test harness
- [ ] Sandbox mode with synthetic billing and mock receipts
- [ ] Provider webhooks (task.started, task.paid, task.failed)
- [ ] Provider earnings and retention analytics
- [ ] Billing statements and payout exports
- [ ] Staging-to-production promotion pipeline
- [ ] Endpoint health monitor and alerting
- [ ] Auto-generated API docs from schema
- [ ] Capability starter templates by category

## 7) Session Timeline and Replay

- [x] Session detail view
- [x] Receipt list and tx links
- [ ] Time-travel replay scrubber
- [ ] Judge proof mode UI
- [ ] Run-vs-run comparison for same goal
- [ ] Session cloning for deterministic demo runs
- [ ] Annotated share links and comments
- [ ] PDF and JSON proof export
- [ ] Playback speed and focus filters
- [ ] Plan revision timeline
- [ ] Session privacy controls
- [ ] Searchable session archive index

## 8) Mobile App Expansion

- [x] Expo skeleton with navigation
- [x] Environment scaffolding for mobile runtime
- [ ] Push notifications for task completion
- [ ] Lock-screen quick actions
- [ ] Offline queue with deferred sync
- [ ] Deep-link wallet connect flow
- [ ] Biometric confirmation for critical actions
- [ ] Operator mode with compact live feed
- [ ] Agent watchlist and price alerts
- [ ] Session replay support on mobile
- [ ] Provider dashboard in mobile app

## 9) Growth and Business

- [ ] Referral and affiliate model
- [ ] Trial credits and per-agent coupons
- [ ] Team plans with budgets and seats
- [ ] Enterprise private marketplace
- [ ] White-label orchestration API
- [ ] Public status page with SLA
- [ ] Revenue-share policy contracts
- [ ] Provider promotion placements
- [ ] Integration packs (CRM/ticketing)
- [ ] Localization and regional launch kits

## 10) Application Flows (Complete List)

### A) Voice Goal to Settled Session
1. User submits goal by voice or text.
2. Planner generates task DAG.
3. Discovery selects candidate agents.
4. Execution runs by dependency groups.
5. Payment settles per task and receipts are stored.
6. Narration is generated and returned.
7. Session timeline and proof are available.

### B) Provider Onboarding
1. Provider submits capability, endpoint, pricing, SLA.
2. Validation and synthetic test calls run.
3. Wallet and payout setup is completed.
4. Registry entry is created.
5. Listing is published and monitored.

### C) Contract Creation
1. Draft contract from provider or admin flow.
2. Select contract type (escrow, SLA, subscription, dispute-enabled).
3. Define terms (payer, payee, cap, timeout, success criteria).
4. Configure request/response hash binding.
5. Generate metadata and version hash.
6. Deploy contract.
7. Link contract to listing/session policy.
8. Execute verification transaction.
9. Activate contract.

### D) Task Escrow
1. Session budget is locked.
2. Task escrow allocation is created.
3. Agent executes task.
4. Success verification runs.
5. Release or refund is executed.
6. Receipt event is emitted and indexed.

### E) Dispute and Arbitration
1. User raises dispute.
2. Evidence package is auto-collected.
3. Hold is placed on unsettled payout.
4. Arbitration policy resolves outcome.
5. Release, split, or refund is executed.
6. Reputation and metrics are updated.

### F) Provider Payout
1. Confirmed balance accrues.
2. Provider triggers payout or auto-sweep.
3. Holdbacks and disputes are checked.
4. Net payout settles.
5. Statement and export entries are generated.

### G) Replay and Verification
1. Session is opened in replay mode.
2. Timeline rehydrates from events.
3. Planner, task, payment, narration replay is rendered.
4. Explorer links and hash proofs are displayed.
5. Proof packet export is generated.

### H) Failure Recovery
1. Task timeout or failure occurs.
2. Retry policy applies.
3. Fallback provider may be selected.
4. Partial completion policy determines continuation.
5. Settlement ensures no duplicate payment.

### I) Enterprise Approval
1. Goal is submitted under team policy.
2. Budget and risk guard checks run.
3. If threshold exceeded, approval is requested.
4. Session starts only after approval.
5. All events are auditable and exportable.

## 11) Contract Modules (Priority)

- [ ] AgentRegistryContract
- [ ] SessionBudgetContract
- [ ] TaskEscrowContract
- [ ] SLAContract
- [ ] ReputationContract
- [ ] DisputeContract
- [ ] SubscriptionContract
- [ ] RevenueShareContract

## 12) Recommended Delivery Order

### Phase 1 (Demo-impact first)
- Task escrow release
- Proof verification panel
- Replay scrubber
- Budget guardian
- Fallback rerouting with reason visibility

### Phase 2 (Provider and marketplace maturity)
- Provider onboarding wizard
- Benchmarks and SLA badges
- Webhooks and analytics
- Payout exports and statements

### Phase 3 (Contract and enterprise)
- Full contract suite deployment
- Dispute workflow automation
- Team approval and compliance exports
- Enterprise private marketplace
