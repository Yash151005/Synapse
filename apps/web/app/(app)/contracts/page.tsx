"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Copy,
  Database,
  Download,
  FileText,
  Gavel,
  Lock,
  Play,
  RefreshCw,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { contractModules } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

type ContractType =
  | "TaskEscrow"
  | "SessionBudget"
  | "SLA"
  | "Dispute"
  | "AgentRegistry"
  | "RevenueShare";

type DeployState = "draft" | "metadata" | "deployed" | "verified" | "active";
type EscrowStatus = "queued" | "locked" | "released" | "held" | "refunded";

type ContractForm = {
  type: ContractType;
  payer: string;
  payee: string;
  capUsdc: number;
  timeoutSec: number;
  successCriteria: string;
  requestHashRule: string;
  responseHashRule: string;
  releaseRule: string;
  refundRule: string;
  reviewerPolicy: string;
  version: string;
};

type EscrowTask = {
  id: string;
  label: string;
  amountUsdc: number;
  status: EscrowStatus;
  note: string;
};

const typeOptions: ContractType[] = [
  "TaskEscrow",
  "SessionBudget",
  "SLA",
  "Dispute",
  "AgentRegistry",
  "RevenueShare",
];

const contractTypeByModule: Record<string, ContractType> = {
  "Agent Registry Contract": "AgentRegistry",
  "Session Budget Contract": "SessionBudget",
  "Task Escrow Contract": "TaskEscrow",
  "SLA Contract": "SLA",
  "Reputation Contract": "SLA",
  "Dispute Contract": "Dispute",
};

const initialForm: ContractForm = {
  type: "TaskEscrow",
  payer: "GB4SYNAPSEPLATFORMTREASURY7X7WALLETDEMO00000001",
  payee: "GBNIMBUSNOWAGENTPAYMENTADDR7X7WALLETDEMO001",
  capUsdc: 0.05,
  timeoutSec: 90,
  successCriteria: "agent_response.ok == true && response_hash_present",
  requestHashRule: "memo_hash == sha256(request_payload)",
  responseHashRule: "receipt.response_hash == sha256(agent_response)",
  releaseRule: "hash_match && success",
  refundRule: "timeout || failed || reviewer_refund",
  reviewerPolicy: "single reviewer can release, split, or refund held payouts",
  version: "0.3.0",
};

const initialTasks: EscrowTask[] = [
  {
    id: "task-01",
    label: "Agent output accepted",
    amountUsdc: 0.004,
    status: "queued",
    note: "request hash matched memo hash",
  },
  {
    id: "task-02",
    label: "Citation mismatch",
    amountUsdc: 0.0035,
    status: "queued",
    note: "evidence pack attached",
  },
  {
    id: "task-03",
    label: "Provider timeout",
    amountUsdc: 0.0015,
    status: "queued",
    note: "fallback selected after retry budget",
  },
];

const statusTone: Record<EscrowStatus, "neutral" | "teal" | "mint" | "amber" | "crimson"> = {
  queued: "neutral",
  locked: "teal",
  released: "mint",
  held: "amber",
  refunded: "crimson",
};

function stableHash(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Array.from({ length: 8 }, (_, i) => ((hash >>> ((i % 4) * 8)) & 255).toString(16).padStart(2, "0")).join("");
}

