"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Code2,
  FileText,
  Gavel,
  LayoutDashboard,
  LogIn,
  Mic,
  Receipt,
  Search,
  ShieldCheck,
  Store,
  Wallet,
} from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, shortHash } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/studio", label: "Studio", icon: Mic },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/sessions", label: "Sessions", icon: Search },
  { href: "/ledger", label: "Ledger", icon: Receipt },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/governance", label: "Governance", icon: Gavel },
  { href: "/developer", label: "Developer", icon: Code2 },
];

export function AppShell({
  children,
  eyebrow,
  title,
  description,
  actions,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, session, logout } = useAuth();

  useEffect(() => {
    if (!loading && !session) {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, session]);

  if (loading || !session) {
    return (
      <main className="min-h-screen bg-bg-base text-ink-high grid-bg">
        <div className="flex min-h-screen items-center justify-center">
          <div className="glass px-5 py-4 text-sm text-ink-mid">Loading workspace...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-base text-ink-high grid-bg">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-white/5 bg-bg-sunken/70 px-3 py-4 backdrop-blur-xl lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-2 px-2 py-2">
            <span className="block h-7 w-7 rounded-xs bg-linear-to-br from-brand-crimson to-brand-violet" />
            <span className="font-display text-2xl italic">Synapse</span>
          </Link>

          <div className="mt-4 rounded-md border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.16em] text-ink-low">workspace</span>
              <Badge tone="teal">testnet</Badge>
            </div>
            <p className="mt-2 text-sm text-ink-mid">
              {session.kind === "wallet" ? shortHash(session.label, 6, 6) : session.label}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-ink-low">
              <Wallet className="h-3.5 w-3.5 text-brand-mint" />
              {session.kind === "wallet" ? "Freighter connected" : "Passkey unlocked"}
            </div>
          </div>

          <nav className="mt-4 flex flex-1 flex-col gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-ink-mid transition hover:bg-white/[0.04] hover:text-ink-high",
                    active && "bg-white/[0.06] text-ink-high ring-1 ring-white/10",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="rounded-md border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 text-sm text-ink-high">
              <ShieldCheck className="h-4 w-4 text-brand-mint" />
              Policy guard
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-low">
              Budget caps, risk approvals, and hash-bound receipts are visible across the app.
            </p>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-white/5 bg-bg-base/85 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="flex items-center gap-2 lg:hidden">
                <span className="block h-6 w-6 rounded-xs bg-linear-to-br from-brand-crimson to-brand-violet" />
                <span className="font-display text-xl italic">Synapse</span>
              </Link>

              <div className="hidden min-w-0 lg:block">
                {eyebrow ? (
                  <div className="text-[11px] uppercase tracking-[0.18em] text-ink-low">{eyebrow}</div>
                ) : null}
                {title ? <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1> : null}
              </div>

              <div className="ml-auto flex items-center gap-2">
                {actions}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    logout();
                    router.replace("/auth/login");
                  }}
                >
                  <LogIn className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </div>

            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-sm border border-white/8 px-3 py-1.5 text-xs text-ink-mid",
                      active && "border-brand-teal/40 bg-brand-teal/10 text-brand-teal",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <div className="px-4 py-6 md:px-6">
            {(title || description) && (
              <div className="mb-6 lg:hidden">
                {eyebrow ? (
                  <div className="text-[11px] uppercase tracking-[0.18em] text-ink-low">{eyebrow}</div>
                ) : null}
                {title ? <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1> : null}
                {description ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-mid">{description}</p> : null}
              </div>
            )}

            {(title || description) && (
              <div className="mb-6 hidden lg:block">
                {description ? <p className="max-w-3xl text-sm leading-relaxed text-ink-mid">{description}</p> : null}
              </div>
            )}

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
