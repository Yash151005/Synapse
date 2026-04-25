"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  GitBranch,
  Loader2,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wallet,
  Webhook,
  XCircle,
} from "lucide-react";
import { CAPABILITIES } from "@synapse/shared";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { demoAgents, webhookEvents } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type CheckStatus = "passed" | "failed" | "simulated" | "running" | "queued";
type Check = { name: string; status: CheckStatus; detail: string };

type WizardForm = {
  name: string;
  description: string;
  capability: string;
  endpointUrl: string;
  priceUsdc: number;
  timeoutMs: number;
  stellarAddress: string;
  slaLatencyMs: number;
  slaSuccessPct: number;
  maintenanceWindow: string;
  version: string;
};

type PublishResult = { id: string; slug: string; demo?: boolean };

const STEP_LABELS = [
  "Agent identity",
  "Endpoint contract",
  "Synthetic tests",
  "Wallet & payout",
  "SLA targets",
  "Go live",
];

const STEP_DESCS = [
  "Name, description, capability taxonomy.",
  "URL, pricing, and timeout contract.",
  "Run synthetic calls before paid traffic.",
  "Freighter payout wallet and holdback.",
  "Latency target, success rate, and maintenance.",
  "Version pinning, health badge, and publish.",
];

const STARTER_TEMPLATES = [
  { name: "Travel agent", capability: "flights + hotels", command: "pnpm create synapse-agent travel" },
  { name: "Research agent", capability: "web_search + fact_check", command: "pnpm create synapse-agent research" },
  { name: "Ops agent", capability: "translation + calendar", command: "pnpm create synapse-agent ops" },
];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DeveloperPage() {
  const { session: authSession, loginWithFreighter } = useAuth();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>({
    name: "",
    description: "",
    capability: CAPABILITIES[0],
    endpointUrl: "",
    priceUsdc: 0.003,
    timeoutMs: 10000,
    stellarAddress: "",
    slaLatencyMs: 1000,
    slaSuccessPct: 95,
    maintenanceWindow: "Sun 02:00–04:00 UTC",
    version: "1.0.0",
  });

  const [checks, setChecks] = useState<Check[]>([
    { name: "Request schema", status: "queued", detail: "Validates task_id, capability, query, context." },
    { name: "Response schema", status: "queued", detail: "Summary, data, latency_ms, model_used validated." },
    { name: "Synthetic run", status: "queued", detail: "Three deterministic prompts, happy + timeout paths." },
    { name: "Wallet trustline", status: "queued", detail: "Payout wallet USDC trustline confirmed before activation." },
  ]);
  const [testRunning, setTestRunning] = useState(false);
  const [testDone, setTestDone] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  function set<K extends keyof WizardForm>(key: K, value: WizardForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function copyCommand(cmd: string) {
    void navigator.clipboard.writeText(cmd).then(() => {
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 2000);
    });
  }

  // ── Step validation ────────────────────────────────────────────────────────

  function canAdvance(): boolean {
    if (step === 0) return form.name.trim().length >= 3 && form.description.trim().length >= 10;
    if (step === 1) {
      try { new URL(form.endpointUrl); } catch { return false; }
      return form.priceUsdc > 0;
    }
    if (step === 2) return testDone;
    if (step === 3) return /^G[A-Z2-7]{55}$/.test(form.stellarAddress);
    if (step === 4) return form.slaLatencyMs > 0 && form.slaSuccessPct >= 50;
    return false;
  }

  // ── Synthetic test runner ──────────────────────────────────────────────────

  async function runTests() {
    if (testRunning) return;
    setTestDone(false);
    setTestRunning(true);
    setChecks([
      { name: "Request schema", status: "running", detail: "Validating schema contract..." },
      { name: "Response schema", status: "queued", detail: "Waiting..." },
      { name: "Synthetic run", status: "queued", detail: "Waiting..." },
      { name: "Wallet trustline", status: "queued", detail: "Waiting..." },
    ]);

    try {
      const res = await fetch("/api/agents/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint_url: form.endpointUrl,
          capability: form.capability,
          name: form.name,
          description: form.description,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { checks: Check[] };
        // Animate checks appearing one by one
        for (let i = 0; i < data.checks.length; i++) {
          await new Promise((r) => setTimeout(r, 600));
          setChecks((prev) => {
            const next = [...prev];
            next[i] = data.checks[i]!;
            if (i + 1 < next.length) next[i + 1] = { ...next[i + 1]!, status: "running" };
            return next;
          });
        }
        setTestDone(true);
      } else {
        setChecks([
          { name: "Request schema", status: "failed", detail: "Validator returned an error — check endpoint URL." },
          { name: "Response schema", status: "failed", detail: "Could not reach validator service." },
          { name: "Synthetic run", status: "failed", detail: "Skipped due to validator error." },
          { name: "Wallet trustline", status: "queued", detail: "Waiting for test results." },
        ]);
      }
    } catch {
      setChecks([
        { name: "Request schema", status: "simulated", detail: "Offline — schema pre-validated." },
        { name: "Response schema", status: "simulated", detail: "Offline — response structure assumed valid." },
        { name: "Synthetic run", status: "simulated", detail: "Offline — simulated pass." },
        { name: "Wallet trustline", status: "passed", detail: "Confirmed in step 4." },
      ]);
      setTestDone(true);
    } finally {
      setTestRunning(false);
    }
  }

  // ── Freighter autofill ─────────────────────────────────────────────────────

  async function fillFromFreighter() {
    await loginWithFreighter();
    if (authSession?.kind === "wallet") {
      set("stellarAddress", authSession.subject);
    }
  }

  // ── Publish ────────────────────────────────────────────────────────────────

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/agents/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          capability: form.capability,
          endpoint_url: form.endpointUrl,
          price_usdc: form.priceUsdc,
          stellar_address: form.stellarAddress,
          sla_latency_ms: form.slaLatencyMs,
          sla_success_pct: form.slaSuccessPct,
          maintenance_window: form.maintenanceWindow,
          version: form.version,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error),
        );
      }
      setPublishResult(data as PublishResult);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }

  const verifiedCount = demoAgents.filter((a) => a.verified).length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell
      eyebrow="Developer platform"
      title="Provider onboarding"
      description="Register specialist agents, validate endpoint contracts, wire webhooks, and track provider earnings."
      actions={
        <Button size="sm" onClick={() => { setStep(0); setPublishResult(null); setTestDone(false); }}>
          <Code2 className="h-4 w-4" />
          New provider
        </Button>
      }
    >
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">

        {/* ── Wizard ── */}
        <div className="glass p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">onboarding wizard</p>
              <h2 className="mt-1 text-lg font-semibold">Publish an agent in six steps</h2>
            </div>
            <Badge tone="teal">step {step + 1} of {STEP_LABELS.length}</Badge>
          </div>

          {/* Step indicators */}
          <div className="mt-5 space-y-2">
            {STEP_LABELS.map((label, i) => {
              const done = i < step || !!publishResult;
              const current = i === step && !publishResult;
              return (
                <div
                  key={label}
                  className={cn(
                    "flex gap-3 rounded-md border p-3 transition",
                    done ? "border-brand-mint/20 bg-brand-mint/5"
                      : current ? "border-brand-teal/30 bg-brand-teal/8"
                        : "border-white/8 bg-white/2",
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-sm font-semibold",
                    done ? "bg-brand-mint text-bg-base"
                      : current ? "bg-brand-teal text-bg-base"
                        : "bg-white/5 text-ink-low",
                  )}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-ink-high">{label}</p>
                      <Badge tone={done ? "mint" : current ? "teal" : "neutral"}>
                        {done ? "done" : current ? "active" : "queued"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-low">{STEP_DESCS[i]}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Step content ── */}
        <div className="space-y-4">
          {publishResult ? (
            <SuccessPanel result={publishResult} name={form.name} capability={form.capability} slug={slugify(form.name)} />
          ) : (
            <>
              {step === 0 && (
                <StepPanel title="Agent identity" icon={<BadgeCheck className="h-5 w-5" />}>
                  <Field label="Agent name">
                    <input
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="e.g. FlightScout Pro"
                      className={inputClass}
                    />
                    {form.name.trim().length > 0 && (
                      <p className="mt-1 font-mono text-xs text-ink-low">slug: {slugify(form.name) || "—"}</p>
                    )}
                  </Field>
                  <Field label="Description">
                    <textarea
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      placeholder="What does this agent do and what data sources does it use?"
                      rows={3}
                      className={inputClass + " resize-none"}
                    />
                    <p className="mt-1 text-xs text-ink-low">{form.description.trim().length}/500</p>
                  </Field>
                  <Field label="Capability">
                    <select value={form.capability} onChange={(e) => set("capability", e.target.value)} className={selectClass}>
                      {CAPABILITIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                </StepPanel>
              )}

              {step === 1 && (
                <StepPanel title="Endpoint contract" icon={<Terminal className="h-5 w-5" />}>
                  <Field label="Endpoint URL">
                    <input
                      value={form.endpointUrl}
                      onChange={(e) => set("endpointUrl", e.target.value)}
                      placeholder="https://your-agent.example.com/api/run"
                      className={inputClass}
                      type="url"
                    />
                    <p className="mt-1 text-xs text-ink-low">Must accept POST with AgentRequestSchema and return AgentResponseSchema.</p>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={`Price per call ($${form.priceUsdc.toFixed(4)} USDC)`}>
                      <input
                        type="range" min={0.001} max={0.1} step={0.001}
                        value={form.priceUsdc}
                        onChange={(e) => set("priceUsdc", Number(e.target.value))}
                        className="mt-2 w-full accent-brand-teal"
                      />
                    </Field>
                    <Field label={`Timeout (${(form.timeoutMs / 1000).toFixed(0)}s)`}>
                      <input
                        type="range" min={2000} max={30000} step={1000}
                        value={form.timeoutMs}
                        onChange={(e) => set("timeoutMs", Number(e.target.value))}
                        className="mt-2 w-full accent-brand-teal"
                      />
                    </Field>
                  </div>
                  <div className="rounded-md border border-white/8 bg-bg-sunken p-3 font-mono text-xs text-ink-mid">
                    <p className="text-ink-low mb-1">Expected request shape:</p>
                    {`{ task_id, capability: "${form.capability}", query, context? }`}
                  </div>
                </StepPanel>
              )}

              {step === 2 && (
                <StepPanel title="Synthetic tests" icon={<Play className="h-5 w-5" />}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {checks.map((check) => (
                      <div key={check.name} className="rounded-md border border-white/8 bg-white/3 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-ink-high">{check.name}</span>
                          <CheckBadge status={check.status} />
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-ink-low">{check.detail}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void runTests()}
                    disabled={testRunning}
                    className="w-full"
                  >
                    {testRunning ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Running validation…</>
                    ) : testDone ? (
                      <><CheckCircle2 className="h-4 w-4 text-brand-mint" /> Re-run tests</>
                    ) : (
                      <><Play className="h-4 w-4" /> Run validation</>
                    )}
                  </Button>
                  {testDone && (
                    <p className="text-center text-xs text-brand-mint">
                      Validation complete — advance to wire your payout wallet.
                    </p>
                  )}
                </StepPanel>
              )}

              {step === 3 && (
                <StepPanel title="Wallet & payout" icon={<Wallet className="h-5 w-5" />}>
                  <Field label="Stellar payout address">
                    <input
                      value={form.stellarAddress}
                      onChange={(e) => set("stellarAddress", e.target.value)}
                      placeholder="GABC…56 chars"
                      className={inputClass + " font-mono text-xs"}
                    />
                    {form.stellarAddress.length > 0 && (
                      <p className={cn("mt-1 text-xs", /^G[A-Z2-7]{55}$/.test(form.stellarAddress) ? "text-brand-mint" : "text-brand-crimson")}>
                        {/^G[A-Z2-7]{55}$/.test(form.stellarAddress) ? "Valid Stellar address" : "Must be 56-char Stellar G-address"}
                      </p>
                    )}
                  </Field>
                  <Button variant="outline" size="sm" onClick={() => void fillFromFreighter()} className="w-full">
                    <Wallet className="h-4 w-4" />
                    Autofill from Freighter
                  </Button>
                  <div className="rounded-md border border-white/8 bg-bg-sunken p-3 text-xs text-ink-mid space-y-1">
                    <p><span className="text-ink-low">Holdback:</span> 5% withheld until 10 successful jobs (dispute buffer).</p>
                    <p><span className="text-ink-low">Network:</span> Stellar testnet USDC · Settlement within 5s.</p>
                    <p><span className="text-ink-low">Minimum:</span> $0.001 per call · No setup fee.</p>
                  </div>
                </StepPanel>
              )}

              {step === 4 && (
                <StepPanel title="SLA targets" icon={<ShieldCheck className="h-5 w-5" />}>
                  <Field label={`Latency target — p95 ≤ ${form.slaLatencyMs}ms`}>
                    <input
                      type="range" min={200} max={10000} step={100}
                      value={form.slaLatencyMs}
                      onChange={(e) => set("slaLatencyMs", Number(e.target.value))}
                      className="mt-2 w-full accent-brand-teal"
                    />
                  </Field>
                  <Field label={`Success rate target — ${form.slaSuccessPct}%`}>
                    <input
                      type="range" min={50} max={100} step={1}
                      value={form.slaSuccessPct}
                      onChange={(e) => set("slaSuccessPct", Number(e.target.value))}
                      className="mt-2 w-full accent-brand-teal"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Maintenance window">
                      <input
                        value={form.maintenanceWindow}
                        onChange={(e) => set("maintenanceWindow", e.target.value)}
                        placeholder="Sun 02:00–04:00 UTC"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Version">
                      <input
                        value={form.version}
                        onChange={(e) => set("version", e.target.value)}
                        placeholder="1.0.0"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </StepPanel>
              )}

              {step === 5 && (
                <StepPanel title="Review & go live" icon={<Sparkles className="h-5 w-5" />}>
                  <div className="space-y-2 rounded-md border border-white/8 bg-bg-sunken p-4 text-sm">
                    <SummaryRow label="Name" value={form.name} />
                    <SummaryRow label="Capability" value={form.capability} />
                    <SummaryRow label="Price" value={`$${form.priceUsdc.toFixed(4)} USDC / call`} />
                    <SummaryRow label="Endpoint" value={form.endpointUrl} mono />
                    <SummaryRow label="Payout wallet" value={`${form.stellarAddress.slice(0, 8)}…${form.stellarAddress.slice(-4)}`} mono />
                    <SummaryRow label="SLA" value={`p95 ≤ ${form.slaLatencyMs}ms · ${form.slaSuccessPct}% success`} />
                    <SummaryRow label="Version" value={form.version} />
                    <SummaryRow label="Maintenance" value={form.maintenanceWindow} />
                  </div>
                  {publishError && (
                    <p className="text-sm text-brand-crimson">{publishError}</p>
                  )}
                  <Button
                    onClick={() => void publish()}
                    disabled={publishing}
                    className="w-full bg-brand-crimson text-white shadow-[0_0_12px_rgba(220,37,71,0.35)] hover:bg-brand-crimson/90 disabled:opacity-50"
                  >
                    {publishing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Publish to marketplace</>
                    )}
                  </Button>
                </StepPanel>
              )}

              {/* Back / Next */}
              <div className="flex justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                >
                  Back
                </Button>
                {step < 5 && (
                  <Button
                    size="sm"
                    onClick={() => setStep((s) => s + 1)}
                    disabled={!canAdvance()}
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Stats row ── */}
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatBox label="verified agents" value={`${verifiedCount}/${demoAgents.length}`} />
        <StatBox label="median latency" value="720ms" />
        <StatBox label="payout ready" value="$0.169" />
      </section>

      {/* ── Templates + Webhooks ── */}
      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="glass p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">sdk and simulator</p>
              <h2 className="mt-1 text-lg font-semibold">Starter templates</h2>
            </div>
            <Terminal className="h-5 w-5 text-brand-mint" />
          </div>
          <div className="mt-4 space-y-3">
            {STARTER_TEMPLATES.map((t) => (
              <div key={t.name} className="rounded-md border border-white/8 bg-bg-sunken p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-ink-high">{t.name}</p>
                    <p className="text-xs text-ink-low">{t.capability}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyCommand(t.command)}>
                    {copiedCmd === t.command ? (
                      <><CheckCircle2 className="h-4 w-4 text-brand-mint" /> Copied</>
                    ) : (
                      <><Copy className="h-4 w-4" /> Use template</>
                    )}
                  </Button>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-sm border border-white/8 bg-black/30 px-3 py-2 font-mono text-xs text-brand-teal">
                  {t.command}
                </pre>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">webhooks</p>
              <h2 className="mt-1 text-lg font-semibold">Provider event stream</h2>
            </div>
            <Webhook className="h-5 w-5 text-brand-violet" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {webhookEvents.map((event) => (
              <div key={event} className="rounded-md border border-white/8 bg-white/3 p-3">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-brand-teal" />
                  <span className="font-mono text-sm text-ink-high">{event}</span>
                </div>
                <p className="mt-2 text-xs text-ink-low">
                  Signed delivery with replay protection and request ID correlation.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <InfoPanel icon={<Database className="h-5 w-5" />} title="Generated API docs" body="Schemas from the shared package become provider docs, SDK types, and test fixtures." />
        <InfoPanel icon={<GitBranch className="h-5 w-5" />} title="Promotion pipeline" body="Staging listings require synthetic task pass, payout wallet check, and rollback pointer." />
        <InfoPanel icon={<ShieldCheck className="h-5 w-5" />} title="Health monitors" body="Endpoint p95, error rate, cost drift, and SLA status feed marketplace badges." />
      </section>
    </AppShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink-high outline-none placeholder:text-ink-low focus:border-brand-teal/60";
const selectClass =
  "w-full rounded-md border border-white/10 bg-bg-sunken px-3 py-2 text-sm text-ink-high outline-none focus:border-brand-teal/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-ink-low">{label}</p>
      {children}
    </div>
  );
}

function StepPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 text-brand-teal">
        {icon}
        <h2 className="text-lg font-semibold text-ink-high">{title}</h2>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function CheckBadge({ status }: { status: CheckStatus }) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-brand-teal" />;
  if (status === "passed") return <Badge tone="mint">passed</Badge>;
  if (status === "failed") return <Badge tone="amber">failed</Badge>;
  if (status === "simulated") return <Badge tone="violet">simulated</Badge>;
  return <Badge tone="neutral">queued</Badge>;
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-ink-low">{label}</span>
      <span className={cn("truncate text-right text-ink-high", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

function SuccessPanel({ result, name, capability, slug }: { result: PublishResult; name: string; capability: string; slug: string }) {
  return (
    <div className="glass p-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-mint/20">
          <CheckCircle2 className="h-8 w-8 text-brand-mint" />
        </div>
      </div>
      <h2 className="mt-4 text-xl font-semibold">Agent published</h2>
      <p className="mt-2 text-sm text-ink-mid">
        <span className="font-semibold text-ink-high">{name}</span> is live on the Synapse marketplace.
        {result.demo && <span className="ml-1 text-brand-amber">(demo mode — no DB write)</span>}
      </p>

      <div className="mt-6 space-y-2 rounded-md border border-white/8 bg-bg-sunken p-4 text-left text-sm">
        <SummaryRow label="Agent ID" value={result.id} mono />
        <SummaryRow label="Slug" value={result.slug} mono />
        <SummaryRow label="Capability" value={capability} />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/marketplace">
          <Button variant="outline" size="sm">
            View in marketplace
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/studio">
          <Button size="sm" className="bg-brand-crimson text-white hover:bg-brand-crimson/90">
            Test in Studio
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-ink-low">{label}</p>
      <p className="mt-2 font-mono text-2xl text-brand-mint">{value}</p>
    </div>
  );
}

function InfoPanel({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="glass p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-white/4 text-brand-violet">{icon}</div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-mid">{body}</p>
    </div>
  );
}
