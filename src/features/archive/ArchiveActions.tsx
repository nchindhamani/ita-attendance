"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { purgeArchive } from "@/app/(dashboard)/admin/archive/actions";

export function ArchiveActions({
  status,
  downloadLinks,
}: {
  status: "IDLE" | "ARCHIVE_READY" | "PURGING";
  downloadLinks?: { label: string; url: string }[];
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handlePurge = () => {
    startTransition(() => {
      purgeArchive(confirmed).then((result) => {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(result?.success ?? "Archive purged.");
        }
      });
    });
  };

  if (status === "PURGING") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        Purging data...
      </div>
    );
  }

  if (status === "ARCHIVE_READY") {
    return (
      <div className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          {downloadLinks?.map((link) => (
            <a
              key={link.label}
              className="block text-primary underline"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download {link.label}
            </a>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          I have verified the data.
        </label>
        <Button
          variant="destructive"
          onClick={handlePurge}
          disabled={!confirmed || isPending}
        >
          {isPending ? "Purging..." : "Purge Database"}
        </Button>
      </div>
    );
  }

  return null;
}

