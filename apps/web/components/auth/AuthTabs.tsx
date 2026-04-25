"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Code2,
  Fingerprint,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isFreighterInstalled } from "@/lib/stellar/freighter";

type AuthTab = "login" | "register";
type RegisterRole = "buyer" | "provider";

export function AuthTabs({ initialTab = "login" }: { initialTab?: AuthTab }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loginWithFreighter, loginWithPasskey, registerPasskey } = useAuth();
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [role, setRole] = useState<RegisterRole>("buyer");
  const [spendLimit, setSpendLimit] = useState(0.05);
  const [email, setEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<"freighter" | "passkey-login" | "passkey-register" | null>(null);
  const [freighterInstalled, setFreighterInstalled] = useState<boolean | null>(null);

  const nextHref = searchParams.get("next") ?? (role === "provider" ? "/developer" : "/dashboard");

  useEffect(() => {
    isFreighterInstalled().then(setFreighterInstalled).catch(() => setFreighterInstalled(false));
  }, []);

  useEffect(() => {
    if (session) {
      router.replace(nextHref);
    }
  }, [nextHref, router, session]);

  const activeSummary = useMemo(() => {
    if (activeTab === "login") {
      return "Restore sessions, wallet policy, replay archives, and provider consoles.";
    }

    return role === "provider"
      ? "Publish agents, validate endpoints, configure payout wallet, and monitor SLA health."
      : "Run voice sessions with a capped guest wallet, proof exports, and team approval controls.";
  }, [activeTab, role]);

  async function handleFreighterLogin() {
    setAuthError(null);
    setBusyMode("freighter");
    try {
      await loginWithFreighter();
      router.push(nextHref);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Freighter login failed.";
      // If the extension was detected but the popup was dismissed, don't hide the button.
      setAuthError(msg);
    } finally {
      setBusyMode(null);
    }
  }

  async function handlePasskeyLogin() {
    setAuthError(null);
    setBusyMode("passkey-login");
    try {
      await loginWithPasskey();
      router.push(nextHref);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Passkey login failed.");
    } finally {
      setBusyMode(null);
    }
  }

  async function handleRegister() {
    setAuthError(null);
    setBusyMode("passkey-register");
    try {
      const label = workspaceName.trim() || email.trim() || (role === "provider" ? "Provider workspace" : "Operator workspace");
      await registerPasskey(label);
      router.push(nextHref);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Passkey registration failed.");
    } finally {
      setBusyMode(null);
    }
  }

  return (
    <main className="min-h-screen bg-bg-base text-ink-high grid-bg">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-8 px-4 py-6 md:px-6 lg:grid-cols-[1fr_460px] lg:items-center">
        <section className="flex min-h-[520px] flex-col justify-between py-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="block h-8 w-8 rounded-xs bg-linear-to-br from-brand-crimson to-brand-violet shadow-[var(--shadow-glow-crimson)]" />
              <span className="font-display text-3xl italic">Synapse</span>
              <Badge tone="teal">testnet</Badge>
            </Link>

            <div className="mt-16 max-w-3xl">
              <Badge tone="amber" className="mb-5">
                <ShieldCheck className="h-3 w-3" />
                Account, wallet, and provider access
              </Badge>
              <h1 className="text-5xl leading-[1.02] tracking-tight md:text-7xl">
                One login for the voice studio, marketplace, and payment proof layer.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-mid">
                Sign in as an operator or register as a provider. Synapse keeps spend caps, payout
                wallets, approvals, and verifiable receipts in the same workspace.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            <TrustTile icon={<Wallet className="h-4 w-4" />} label="Guest wallet" value="$0.05 cap" />
            <TrustTile icon={<Fingerprint className="h-4 w-4" />} label="Auth mode" value="Passkey ready" />
            <TrustTile icon={<BadgeCheck className="h-4 w-4" />} label="Provider checks" value="6-step validation" />
          </div>
        </section>

        <section className="glass p-4 md:p-5">
          <div className="grid grid-cols-2 rounded-md border border-white/8 bg-bg-sunken p-1">
            <button
              type="button"
              onClick={() => setActiveTab("login")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm text-ink-mid transition",
                activeTab === "login" && "bg-white/[0.08] text-ink-high",
              )}
            >
              <LogIn className="h-4 w-4" />
              Login
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("register")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm text-ink-mid transition",
                activeTab === "register" && "bg-white/[0.08] text-ink-high",
              )}
            >
              <UserPlus className="h-4 w-4" />
              Register
            </button>
          </div>

          <div className="mt-5 rounded-md border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">
                  {activeTab === "login" ? "returning workspace" : "new workspace"}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                  {activeTab === "login" ? "Welcome back" : "Create access"}
                </h2>
              </div>
              <Badge tone={activeTab === "login" ? "teal" : "mint"}>
                {activeTab === "login" ? "secure" : role}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-mid">{activeSummary}</p>
          </div>

          {activeTab === "login" ? (
            <form className="mt-5 space-y-4" onSubmit={(event) => event.preventDefault()}>
              <Field label="Email" icon={<Mail className="h-4 w-4" />} placeholder="operator@synapse.demo" type="email" />
              <Field label="Password" icon={<Lock className="h-4 w-4" />} placeholder="Enter password" type="password" />
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handlePasskeyLogin()}
                  className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.06]"
                >
                  <div className="flex items-center gap-2 text-sm text-ink-high">
                    <Fingerprint className="h-4 w-4 text-brand-mint" />
                    Passkey
                  </div>
                  <p className="mt-1 text-xs text-ink-low">Use device credential</p>
                </button>
                {freighterInstalled === false ? (
                  <a
                    href="https://www.freighter.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.06] block"
                  >
                    <div className="flex items-center gap-2 text-sm text-ink-mid">
                      <Wallet className="h-4 w-4 text-ink-low" />
                      Install Freighter
                    </div>
                    <p className="mt-1 text-xs text-ink-low">Add extension to Chrome</p>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleFreighterLogin()}
                    disabled={busyMode !== null && busyMode !== "freighter"}
                    className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-sm text-ink-high">
                      <Wallet className={cn("h-4 w-4", freighterInstalled ? "text-brand-teal" : "text-ink-low")} />
                      {busyMode === "freighter" ? "Opening wallet…" : "Open Wallet"}
                    </div>
                    <p className="mt-1 text-xs text-ink-low">
                      {freighterInstalled ? "Freighter detected — click to connect" : "Checking extension…"}
                    </p>
                  </button>
                )}
              </div>
              <Button
                className="w-full"
                size="lg"
                type="button"
                onClick={() => void handlePasskeyLogin()}
                disabled={busyMode !== null && busyMode !== "passkey-login"}
              >
                {busyMode === "passkey-login" ? "Checking passkey..." : "Login with passkey"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={(event) => event.preventDefault()}>
              <div className="grid grid-cols-2 gap-2">
                <RoleButton
                  active={role === "buyer"}
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Operator"
                  subtitle="Run sessions"
                  onClick={() => setRole("buyer")}
                />
                <RoleButton
                  active={role === "provider"}
                  icon={<Building2 className="h-4 w-4" />}
                  title="Provider"
                  subtitle="Publish agents"
                  onClick={() => setRole("provider")}
                />
              </div>

              <Field
                label="Work email"
                icon={<Mail className="h-4 w-4" />}
                placeholder="name@company.com"
                type="email"
                value={email}
                onChange={setEmail}
              />
              <Field
                label={role === "provider" ? "Provider name" : "Workspace name"}
                icon={role === "provider" ? <Code2 className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                placeholder={role === "provider" ? "AeroScout Labs" : "Acme operations"}
                type="text"
                value={workspaceName}
                onChange={setWorkspaceName}
              />

              <label className="block rounded-md border border-white/10 bg-black/20 px-3 py-3">
                <div className="flex items-center justify-between text-xs text-ink-low">
                  <span>{role === "provider" ? "First payout holdback" : "Session spend limit"}</span>
                  <span className="font-mono text-brand-mint">${spendLimit.toFixed(3)} USDC</span>
                </div>
                <input
                  type="range"
                  min={0.01}
                  max={0.25}
                  step={0.01}
                  value={spendLimit}
                  onChange={(event) => setSpendLimit(Number(event.target.value))}
                  className="mt-3 w-full accent-brand-teal"
                />
              </label>

              <Button
                className="w-full"
                size="lg"
                type="button"
                variant="success"
                onClick={() => void handleRegister()}
                disabled={busyMode !== null && busyMode !== "passkey-register"}
              >
                {busyMode === "passkey-register" ? "Creating passkey..." : "Create workspace"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}

          {session ? (
            <div className="mt-4 rounded-md border border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-sm text-ink-high">
              Signed in as {session.kind === "wallet" ? "wallet" : "passkey"}: {session.label}
            </div>
          ) : null}
          {authError ? (
            <div className="mt-4 rounded-md border border-brand-crimson/30 bg-brand-crimson/10 px-4 py-3 text-sm text-brand-crimson">
              {authError}
            </div>
          ) : null}

          <div className="mt-5 rounded-md border border-white/8 bg-bg-sunken px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.16em] text-ink-low">Access includes</span>
              <Badge tone="violet">demo ready</Badge>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-ink-mid">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-mint" />
                Budget lock, approval gates, and spend alerts
              </div>
              <div className="flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5 text-brand-teal" />
                Guest treasury, Freighter connect, and payout wallet setup
              </div>
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-3.5 w-3.5 text-brand-amber" />
                Session replay, proof export, and receipt verification
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  icon,
  placeholder,
  type,
  value,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  type: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.16em] text-ink-low">{label}</span>
      <span className="mt-2 flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2.5 text-ink-mid focus-within:border-brand-teal/60">
        {icon}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-high outline-none placeholder:text-ink-low"
        />
      </span>
    </label>
  );
}

function RoleButton({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-3 text-left transition",
        active ? "border-brand-teal/50 bg-brand-teal/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
      )}
    >
      <div className="flex items-center gap-2 text-sm text-ink-high">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-xs text-ink-low">{subtitle}</p>
    </button>
  );
}

function TrustTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.03] px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ink-low">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-ink-high">{value}</div>
    </div>
  );
}
