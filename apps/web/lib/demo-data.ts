import type { Capability } from "@synapse/shared";

export type DemoAgent = {
  id: string;
  name: string;
  slug: string;
  capability: Capability;
  description: string;
  price_usdc: number;
  stellar_address?: string;
  reputation: number;
  total_jobs: number;
  verified: boolean;
  region: string;
  dataResidency: string;
  status: "healthy" | "degraded" | "maintenance";
  version: string;
  sla: string;
  latencyMs: number;
  successRate: number;
  p95Cost: number;
  maintenanceWindow: string;
  collection: string;
};

export type DemoLedgerRow = {
  id: string;
  sessionId: string;
  agentName: string;
  capability: Capability;
  taskId: string;
  amountUsdc: number;
  status: "confirmed" | "pending" | "refunded" | "held";
  stellarTxHash: string;
  ledger: number;
  fromAddress: string;
  toAddress: string;
  requestHash: string;
  responseHash: string;
  memoHash: string;
  createdAt: string;
  releaseType: "escrow release" | "split payout" | "refund" | "budget lock";
};

export type DemoSession = {
  id: string;
  goal: string;
  status: "completed" | "running" | "review" | "failed";
  strategy: "balanced" | "cheapest" | "fastest";
  createdAt: string;
  completedAt?: string;
  durationSeconds: number;
  totalCostUsdc: number;
  receiptCount: number;
  riskScore: number;
  privacy: "private" | "team" | "shareable";
  narration: string;
  bookmarks: string[];
  tasks: Array<{
    id: string;
    title: string;
    capability: Capability;
    status: "done" | "running" | "held" | "failed";
    confidence: number;
    risk: "low" | "medium" | "high";
    agent: string;
    costUsdc: number;
  }>;
};

export type ContractModule = {
  name: string;
  priority: number;
  status: "draft" | "simulated" | "ready" | "blocked";
  description: string;
  terms: string[];
  nextAction: string;
};

