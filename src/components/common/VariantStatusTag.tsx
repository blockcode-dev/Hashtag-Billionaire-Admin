import { cn } from "cn";
import { VARIANT_STATUSES, formatShortDate, type VariantStatus } from "@/lib/variants";
import { StatusTag } from "./StatusTag";
import { Tip } from "./Tip";

interface VariantStatusTagProps {
  variant: { status?: string | null; restored_at?: string | null };
  className?: string;
}

// What the supplier syncs last recorded for a variant, and when a sync brought it
// back after it had been removed. Renders nothing for a backend without status.
export function VariantStatusTag({ variant, className }: VariantStatusTagProps) {
  const status = VARIANT_STATUSES[variant.status as VariantStatus];
  const restored = formatShortDate(variant.restored_at);
  if (!status && !restored) return null;

  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      {status && (
        <Tip content={status.hint}>
          <StatusTag color={status.color}>{status.label}</StatusTag>
        </Tip>
      )}
      {restored && <span className="text-xs whitespace-nowrap text-muted-foreground">Restored {restored}</span>}
    </span>
  );
}
