/** @format */

import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import { cn } from "cn";
import { signedPercent } from "./format";

// ---------------------------------------------------------------- change against the previous period

// Up is good for every figure on the dashboard (sales, orders, customers...). `value` tells
// "new" (something now, nothing before) from "nothing in either period".
export function Delta({ change, value, className }: { change: number | null; value?: number; className?: string }) {
  if (change === null || !Number.isFinite(change)) {
    const none = !value;
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground", className)}>
        <Minus className="size-3" aria-hidden />
        {none ? <span className="sr-only">Nothing in either period</span> : "New"}
      </span>
    );
  }
  const up = change > 0;
  const flat = Math.abs(change) < 0.0005;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
        flat
          ? "bg-muted text-muted-foreground"
          : up
            ? "bg-success-soft text-success-soft-foreground"
            : "bg-destructive-soft text-destructive-soft-foreground",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span>{flat ? "0%" : signedPercent(change)}</span>
      <span className="sr-only">{up ? "up" : flat ? "no change" : "down"} on the previous period</span>
    </span>
  );
}

// ---------------------------------------------------------------- sparkline

// The current period's shape, in the accent; no axes (the tile's figure carries the value).
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 120;
  const h = 32;
  if (values.length < 2) return <div className={cn("h-8", className)} aria-hidden />;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden>
      <path d={`${line}L${w},${h}L0,${h}Z`} fill="var(--primary)" fillOpacity={0.08} />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- ranked bars

export interface BarItem {
  key: string;
  label: ReactNode;
  // The figure printed at the end of the row, and the bar's length.
  value: number;
  display: string;
  // A second, quieter line under the figure: share, orders...
  detail?: ReactNode;
  // Under the label.
  sublabel?: ReactNode;
  leading?: ReactNode;
  // The bar and its track. Default: the accent on its light tint.
  color?: string;
  track?: string;
  href?: string;
  title?: string;
}

// One row per item, largest first: name, a thin bar on a shared scale, and the figure. Every
// value is printed, so nothing depends on hovering.
export function BarList({ items, max, empty = "Nothing to show yet" }: { items: BarItem[]; max?: number; empty?: string }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const scale = max ?? Math.max(...items.map((i) => i.value), 0);
  return (
    <ul className="-mx-2 flex flex-col">
      {items.map((item) => {
        const pct = scale > 0 ? Math.max((item.value / scale) * 100, item.value > 0 ? 1.5 : 0) : 0;
        const body = (
          <>
            {item.leading}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-foreground">{item.label}</span>
                <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{item.display}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: item.track ?? "var(--primary-soft)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color ?? "var(--primary)" }} />
                </div>
                {item.detail && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.detail}</span>}
              </div>
              {item.sublabel && <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.sublabel}</div>}
            </div>
            {item.href && <ChevronRight className="size-4 shrink-0 self-center text-placeholder transition-colors group-hover:text-muted-foreground" aria-hidden />}
          </>
        );
        const rowClass = "group flex items-start gap-3 rounded-lg px-2 py-2";
        return (
          <li key={item.key}>
            {item.href ? (
              <Link to={item.href} title={item.title} className={cn(rowClass, "transition-colors hover:bg-muted focus-visible:bg-muted")}>
                {body}
              </Link>
            ) : (
              <div className={rowClass} title={item.title}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- one whole in two to six parts

export interface SplitPart {
  key: string;
  label: string;
  value: number;
  color: string;
  // White or near-black, by the fill's luminance.
  ink?: string;
  detail?: ReactNode;
}

// A tall segmented bar: each part its own block, its share printed inside when it fits, and a
// legend of names in block order. Hover or focus gives each part's name and share.
export function SplitBar({ parts, ariaLabel }: { parts: SplitPart[]; ariaLabel: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      {total > 0 ? (
        <div className="flex h-7 w-full gap-0.5" role="img" aria-label={ariaLabel}>
          {shown.map((p) => {
            const share = p.value / total;
            return (
              <div
                key={p.key}
                className="flex min-w-1 items-center overflow-hidden rounded px-2 text-xs font-semibold"
                style={{ flexGrow: p.value, flexBasis: 0, background: p.color, color: p.ink ?? "#fff" }}
                title={`${p.label}: ${Math.round(share * 100)}%`}
              >
                {share >= 0.12 && <span className="whitespace-nowrap">{Math.round(share * 100)}%</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-7 w-full rounded bg-muted" aria-label={ariaLabel} role="img" />
      )}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {parts.map((p) => (
          <li key={p.key} className="flex items-start gap-2">
            <span className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden />
            <div className="min-w-0">
              <div className="text-sm text-foreground">{p.label}</div>
              {p.detail && <div className="text-xs text-muted-foreground">{p.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- a card with a title row

export function Panel({
  title,
  description,
  action,
  children,
  className,
  stale,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  stale?: boolean;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border bg-card p-5 shadow-xs", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col transition-opacity", stale && "opacity-60")}>{children}</div>
    </section>
  );
}

// A small two-to-four way switch for a card's view.
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 items-center rounded-lg bg-muted p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-md px-2.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
