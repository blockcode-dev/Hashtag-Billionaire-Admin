/** @format */

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ChartLine, DollarSign, Package, Receipt, RotateCw, ShoppingBag, Table2, UserPlus, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GetDashboardActivityAPI,
  GetDashboardCustomersAPI,
  GetDashboardOverviewAPI,
  GetDashboardTopAPI,
  GetDashboardTrendAPI,
  type Metric,
  type Overview,
  type RangePreset,
  type RangeQuery,
  type TopSort,
  type TrendInterval,
  type TrendPoint,
} from "@/services/Api/DashboardApi";
import { Delta, Panel, Segmented, Sparkline } from "./charts";
import {
  AttentionCard,
  CardError,
  CustomersCard,
  MoneyCard,
  PaymentMethodsCard,
  RecentOrdersCard,
  SalesByCard,
  StatusCard,
  TopProductsCard,
} from "./cards";
import { bucketName, bucketTick, count, countShort, countTick, formatRange, money, moneyShort, moneyTick, zoneName } from "./format";
import { RangePicker } from "./RangePicker";
import { PRESETS } from "./ranges";
import { TrendChart, TrendTable, type TrendChartPoint } from "./TrendChart";
import { useApi } from "./useApi";

// ---------------------------------------------------------------- the five figures

type MetricKey = "sales" | "orders" | "average_order_value" | "items" | "new_customers";

interface MetricDef {
  label: string;
  hint: string;
  icon: LucideIcon;
  kpi: (o: Overview) => Metric;
  // A chart point's value; null where there's nothing to average.
  point: (p: TrendPoint) => number | null;
  format: (n: number) => string;
  tile: (n: number) => string;
  tick: (n: number, top: number) => string;
  // Whole numbers: orders, items, customers.
  integer?: boolean;
}

const METRICS: Record<MetricKey, MetricDef> = {
  sales: {
    label: "Total sales",
    hint: "Paid orders that weren't cancelled: products, handling fees, tax and shipping",
    icon: DollarSign,
    kpi: (o) => o.kpis.sales,
    point: (p) => p.sales,
    format: money,
    tile: moneyShort,
    tick: moneyTick,
  },
  orders: {
    label: "Orders",
    hint: "Paid orders that weren't cancelled",
    icon: ShoppingBag,
    kpi: (o) => o.kpis.orders,
    point: (p) => p.orders,
    format: count,
    tile: countShort,
    tick: countTick,
    integer: true,
  },
  average_order_value: {
    label: "Average order value",
    hint: "Total sales divided by orders",
    icon: Receipt,
    kpi: (o) => o.kpis.average_order_value,
    point: (p) => (p.orders ? p.average_order_value : null),
    format: money,
    tile: moneyShort,
    tick: moneyTick,
  },
  items: {
    label: "Items sold",
    hint: "Units across every order line",
    icon: Package,
    kpi: (o) => o.kpis.items_sold,
    point: (p) => p.items,
    format: count,
    tile: countShort,
    tick: countTick,
    integer: true,
  },
  new_customers: {
    label: "New customers",
    hint: "Accounts created on the website",
    icon: UserPlus,
    kpi: (o) => o.kpis.new_customers,
    point: (p) => p.new_customers,
    format: count,
    tile: countShort,
    tick: countTick,
    integer: true,
  },
};
const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

// The intervals worth offering for a range of `days`.
const intervalsFor = (days: number): { value: TrendInterval; label: string }[] =>
  [
    { value: "hour" as const, label: "Hour", ok: days <= 7 },
    { value: "day" as const, label: "Day", ok: days > 1 && days <= 400 },
    { value: "week" as const, label: "Week", ok: days >= 14 },
    { value: "month" as const, label: "Month", ok: days >= 60 },
  ]
    .filter((o) => o.ok)
    .map(({ value, label }) => ({ value, label }));

// ---------------------------------------------------------------- the range, kept in the address

const readRange = (params: URLSearchParams): RangeQuery => {
  const from = params.get("from");
  const to = params.get("to");
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) return { from, to };
  const preset = params.get("range") as RangePreset | null;
  return { range: preset && PRESETS.some((p) => p.value === preset) ? preset : "last_30_days" };
};

