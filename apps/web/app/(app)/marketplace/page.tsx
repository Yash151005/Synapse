/**
 * app/(app)/marketplace/page.tsx — Browse & discover agents
 * 
 * Shows all registered agents with semantic search.
 */

"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CAPABILITIES } from "@synapse/shared";

interface Agent {
  id: string;
  name: string;
  slug: string;
  capability: string;
  description: string;
  price_usdc: number;
  reputation: number;
  total_jobs: number;
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [capability, setCapability] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"reputation" | "price" | "jobs">("reputation");

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchQuery.trim().length >= 2) {
          params.set("query", searchQuery.trim());
          params.set("limit", "36");
        } else {
          params.set("limit", "50");
        }
        if (capability !== "all") {
          params.set("capability", capability);
        }

        const resp = await fetch(`/api/agents/discover?${params.toString()}`);
        if (resp.ok) {
          const data = await resp.json();
          setAgents(Array.isArray(data) ? data : data.agents ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch agents:", err);
      } finally {
        setLoading(false);
      }
    };

    const t = setTimeout(fetchAgents, searchQuery.trim().length >= 2 ? 220 : 0);
    return () => clearTimeout(t);
  }, [searchQuery, capability]);

  const filteredAgents = agents
    .filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.capability.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === "price") return a.price_usdc - b.price_usdc;
      if (sortBy === "jobs") return b.total_jobs - a.total_jobs;
      return b.reputation - a.reputation;
    });

  return (
    <div className="min-h-screen bg-linear-to-br from-bg-base via-bg-raised to-bg-sunken">
      {/* Header */}
      <div className="border-b border-ink-faint bg-bg-raised/50 px-6 py-12 backdrop-blur">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-4 text-4xl font-bold text-ink-high">
            Agent Marketplace
          </h1>
          <p className="text-ink-mid">
            {agents.length} specialist agents ready to hire
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-ink-faint bg-bg-base/50 px-6 py-8 backdrop-blur">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input
              type="text"
              placeholder="Search agents, capabilities, descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-ink-faint bg-bg-sunken px-4 py-3 text-ink-high placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-violet"
            />
            <select
              value={capability}
              onChange={(e) => setCapability(e.target.value)}
              className="rounded-lg border border-ink-faint bg-bg-sunken px-3 py-2 text-sm text-ink-high"
            >
              <option value="all">All capabilities</option>
              {CAPABILITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "reputation" | "price" | "jobs")}
              className="rounded-lg border border-ink-faint bg-bg-sunken px-3 py-2 text-sm text-ink-high"
            >
              <option value="reputation">Sort: Reputation</option>
              <option value="price">Sort: Lowest Price</option>
              <option value="jobs">Sort: Most Jobs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="text-center text-ink-mid">Loading agents…</div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center text-ink-mid">No agents found</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="group rounded-2xl border border-ink-faint bg-bg-glass p-6 backdrop-blur-glass shadow-glass transition hover:shadow-glass-lg hover:border-brand-violet/50"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-ink-high">
                        {agent.name}
                      </h3>
                      <Badge tone="violet" className="mt-2">
                        {agent.capability}
                      </Badge>
                    </div>
                    {agent.reputation >= 4.8 ? <Badge tone="mint">top rated</Badge> : null}
                  </div>

                  <p className="mb-4 text-sm text-ink-mid line-clamp-3">
                    {agent.description}
                  </p>

                  <div className="mb-4 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-ink-low">Price per call</p>
                      <p className="font-mono font-semibold text-brand-mint">
                        ${agent.price_usdc.toFixed(3)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-ink-low">Jobs</p>
                      <p className="font-semibold text-brand-teal">
                        {agent.total_jobs}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-ink-low">
                    <span>★</span>
                    <span>{agent.reputation.toFixed(2)} / 5.0</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