function makeMetadata(form: ContractForm) {
  const base = {
    contract: form.type,
    network: "stellar-testnet",
    version: form.version,
    terms: {
      payer: form.payer,
      payee: form.payee,
      cap: form.capUsdc.toFixed(7),
      timeoutSec: form.timeoutSec,
      successCriteria: form.successCriteria,
      reviewerPolicy: form.reviewerPolicy,
    },
    binding: {
      request: form.requestHashRule,
      response: form.responseHashRule,
    },
    policy: {
      releaseRule: form.releaseRule,
      refundRule: form.refundRule,
    },
  };
  return {
    ...base,
    metadataHash: `syn-${stableHash(JSON.stringify(base))}`,
    generatedAt: new Date().toISOString(),
  };
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ContractsPage() {
  const router = useRouter();
  const [form, setForm] = useState<ContractForm>(initialForm);
  const [deployState, setDeployState] = useState<DeployState>("draft");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deployment, setDeployment] = useState({
    contractId: "",
    txHash: "",
    verificationTx: "",
    activatedAt: "",
  });
  const [tasks, setTasks] = useState<EscrowTask[]>(initialTasks);

  const metadata = useMemo(() => makeMetadata(form), [form]);
  const metadataText = useMemo(() => JSON.stringify(metadata, null, 2), [metadata]);
  const lockedTotal = tasks.filter((task) => task.status !== "queued").reduce((sum, task) => sum + task.amountUsdc, 0);
  const releasedTotal = tasks.filter((task) => task.status === "released").reduce((sum, task) => sum + task.amountUsdc, 0);
  const heldTotal = tasks.filter((task) => task.status === "held").reduce((sum, task) => sum + task.amountUsdc, 0);

  function set<K extends keyof ContractForm>(key: K, value: ContractForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (deployState !== "draft") setDeployState("draft");
  }

  function selectModule(moduleName: string) {
    const type = contractTypeByModule[moduleName] ?? "TaskEscrow";
    set("type", type);
  }

  function generateMetadata() {
    setDeployState("metadata");
  }

  async function deploy() {
    setBusy("deploy");
    await new Promise((resolve) => setTimeout(resolve, 900));
    setDeployment((prev) => ({
      ...prev,
      contractId: `C${stableHash(`${metadata.metadataHash}:contract`).toUpperCase()}TESTNET${form.type.toUpperCase()}`,
      txHash: `${stableHash(`${metadata.metadataHash}:deploy`)}${stableHash(form.payer)}${stableHash(form.payee)}`,
    }));
    setDeployState("deployed");
    setBusy(null);
  }

  async function verify() {
    setBusy("verify");
    await new Promise((resolve) => setTimeout(resolve, 850));
    setDeployment((prev) => ({
      ...prev,
      verificationTx: `${stableHash(`${metadata.metadataHash}:verify`)}${stableHash(String(form.capUsdc))}`,
    }));
    setDeployState("verified");
    setBusy(null);
  }

  async function activate() {
    setBusy("activate");
    await new Promise((resolve) => setTimeout(resolve, 650));
    setDeployment((prev) => ({ ...prev, activatedAt: new Date().toISOString() }));
    setDeployState("active");
    setBusy(null);
  }

  function resetWorkflow() {
    setForm(initialForm);
    setDeployState("draft");
    setBusy(null);
    setCopied(false);
    setDeployment({ contractId: "", txHash: "", verificationTx: "", activatedAt: "" });
    setTasks(initialTasks);
  }

  async function copyMetadata() {
    await navigator.clipboard.writeText(metadataText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function sendToStudio() {
    localStorage.setItem(
      "synapse.prefillGoal",
      `Draft and review a ${form.type} contract with ${form.capUsdc.toFixed(3)} XLM cap, ${form.timeoutSec}s timeout, release rule "${form.releaseRule}", and refund rule "${form.refundRule}" on Stellar testnet.`,
    );
    router.push("/studio");
  }

  function runEscrowSimulation() {
    setTasks(initialTasks.map((task) => ({ ...task, status: "locked" })));
    setTimeout(() => {
      setTasks([
        { ...initialTasks[0]!, status: "released" },
        { ...initialTasks[1]!, status: "held" },
        { ...initialTasks[2]!, status: "refunded" },
      ]);
    }, 850);
  }

  function updateTaskStatus(id: string, status: EscrowStatus) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status } : task)));
  }

  return (
    <AppShell
      eyebrow="On-chain modules"
      title="Contract suite"
      description="Design escrow, budget locks, SLA enforcement, reputation, disputes, subscriptions, and revenue share contracts."
      actions={
        <>
          <Button size="sm" variant="outline" onClick={resetWorkflow}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button size="sm" onClick={sendToStudio}>
            <FileText className="h-4 w-4" />
            Draft contract
          </Button>
        </>
      }
    >
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="glass p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">creation flow</p>
              <h2 className="mt-1 text-lg font-semibold">Contract creation workspace</h2>
            </div>
            <Badge tone={deployState === "active" ? "mint" : "teal"}>{deployState}</Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="Contract type">
              <select value={form.type} onChange={(e) => set("type", e.target.value as ContractType)} className={selectClass}>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field label="Version">
              <input value={form.version} onChange={(e) => set("version", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Payer wallet">
              <input value={form.payer} onChange={(e) => set("payer", e.target.value)} className={`${inputClass} font-mono text-xs`} />
            </Field>
            <Field label="Payee wallet">
              <input value={form.payee} onChange={(e) => set("payee", e.target.value)} className={`${inputClass} font-mono text-xs`} />
            </Field>
            <Field label={`Cap ${form.capUsdc.toFixed(3)} XLM`}>
              <input type="range" min={0.001} max={1} step={0.001} value={form.capUsdc} onChange={(e) => set("capUsdc", Number(e.target.value))} className="w-full accent-brand-teal" />
            </Field>
            <Field label={`Timeout ${form.timeoutSec}s`}>
              <input type="range" min={15} max={600} step={15} value={form.timeoutSec} onChange={(e) => set("timeoutSec", Number(e.target.value))} className="w-full accent-brand-teal" />
            </Field>
            <Field label="Success criteria">
              <input value={form.successCriteria} onChange={(e) => set("successCriteria", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Reviewer policy">
              <input value={form.reviewerPolicy} onChange={(e) => set("reviewerPolicy", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Request hash rule">
              <input value={form.requestHashRule} onChange={(e) => set("requestHashRule", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Response hash rule">
              <input value={form.responseHashRule} onChange={(e) => set("responseHashRule", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Release rule">
              <input value={form.releaseRule} onChange={(e) => set("releaseRule", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Refund rule">
              <input value={form.refundRule} onChange={(e) => set("refundRule", e.target.value)} className={inputClass} />
            </Field>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <Button size="sm" variant={deployState === "metadata" ? "success" : "outline"} onClick={generateMetadata}>
              <Clipboard className="h-4 w-4" />
              Generate
            </Button>
            <Button size="sm" variant={deployState === "deployed" ? "success" : "outline"} disabled={deployState === "draft" || busy === "deploy"} onClick={() => void deploy()}>
              {busy === "deploy" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Deploy
            </Button>
            <Button size="sm" variant={deployState === "verified" ? "success" : "outline"} disabled={deployState !== "deployed" || busy === "verify"} onClick={() => void verify()}>
              {busy === "verify" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Verify
            </Button>
            <Button size="sm" variant={deployState === "active" ? "success" : "outline"} disabled={deployState !== "verified" || busy === "activate"} onClick={() => void activate()}>
              {busy === "activate" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Activate
            </Button>
          </div>

          <div className="mt-4 rounded-md border border-white/8 bg-bg-sunken p-3 text-xs">
            <StatusRow label="Contract ID" value={deployment.contractId || "not deployed"} />
            <StatusRow label="Deploy tx" value={deployment.txHash || "waiting"} />
            <StatusRow label="Verification tx" value={deployment.verificationTx || "waiting"} />
            <StatusRow label="Activated at" value={deployment.activatedAt || "waiting"} />
          </div>
        </div>

        <div className="glass p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">module backlog</p>
              <h2 className="mt-1 text-lg font-semibold">Priority contracts</h2>
            </div>
            <Badge tone="amber">click to load</Badge>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {contractModules.map((module) => {
              const selected = contractTypeByModule[module.name] === form.type;
              return (
                <div key={module.name} className={cn("rounded-md border p-4 transition", selected ? "border-brand-teal/40 bg-brand-teal/10" : "border-white/8 bg-white/[0.03]")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-high">{module.name}</p>
                      <p className="mt-1 text-xs text-ink-low">Priority {module.priority}</p>
                    </div>
                    <Badge tone={module.status === "ready" ? "mint" : module.status === "simulated" ? "teal" : module.status === "blocked" ? "crimson" : "neutral"}>
                      {module.status}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-mid">{module.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {module.terms.map((term) => (
                      <span key={term} className="rounded-full border border-white/8 bg-bg-sunken px-2 py-1 text-[11px] text-ink-low">
                        {term}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-brand-teal">{module.nextAction}</p>
                    <Button size="sm" variant={selected ? "success" : "outline"} onClick={() => selectModule(module.name)}>
                      {selected ? "Loaded" : "Use"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="glass p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">task escrow simulation</p>
              <h2 className="mt-1 text-lg font-semibold">Release, hold, or refund flow</h2>
            </div>
            <Button size="sm" variant="outline" onClick={runEscrowSimulation}>
              <Play className="h-4 w-4" />
              Run simulation
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Metric icon={<Lock className="h-5 w-5 text-brand-teal" />} label="Budget locked" value={`${form.capUsdc.toFixed(3)} XLM`} />
            <Metric icon={<Wallet className="h-5 w-5 text-brand-teal" />} label="Task escrow" value={`${lockedTotal.toFixed(4)} XLM`} />
            <Metric icon={<Receipt className="h-5 w-5 text-brand-teal" />} label="Released" value={`${releasedTotal.toFixed(4)} XLM`} />
            <Metric icon={<Gavel className="h-5 w-5 text-brand-teal" />} label="Held" value={`${heldTotal.toFixed(4)} XLM`} />
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-white/8 bg-bg-sunken">
            {tasks.map((task) => (
              <div key={task.id} className="grid gap-3 border-t border-white/5 px-4 py-3 text-sm first:border-t-0 lg:grid-cols-[0.75fr_1fr_1fr_auto] lg:items-center">
                <span className="font-mono text-ink-low">{task.id}</span>
                <span className="text-ink-high">{task.label}</span>
                <span className="text-ink-low">{task.note}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[task.status]}>{task.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "released")}>Release</Button>
                  <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "held")}>Hold</Button>
                  <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "refunded")}>Refund</Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="glass p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">metadata preview</p>
                <h2 className="mt-1 text-lg font-semibold">{form.type} v{form.version}</h2>
              </div>
              <Database className="h-5 w-5 text-brand-violet" />
            </div>
            <pre className="mt-4 max-h-[360px] overflow-auto rounded-sm border border-white/8 bg-black/30 p-3 font-mono text-xs leading-relaxed text-ink-mid">
              {metadataText}
            </pre>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button size="sm" variant={copied ? "success" : "outline"} onClick={() => void copyMetadata()}>
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Copy JSON"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadJson(metadata, `synapse-${form.type.toLowerCase()}-contract.json`)}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-brand-amber/25 bg-brand-amber/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-brand-amber" />
              <div>
                <p className="text-sm font-medium text-ink-high">Reviewer policy required</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-mid">
                  Dispute payouts can be released, split, or refunded after evidence review.
                </p>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => router.push("/governance")}>
                  Open governance
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="glass p-4">
            <div className="flex items-center gap-2 text-sm text-ink-high">
              <Gavel className="h-4 w-4 text-brand-teal" />
              Dispute-enabled payout
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-low">
              Current policy: {form.reviewerPolicy}
            </p>
            <Button className="mt-4 w-full" variant="outline" onClick={() => set("type", "Dispute")}>
              Load dispute contract
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

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

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-white/5 py-2 first:border-t-0">
      <span className="text-ink-low">{label}</span>
      <span className="max-w-[70%] truncate text-right font-mono text-ink-high">{value}</span>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.03] p-3">
      {icon}
      <p className="mt-3 text-sm text-ink-high">{label}</p>
      <p className="mt-1 font-mono text-sm text-brand-mint">{value}</p>
    </div>
  );
}
