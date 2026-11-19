/** @format */

import type { TrendInterval } from "@/services/Api/DashboardApi";

// Numbers: in full below 10,000, compact above (12.9K, $4.2M), as stat tiles and axes show them.
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const money = (n: number) => usd.format(n);
export const moneyShort = (n: number) => (Math.abs(n) >= 10000 ? usdCompact.format(n) : usd.format(n));
export const moneyWhole = (n: number) => (Math.abs(n) >= 10000 ? usdCompact.format(n) : usdWhole.format(n));
export const count = (n: number) => whole.format(n);
export const countShort = (n: number) => (Math.abs(n) >= 10000 ? compact.format(n) : whole.format(n));

// Axis ticks: whole numbers, compact once the axis reaches 10,000.
export const moneyTick = (n: number, top: number) => (top >= 10000 ? usdCompact.format(n) : usdWhole.format(n));
export const countTick = (n: number, top: number) => (top >= 10000 ? compact.format(n) : whole.format(n));

export const percent = (ratio: number | null | undefined, digits = 0) =>
  ratio === null || ratio === undefined || !Number.isFinite(ratio) ? "—" : `${(ratio * 100).toFixed(digits)}%`;

// +12.3% / −4.0% (a real minus sign).
export const signedPercent = (ratio: number) => {
  const text = `${Math.abs(ratio * 100).toFixed(Math.abs(ratio) >= 1 ? 0 : 1)}%`;
  return ratio > 0 ? `+${text}` : ratio < 0 ? `−${text}` : "0%";
};

// ---------------------------------------------------------------- dates
// Store days arrive as YYYY-MM-DD; they're shown as written, whatever the viewer's zone.

const day = (text: string) => new Date(`${text.slice(0, 10)}T00:00:00Z`);
const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options });
const monthDay = fmt({ month: "short", day: "numeric" });
const monthDayYear = fmt({ month: "short", day: "numeric", year: "numeric" });
const weekdayMonthDay = fmt({ weekday: "short", month: "short", day: "numeric" });
const monthYear = fmt({ month: "long", year: "numeric" });
const monthShort = fmt({ month: "short" });
const monthShortYear = fmt({ month: "short", year: "numeric" });

export const formatDay = (text: string) => monthDayYear.format(day(text));

export const formatRange = (from: string, to: string) => {
  if (from === to) return monthDayYear.format(day(from));
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${(sameYear ? monthDay : monthDayYear).format(day(from))} – ${monthDayYear.format(day(to))}`;
};

// A bucket's 24-hour "YYYY-MM-DD HH:mm" label as 2 PM.
const hourOf = (label: string) => {
  const hour = Number(label.slice(11, 13));
  return `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
};

// What a chart point covers, in full: tooltips and the table view.
export const bucketName = (point: { label: string; from: string; to: string }, interval: TrendInterval) => {
  if (interval === "hour") return `${weekdayMonthDay.format(day(point.from))}, ${hourOf(point.label)}`;
  if (interval === "day") return weekdayMonthDay.format(day(point.from));
  if (interval === "month" && point.from.endsWith("-01") && isMonthEnd(point.to)) return monthYear.format(day(point.from));
  return formatRange(point.from, point.to);
};

const isMonthEnd = (text: string) => {
  const next = new Date(day(text).getTime() + 86400000);
  return next.getUTCDate() === 1;
};

// The short axis label under a point.
export const bucketTick = (point: { label: string; from: string }, interval: TrendInterval, first: boolean) => {
  if (interval === "hour") return hourOf(point.label);
  if (interval === "month") return (first || point.from.slice(5, 7) === "01" ? monthShortYear : monthShort).format(day(point.from));
  return monthDay.format(day(point.from));
};

// An instant on the store's clock: Nov 19, 3:42 PM.
export const storeDateTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );

// 3 days, 5 hours, 20 minutes.
export const ageOf = (iso: string, now = Date.now()) => {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
};

// US Central for America/Chicago; the zone's own name otherwise.
export const zoneName = (timeZone: string) =>
  timeZone === "America/Chicago" ? "US Central time" : timeZone.replace(/_/g, " ");

// Supplier names arrive with HTML entities and doubled spaces ("Allmade  &#174;  Tee"). A textarea
// decodes them as plain text, as the Orders page does: nothing in them is ever run or rendered as HTML.
export const plainText = (text?: string | null) => {
  if (!text) return "";
  if (!text.includes("&") || typeof document === "undefined") return text.replace(/\s+/g, " ").trim();
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value.replace(/\s+/g, " ").trim();
};
