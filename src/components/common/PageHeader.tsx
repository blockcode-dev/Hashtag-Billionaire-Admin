import type { ReactNode } from "react";
import { cn } from "cn";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  // Buttons on the right, e.g. "Add product".
  actions?: ReactNode;
  className?: string;
}

// Title row at the top of every page.
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {/* Takes the full row once it wraps under the title on narrow screens. */}
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}
