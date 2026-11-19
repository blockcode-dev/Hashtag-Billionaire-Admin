/** @format */

import { useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RangeQuery } from "@/services/Api/DashboardApi";
import { formatRange } from "./format";
import { MAX_DAYS, PRESETS, rangeLabel } from "./ranges";

// Presets as rows (selection marked with a check), a custom range below the line.
export function RangePicker({
  value,
  onChange,
  resolved,
}: {
  value: RangeQuery;
  onChange: (next: RangeQuery) => void;
  // The dates the server worked the preset out to, shown beside the preset's name.
  resolved?: { from: string; to: string };
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("from" in value ? value.from : (resolved?.from ?? ""));
  const [to, setTo] = useState("to" in value ? value.to : (resolved?.to ?? ""));
  const days = from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 : 0;
  const problem = !from || !to ? null : days < 1 ? "The start must be on or before the end." : days > MAX_DAYS ? `Pick at most ${MAX_DAYS} days.` : null;

  const choose = (next: RangeQuery) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Opening starts the custom range from what's showing.
        if (next && "range" in value && resolved) {
          setFrom(resolved.from);
          setTo(resolved.to);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 gap-2 bg-background font-normal">
          <CalendarDays className="text-muted-foreground" aria-hidden />
          <span className="font-medium text-foreground">{rangeLabel(value)}</span>
          {"range" in value && resolved && (
            <span className="hidden text-muted-foreground sm:inline">{formatRange(resolved.from, resolved.to)}</span>
          )}
          <ChevronDown className="text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <ul role="listbox" aria-label="Date range" className="flex flex-col">
          {PRESETS.map((p) => {
            const selected = "range" in value && value.range === p.value;
            return (
              <li key={p.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose({ range: p.value })}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-accent",
                    selected && "font-medium text-foreground",
                  )}
                >
                  <Check className={cn("size-4 shrink-0 stroke-[3] text-primary", !selected && "invisible")} aria-hidden />
                  {p.label}
                </button>
              </li>
            );
          })}
        </ul>
        <form
          className="mt-1 border-t px-2 pt-3 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (from && to && !problem) choose({ from, to });
          }}
        >
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="dash-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input id="dash-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-8 px-2 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dash-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input id="dash-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-8 px-2 text-sm" />
            </div>
          </div>
          {problem && <p className="mt-2 text-xs text-destructive-soft-foreground">{problem}</p>}
          <Button type="submit" size="sm" className="mt-3 w-full" disabled={!from || !to || !!problem}>
            Show this range
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