export const demoAgents: DemoAgent[] = [
  {
    id: "agent-flight-01",
    name: "AeroScout",
    slug: "aeroscout",
    capability: "flights",
    description: "Compares airline inventory, fare classes, baggage fees, and schedule risk.",
    price_usdc: 0.004,
    reputation: 4.94,
    total_jobs: 18420,
    verified: true,
    region: "US-East",
    dataResidency: "US",
    status: "healthy",
    version: "v3.8.1",
    sla: "99.95%",
    latencyMs: 720,
    successRate: 99.1,
    p95Cost: 0.006,
    maintenanceWindow: "Sun 03:00 UTC",
    collection: "Travel stack",
  },
  {
    id: "agent-hotel-01",
    name: "StayRank",
    slug: "stayrank",
    capability: "hotels",
    description: "Ranks hotels by location fit, cancellation policy, tax load, and review quality.",
    price_usdc: 0.0035,
    reputation: 4.88,
    total_jobs: 15302,
    verified: true,
    region: "EU-West",
    dataResidency: "EU",
    status: "healthy",
    version: "v2.6.0",
    sla: "99.90%",
    latencyMs: 810,
    successRate: 98.6,
    p95Cost: 0.005,
    maintenanceWindow: "Sat 22:00 UTC",
    collection: "Travel stack",
  },
  {
    id: "agent-weather-01",
    name: "Nimbus Now",
    slug: "nimbus-now",
    capability: "weather",
    description: "Generates city and route forecasts with confidence bands and severe weather flags.",
    price_usdc: 0.0015,
    reputation: 4.91,
    total_jobs: 28104,
    verified: true,
    region: "Global",
    dataResidency: "Regional edge",
    status: "healthy",
    version: "v4.1.4",
    sla: "99.99%",
    latencyMs: 430,
    successRate: 99.4,
    p95Cost: 0.002,
    maintenanceWindow: "None planned",
    collection: "Research sprint",
  },
  {
    id: "agent-web-01",
    name: "Vector Scout",
    slug: "vector-scout",
    capability: "web_search",
    description: "Searches current sources, deduplicates claims, and returns cited answer packets.",
    price_usdc: 0.005,
    reputation: 4.82,
    total_jobs: 21489,
    verified: true,
    region: "US-West",
    dataResidency: "US",
    status: "degraded",
    version: "v5.0.2",
    sla: "99.50%",
    latencyMs: 1180,
    successRate: 97.9,
    p95Cost: 0.007,
    maintenanceWindow: "Patch in progress",
    collection: "Research sprint",
  },
  {
    id: "agent-currency-01",
    name: "FX Needle",
    slug: "fx-needle",
    capability: "currency",
    description: "Converts budgets and quotes with live FX, spread disclosure, and rounding policy.",
    price_usdc: 0.001,
    reputation: 4.96,
    total_jobs: 30912,
    verified: true,
    region: "Global",
    dataResidency: "No PII",
    status: "healthy",
    version: "v2.9.9",
    sla: "99.99%",
    latencyMs: 260,
    successRate: 99.8,
    p95Cost: 0.001,
    maintenanceWindow: "None planned",
    collection: "Finance ops",
  },
  {
    id: "agent-translation-01",
    name: "Polyglot Relay",
    slug: "polyglot-relay",
    capability: "translation",
    description: "Translates transcripts and narration with tone locking across 18 languages.",
    price_usdc: 0.002,
    reputation: 4.76,
    total_jobs: 12880,
    verified: false,
    region: "AP-South",
    dataResidency: "India",
    status: "healthy",
    version: "v1.7.3",
    sla: "99.70%",
    latencyMs: 640,
    successRate: 98.1,
    p95Cost: 0.003,
    maintenanceWindow: "Fri 19:00 UTC",
    collection: "Voice ops",
  },
  {
    id: "agent-fact-01",
    name: "ClaimCheck",
    slug: "claimcheck",
    capability: "fact_check",
    description: "Builds evidence packs, source quality grades, and confidence deltas for claims.",
    price_usdc: 0.006,
    reputation: 4.89,
    total_jobs: 9734,
    verified: true,
    region: "US-East",
    dataResidency: "US",
    status: "healthy",
    version: "v3.2.0",
    sla: "99.80%",
    latencyMs: 1320,
    successRate: 98.8,
    p95Cost: 0.009,
    maintenanceWindow: "Sun 01:00 UTC",
    collection: "Trust layer",
  },
  {
    id: "agent-calendar-01",
    name: "SlotSense",
    slug: "slotsense",
    capability: "calendar",
    description: "Finds free slots, builds meeting plans, and applies local timezone constraints.",
    price_usdc: 0.0025,
    reputation: 4.71,
    total_jobs: 8021,
    verified: false,
    region: "US-Central",
    dataResidency: "US",
    status: "maintenance",
    version: "v1.4.8",
    sla: "99.20%",
    latencyMs: 900,
    successRate: 96.4,
    p95Cost: 0.004,
    maintenanceWindow: "Now until 17:00 UTC",
    collection: "Operator mode",
  },
];

