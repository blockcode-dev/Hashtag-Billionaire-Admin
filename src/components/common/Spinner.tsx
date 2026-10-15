import { Loader2 } from "lucide-react";
import { cn } from "cn";

const SIZES = { small: 14, default: 20, large: 32 } as const;

interface SpinnerProps {
  size?: keyof typeof SIZES;
  className?: string;
  label?: string;
}

// Loading indicator; `label` is read by screen readers.
export function Spinner({ size = "default", className, label = "Loading" }: SpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label={label}
      size={SIZES[size]}
      className={cn("animate-spin text-muted-foreground", className)}
    />
  );
}
