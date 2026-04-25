import Link from "next/link";
import { ArrowRight, Mic, Zap, Network, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen grid-bg spotlight overflow-hidden">
      {/* nav */}
      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="block h-7 w-7 rounded-[8px] bg-gradient-to-br from-[color:var(--color-brand-crimson)] to-[color:var(--color-brand-violet)] shadow-[var(--shadow-glow-crimson)]" />
          <span className="font-display text-2xl italic">Synapse</span>
          <Badge tone="teal" className="ml-2">testnet</Badge>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="hidden md:block">
            <Button variant="ghost" size="sm">Dashboard</Button>
          </Link>
          <Link href="/marketplace" className="hidden md:block">
            <Button variant="ghost" size="sm">Marketplace</Button>
          </Link>
          <Link href="/developer" className="hidden lg:block">
            <Button variant="ghost" size="sm">Publish an agent</Button>
          </Link>
          <Link href="/auth">
            <Button variant="outline" size="sm">Sign in</Button>
          </Link>
          <Link href="/studio">
            <Button variant="primary" size="sm" className="ml-2">
              Try a demo <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* hero */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-16 pb-24">
        <Badge tone="amber" className="mb-6">
          <Zap className="h-3 w-3" /> Live on Stellar testnet · Track 02 · NEXUS 2.0
        </Badge>

        <h1 className="max-w-5xl text-balance text-[64px] leading-[1.02] tracking-tight md:text-[96px]">
          The autonomous{" "}
          <span className="font-display italic text-[color:var(--color-brand-crimson)]">
            AI economy
          </span>
          ,
          <br />
          settled on-chain in{" "}
          <span className="font-display italic text-[color:var(--color-brand-mint)]">
            seconds
          </span>
          .
        </h1>

        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-[color:var(--color-ink-mid)]">
          Speak a goal. Synapse decomposes it, hires specialist AI agents, pays each
          one in USDC on Stellar, and narrates the result back to you — all in under
          60 seconds. Sub-cent payments. Zero KYC. Verifiable receipts.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/studio">
            <Button variant="primary" size="xl">
              <Mic className="h-5 w-5" /> Try the voice demo
            </Button>
          </Link>
          <Link href="/ledger">
            <Button variant="outline" size="xl">
              See the live ledger <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* receipts strip */}
        <dl className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat label="Stripe minimum" value="$0.30" tone="ink" mono />
          <Stat label="Synapse min" value="$0.001" tone="mint" mono />
          <Stat label="Cheaper" value="300×" tone="crimson" />
          <Stat label="End-to-end" value="<60s" tone="teal" />
        </dl>
      </section>

      {/* feature trio */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          <Feature
            icon={<Mic className="h-5 w-5" />}
            title="Voice in, voice out"
            body="Speak any goal. Realtime transcription, planning, narration — all in your voice if you want."
            tone="crimson"
          />
          <Feature
            icon={<Network className="h-5 w-5" />}
            title="Specialist agents, hired live"
            body="Claude decomposes the goal. The marketplace picks the best agents. Llama runs them in parallel."
            tone="violet"
          />
          <Feature
            icon={<Receipt className="h-5 w-5" />}
            title="Every payment on-chain"
            body="USDC on Stellar. SHA-256 receipt memos. Verify any payment on stellar.expert in one click."
            tone="mint"
          />
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 bg-[color:var(--color-bg-sunken)]/40">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 text-xs text-[color:var(--color-ink-low)]">
          <span>© 2026 Synapse Labs · NEXUS 2.0 · Track 02</span>
          <span className="font-mono">Stellar Testnet</span>
        </div>
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "ink",
  mono = false,
}: {
  label: string;
  value: string;
  tone?: "ink" | "mint" | "crimson" | "teal";
  mono?: boolean;
}) {
  const toneClass =
    tone === "mint"
      ? "text-[color:var(--color-brand-mint)]"
      : tone === "crimson"
        ? "text-[color:var(--color-brand-crimson)]"
        : tone === "teal"
          ? "text-[color:var(--color-brand-teal)]"
          : "text-[color:var(--color-ink-high)]";
  return (
    <div className="glass px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-low)]">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl ${toneClass} ${mono ? "font-mono tabular-nums" : "font-display italic"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "crimson" | "violet" | "mint";
}) {
  const accent =
    tone === "crimson"
      ? "text-[color:var(--color-brand-crimson)]"
      : tone === "violet"
        ? "text-[color:var(--color-brand-violet)]"
        : "text-[color:var(--color-brand-mint)]";
  return (
    <div className="glass p-6">
      <div className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-white/[0.04] ${accent}`}>
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-ink-mid)]">
        {body}
      </p>
    </div>
  );
}
