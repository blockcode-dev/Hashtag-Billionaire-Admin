import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

// Shows `content` on hover or focus of `children`. Plain text and icons are
// wrapped in a span so they can receive the trigger's ref and events.
export function Tip({ content, children, side = "top" }: TipProps) {
  if (!content) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