// ---------------------------------------------------------------- the page

const Dashboard = () => {
  const [params, setParams] = useSearchParams();
  const range = useMemo(() => readRange(params), [params]);
  const rangeKey = JSON.stringify(range);

  const [metric, setMetric] = useState<MetricKey>("sales");
  // null: the server picks for the range's length. Reset when the range changes.
  const [interval, setIntervalChoice] = useState<{ range: string; value: TrendInterval } | null>(null);
  const chosenInterval = interval && interval.range === rangeKey ? interval.value : undefined;
  const [view, setView] = useState<"chart" | "table">("chart");
  const [productSort, setProductSort] = useState<TopSort>("revenue");
  const [salesBy, setSalesBy] = useState<"grand_category" | "supplier">("grand_category");
  const [reload, setReload] = useState(0);

  const overview = useApi(`${rangeKey}|${reload}`, () => GetDashboardOverviewAPI(range));
  const trend = useApi(`${rangeKey}|${chosenInterval}|${reload}`, () => GetDashboardTrendAPI(range, chosenInterval));
  const products = useApi(`${rangeKey}|${productSort}|${reload}`, () => GetDashboardTopAPI(range, "product", productSort, 8));
  const salesByData = useApi(`${rangeKey}|${salesBy}|${reload}`, () => GetDashboardTopAPI(range, salesBy, "revenue", 8));
  const customers = useApi(`${rangeKey}|${reload}`, () => GetDashboardCustomersAPI(range, 5));
  const activity = useApi(`${reload}`, () => GetDashboardActivityAPI(8));

  const setRange = (next: RangeQuery) => {
    const query = new URLSearchParams();
    if ("range" in next) {
      if (next.range !== "last_30_days") query.set("range", next.range);
    } else {
      query.set("from", next.from);
      query.set("to", next.to);
    }
    setParams(query, { replace: true });
  };
  const refresh = () => setReload((n) => n + 1);

  const o = overview.data;
  const t = trend.data;
  const def = METRICS[metric];
  const resolved = o?.range ?? t?.range;

  const points: TrendChartPoint[] = useMemo(
    () =>
      t
        ? t.buckets.map((b, i) => ({
            key: `${b.label}`,
            tick: bucketTick(b, t.interval, i === 0),
            name: `${bucketName(b, t.interval)}${b.partial ? " (so far)" : ""}`,
            previousName: bucketName(b.previous, t.interval),
            value: b.upcoming ? null : def.point(b),
            previous: def.point(b.previous),
          }))
        : [],
    [t, def],
  );

  const partialIndex = t ? t.buckets.findIndex((b) => b.partial) : -1;
  const updated = activity.data ? new Date(activity.data.generated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  const reloading = overview.stale || trend.stale || activity.stale;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="How the store is doing. Sales are paid orders that weren't cancelled."
      />

      {/* One filter row: it scopes every figure below it. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <RangePicker value={range} onChange={setRange} resolved={resolved ? { from: resolved.from, to: resolved.to } : undefined} />
        {resolved && (
          <span className="text-sm text-muted-foreground">
            compared with {formatRange(resolved.previous.from, resolved.previous.to)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {resolved && <span className="hidden text-xs text-muted-foreground md:inline">Days follow {zoneName(resolved.timezone)}</span>}
          <Button variant="outline" size="sm" onClick={refresh} className="bg-background" title={updated ? `Updated at ${updated}` : undefined}>
            <RotateCw className={cn(reloading && "animate-spin")} aria-hidden />
            Refresh
          </Button>
        </div>
      </div>

      {/* The figures. Each one picks what the chart below shows. */}
      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5 [&>*:first-child]:col-span-2 lg:[&>*:first-child]:col-span-1"
        role="radiogroup"
        aria-label="Figure to chart"
      >
        {METRIC_KEYS.map((key) => {
          const m = METRICS[key];
          const k = o ? m.kpi(o) : null;
          const Icon = m.icon;
          const selected = metric === key;
          const spark = t ? t.buckets.filter((b) => !b.upcoming).map((b) => m.point(b) ?? 0) : [];
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMetric(key)}
              title={m.hint}
              className={cn(
                "group flex min-w-0 flex-col rounded-xl border bg-card p-4 text-left shadow-xs transition-[border-color,box-shadow,opacity]",
                selected ? "border-primary ring-2 ring-primary/15" : "hover:border-primary-border",
                overview.stale && "opacity-60",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">{m.label}</span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-colors",
                    selected ? "bg-primary-soft text-primary-soft-foreground" : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  <Icon className="size-3.5" />
                </span>
              </span>
              {k ? (
                <>
                  <span className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground" title={m.format(k.value)}>
                    {m.tile(k.value)}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    <Delta change={k.change} value={k.value} />
                    <span className="truncate">from {m.tile(k.previous)}</span>
                  </span>
                </>
              ) : overview.error ? (
                <span className="mt-2 text-sm text-muted-foreground">Couldn't load</span>
              ) : (
                <>
                  <Skeleton className="mt-3 h-7 w-24" />
                  <Skeleton className="mt-2 h-4 w-28" />
                </>
              )}
              <Sparkline values={spark} className={cn("mt-3", !selected && "opacity-70")} />
            </button>
          );
        })}
      </div>

      {o?.range.includes_today && (
        <p className="mt-2 text-xs text-muted-foreground">Today is still going, so its figures will grow.</p>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={`${def.label} over time`}
          description={def.hint}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {t && intervalsFor(t.range.days).length > 1 && (
                <Segmented
                  label="Group by"
                  value={t.interval}
                  onChange={(value) => setIntervalChoice({ range: rangeKey, value })}
                  options={intervalsFor(t.range.days)}
                />
              )}
              <Segmented<"chart" | "table">
                label="Show as"
                value={view}
                onChange={setView}
                options={[
                  { value: "chart", label: "Chart" },
                  { value: "table", label: "Table" },
                ]}
              />
            </div>
          }
        >
          {trend.error && !t ? (
            <CardError onRetry={refresh} />
          ) : !t ? (
            <Skeleton className="h-[290px] w-full" />
          ) : view === "table" ? (
            <TrendTable points={points} formatValue={def.format} valueLabel={def.label} />
          ) : (
            <TrendChart
              points={points}
              formatValue={def.format}
              formatTick={def.tick}
              title={def.label}
              currentLabel={formatRange(t.range.from, t.range.to)}
              previousLabel={`${formatRange(t.range.previous.from, t.range.previous.to)} (previous period)`}
              emptyText={metric === "new_customers" ? "No new accounts in this period" : "No sales in this period"}
              stale={trend.stale}
              partialIndex={partialIndex >= 0 ? partialIndex : null}
              integer={def.integer}
            />
          )}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            {view === "chart" ? <ChartLine className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
            {view === "chart"
              ? "Point at the chart, or focus it and use the arrow keys, to read each point."
              : `Every point, with the same point in the previous period.`}
          </p>
        </Panel>

        <AttentionCard data={activity.data} loading={activity.loading} error={activity.error} onRetry={refresh} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {overview.error && !o ? (
          <Panel title="Sales" className="lg:col-span-2 xl:col-span-3">
            <CardError onRetry={refresh} />
          </Panel>
        ) : (
          <>
            <MoneyCard data={o} stale={overview.stale} />
            <StatusCard data={o} stale={overview.stale} />
            <PaymentMethodsCard data={o} stale={overview.stale} />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TopProductsCard
          data={products.data}
          stale={products.stale}
          sort={productSort}
          onSort={setProductSort}
          error={products.error}
          onRetry={refresh}
        />
        <SalesByCard data={salesByData.data} stale={salesByData.stale} by={salesBy} onBy={setSalesBy} error={salesByData.error} onRetry={refresh} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <CustomersCard data={customers.data} stale={customers.stale} error={customers.error} onRetry={refresh} />
        </div>
        <div className="min-w-0 xl:col-span-3">
          <RecentOrdersCard data={activity.data} loading={activity.loading} error={activity.error} onRetry={refresh} />
        </div>
      </div>

      {o && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {count(o.checkouts.placed)} checkouts in {formatRange(o.range.from, o.range.to)} · days follow {zoneName(o.range.timezone)}
        </p>
      )}
    </div>
  );
};

export default Dashboard;
