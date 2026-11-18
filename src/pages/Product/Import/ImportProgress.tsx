/** @format */

import { useEffect, useState, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

// What a running check or import shows: what's happening, its two steps (sending the file, then
// the server's work), a bar, and how long it has taken so far.

const elapsed = (seconds: number) => {
  if (seconds < 3) return "Started just now";
  if (seconds < 60) return `${seconds} seconds so far`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s so far`;
};

function Step({ state, children }: { state: "waiting" | "active" | "done"; children: ReactNode }) {
  return (
    <li
      className={cn(
        "flex items-center gap-1.5",
        state === "waiting" ? "text-muted-foreground" : "text-foreground",
        state === "active" && "font-medium",
      )}
    >
      <span className="grid size-4 place-items-center" aria-hidden>
        {state === "done" ? (
          <Check className="size-4 text-success" />
        ) : (
          <span className={cn("size-2 rounded-full", state === "active" ? "bg-primary" : "bg-muted-strong")} />
        )}
      </span>
      {children}
      {state === "done" && <span className="sr-only">, done</span>}
    </li>
  );
}

interface ImportProgressProps {
  // "Checking products.csv"
  title: string;
  // The server's step, after the file is sent: "Checking every row".
  work: string;
  // Share of the file sent, 0 to 1.
  sent: number;
  startedAt: number;
  note: ReactNode;
  onCancel?: () => void;
}

export function ImportProgress({ title, work, sent, startedAt, note, onCancel }: ImportProgressProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sending = sent < 1;
  const percent = Math.round(sent * 100);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  return (
    <div className="rounded-lg border border-primary-border bg-primary-soft/50 px-5 py-4" data-import-progress>
      <div className="flex items-start gap-3">
        <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium break-words text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {elapsed(seconds)}
            {seconds >= 20 && ". Big files can take a minute or two."}
          </p>
        </div>
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      <div
        role="progressbar"
        aria-label={sending ? "Sending the file" : work}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={sending ? percent : undefined}
        className="mt-4 h-2 overflow-hidden rounded-full bg-primary/15"
      >
        {sending ? (
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(4, percent)}%` }} />
        ) : (
          <div className="h-full w-2/5 rounded-full bg-primary animate-progress-slide motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
        )}
      </div>

      <ol className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm" aria-live="polite">
        <Step state={sending ? "active" : "done"}>Sending the file{sending && percent > 0 ? ` · ${percent}%` : ""}</Step>
        <Step state={sending ? "waiting" : "active"}>{work}</Step>
      </ol>

      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
