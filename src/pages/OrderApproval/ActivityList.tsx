import { useMemo, useState } from "react";
import { Store, User, Users } from "lucide-react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Combobox } from "@/components/common/Combobox";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusTag } from "@/components/common/StatusTag";
import type { ApprovalView } from "@/services/Api/ApprovalApi";
import { buildActivity, type ActivityEntry, type ActivityWho } from "./activity";
import { centralTime, deviceOf, lineName } from "./format";

const WHO_OPTIONS = [
  { value: "all", label: "Customer and team" },
  { value: "customer", label: "Only the customer" },
  { value: "team", label: "Only the team" },
];

const WHO_STYLE: Record<ActivityWho, { icon: typeof User; className: string; label: string }> = {
  customer: { icon: User, className: "bg-info-soft text-info-soft-foreground", label: "Customer" },
  team: { icon: Users, className: "bg-muted text-muted-foreground", label: "Team" },
  store: { icon: Store, className: "bg-muted text-muted-foreground", label: "Store" },
};

const TONE_TEXT: Record<NonNullable<ActivityEntry["tone"]>, string> = {
  good: "text-success-soft-foreground",
  attention: "text-warning-soft-foreground",
  problem: "text-destructive-soft-foreground",
};

// The Activity tab: everything that happened, newest first, in plain sentences. Nothing is ever
// deleted; what the customer took back is crossed out.
export function ActivityList({ view, newEventIds }: { view: ApprovalView; newEventIds: ReadonlySet<number> }) {
  const entries = useMemo(() => buildActivity(view), [view]);
  const [lineFilter, setLineFilter] = useState("all");
  const [who, setWho] = useState("all");

  const lineOptions = [
    { value: "all", label: "All items" },
    ...view.lines
      .filter((line) => line.id !== null)
      .map((line, i) => ({ value: String(line.id), label: lineName(line) || `Item ${i + 1}` })),
  ];
  const shown = entries.filter(
    (entry) =>
      (lineFilter === "all" || entry.lineIds.includes(Number(lineFilter))) &&
      (who === "all" || (who === "customer") === (entry.who === "customer")),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Everything that happened, newest first. Times are US Central.</p>
        <div className="flex flex-wrap gap-2">
          <Combobox
            searchable={false}
            options={lineOptions}
            value={lineFilter}
            onChange={(value) => setLineFilter(value ?? "all")}
            style={{ width: 260 }}
          />
          <Combobox
            searchable={false}
            options={WHO_OPTIONS}
            value={who}
            onChange={(value) => setWho(value ?? "all")}
            style={{ width: 200 }}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState description={entries.length ? "Nothing matches these filters." : "Nothing has happened yet."} />
        </div>
      ) : (
        <ol className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {shown.map((entry) => (
            <ActivityRow key={entry.event.id} entry={entry} isNew={entry.ids.some((id) => newEventIds.has(id))} />
          ))}
        </ol>
      )}
    </div>
  );
}

function ActivityRow({ entry, isNew }: { entry: ActivityEntry; isNew: boolean }) {
  const style = WHO_STYLE[entry.who];
  const Icon = style.icon;
  const { event } = entry;
  const device = deviceOf(event.user_agent);

  return (
    <li className="flex gap-3 px-4 py-3">
      <span
        className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", style.className)}
        role="img"
        aria-label={style.label}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm">
          <span
            className={cn(
              "text-foreground",
              entry.tone && TONE_TEXT[entry.tone],
              entry.crossedOut && "text-muted-foreground line-through",
            )}
          >
            {entry.text}
          </span>
          {isNew && (
            <StatusTag color="gold" className="ml-2 align-middle">
              New
            </StatusTag>
          )}
        </p>
        {entry.details && entry.details.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {entry.details.map((detail, i) => (
              <li key={i}>{detail}</li>
            ))}
          </ul>
        )}
        {entry.quote && (
          <blockquote className="border-l-2 pl-3 text-sm break-words whitespace-pre-wrap text-muted-foreground">
            {entry.quote}
          </blockquote>
        )}
        {entry.extra && <p className="text-xs text-muted-foreground">{entry.extra}</p>}
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <time dateTime={event.created_at}>{centralTime(event.created_at)}</time>
          {(event.ip || event.user_agent) && (
            <>
              <span aria-hidden>·</span>
              {/* Where a customer action came from, for when someone asks who approved. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded underline decoration-dotted underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {device || "Device details"}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs space-y-0.5">
                  <p>IP address: {event.ip || "unknown"}</p>
                  {device && <p>Device: {device}</p>}
                  {event.user_agent && <p className="break-all opacity-75">{event.user_agent}</p>}
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </p>
      </div>
    </li>
  );
}