export const demoLedgerRows: DemoLedgerRow[] = [
  {
    id: "rcpt-1001",
    sessionId: "sess-travel-0425",
    agentName: "AeroScout",
    capability: "flights",
    taskId: "task-01",
    amountUsdc: 0.004,
    status: "confirmed",
    stellarTxHash: "8f7a25ce94a13b0e4875f0cb4f0d3a74d33a2d9f67eac9c73f64f493da61a22e",
    ledger: 1539204,
    fromAddress: "GB4SYNAPSEPLATFORMTREASURY7X7WALLETDEMO00000001",
    toAddress: "GBAEROSCOUTAGENTPAYMENTADDR7X7WALLETDEMO0001",
    requestHash: "a3de927f3bd911adf2f1341b418af387c129f5da942fe122083bc283a0f8f4e1",
    responseHash: "f68fb442d93f8e339006ed5fe8d02f466a46a8d3ea80fa77e67ef81b332a7140",
    memoHash: "a3de927f3bd911adf2f1341b418af387c129f5da942fe122083bc283a0f8f4e1",
    createdAt: "2026-04-25T10:31:12.000Z",
    releaseType: "escrow release",
  },
  {
    id: "rcpt-1002",
    sessionId: "sess-travel-0425",
    agentName: "StayRank",
    capability: "hotels",
    taskId: "task-02",
    amountUsdc: 0.0035,
    status: "confirmed",
    stellarTxHash: "6ac184780b7988db77fc3ea49dbedb47f0cda4d71986ebc40ac65e8390a65144",
    ledger: 1539208,
    fromAddress: "GB4SYNAPSEPLATFORMTREASURY7X7WALLETDEMO00000001",
    toAddress: "GBSTAYRANKAGENTPAYMENTADDR7X7WALLETDEMO00001",
    requestHash: "062c86a1d728fc70550afa3d9acdb217390559a8f551e3d8374e64ca25bfa998",
    responseHash: "e151a3f90d8afab4cd7d90bb44f4e2b34a7e2e3e8724dd337d65fdf0d562b7ab",
    memoHash: "062c86a1d728fc70550afa3d9acdb217390559a8f551e3d8374e64ca25bfa998",
    createdAt: "2026-04-25T10:31:18.000Z",
    releaseType: "split payout",
  },
  {
    id: "rcpt-1003",
    sessionId: "sess-travel-0425",
    agentName: "Nimbus Now",
    capability: "weather",
    taskId: "task-03",
    amountUsdc: 0.0015,
    status: "confirmed",
    stellarTxHash: "bbd0b5566f5b54c889ddf1e26c73589ba52de75366835f3df0d92060abf4fb20",
    ledger: 1539210,
    fromAddress: "GB4SYNAPSEPLATFORMTREASURY7X7WALLETDEMO00000001",
    toAddress: "GBNIMBUSNOWAGENTPAYMENTADDR7X7WALLETDEMO001",
    requestHash: "abf94da93ad0491d98ab024f0a4d27908f9acee93d15b8c64fb0a5bd1d8eeb15",
    responseHash: "72e4f016cb3a6aa8f742bcb2eaf2a2d21f0934ab3489f8437899c3fbb18495a9",
    memoHash: "abf94da93ad0491d98ab024f0a4d27908f9acee93d15b8c64fb0a5bd1d8eeb15",
    createdAt: "2026-04-25T10:31:26.000Z",
    releaseType: "escrow release",
  },
  {
    id: "rcpt-1004",
    sessionId: "sess-research-0419",
    agentName: "Vector Scout",
    capability: "web_search",
    taskId: "task-01",
    amountUsdc: 0.005,
    status: "held",
    stellarTxHash: "42a6065fd70f7d9165d4f4b63c8d2ea9346e1da7108091b6d83874e732230c19",
    ledger: 1539011,
    fromAddress: "GB4SYNAPSEPLATFORMTREASURY7X7WALLETDEMO00000001",
    toAddress: "GBVECTORSCOUTAGENTPAYMENTADDR7X7WALLETDEMO01",
    requestHash: "b0405d6f8c3c697f6d598b52f73b91947eb6c63d8a64ddfe1437f6ba8b40bd31",
    responseHash: "98b33f89d07fc8d9769a7ea8d45b3d07afc7c30fc10d2f138f24853f72061b29",
    memoHash: "b0405d6f8c3c697f6d598b52f73b91947eb6c63d8a64ddfe1437f6ba8b40bd31",
    createdAt: "2026-04-19T15:02:04.000Z",
    releaseType: "budget lock",
  },
  {
    id: "rcpt-1005",
    sessionId: "sess-research-0419",
    agentName: "ClaimCheck",
    capability: "fact_check",
    taskId: "task-02",
    amountUsdc: 0.006,
    status: "pending",
    stellarTxHash: "1eb6c8da731905be645f42d5ae46a403bb66bdf6ce482ad290036f98ebf7831f",
    ledger: 1539018,
    fromAddress: "GB4SYNAPSEPLATFORMTREASURY7X7WALLETDEMO00000001",
    toAddress: "GBCLAIMCHECKAGENTPAYMENTADDR7X7WALLETDEMO001",
    requestHash: "10ea2cc2438440dbe44c51650156e454ba218df17d7362eafdd5c9800d97222a",
    responseHash: "44b8e876f8f64c7eb74f91b811654eb5da07f9d7c16b564a9c02a5439825b762",
    memoHash: "10ea2cc2438440dbe44c51650156e454ba218df17d7362eafdd5c9800d97222a",
    createdAt: "2026-04-19T15:02:48.000Z",
    releaseType: "escrow release",
  },
];

