import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  [
    "btn-reset inline-flex items-center justify-center gap-2",
    "font-medium tracking-tight whitespace-nowrap",
    "rounded-[var(--radius-md)] transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-teal)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg-base)]",
    "disabled:pointer-events-none disabled:opacity-40",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-[color:var(--color-brand-crimson)] text-[color:var(--color-ink-high)]",
          "shadow-[var(--shadow-glow-crimson)]",
          "hover:brightness-110 active:brightness-95",
        ],
        accent: [
          "bg-[color:var(--color-brand-teal)] text-[color:var(--color-bg-base)]",
          "shadow-[var(--shadow-glow-teal)]",
          "hover:brightness-110 active:brightness-95",
        ],
        ghost: [
          "bg-transparent text-[color:var(--color-ink-mid)]",
          "hover:bg-white/[0.04] hover:text-[color:var(--color-ink-high)]",
        ],
        outline: [
          "bg-[color:var(--color-bg-glass)] backdrop-blur-xl",
          "text-[color:var(--color-ink-high)]",
          "border border-white/10 hover:border-white/20",
          "hover:bg-white/[0.04]",
        ],
        success: [
          "bg-[color:var(--color-brand-mint)] text-[color:var(--color-bg-base)]",
          "shadow-[var(--shadow-glow-mint)]",
          "hover:brightness-110 active:brightness-95",
        ],
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
