/** @format */

import { Link, useNavigate } from "react-router";
import {
  Check,
  ChevronRight,
  Clock,
  Flag,
  Mail,
  PackageCheck,
  PackageX,
  SearchCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { Thumbnail } from "@/components/common/Thumbnail";
import { ORDER_STATUS, ORDER_STATUS_FILTERS, ordersLink } from "@/lib/orderStatus";
import type { Activity, Customers, Overview, Top, TopSort } from "@/services/Api/DashboardApi";
import { BarList, Panel, Segmented, SplitBar } from "./charts";
import { ageOf, count, money, percent, plainText, storeDateTime } from "./format";

// ---------------------------------------------------------------- shared bits

export function CardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      ))}
    </div>
  );
}

export function CardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
      <TriangleAlert className="size-5 text-warning" aria-hidden />
      Couldn't load this.
      <button type="button" onClick={onRetry} className="font-medium text-primary underline-offset-4 hover:underline">
        Try again
      </button>
    </div>
  );
}

const StatusDot = ({ color }: { color: string }) => (
  <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
);

function StatusPill({ status }: { status: string }) {
  const cfg = ORDER_STATUS[status] ?? ORDER_STATUS.CANCELLED;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
      title={cfg.desc}
    >
      <span className="size-1.5 rounded-full" style={{ background: cfg.dot }} aria-hidden />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------- needs attention

type Tone = "danger" | "warning" | "info" | "neutral";
const TONE: Record<Tone, string> = {
  danger: "bg-destructive-soft text-destructive-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  neutral: "bg-muted text-muted-foreground",
};

interface AttentionRow {
  key: string;
  icon: LucideIcon;
  count: number;
  label: string;
  detail: string;
  tone: Tone;
  href: string;
  // Left out when there is none.
  optional?: boolean;
}

export function AttentionCard({ data, loading, error, onRetry }: { data: Activity | null; loading: boolean; error: unknown; onRetry: () => void }) {
  const all: AttentionRow[] = data
    ? [
        {
          key: "ship",
          icon: PackageCheck,
          count: data.to_ship.orders,
          label: "Orders to ship",
          detail: data.to_ship.orders
            ? `No label yet${data.to_ship.oldest_at ? ` · oldest ${ageOf(data.to_ship.oldest_at)}` : ""}`
            : "Every paid order has a label",
          tone: "warning",
          href: ordersLink({ status: "CONFIRMED" }),
        },
        {
          key: "label",
          icon: TriangleAlert,
          count: data.to_ship.label_failed,
          label: "Labels that failed",
          detail: "ShipStation couldn't buy them. Try Buy label again.",
          tone: "danger",
          href: ordersLink({ status: "CONFIRMED" }),
          optional: true,
        },
        {
          key: "flagged",
          icon: Flag,
          count: data.needs_attention.orders,
          label: "Orders flagged for a look",
          detail: "A note on each order says why",
          tone: "warning",
          href: "/orders",
          optional: true,
        },
        {
          key: "unpaid",
          icon: Clock,
          count: data.unpaid_checkouts.orders,
          label: "Unpaid checkouts",
          detail: `Last ${data.unpaid_checkouts.days} days${data.unpaid_checkouts.orders ? ` · ${money(data.unpaid_checkouts.amount)}` : ""}`,
          tone: "neutral",
          href: ordersLink({ status: "PENDING_PAYMENT", payment_status: "PENDING" }),
        },
        {
          key: "sourcing",
          icon: SearchCheck,
          count: data.sourcing_requests.new,
          label: "New sourcing requests",
          detail: data.sourcing_requests.in_review ? `${count(data.sourcing_requests.in_review)} more in review` : "Customers asking for a product",
          tone: "info",
          href: "/sourcing-requests",
        },
        {
          key: "messages",
          icon: Mail,
          count: data.messages.new,
          label: "New messages",
          detail: "From the Contact Us form",
          tone: "info",
          href: "/contact-us",
        },
        {
          key: "stock",
          icon: PackageX,
          count: data.out_of_stock.manual_products,
          label: "Manual products out of stock",
          detail: "Hidden on the website until an option has stock",
          tone: "warning",
          href: "/products",
          optional: true,
        },
      ]
    : [];
  const rows = all.filter((row) => !row.optional || row.count > 0);

  return (
    <Panel title="Needs your attention" description="Right now, whatever the dates above">
      {error && !data ? (
        <CardError onRetry={onRetry} />
      ) : loading ? (
        <CardSkeleton rows={6} />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {rows.map((row) => {
            const Icon = row.count ? row.icon : Check;
            return (
              <li key={row.key}>
                <Link
                  to={row.href}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted focus-visible:bg-muted"
                >
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", row.count ? TONE[row.tone] : "bg-success-soft text-success-soft-foreground")}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{row.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{row.detail}</span>
                  </span>
                  <span className={cn("text-lg font-semibold tabular-nums", row.count ? "text-foreground" : "text-placeholder")}>{count(row.count)}</span>
                  <ChevronRight className="size-4 shrink-0 text-placeholder group-hover:text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- where the money comes from

export function MoneyCard({ data, stale }: { data: Overview | null; stale: boolean }) {
  if (!data) return <Panel title="Where the money comes from"><CardSkeleton rows={5} /></Panel>;
  const b = data.breakdown;
  const lines = [
    { label: "Product sales", value: b.product_sales, hint: "What the items and their decoration cost" },
    { label: "Handling fees", value: b.handling, hint: "The order fee set on the Settings page" },
    { label: "Sales tax", value: b.tax, hint: "Collected for the state" },
    { label: "Shipping charged", value: b.shipping, hint: "What customers paid for shipping" },
  ];
  const margin = b.shipping_labelled - b.label_cost;
  const cancelled = data.cancelled_after_payment;
  return (
    <Panel title="Where the money comes from" description="Total sales, split into its parts" stale={stale}>
      <dl className="flex flex-col">
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-3 py-1.5" title={line.hint}>
            <dt className="text-sm text-muted-foreground">{line.label}</dt>
            <dd className="text-sm text-foreground tabular-nums">
              {money(line.value)}
              <span className="ml-2 inline-block w-10 text-right text-xs text-muted-foreground">{b.total ? percent(line.value / b.total) : "—"}</span>
            </dd>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2.5">
          <dt className="text-sm font-semibold text-foreground">Total sales</dt>
          <dd className="text-sm font-semibold text-foreground tabular-nums">
            {money(b.total)}
            <span className="ml-2 inline-block w-10" />
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">Shipping labels bought</span>
          <span className="text-foreground tabular-nums">{money(b.label_cost)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground" title="On orders that have a label: shipping charged minus what the labels cost">
            Shipping margin so far
          </span>
          <span
            className={cn(
              "font-medium tabular-nums",
              Math.abs(margin) < 0.005 ? "text-muted-foreground" : margin > 0 ? "text-success-soft-foreground" : "text-destructive-soft-foreground",
            )}
          >
            {Math.abs(margin) < 0.005 ? "" : margin > 0 ? "+" : "−"}
            {money(Math.abs(margin))}
          </span>
        </div>
      </div>

      {cancelled.orders > 0 && (
        <Link
          to={ordersLink({ status: "CANCELLED", payment_status: "SUCCESS" })}
          className="mt-3 flex gap-2.5 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-sm text-warning-soft-foreground transition-colors hover:border-warning"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">
              {count(cancelled.orders)} paid order{cancelled.orders === 1 ? " was" : "s were"} cancelled ({money(cancelled.amount)}).
            </strong>{" "}
            Not counted in sales. Cancelling doesn't refund: refund in Square or PayPal if you haven't.
          </span>
        </Link>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- orders placed, by status

export function StatusCard({ data, stale }: { data: Overview | null; stale: boolean }) {
  if (!data) return <Panel title="Orders placed"><CardSkeleton rows={6} /></Panel>;
  const byStatus = new Map(data.orders_by_status.map((s) => [s.status, s]));
  const { placed, paid, paid_rate } = data.checkouts;
  return (
    <Panel
      title="Orders placed"
      description={placed ? `${count(placed)} checkouts · ${count(paid)} paid (${percent(paid_rate)})` : "Every checkout, paid or not"}
      stale={stale}
    >
      <BarList
        items={ORDER_STATUS_FILTERS.map((status) => {
          const row = byStatus.get(status);
          const cfg = ORDER_STATUS[status];
          return {
            key: status,
            label: cfg.label,
            title: cfg.desc,
            value: row?.orders ?? 0,
            display: count(row?.orders ?? 0),
            detail: money(row?.amount ?? 0),
            leading: <StatusDot color={cfg.dot} />,
            color: cfg.dot,
            track: cfg.bg,
            href: ordersLink({ status, payment_status: "ALL" }),
          };
        })}
        empty="No checkouts in this period"
      />
    </Panel>
  );
}

// ---------------------------------------------------------------- payment methods

export function PaymentMethodsCard({ data, stale }: { data: Overview | null; stale: boolean }) {
  if (!data) return <Panel title="How customers pay"><CardSkeleton rows={4} /></Panel>;
  return (
    <Panel title="How customers pay" description="Total sales by payment method" stale={stale}>
      <BarList
        items={data.payment_methods.map((m) => ({
          key: m.method,
          label: m.label,
          value: m.amount,
          display: money(m.amount),
          detail: `${count(m.orders)} order${m.orders === 1 ? "" : "s"} · ${percent(m.share)}`,
        }))}
        empty="No sales in this period"
      />
    </Panel>
  );
}

// ---------------------------------------------------------------- top products

export function TopProductsCard({
  data,
  stale,
  sort,
  onSort,
  error,
  onRetry,
}: {
  data: Top | null;
  stale: boolean;
  sort: TopSort;
  onSort: (sort: TopSort) => void;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Panel
      title="Top products"
      description={sort === "units" ? "By items sold" : "By sales, before tax and shipping"}
      action={
        <Segmented
          label="Rank products by"
          value={sort}
          onChange={onSort}
          options={[
            { value: "revenue", label: "Sales" },
            { value: "units", label: "Items" },
          ]}
        />
      }
      stale={stale}
    >
      {error && !data ? (
        <CardError onRetry={onRetry} />
      ) : !data ? (
        <CardSkeleton rows={6} />
      ) : (
        <>
          <BarList
            items={data.rows.map((row) => ({
              key: String(row.id),
              label: plainText(row.name),
              sublabel: row.supplier_label,
              value: sort === "units" ? row.units : row.revenue,
              display: sort === "units" ? count(row.units) : money(row.revenue),
              detail: `${count(row.orders)} order${row.orders === 1 ? "" : "s"} · ${percent(row.share)}`,
              leading: <Thumbnail src={row.image} alt="" size={40} className="rounded-md border" />,
              href: `/products/${row.id}`,
            }))}
            empty="No products sold in this period"
          />
          {data.others && (sort === "units" ? data.others.units : data.others.revenue) > 0 && (
            <p className="mt-2 border-t pt-2.5 text-xs text-muted-foreground">
              Other products: {sort === "units" ? `${count(data.others.units)} items` : money(data.others.revenue)}
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- sales by grand category or supplier

export function SalesByCard({
  data,
  stale,
  by,
  onBy,
  error,
  onRetry,
}: {
  data: Top | null;
  stale: boolean;
  by: "grand_category" | "supplier";
  onBy: (by: "grand_category" | "supplier") => void;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Panel
      title={by === "supplier" ? "Sales by supplier" : "Sales by grand category"}
      description="Product sales, before tax and shipping"
      action={
        <Segmented
          label="Group sales by"
          value={by}
          onChange={onBy}
          options={[
            { value: "grand_category", label: "Grand category" },
            { value: "supplier", label: "Supplier" },
          ]}
        />
      }
      stale={stale}
    >
      {error && !data ? (
        <CardError onRetry={onRetry} />
      ) : !data ? (
        <CardSkeleton rows={6} />
      ) : (
        <>
          <BarList
            items={data.rows.map((row) => ({
              key: String(row.id),
              label: row.id === null ? <span className="text-muted-foreground">{row.name}</span> : plainText(row.name),
              title: row.id === null ? "Products whose supplier categories aren't in any parent category with a grand category" : undefined,
              value: row.revenue,
              display: money(row.revenue),
              detail: `${count(row.units)} items · ${percent(row.share)}`,
              color: row.id === null ? "var(--placeholder)" : undefined,
              track: row.id === null ? "var(--muted)" : undefined,
            }))}
            empty="No sales in this period"
          />
          {data.overlaps && (
            <p className="mt-2 border-t pt-2.5 text-xs text-muted-foreground">
              A product in more than one grand category counts in each, so these add up to more than product sales (
              {money(data.totals.revenue)}).
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- customers

export function CustomersCard({ data, stale, error, onRetry }: { data: Customers | null; stale: boolean; error: unknown; onRetry: () => void }) {
  const navigate = useNavigate();
  if (error && !data) return <Panel title="Customers"><CardError onRetry={onRetry} /></Panel>;
  if (!data) return <Panel title="Customers"><CardSkeleton rows={5} /></Panel>;
  const s = data.summary;
  return (
    <Panel title="Customers" description={`${count(s.buyers)} bought in this period`} stale={stale}>
      <SplitBar
        ariaLabel={`New buyers ${count(s.first_time.customers)}, returning ${count(s.returning.customers)}`}
        parts={[
          {
            key: "first",
            label: "New buyers: first order in this period",
            value: s.first_time.customers,
            color: "var(--primary)",
            detail: `${count(s.first_time.customers)} customers · ${money(s.first_time.sales)}`,
          },
          {
            key: "returning",
            label: "Returning: ordered before this period",
            value: s.returning.customers,
            color: "var(--violet)",
            detail: `${count(s.returning.customers)} customers · ${money(s.returning.sales)}`,
          },
        ]}
      />
      <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Accounts</div>
          <div className="mt-0.5 font-semibold text-foreground">{count(s.registered_total)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Have ever bought</div>
          <div className="mt-0.5 font-semibold text-foreground">
            {count(s.ordered_total)}{" "}
            <span className="font-normal text-muted-foreground">({percent(s.registered_total ? s.ordered_total / s.registered_total : null)})</span>
          </div>
        </div>
      </div>

      <h3 className="mt-5 mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Top customers</h3>
      {data.top.length ? (
        <ul className="-mx-2 flex flex-col">
          {data.top.map((c) => (
            <li key={c.user_id}>
              <button
                type="button"
                onClick={() => navigate(ordersLink({ payment_status: "ALL", search: c.email ?? "" }))}
                className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted"
                title="See their orders"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground" aria-hidden>
                  {initials(plainText(c.name) || c.email || "?")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{plainText(c.name) || c.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {count(c.orders)} order{c.orders === 1 ? "" : "s"}
                    {c.returning ? " · returning" : " · new this period"}
                  </span>
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{money(c.spent)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">No sales in this period</p>
      )}
    </Panel>
  );
}

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

// ---------------------------------------------------------------- recent orders

export function RecentOrdersCard({ data, loading, error, onRetry }: { data: Activity | null; loading: boolean; error: unknown; onRetry: () => void }) {
  const navigate = useNavigate();
  return (
    <Panel
      title="Recent orders"
      description="The latest paid orders"
      action={
        <Link to="/orders" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          All orders
        </Link>
      }
    >
      {error && !data ? (
        <CardError onRetry={onRetry} />
      ) : loading || !data ? (
        <CardSkeleton rows={6} />
      ) : data.recent_orders.length ? (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[440px] table-fixed text-sm">
            <colgroup>
              <col className="w-[34%]" />
              <col />
              <col className="w-[118px]" />
              <col className="w-[112px]" />
            </colgroup>
            <thead>
              <tr className="border-b">
                <th className="px-5 pb-2 text-left">Order</th>
                <th className="px-3 pb-2 text-left">Customer</th>
                <th className="px-3 pb-2 text-left">Status</th>
                <th className="px-5 pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_orders.map((o) => {
                const open = () => navigate(ordersLink({ payment_status: "ALL", search: o.order_number, open: o.order_number }));
                return (
                  <tr
                    key={o.id}
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open();
                      }
                    }}
                    className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    aria-label={`Open order ${o.order_number}`}
                  >
                    <td className="px-5 py-2.5 font-medium text-foreground">
                      <span className="block truncate" title={o.order_number}>
                        {o.order_number}
                      </span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {storeDateTime(o.created_at, data.timezone)} · {count(o.items)} item{o.items === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block truncate text-foreground">{plainText(o.customer.name) || o.customer.email || "—"}</span>
                      {o.customer.name && o.customer.email && <span className="block truncate text-xs text-muted-foreground">{o.customer.email}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold text-foreground tabular-nums">{money(o.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">No paid orders yet</p>
      )}
    </Panel>
  );
}
