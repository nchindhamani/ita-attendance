import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-all duration-300 ease-smooth",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#6366f1] text-white",
        secondary:
          "border-transparent bg-[#64748b] text-white",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-[#e2e8f0]",
        muted: "border-transparent bg-muted text-muted-foreground",
        success: "border-transparent bg-[#dcfce7] text-[#166534]",
        active: "border-transparent bg-[#dbeafe] text-[#1e40af]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

