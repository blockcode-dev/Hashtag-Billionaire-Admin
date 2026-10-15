import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "cn";

interface EmptyStateProps {
  description?: ReactNode;
  className?: string;
}

export function EmptyState({ description = "No data", className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground", className)}>
      <Inbox className="size-8 text-muted-foreground/50" aria-hidden />
      <div>{description}</div>
    </div>
  );
}
