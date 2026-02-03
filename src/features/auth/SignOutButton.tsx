"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  variant?: "default" | "sidebar";
  className?: string;
}

export function SignOutButton({ variant = "default", className }: SignOutButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const supabase = createSupabaseBrowserClient();
            await supabase.auth.signOut();
            router.replace("/");
            router.refresh();
          });
        }}
        className={cn(
          "w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all duration-300 disabled:opacity-50",
          className
        )}
      >
        {isPending ? "Signing out..." : "Sign out"}
      </button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut();
          router.replace("/");
          router.refresh();
        });
      }}
      className={className}
    >
      {isPending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
