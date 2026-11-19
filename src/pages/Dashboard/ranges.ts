/** @format */

import type { RangePreset, RangeQuery } from "@/services/Api/DashboardApi";
import { formatRange } from "./format";

// The date range choices the API takes (dashboard.service.js PRESETS), in menu order.
export const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "last_12_months", label: "Last 12 months" },
];

export const MAX_DAYS = 731;

export const rangeLabel = (range: RangeQuery) =>
  "range" in range ? (PRESETS.find((p) => p.value === range.range)?.label ?? "Last 30 days") : formatRange(range.from, range.to);
