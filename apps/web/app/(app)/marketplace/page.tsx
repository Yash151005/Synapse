"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  Filter,
  Gauge,
  Globe2,
  LineChart,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { CAPABILITIES, CAPABILITY_DESCRIPTIONS } from "@synapse/shared";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { demoAgents, type DemoAgent } from "@/lib/demo-data";

type SortMode = "reputation" | "price" | "jobs" | "latency";

const featuredCollections = ["Travel stack", "Research sprint", "Finance ops", "Voice ops", "Trust layer"];

function normalizeAgent(agent: Partial<DemoAgent>): DemoAgent {
  const fallback = demoAgents.find((demo) => demo.capability === agent.capability) ?? demoAgents[0]!;
  return {
    ...fallback,
    ...agent,
    id: agent.id ?? fallback.id,
    name: agent.name ?? fallback.name,
    slug: agent.slug ?? fallback.slug,
    description: agent.description ?? fallback.description,
    capability: agent.capability ?? fallback.capability,
    price_usdc: Number(agent.price_usdc ?? fallback.price_usdc),
    reputation: Number(agent.reputation ?? fallback.reputation),
    total_jobs: Number(agent.total_jobs ?? fallback.total_jobs),
  };
}

export default function MarketplacePage() {
  const router = useRouter();
  const [agents, setAgents] = useState<DemoAgent[]>(demoAgents);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [capability, setCapability] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");
  const [collection, setCollection] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortMode>("reputation");

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("limit", searchQuery.trim().length >= 2 ? "36" : "50");
        if (searchQuery.trim().length >= 2) params.set("query", searchQuery.trim());
        if (capability !== "all") params.set("capability", capability);

        const resp = await fetch(`/api/agents/discover?${params.toString()}`);
        if (resp.ok) {
          const data = await resp.json();
          const rows = Array.isArray(data) ? data : data.agents ?? [];
          if (Array.isArray(rows) && rows.length > 0) {
            setAgents(rows.map((row) => normalizeAgent(row)));
            return;
          }
        }
        setAgents(demoAgents);
      } catch (err) {
        console.error("Failed to fetch agents:", err);
        setAgents(demoAgents);
      } finally {
        setLoading(false);
      }
    };

    const t = window.setTimeout(fetchAgents, searchQuery.trim().length >= 2 ? 220 : 0);
    return () => window.clearTimeout(t);
  }, [searchQuery, capability]);

  const regions = useMemo(() => ["all", ...Array.from(new Set(demoAgents.map((agent) => agent.region)))], []);

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return agents
      .filter((agent) => {
        const matchesQuery =
          q.length === 0 ||
          agent.name.toLowerCase().includes(q) ||
          agent.description.toLowerCase().includes(q) ||
          agent.capability.toLowerCase().includes(q);
        const matchesCapability = capability === "all" || agent.capability === capability;
        const matchesRegion = region === "all" || agent.region === region;
        const matchesCollection = collection === "all" || agent.collection === collection;
        return matchesQuery && matchesCapability && matchesRegion && matchesCollection;
      })
      .sort((a, b) => {
        if (sortBy === "price") return a.price_usdc - b.price_usdc;
        if (sortBy === "jobs") return b.total_jobs - a.total_jobs;
        if (sortBy === "latency") return a.latencyMs - b.latencyMs;
        return b.reputation - a.reputation;
      });
  }, [agents, capability, collection, region, searchQuery, sortBy]);

  const bestAgent = filteredAgents[0] ?? demoAgents[0]!;

  return (
    <AppShell
      eyebrow="Agent marketplace"
      title="Provider discovery"
      description="Browse specialist agents by capability, price, benchmark, SLA status, region, and trust signal."
      actions={
        <Link href="/developer">
          <Button size="sm">
            <Store className="h-4 w-4" />
            Publish agent
          </Button>
        </Link>
      }
    >
      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="glass p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">advanced filters</p>
              <h2 className="mt-1 text-lg font-semibold">Capability, region, workflow, and sort controls</h2>
            </div>
            <Badge tone="teal">
              {loading ? "syncing" : `${filteredAgents.length} agents`}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-ink-mid focus-within:border-brand-teal/60">
              <Search className="h-4 w-4" />
              <input
                type="text"
                placeholder="Search agents, capabilities, descriptions..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-ink-high outline-none placeholder:text-ink-low"
              />
            </label>
            <Select label="Capability" value={capability} onChange={setCapability} options={["all", ...CAPABILITIES]} />
            <Select label="Sort" value={sortBy} onChange={(value) => setSortBy(value as SortMode)} options={["reputation", "price", "jobs", "latency"]} />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Select label="Region" value={region} onChange={setRegion} options={regions} />
            <Select label="Collection" value={collection} onChange={setCollection} options={["all", ...featuredCollections]} />
          </div>
        </div>

        <div className="glass p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">leaderboard</p>
              <h2 className="mt-1 text-lg font-semibold">Best current match</h2>
            </div>
            <LineChart className="h-5 w-5 text-brand-violet" />
          </div>
          <div className="mt-4 rounded-md border border-brand-mint/20 bg-brand-mint/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{bestAgent.name}</p>
                <p className="mt-1 text-xs text-ink-low">{bestAgent.collection}</p>
              </div>
              <Badge tone="mint">#{sortBy}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <Benchmark label="rep" value={bestAgent.reputation.toFixed(2)} />
              <Benchmark label="p95" value={`${bestAgent.latencyMs}ms`} />
              <Benchmark label="cost" value={`$${bestAgent.p95Cost.toFixed(3)}`} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredAgents.map((agent) => (
          <article key={agent.id} className="glass p-4 transition hover:border-brand-teal/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-semibold text-ink-high">{agent.name}</h3>
                  {agent.verified ? (
                    <Badge tone="mint">
                      <BadgeCheck className="h-3 w-3" />
                      verified
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="violet">{agent.capability}</Badge>
                  <Badge tone={agent.status === "healthy" ? "mint" : agent.status === "degraded" ? "amber" : "neutral"}>
                    {agent.status}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl text-brand-mint">${agent.price_usdc.toFixed(3)}</p>
                <p className="text-xs text-ink-low">per call</p>
              </div>
            </div>

            <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-ink-mid">{agent.description}</p>
            <p className="mt-2 text-xs text-ink-low">
              {CAPABILITY_DESCRIPTIONS[agent.capability]}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Benchmark label="latency" value={`${agent.latencyMs}ms`} />
              <Benchmark label="success" value={`${agent.successRate.toFixed(1)}%`} />
              <Benchmark label="jobs" value={agent.total_jobs.toLocaleString()} />
            </div>

            <div className="mt-4 grid gap-2 rounded-md border border-white/8 bg-bg-sunken p-3 text-xs text-ink-low">
              <MetaRow icon={<Globe2 className="h-3.5 w-3.5" />} label="Region" value={`${agent.region} / ${agent.dataResidency}`} />
              <MetaRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="SLA" value={`${agent.sla} / ${agent.version}`} />
              <MetaRow icon={<Clock3 className="h-3.5 w-3.5" />} label="Maintenance" value={agent.maintenanceWindow} />
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`https://stellar.expert/explorer/testnet/search?term=${encodeURIComponent(agent.name)}`, "_blank", "noopener,noreferrer");
                }}
              >
                Inspect
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="success"
                onClick={() => {
                  localStorage.setItem(
                    "synapse.prefillGoal",
                    `Use ${agent.name} (${agent.capability}) to ${agent.description}`,
                  );
                  router.push("/studio");
                }}
              >
                Hire
                <Zap className="h-4 w-4" />
              </Button>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <FeaturePanel icon={<Filter className="h-5 w-5" />} title="Capability taxonomy" body="Route by primary capability, subcategory, data residency, and quality tier." />
        <FeaturePanel icon={<Gauge className="h-5 w-5" />} title="SLA and health badges" body="Latency, success rate, p95 cost, maintenance windows, and uptime all feed provider trust." />
        <FeaturePanel icon={<SlidersHorizontal className="h-5 w-5" />} title="Rollback controls" body="Version pins and provider changelogs support safe fallback during live sessions." />
      </section>
    </AppShell>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-ink-low">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full min-w-40 rounded-sm border border-white/10 bg-bg-sunken px-2 py-1.5 text-sm text-ink-high"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "all" ? `All ${label.toLowerCase()}` : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Benchmark({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-white/8 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-low">{label}</p>
      <p className="mt-1 truncate font-mono text-sm text-ink-high">{value}</p>
    </div>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <span className="text-brand-teal">{icon}</span>
        {label}
      </span>
      <span className="truncate text-right text-ink-mid">{value}</span>
    </div>
  );
}

function FeaturePanel({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="glass p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-white/[0.04] text-brand-teal">{icon}</div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-mid">{body}</p>
    </div>
  );
}
