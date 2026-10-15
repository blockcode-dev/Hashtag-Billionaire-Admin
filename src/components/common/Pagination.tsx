import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

export interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number, pageSize: number) => void;
  // Shows a "per page" picker; changing it reports page 1 with the new size.
  showSizeChanger?: boolean;
  pageSizeOptions?: number[];
  showTotal?: (total: number) => ReactNode;
  size?: "small" | "default";
  className?: string;
}

// Page numbers to show around the current page, with "…" gaps.
function pageList(current: number, last: number): (number | "gap")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set([1, last, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= last - 2) [last - 3, last - 2, last - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function Pagination({
  current,
  total,
  pageSize,
  onChange,
  showSizeChanger = false,
  pageSizeOptions = [10, 20, 50, 100],
  showTotal,
  size = "default",
  className,
}: PaginationProps) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  const btnSize = size === "small" ? "icon-xs" : "icon-sm";

  return (
    <nav aria-label="Pagination" className={cn("flex flex-wrap items-center justify-end gap-2 text-sm", className)}>
      {showTotal && <span className="mr-auto text-muted-foreground">{showTotal(total)}</span>}

      <Button
        variant="outline"
        size={btnSize}
        disabled={current <= 1}
        onClick={() => onChange(current - 1, pageSize)}
        aria-label="Previous page"
      >
        <ChevronLeft />
      </Button>

      {pageList(current, last).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === current ? "default" : "ghost"}
            size={btnSize}
            className="tabular-nums"
            aria-current={p === current ? "page" : undefined}
            onClick={() => p !== current && onChange(p, pageSize)}
          >
            {p}
          </Button>
        ),
      )}

      <Button
        variant="outline"
        size={btnSize}
        disabled={current >= last}
        onClick={() => onChange(current + 1, pageSize)}
        aria-label="Next page"
      >
        <ChevronRight />
      </Button>

      {showSizeChanger && (
        <select
          aria-label="Rows per page"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={pageSize}
          onChange={(e) => onChange(1, Number(e.target.value))}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      )}
    </nav>
  );
}