export const demoSessions: DemoSession[] = [
  {
    id: "sess-travel-0425",
    goal: "Plan a two-day New York trip under $900 with flights, hotel, and weather risk.",
    status: "completed",
    strategy: "balanced",
    createdAt: "2026-04-25T10:30:58.000Z",
    completedAt: "2026-04-25T10:31:38.000Z",
    durationSeconds: 40,
    totalCostUsdc: 0.009,
    receiptCount: 3,
    riskScore: 18,
    privacy: "shareable",
    narration:
      "Found a low-risk itinerary with a morning outbound flight, a verified hotel near transit, and clear weather windows for both travel days.",
    bookmarks: ["flight option", "hotel shortlist", "proof packet"],
    tasks: [
      {
        id: "task-01",
        title: "Compare flight options and baggage rules",
        capability: "flights",
        status: "done",
        confidence: 94,
        risk: "low",
        agent: "AeroScout",
        costUsdc: 0.004,
      },
      {
        id: "task-02",
        title: "Rank hotels by total stay cost",
        capability: "hotels",
        status: "done",
        confidence: 91,
        risk: "low",
        agent: "StayRank",
        costUsdc: 0.0035,
      },
      {
        id: "task-03",
        title: "Check weather and schedule risk",
        capability: "weather",
        status: "done",
        confidence: 96,
        risk: "low",
        agent: "Nimbus Now",
        costUsdc: 0.0015,
      },
    ],
  },
  {
    id: "sess-research-0419",
    goal: "Build an evidence pack for a launch claim and flag uncertain sources.",
    status: "review",
    strategy: "fastest",
    createdAt: "2026-04-19T15:01:38.000Z",
    durationSeconds: 73,
    totalCostUsdc: 0.011,
    receiptCount: 2,
    riskScore: 62,
    privacy: "team",
    narration:
      "Two strong sources agree on the core claim, but one payment remains held while a citation mismatch is reviewed.",
    bookmarks: ["citation mismatch", "held payout", "review note"],
    tasks: [
      {
        id: "task-01",
        title: "Find current sources and remove duplicates",
        capability: "web_search",
        status: "held",
        confidence: 82,
        risk: "medium",
        agent: "Vector Scout",
        costUsdc: 0.005,
      },
      {
        id: "task-02",
        title: "Verify claims against trusted evidence",
        capability: "fact_check",
        status: "running",
        confidence: 78,
        risk: "medium",
        agent: "ClaimCheck",
        costUsdc: 0.006,
      },
    ],
  },
  {
    id: "sess-ops-0416",
    goal: "Translate a customer incident summary and schedule the follow-up review.",
    status: "completed",
    strategy: "cheapest",
    createdAt: "2026-04-16T08:12:20.000Z",
    completedAt: "2026-04-16T08:13:11.000Z",
    durationSeconds: 51,
    totalCostUsdc: 0.0045,
    receiptCount: 2,
    riskScore: 24,
    privacy: "private",
    narration:
      "The incident summary was translated with technical tone preserved and the review was scheduled in both local time zones.",
    bookmarks: ["translated brief", "calendar invite"],
    tasks: [
      {
        id: "task-01",
        title: "Translate incident report with tone lock",
        capability: "translation",
        status: "done",
        confidence: 89,
        risk: "low",
        agent: "Polyglot Relay",
        costUsdc: 0.002,
      },
      {
        id: "task-02",
        title: "Find review slot and generate agenda",
        capability: "calendar",
        status: "done",
        confidence: 86,
        risk: "low",
        agent: "SlotSense",
        costUsdc: 0.0025,
      },
    ],
  },
];

