/** @format */

import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "cn";
import { signedPercent } from "./format";

export interface TrendChartPoint {
  key: string;
  // Under the point on the x axis.
  tick: string;
  // In full, in the tooltip and the table.
  name: string;
  previousName: string;
  // null: no value there (an average with no orders), drawn as a gap.
  value: number | null;
  previous: number | null;
}

interface TrendChartProps {
  points: TrendChartPoint[];
  formatValue: (n: number) => string;
  formatTick: (n: number, top: number) => string;
  // The legend's names for the two lines.
  currentLabel: string;
  previousLabel: string;
  // What's plotted, for screen readers: "Total sales".
  title: string;
  height?: number;
  emptyText?: string;
  // Held at reduced opacity while the next range loads.
  stale?: boolean;
  // The point still under way (today, this week...): reached by a dashed line, ringed.
  partialIndex?: number | null;
  // Counts: the axis steps by whole numbers.
  integer?: boolean;
}

const MARGIN = { top: 12, right: 12, bottom: 30 };
const TICK_CHARS = 7; // px per character of an axis label, near enough at 12px

// Round axis steps: 1, 2, 2.5 or 5 times a power of ten; whole steps for counts.
const niceTicks = (max: number, integer: boolean, count = 4) => {
  if (!(max > 0)) return { ticks: [0], top: 1 };
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  const step = integer ? Math.max(1, Math.ceil(nice)) : nice;
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { ticks, top };
};

