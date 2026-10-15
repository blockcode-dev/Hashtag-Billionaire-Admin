import type { CSSProperties, ReactNode } from "react";
import { cn } from "cn";

// Colour names used across the panel's labels, mapped to the design tokens.
const COLORS: Record<string, string> = {
  default: "bg-muted text-foreground border-border",
  gold: "bg-primary-soft text-primary-soft-foreground border-primary-border",
  primary: "bg-primary-soft text-primary-soft-foreground border-primary-border",
  green: "bg-success-soft text-success-soft-foreground border-success-border",
  success: "bg-success-soft text-success-soft-foreground border-success-border",
  red: "bg-destructive-soft text-destructive-soft-foreground border-destructive-border",
  error: "bg-destructive-soft text-destructive-soft-foreground border-destructive-border",
  orange: "bg-warning-soft text-warning-soft-foreground border-warning-border",
  warning: "bg-warning-soft text-warning-soft-foreground border-warning-border",
  yellow: "bg-warning-soft text-warning-soft-foreground border-warning-border",
  blue: "bg-info-soft text-info-soft-foreground border-info-border",
  info: "bg-info-soft text-info-soft-foreground border-info-border",
  processing: "bg-info-soft text-info-soft-foreground border-info-border",
  cyan: "bg-info-soft text-info-soft-foreground border-info-border",
  geekblue: "bg-violet-soft text-violet-soft-foreground border-violet-border",
  purple: "bg-violet-soft text-violet-soft-foreground border-violet-border",
  violet: "bg-violet-soft text-violet-soft-foreground border-violet-border",
  magenta: "bg-violet-soft text-violet-soft-foreground border-violet-border",
};

interface StatusTagProps {
  color?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

// Small coloured label. Colours come from the design tokens in index.css.
export function StatusTag({ color = "default", className, style, children }: StatusTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        COLORS[color] ?? COLORS.default,
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