export const contractModules: ContractModule[] = [
  {
    name: "Agent Registry Contract",
    priority: 1,
    status: "ready",
    description: "Owns verified provider identity, active endpoint metadata, version pins, and rollback state.",
    terms: ["capability hash", "provider wallet", "version pointer", "health threshold"],
    nextAction: "Deploy testnet registry and bind marketplace listings.",
  },
  {
    name: "Session Budget Contract",
    priority: 2,
    status: "simulated",
    description: "Locks a session spend ceiling before orchestration and rejects repricing above policy.",
    terms: ["payer", "budget cap", "expiry", "approval threshold"],
    nextAction: "Connect budget guardian UI to contract invocation.",
  },
  {
    name: "Task Escrow Contract",
    priority: 3,
    status: "simulated",
    description: "Allocates task-level escrow, validates success criteria, and releases or refunds each task.",
    terms: ["task id", "max price", "request hash", "success rule"],
    nextAction: "Finalize release/refund event schema.",
  },
  {
    name: "SLA Contract",
    priority: 4,
    status: "draft",
    description: "Applies provider latency, uptime, and quality commitments with automatic fee adjustments.",
    terms: ["latency p95", "success rate", "credit rate", "measurement window"],
    nextAction: "Map marketplace benchmark cards to SLA fields.",
  },
  {
    name: "Reputation Contract",
    priority: 5,
    status: "draft",
    description: "Stores quality, cost, latency, and dispute-weighted reputation deltas.",
    terms: ["quality score", "latency score", "dispute penalty", "decay factor"],
    nextAction: "Agree on score weights and anti-gaming policy.",
  },
  {
    name: "Dispute Contract",
    priority: 6,
    status: "draft",
    description: "Places holds, attaches evidence bundles, and executes release, split, or refund outcomes.",
    terms: ["evidence hash", "hold amount", "reviewer", "resolution code"],
    nextAction: "Wire governance evidence pack export.",
  },
];

export const providerWizardSteps = [
  "Profile and capability",
  "Endpoint schema validation",
  "Synthetic task run",
  "Wallet and payout setup",
  "SLA and pricing policy",
  "Publish listing",
];

export const webhookEvents = [
  "task.started",
  "task.output_submitted",
  "task.paid",
  "task.failed",
  "dispute.opened",
  "provider.health_changed",
];

export const governanceDisputes = [
  {
    id: "DSP-204",
    sessionId: "sess-research-0419",
    title: "Citation mismatch in research packet",
    amountUsdc: 0.005,
    status: "evidence ready",
    severity: "medium",
    due: "2026-04-26 10:00 UTC",
  },
  {
    id: "DSP-199",
    sessionId: "sess-ops-0416",
    title: "User requested translation tone review",
    amountUsdc: 0.002,
    status: "resolved split",
    severity: "low",
    due: "2026-04-18 11:00 UTC",
  },
];

export const policyControls = [
  {
    name: "Sensitive task confirmation",
    state: "on",
    detail: "Require a second confirmation for wallet, legal, medical, and hiring-sensitive actions.",
  },
  {
    name: "Endpoint anomaly throttling",
    state: "monitor",
    detail: "Throttle providers when latency, error rate, or price deviates from the rolling baseline.",
  },
  {
    name: "Enterprise approval gate",
    state: "on",
    detail: "Route sessions above $0.05 or risk score 70 to budget owner approval.",
  },
  {
    name: "Compliance export retention",
    state: "30 days",
    detail: "Retain proof packets and audit events for team export windows.",
  },
];

export function getDemoSession(id: string): DemoSession {
  return demoSessions.find((session) => session.id === id) ?? demoSessions[0]!;
}

export function getSessionReceipts(sessionId: string): DemoLedgerRow[] {
  return demoLedgerRows.filter((row) => row.sessionId === sessionId);
}