// The current period as a gold line over a 10% wash, the previous period as a grey line, one
// y axis. A crosshair snaps to the nearest point; the tooltip lists both periods.
export function TrendChart({
  points,
  formatValue,
  formatTick,
  currentLabel,
  previousLabel,
  title,
  height = 260,
  emptyText = "Nothing in this period yet",
  stale = false,
  partialIndex = null,
  integer = false,
}: TrendChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = points.length;
  const current = points.map((p) => p.value);
  const previous = points.map((p) => p.previous);
  const max = Math.max(0, ...current.filter(isNum), ...previous.filter(isNum));
  const empty = max === 0;
  const { ticks, top } = useMemo(() => niceTicks(max, integer), [max, integer]);
  const left = Math.max(36, ...ticks.map((t) => formatTick(t, top).length * TICK_CHARS + 12));
  const innerW = Math.max(width - left - MARGIN.right, 10);
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const x = (i: number) => left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v: number) => MARGIN.top + innerH - (v / top) * innerH;

  const baseline = y(0);
  // Runs of points with a value; a null breaks the line.
  const runs = (values: (number | null)[]) => {
    const out: number[][] = [];
    values.forEach((v, i) => {
      if (!isNum(v)) return;
      if (i > 0 && isNum(values[i - 1])) out[out.length - 1].push(i);
      else out.push([i]);
    });
    return out;
  };
  const linePath = (values: (number | null)[]) =>
    runs(values)
      .filter((run) => run.length > 1)
      .map((run) => run.map((i, k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(values[i] as number).toFixed(1)}`).join(""))
      .join("");
  const areaPath = runs(current)
    .filter((run) => run.length > 1)
    .map(
      (run) =>
        `${run.map((i, k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(current[i] as number).toFixed(1)}`).join("")}` +
        `L${x(run[run.length - 1]).toFixed(1)},${baseline}L${x(run[0]).toFixed(1)},${baseline}Z`,
    )
    .join("");
  // A point with no neighbour on either side is a dot, or it would not show at all.
  const lonely = (values: (number | null)[]) => runs(values).filter((run) => run.length === 1).map((run) => run[0]);
  // The settled part of the current line is solid; the step into the point under way is dashed.
  const partial = partialIndex !== null && partialIndex >= 0 && partialIndex < n && isNum(current[partialIndex]) ? partialIndex : null;
  const settled = partial === null ? current : current.map((v, i) => (i === partial ? null : v));
  const dashed =
    partial !== null && partial > 0 && isNum(current[partial - 1])
      ? `M${x(partial - 1).toFixed(1)},${y(current[partial - 1] as number).toFixed(1)}L${x(partial).toFixed(1)},${y(current[partial] as number).toFixed(1)}`
      : "";

  // As many x labels as fit, evenly spaced; the last point always gets one when there's room.
  const tickIndexes = useMemo(() => {
    if (!n || !width) return [];
    const fit = Math.max(2, Math.floor(innerW / 76));
    const step = Math.max(1, Math.ceil(n / fit));
    const out: number[] = [];
    for (let i = 0; i < n; i += step) out.push(i);
    const last = n - 1;
    if (out[out.length - 1] !== last && (x(last) - x(out[out.length - 1])) > 64) out.push(last);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, width, innerW]);

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const rect = (event.currentTarget.ownerSVGElement ?? event.currentTarget).getBoundingClientRect();
    const px = event.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((px - left) / innerW) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!n) return;
    const move: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    if (event.key in move) {
      event.preventDefault();
      setActive((a) => Math.min(n - 1, Math.max(0, (a ?? n - 1) + move[event.key])));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(n - 1);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  };

  const point = active === null ? null : points[active];
  const tipLeft = active === null ? 0 : x(active);
  const flip = tipLeft > width - 230;

  return (
    <div className={cn("transition-opacity", stale && "opacity-60")}>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-primary" aria-hidden />
          <span className="text-foreground">{currentLabel}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-placeholder" aria-hidden />
          {previousLabel}
        </span>
        {partialIndex !== null && (
          <span className="inline-flex items-center gap-2">
            <svg width="16" height="2" aria-hidden>
              <line x1="1" x2="15" y1="1" y2="1" stroke="var(--primary)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
            </svg>
            So far: still growing
          </span>
        )}
      </div>

      <div
        ref={box}
        className="relative rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        style={{ height }}
        tabIndex={n ? 0 : -1}
        role="group"
        aria-label={`${title}: ${currentLabel}, compared with ${previousLabel}. Use the arrow keys to read each point.`}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? (n ? n - 1 : null))}
        onBlur={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={height} className="block overflow-visible" aria-hidden>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={left}
                  x2={left + innerW}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? "var(--input)" : "var(--border)"}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={12}
                  fill="var(--muted-foreground)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatTick(t, top)}
                </text>
              </g>
            ))}

            {tickIndexes.map((i, k) => (
              <text
                key={points[i].key}
                x={x(i)}
                y={height - 8}
                textAnchor={n > 1 && k === 0 && i === 0 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"}
                fontSize={12}
                fill="var(--muted-foreground)"
              >
                {points[i].tick}
              </text>
            ))}

            {areaPath && <path d={areaPath} fill="var(--primary)" fillOpacity={0.1} />}
            <path d={linePath(previous)} fill="none" stroke="var(--placeholder)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <path d={linePath(settled)} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {dashed && <path d={dashed} fill="none" stroke="var(--primary)" strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />}
            {partial !== null && (
              <circle cx={x(partial)} cy={y(current[partial] as number)} r={4} fill="var(--card)" stroke="var(--primary)" strokeWidth={2} />
            )}
            {lonely(previous).map((i) => (
              <circle key={`p${i}`} cx={x(i)} cy={y(previous[i] as number)} r={3} fill="var(--placeholder)" stroke="var(--card)" strokeWidth={2} />
            ))}
            {lonely(settled).map((i) => (
              <circle key={`c${i}`} cx={x(i)} cy={y(current[i] as number)} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
            ))}

            {point && (
              <g>
                <line
                  x1={tipLeft}
                  x2={tipLeft}
                  y1={MARGIN.top}
                  y2={baseline}
                  stroke="var(--input)"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                {isNum(point.previous) && (
                  <circle cx={tipLeft} cy={y(point.previous)} r={4} fill="var(--placeholder)" stroke="var(--card)" strokeWidth={2} />
                )}
                {isNum(point.value) && (
                  <circle cx={tipLeft} cy={y(point.value)} r={4.5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
                )}
              </g>
            )}

            {/* The hit area: the whole plot, so the pointer only has to be near a date. */}
            <rect
              x={left}
              y={MARGIN.top}
              width={innerW}
              height={innerH}
              fill="transparent"
              onPointerMove={pick}
              onPointerDown={pick}
              onPointerLeave={() => setActive(null)}
            />
          </svg>
        )}

        {empty && width > 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        )}

        {point && (
          <div
            className="pointer-events-none absolute z-10 w-max min-w-44 max-w-64 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
            style={{ top: MARGIN.top, left: flip ? undefined : tipLeft + 12, right: flip ? width - tipLeft + 12 : undefined }}
            role="status"
            aria-live="polite"
          >
            <div className="mb-1.5 font-medium text-foreground">{point.name}</div>
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-3 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="text-sm font-semibold text-foreground">{show(point.value, formatValue)}</span>
              <Change now={point.value} before={point.previous} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
              <span className="h-0.5 w-3 shrink-0 rounded-full bg-placeholder" aria-hidden />
              <span className="font-medium">{show(point.previous, formatValue)}</span>
              <span className="truncate">{point.previousName}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const show = (v: number | null, format: (n: number) => string) => (isNum(v) ? format(v) : "—");

function Change({ now, before }: { now: number | null; before: number | null }) {
  if (!isNum(now) || !isNum(before) || !before) return null;
  const ratio = (now - before) / before;
  return (
    <span className={cn("font-medium", ratio >= 0 ? "text-success-soft-foreground" : "text-destructive-soft-foreground")}>
      {signedPercent(ratio)}
    </span>
  );
}

// The chart's twin for screen readers and exact values: every point, both periods.
export function TrendTable({
  points,
  formatValue,
  valueLabel,
}: {
  points: TrendChartPoint[];
  formatValue: (n: number) => string;
  valueLabel: string;
}) {
  return (
    <div className="max-h-[300px] overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="px-3 py-2 text-left">Period</th>
            <th className="px-3 py-2 text-right">{valueLabel}</th>
            <th className="px-3 py-2 text-left">Previous period</th>
            <th className="px-3 py-2 text-right">{valueLabel}</th>
            <th className="px-3 py-2 text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key} className="border-t">
              <td className="px-3 py-1.5">{p.name}</td>
              <td className="px-3 py-1.5 text-right font-medium">{show(p.value, formatValue)}</td>
              <td className="px-3 py-1.5 text-muted-foreground">{p.previousName}</td>
              <td className="px-3 py-1.5 text-right text-muted-foreground">{show(p.previous, formatValue)}</td>
              <td className="px-3 py-1.5 text-right">
                {p.previous ? <Change now={p.value} before={p.previous} /> : <span className="text-muted-foreground">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
