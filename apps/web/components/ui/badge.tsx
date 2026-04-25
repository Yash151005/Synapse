import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  [
    "inline-flex items-center gap-1.5",
    "rounded-full px-2.5 py-0.5",
    "text-[11px] font-medium tracking-wide",
    "border",
  ],
  {
    variants: {
      tone: {
        neutral: "border-white/8 bg-white/[0.03] text-[color:var(--color-ink-mid)]",
        crimson:
          "border-[color:var(--color-brand-crimson)]/30 bg-[color:var(--color-brand-crimson)]/10 text-[color:var(--color-brand-crimson)]",
        teal:
          "border-[color:var(--color-brand-teal)]/30 bg-[color:var(--color-brand-teal)]/10 text-[color:var(--color-brand-teal)]",
        violet:
          "border-[color:var(--color-brand-violet)]/30 bg-[color:var(--color-brand-violet)]/10 text-[color:var(--color-brand-violet)]",
        mint:
          "border-[color:var(--color-brand-mint)]/30 bg-[color:var(--color-brand-mint)]/10 text-[color:var(--color-brand-mint)]",
        amber:
          "border-[color:var(--color-brand-amber)]/30 bg-[color:var(--color-brand-amber)]/10 text-[color:var(--color-brand-amber)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, ...props }, ref) => (
    <span ref={ref} className={cn(badge({ tone }), className)} {...props} />
  )
);
Badge.displayName = "Badge";
