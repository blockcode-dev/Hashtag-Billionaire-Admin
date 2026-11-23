/** @format */

import axios from "axios";

import { API_BASE_URL } from "@/config/env";

// The Dashboard page (hashtag-backend docs/admin-panel-changes.md, 19 Nov 2026). Read-only.
// A sale is a paid order that isn't cancelled. Days follow the store's clock (`range.timezone`),
// and every range is compared with the period of the same length just before it.

export type RangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_12_months";

// A preset, or two dates (YYYY-MM-DD, both included).
export type RangeQuery = { range: RangePreset } | { from: string; to: string };

export interface DashboardRange {
  preset: RangePreset | null;
  from: string;
  to: string;
  days: number;
  previous: { from: string; to: string };
  timezone: string;
  // Today's figures are still growing.
  includes_today: boolean;
}

export interface Metric {
  value: number;
  previous: number;
  // (value - previous) / previous; null when the previous period had nothing.
  change: number | null;
}

export interface Overview {
  range: DashboardRange;
  kpis: {
    sales: Metric;
    orders: Metric;
    average_order_value: Metric;
    items_sold: Metric;
    customers: Metric;
    new_customers: Metric;
  };
  breakdown: {
    product_sales: number;
    handling: number;
    tax: number;
    shipping: number;
    total: number;
    // Orders that have a label: shipping their customers paid, and what the labels cost.
    shipping_labelled: number;
    label_cost: number;
  };
  cancelled_after_payment: { orders: number; amount: number };
  checkouts: { placed: number; paid: number; paid_rate: number | null };
  orders_by_status: { status: string; orders: number; amount: number }[];
  payment_methods: { method: string; label: string; orders: number; amount: number; share: number | null }[];
}

export type TrendInterval = "hour" | "day" | "week" | "month";

export interface TrendPoint {
  label: string;
  from: string;
  to: string;
  sales: number;
  orders: number;
  items: number;
  average_order_value: number;
  new_customers: number;
}

export interface Trend {
  range: DashboardRange;
  interval: TrendInterval;
  buckets: (TrendPoint & {
    // Hasn't begun yet (later today, hourly): nothing to show.
    upcoming: boolean;
    // Under way now: still growing.
    partial: boolean;
    previous: TrendPoint;
  })[];
}

export type TopBy = "product" | "supplier" | "grand_category";
export type TopSort = "revenue" | "units";

export interface TopRow {
  id: number | string | null;
  name: string;
  supplier?: string;
  supplier_label?: string;
  image?: string | null;
  units: number;
  revenue: number;
  orders: number;
  share: number | null;
}

export interface Top {
  range: DashboardRange;
  by: TopBy;
  sort: TopSort;
  totals: { revenue: number; units: number };
  rows: TopRow[];
  others: { revenue: number; units: number } | null;
  // A product in several grand categories counts in each, so the rows add up to more than the totals.
  overlaps: boolean;
}

export interface CustomerGroup {
  customers: number;
  orders: number;
  sales: number;
}

export interface Customers {
  range: DashboardRange;
  summary: {
    buyers: number;
    first_time: CustomerGroup;
    returning: CustomerGroup;
    returning_rate: number | null;
    registered_total: number;
    ordered_total: number;
  };
  top: {
    user_id: number;
    name: string | null;
    email: string | null;
    orders: number;
    spent: number;
    last_order_at: string;
    first_order_at: string;
    returning: boolean;
  }[];
}

export interface Activity {
  generated_at: string;
  timezone: string;
  to_ship: { orders: number; label_failed: number; oldest_at: string | null };
  // Paid orders whose label waits for the customer's artwork approval (or for the team to decide
  // whether it should). They aren't in to_ship.
  waiting_for_approval: { count: number; oldest_at: string | null };
  // Open artwork approvals (not locked, and the order isn't cancelled or with the carrier) where
  // the customer asked for changes, and where they approved everything (ready to lock for
  // production). Missing from a backend without them.
  approval_changes?: { count: number };
  approval_ready?: { count: number };
  needs_attention: { orders: number };
  unpaid_checkouts: { orders: number; amount: number; days: number };
  sourcing_requests: { new: number; in_review: number };
  messages: { new: number };
  out_of_stock: { manual_products: number };
  recent_orders: {
    id: number;
    order_number: string;
    created_at: string;
    status: string;
    shipment_status: string;
    payment_method: string | null;
    total: number;
    items: number;
    customer: { name: string | null; email: string | null };
  }[];
}

const get = async <T,>(path: string, params: Record<string, unknown>): Promise<T> => {
  const res = await axios.get(`${API_BASE_URL}admin/dashboard/${path}`, { params });
  return res.data?.data as T;
};

export const GetDashboardOverviewAPI = (range: RangeQuery) => get<Overview>("overview", range);

export const GetDashboardTrendAPI = (range: RangeQuery, interval?: TrendInterval) =>
  get<Trend>("trend", { ...range, interval });

export const GetDashboardTopAPI = (range: RangeQuery, by: TopBy, sort: TopSort = "revenue", limit = 8) =>
  get<Top>("top", { ...range, by, sort, limit });

export const GetDashboardCustomersAPI = (range: RangeQuery, limit = 5) => get<Customers>("customers", { ...range, limit });

export const GetDashboardActivityAPI = (limit = 8) => get<Activity>("activity", { limit });
