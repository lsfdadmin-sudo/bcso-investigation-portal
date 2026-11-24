import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        open: "border-status-amber/30 bg-status-amber/10 text-status-amber",
        closed: "border-status-emerald/30 bg-status-emerald/10 text-status-emerald",
        suspect: "border-status-crimson/30 bg-status-crimson/10 text-status-crimson",
        evidence: "border-signal-cyan/30 bg-signal-cyan/10 text-signal-cyan",
        related: "border-signal-indigo/30 bg-signal-indigo/10 text-signal-indigo",
        gold: "border-gold/30 bg-gold/10 text-gold-bright",
        neutral: "border-white/10 bg-white/5 text-fog",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
