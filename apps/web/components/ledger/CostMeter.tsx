"use client";

import { useEffect, useMemo, useState } from "react";

export interface CostMeterProps {
  totalCostUsdc: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function CostMeter({ totalCostUsdc }: CostMeterProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const start = displayValue;
    const end = totalCostUsdc;
    if (Math.abs(end - start) < 0.000001) return;

    const t0 = performance.now();
    const duration = 600;
    let raf = 0;

    const tick = (t: number) => {
      const p = clamp((t - t0) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayValue(start + (end - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [displayValue, totalCostUsdc]);

  const cheaperBy = useMemo(() => {
    const stripeMin = 0.3;
    if (displayValue <= 0) return 0;
    return stripeMin / displayValue;
  }, [displayValue]);

  const pct = Math.min(100, (displayValue / 0.03) * 100);

  return (
    <div className="glass px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink-low">
          session cost
        </span>
        <span className="rounded-full border border-brand-mint/30 bg-brand-mint/10 px-2 py-0.5 text-[11px] text-brand-mint">
          XLM
        </span>
      </div>
      <div className="mt-2 font-mono text-4xl tabular-nums text-brand-mint">
        {displayValue.toFixed(6)}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full bg-brand-mint transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink-low">
        Stripe minimum <span className="font-mono">$0.30</span> · You <span className="font-mono text-brand-mint">${displayValue.toFixed(6)}</span>
        {cheaperBy > 0 ? (
          <>
            {" "}
            · <span className="font-mono">{cheaperBy.toFixed(1)}x</span> cheaper
          </>
        ) : null}
      </p>
    </div>
  );
}
