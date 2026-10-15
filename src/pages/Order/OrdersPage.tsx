/** @format */

import { useEffect, useState, useCallback, useMemo } from "react";
import { ArrowUpRight, Eye } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox } from "@/components/common/Combobox";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { SearchInput } from "@/components/common/SearchInput";
import "./Order.scss";
import { GetAdminOrdersAPI } from "@/services/Api/OrderApi";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type CustomizationType = "AUTO" | "MANUAL";

/** How an order line was customized — derived from the payload, not stored. */
type ItemKind = "MANUAL" | "AUTO" | "DECORATED" | "STANDARD";

interface PricingTier {
  id?: number;
  min_quantity?: number | null;
  max_quantity?: number | null;
  quantity?: number | null;
  price: number;
}

/** Supplier products (SanMar / S&S): one row per decoration location. */
interface PricingRow {
  type?: string;
  print_method?: string;
  location?: string;
  quantity: number;
  price_per_item: number;
  total: number;
}

/** Manual products: one row per selected customization option value. */
interface ManualCustomizationLine {
  customization_option_id: number;
  option_name: string;
  customization_option_value_id: number;
  value_name: string;
  pricing_type: "FIXED" | "TIERED" | "QUANTITY_BASED" | string;
  unit_price: number | null;
  quantity: number;
  total: number;
  pricing_tier?: PricingTier;
}

interface AddonLine {
  product_addon_id: number;
  addon_product_id?: number;
  name: string;
  unit_price: number;
  quantity: number;
  total: number;
}

interface PricingBreakdown {
  actual_product_price: number;
  supplier_markup: number;
  final_product_price: number;
  customization_price: number;
  setup_fee?: number;
  product_total?: number;
  addon_price?: number;
  final_price_per_item: number;
  final_total: number;
  pricing_table?: PricingRow[];
  customization?: { items: ManualCustomizationLine[]; total: number };
  addons?: AddonLine[];
}

interface PricingSnapshot {
  supplier?: string;
  quantity?: number;
  inquiry_only?: boolean;
  product_price?: {
    base_price?: number;
    markup_percent?: number;
    pricing_mode?: string;
    pricing_tier?: PricingTier;
  };
}

interface CustomizationConfig {
  type?: CustomizationType;
  product_id?: number;
  print_method?: string;
  quantity?: number;
  custom_text?: string;
  locations?: { location?: string; id?: string }[];
  customization?: {
    customization_option_id: number;
    customization_option_value_id: number;
    logo_image?: string;
  }[];
  addons?: { product_addon_id: number; quantity: number }[];
}

interface OrderItem {
  product_id: number;
  product_name: string;
  variant_id: number;
  sku: string;
  color: string | null;
  size: string | null;
  original_image: string | null;
  customized_image: string | null;
  price: number;
  quantity: number;
  total: number;
  customization_config?: CustomizationConfig;
  pricing_snapshot?: PricingSnapshot;
  pricing_breakdown?: PricingBreakdown;
}

interface Order {
  id: number;
  order_number: string;
  created_at: string;
  subtotal_amount: number;
  shipping_amount: number;
  total_amount: number;
  status: string;
  payment_status: string;
  shipment_status: string;
  payment_method: string;
  carrier: string;
  tracking_number: string;
  tracking_url: string;
  label_url: string;
  user: { id: number; name: string; email: string };
  preview?: {
    product_name: string;
    original_image: string | null;
    customized_image: string | null;
    total_items: number;
    customization_type: CustomizationType | null;
    print_method: string | null;
    custom_text?: string | null;
  };
  items: OrderItem[];
}

interface OrdersPayload {
  data: Order[];
  pagination?: { total: number };
}

interface BadgeConfig {
  color: string;
  bg: string;
  dot: string;
  label: string;
  desc?: string;
}

// ─────────────────────────────────────────────
// Status / Payment configs
// ─────────────────────────────────────────────
// Values come from the backend schema (BACKEND_QUESTIONS.md, B9). An order has three
// separate fields: its own status, its payment status and its shipment status.
const ORDER_STATUS: Record<string, BadgeConfig> = {
  PENDING: { color: "var(--warning-soft-foreground)", bg: "var(--warning-soft)", dot: "var(--warning)", label: "Pending" },
  PENDING_PAYMENT: { color: "var(--warning-soft-foreground)", bg: "var(--warning-soft)", dot: "var(--warning)", label: "Awaiting payment" },
  CONFIRMED: { color: "var(--info-soft-foreground)", bg: "var(--info-soft)", dot: "var(--info)", label: "Confirmed" },
  SHIPPED: { color: "var(--primary-soft-foreground)", bg: "var(--primary-soft)", dot: "var(--primary)", label: "Shipped" },
  DELIVERED: { color: "var(--success-soft-foreground)", bg: "var(--success-soft)", dot: "var(--success)", label: "Delivered" },
  CANCELLED: { color: "var(--muted-foreground)", bg: "var(--muted)", dot: "var(--placeholder)", label: "Cancelled" },
  FAILED: { color: "var(--destructive-soft-foreground)", bg: "var(--destructive-soft)", dot: "var(--destructive)", label: "Failed" },
};

const SHIPMENT_STATUS: Record<string, BadgeConfig & { desc: string }> = {
  PENDING: { color: "var(--muted-foreground)", bg: "var(--muted)", dot: "var(--placeholder)", label: "Not shipped", desc: "No shipping label yet." },
  LABEL_CREATED: { color: "var(--info-soft-foreground)", bg: "var(--info-soft)", dot: "var(--info)", label: "Label created", desc: "Label printed; waiting for the carrier's first scan." },
  SUCCESS: { color: "var(--primary-soft-foreground)", bg: "var(--primary-soft)", dot: "var(--primary)", label: "Shipment created", desc: "Label and tracking number assigned." },
  IN_TRANSIT: { color: "var(--primary-soft-foreground)", bg: "var(--primary-soft)", dot: "var(--primary)", label: "In transit", desc: "Moving through the carrier network." },
  OUT_FOR_DELIVERY: { color: "var(--violet-soft-foreground)", bg: "var(--violet-soft)", dot: "var(--violet)", label: "Out for delivery", desc: "On the delivery vehicle, expected today." },
  DELIVERED: { color: "var(--success-soft-foreground)", bg: "var(--success-soft)", dot: "var(--success)", label: "Delivered", desc: "The carrier confirmed delivery." },
  RETURNED: { color: "var(--warning-soft-foreground)", bg: "var(--warning-soft)", dot: "var(--warning)", label: "Returned", desc: "Coming back to the sender. Refund or reship needed." },
  EXCEPTION: { color: "var(--destructive-soft-foreground)", bg: "var(--destructive-soft)", dot: "var(--destructive)", label: "Exception", desc: "Delivery problem: bad address, customs hold or missed delivery." },
  FAILED: { color: "var(--destructive-soft-foreground)", bg: "var(--destructive-soft)", dot: "var(--destructive)", label: "Failed", desc: "The carrier reported a failure." },
  CANCELLED: { color: "var(--muted-foreground)", bg: "var(--muted)", dot: "var(--placeholder)", label: "Cancelled", desc: "The shipment was cancelled." },
};

const PAYMENT_STATUS: Record<string, BadgeConfig> = {
  SUCCESS: { color: "var(--success-soft-foreground)", bg: "var(--success-soft)", dot: "var(--success)", label: "Paid" },
  PENDING: { color: "var(--warning-soft-foreground)", bg: "var(--warning-soft)", dot: "var(--warning)", label: "Pending" },
  REJECTED: { color: "var(--destructive-soft-foreground)", bg: "var(--destructive-soft)", dot: "var(--destructive)", label: "Rejected" },
};

// The backend lists only paid orders unless payment_status is sent, so the filter always
// sends one; there is no "all" option yet.
const PAYMENT_FILTERS = [
  { value: "SUCCESS", label: "Paid", stat: "Paid orders" },
  { value: "PENDING", label: "Payment pending", stat: "Awaiting payment" },
  { value: "REJECTED", label: "Payment rejected", stat: "Payment rejected" },
];

const KIND_META: Record<ItemKind, { label: string; className: string; artworkCaption: string }> = {
  MANUAL: { label: "Manual", className: "kind-manual", artworkCaption: "Customized" },
  AUTO: { label: "Auto", className: "kind-auto", artworkCaption: "Logo" },
  DECORATED: { label: "Decorated", className: "kind-decorated", artworkCaption: "Logo" },
  STANDARD: { label: "Standard", className: "kind-standard", artworkCaption: "Customized" },
};

const CARRIER_LABELS: Record<string, string> = {
  stamps_com: "USPS (Stamps.com)",
  usps: "USPS",
  ups: "UPS",
  fedex: "FedEx",
  dhl: "DHL",
  dhl_express: "DHL Express",
};

// ─────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────
const toNum = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const TOLERANCE = 0.01;
const nearlyEqual = (a: number, b: number) => Math.abs(round2(a) - round2(b)) <= TOLERANCE;

const sum = (values: number[]) => round2(values.reduce((acc, v) => acc + toNum(v), 0));

const fmt$ = (n: number | null | undefined) => {
  const v = round2(toNum(n));
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${v < 0 ? "−" : ""}$${abs}`;
};

const fmtDate = (date: string) => {
  if (!date) return "--";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtShortDate = (date: string) =>
  date
    ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "--";

/** RIGHT_CHEST → Right Chest */
const humanize = (s?: string | null) =>
  s
    ? s
        .toLowerCase()
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : "--";

const formatCarrier = (carrier?: string | null) =>
  carrier ? CARRIER_LABELS[carrier.toLowerCase()] ?? humanize(carrier) : "--";

const initials = (name: string) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Supplier names arrive with HTML entities ("Sport-Tek &#174;"). */
const decodeEntities = (s?: string | null) => {
  if (!s) return "";
  if (typeof document === "undefined") return s;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = s;
  return textarea.value.replace(/\s+/g, " ").trim();
};

/** Manual customization logos are stored as relative paths ("/images/…"). */
const resolveImageUrl = (path?: string | null, reference?: string | null): string | null => {
  if (!path) return null;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  try {
    const origin = reference ? new URL(reference).origin : window.location.origin;
    return new URL(path, origin).toString();
  } catch {
    return path;
  }
};

const tierRange = (tier?: PricingTier) => {
  if (!tier) return "";
  if (tier.min_quantity != null || tier.max_quantity != null) {
    return `${tier.min_quantity ?? 1}–${tier.max_quantity ?? "∞"} units`;
  }
  return tier.quantity ? `${tier.quantity} units` : "";
};

// ─────────────────────────────────────────────
// Domain helpers
// ─────────────────────────────────────────────
const getItemKind = (item: OrderItem): ItemKind => {
  const cfg = item.customization_config;
  if (cfg?.type === "MANUAL" || item.pricing_snapshot?.supplier === "MANUAL") return "MANUAL";
  if (cfg?.type === "AUTO") return "AUTO";
  if (cfg?.print_method || item.pricing_breakdown?.pricing_table?.length) return "DECORATED";
  return "STANDARD";
};

const getLocations = (item: OrderItem) =>
  (item.customization_config?.locations ?? [])
    .map((l) => l.location ?? l.id)
    .filter((l): l is string => Boolean(l));

interface ItemImage {
  src: string | null;
  caption: string;
  fit: "cover" | "contain";
}

/** Original + customized image + per-option artwork (deduplicated). */
const getItemImages = (item: OrderItem): ItemImage[] => {
  const kind = getItemKind(item);
  const images: ItemImage[] = [{ src: item.original_image, caption: "Original", fit: "cover" }];
  const seen = new Set<string>();
  if (item.original_image) seen.add(item.original_image);

  if (item.customized_image && !seen.has(item.customized_image)) {
    seen.add(item.customized_image);
    images.push({ src: item.customized_image, caption: KIND_META[kind].artworkCaption, fit: "contain" });
  }

  const optionNames = new Map(
    (item.pricing_breakdown?.customization?.items ?? []).map((l) => [l.customization_option_id, l.option_name]),
  );

  (item.customization_config?.customization ?? []).forEach((c) => {
    const url = resolveImageUrl(c.logo_image, item.original_image);
    if (url && !seen.has(url)) {
      seen.add(url);
      images.push({ src: url, caption: optionNames.get(c.customization_option_id) ?? "Artwork", fit: "contain" });
    }
  });

  // Customized line with no artwork at all → show an explicit empty slot.
  if (images.length === 1 && kind !== "STANDARD") {
    images.push({ src: null, caption: KIND_META[kind].artworkCaption, fit: "contain" });
  }
  return images;
};

const getVariantChips = (item: OrderItem) =>
  [
    item.sku ? `SKU: ${item.sku}` : null,
    item.color ? item.color : null,
    item.size ? `Size: ${item.size}` : null,
  ].filter((c): c is string => Boolean(c));

// ─────────────────────────────────────────────
// Calculations & checks
// ─────────────────────────────────────────────
interface Caution {
  level: "warning" | "info";
  message: string;
}

interface CalcLine {
  label: string;
  detail?: string;
  amount: number;
}

interface ItemCalc {
  kind: ItemKind;
  quantity: number;
  lines: CalcLine[];
  computedTotal: number;
  reportedTotal: number;
  /** Line total ÷ quantity — includes one-time fees. */
  effectiveUnit: number;
  cautions: Caution[];
}

interface OrderCalc {
  items: ItemCalc[];
  itemsTotal: number;
  units: number;
  subtotal: number;
  shipping: number;
  /** API does not return tax, so it is derived: total − subtotal − shipping. */
  tax: number;
  taxRate: number;
  grandTotal: number;
  cautions: Caution[];
  warningCount: number;
}

const pushMismatch = (cautions: Caution[], what: string, expected: number, recorded: number) => {
  if (!nearlyEqual(expected, recorded)) {
    cautions.push({
      level: "warning",
      message: `${what}: calculated ${fmt$(expected)}, recorded ${fmt$(recorded)} (diff ${fmt$(recorded - expected)}).`,
    });
  }
};

const missingArtworkCaution = (item: OrderItem, kind: ItemKind, cautions: Caution[]) => {
  const hasOptionArt = (item.customization_config?.customization ?? []).some((c) => c.logo_image);
  if (kind !== "STANDARD" && !item.customized_image && !hasOptionArt) {
    cautions.push({ level: "info", message: "No customization artwork is attached to this line." });
  }
};

/** Supplier products: product × qty + Σ(location price × qty) + one-time setup fee. */
const calcDecoratedItem = (item: OrderItem, kind: ItemKind): ItemCalc => {
  const qty = toNum(item.quantity);
  const pb = item.pricing_breakdown;
  const cautions: Caution[] = [];

  const actual = toNum(pb?.actual_product_price);
  const markup = toNum(pb?.supplier_markup);
  const productUnit = toNum(pb?.final_product_price ?? item.price);
  const setup = toNum(pb?.setup_fee);
  const rows = pb?.pricing_table ?? [];

  if (pb) pushMismatch(cautions, "Supplier price + markup", actual + markup, productUnit);

  const lines: CalcLine[] = [
    {
      label: "Product",
      detail: `${qty} × ${fmt$(productUnit)}${pb ? ` (supplier ${fmt$(actual)} + markup ${fmt$(markup)})` : ""}`,
      amount: round2(productUnit * qty),
    },
  ];

  rows.forEach((row) => {
    const perItem = toNum(row.price_per_item);
    const label = `${humanize(row.print_method ?? row.type)} — ${humanize(row.location)}`;
    if (toNum(row.quantity) && toNum(row.quantity) !== qty) {
      cautions.push({ level: "warning", message: `${label} is priced for ${row.quantity} units but the line has ${qty}.` });
    }
    pushMismatch(cautions, `${label} total`, perItem * toNum(row.quantity || qty), toNum(row.total));
    if (perItem === 0) {
      cautions.push({ level: "info", message: `${label} is priced at $0.00 — confirm this was intended.` });
    }
    lines.push({ label, detail: `${qty} × ${fmt$(perItem)}`, amount: round2(perItem * qty) });
  });

  const decoUnit = rows.length ? sum(rows.map((r) => r.price_per_item)) : toNum(pb?.customization_price);
  if (!rows.length && decoUnit > 0) {
    lines.push({ label: "Decoration", detail: `${qty} × ${fmt$(decoUnit)}`, amount: round2(decoUnit * qty) });
  }
  if (rows.length && pb) pushMismatch(cautions, "Decoration per item", decoUnit, toNum(pb.customization_price));
  if (setup > 0) lines.push({ label: "Setup / digitizing fee", detail: "One-time charge", amount: setup });

  const computedTotal = sum(lines.map((l) => l.amount));
  const reportedTotal = toNum(item.total ?? pb?.final_total);

  if (pb) {
    pushMismatch(cautions, "Price per item (product + decoration)", productUnit + decoUnit, toNum(pb.final_price_per_item));
    pushMismatch(cautions, "Line total", computedTotal, toNum(pb.final_total));
  }
  pushMismatch(cautions, "Unit price × qty + setup", toNum(item.price) * qty + setup, reportedTotal);
  if (item.pricing_snapshot?.inquiry_only) {
    cautions.push({ level: "warning", message: "Inquiry-only product — pricing needs manual confirmation." });
  }
  missingArtworkCaution(item, kind, cautions);

  return {
    kind,
    quantity: qty,
    lines,
    computedTotal,
    reportedTotal,
    effectiveUnit: qty ? round2(reportedTotal / qty) : 0,
    cautions,
  };
};

const expectedManualLineTotal = (line: ManualCustomizationLine, qty: number) => {
  const lineQty = toNum(line.quantity) || qty;
  switch (line.pricing_type) {
    case "QUANTITY_BASED":
      return toNum(line.pricing_tier?.price); // flat price for the package
    case "FIXED":
    case "TIERED":
      return toNum(line.unit_price ?? line.pricing_tier?.price) * lineQty;
    default:
      return toNum(line.total);
  }
};

const describeManualPricing = (line: ManualCustomizationLine, qty: number) => {
  const lineQty = toNum(line.quantity) || qty;
  const range = tierRange(line.pricing_tier);
  switch (line.pricing_type) {
    case "FIXED":
      return `Fixed · ${lineQty} × ${fmt$(line.unit_price)}`;
    case "TIERED":
      return `Tiered${range ? ` (${range})` : ""} · ${lineQty} × ${fmt$(line.unit_price ?? line.pricing_tier?.price)}`;
    case "QUANTITY_BASED":
      return `Package · ${line.pricing_tier?.quantity ?? lineQty} units for ${fmt$(line.pricing_tier?.price)}`;
    default:
      return humanize(line.pricing_type);
  }
};

/** Manual products: product total + Σ customization lines + Σ add-ons. */
const calcManualItem = (item: OrderItem): ItemCalc => {
  const qty = toNum(item.quantity);
  const pb = item.pricing_breakdown;
  const productPrice = item.pricing_snapshot?.product_price;
  const cautions: Caution[] = [];

  const unit = toNum(pb?.final_product_price);
  const mode = productPrice?.pricing_mode;
  const tier = productPrice?.pricing_tier;
  const productTotal = toNum(pb?.product_total ?? (mode === "quantity_fixed" ? unit : unit * qty));

  let productDetail = `${qty} × ${fmt$(unit)}`;
  if (mode === "quantity_fixed") {
    productDetail = `Pack of ${tier?.quantity ?? qty} @ ${fmt$(unit)}`;
    pushMismatch(cautions, "Pack price", unit, productTotal);
  } else {
    if (mode === "tiered" && tier) productDetail += ` · tier ${tierRange(tier)}`;
    pushMismatch(cautions, "Product total", unit * qty, productTotal);
  }
  if (toNum(productPrice?.markup_percent) > 0) {
    productDetail += ` · incl. ${productPrice?.markup_percent}% markup`;
  }

  const lines: CalcLine[] = [{ label: "Product", detail: productDetail, amount: productTotal }];

  const custLines = pb?.customization?.items ?? [];
  custLines.forEach((line) => {
    const label = `${line.option_name}: ${line.value_name}`;
    pushMismatch(cautions, `${label} total`, expectedManualLineTotal(line, qty), toNum(line.total));
    if (toNum(line.total) === 0) {
      cautions.push({ level: "info", message: `${label} is priced at $0.00 — confirm this was intended.` });
    }
    lines.push({ label, detail: describeManualPricing(line, qty), amount: toNum(line.total) });
  });

  const addons = pb?.addons ?? [];
  addons.forEach((addon) => {
    const label = `Add-on: ${addon.name}`;
    pushMismatch(cautions, `${label} total`, toNum(addon.unit_price) * toNum(addon.quantity), toNum(addon.total));
    lines.push({ label, detail: `${addon.quantity} × ${fmt$(addon.unit_price)}`, amount: toNum(addon.total) });
  });

  const computedTotal = sum(lines.map((l) => l.amount));
  const reportedTotal = toNum(item.total ?? pb?.final_total);

  if (pb?.customization) pushMismatch(cautions, "Customization subtotal", sum(custLines.map((l) => l.total)), toNum(pb.customization.total));
  if (pb?.addon_price != null) pushMismatch(cautions, "Add-on subtotal", sum(addons.map((a) => a.total)), toNum(pb.addon_price));
  if (pb) pushMismatch(cautions, "Line total", computedTotal, toNum(pb.final_total));
  pushMismatch(cautions, "Recorded line total", computedTotal, reportedTotal);

  if (qty && !nearlyEqual(toNum(item.price) * qty, reportedTotal)) {
    cautions.push({
      level: "info",
      message: `Unit price ${fmt$(item.price)} is rounded (${qty} × ${fmt$(item.price)} = ${fmt$(toNum(item.price) * qty)}). The line total ${fmt$(reportedTotal)} is what was billed.`,
    });
  }
  missingArtworkCaution(item, "MANUAL", cautions);

  return {
    kind: "MANUAL",
    quantity: qty,
    lines,
    computedTotal,
    reportedTotal,
    effectiveUnit: qty ? round2(reportedTotal / qty) : 0,
    cautions,
  };
};

const calcItem = (item: OrderItem): ItemCalc => {
  const kind = getItemKind(item);
  return kind === "MANUAL" ? calcManualItem(item) : calcDecoratedItem(item, kind);
};

const calcOrder = (order: Order): OrderCalc => {
  const items = (order.items ?? []).map(calcItem);
  const itemsTotal = sum(items.map((i) => i.reportedTotal));
  const units = items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotal = toNum(order.subtotal_amount);
  const shipping = toNum(order.shipping_amount);
  const grandTotal = toNum(order.total_amount);
  const tax = round2(grandTotal - subtotal - shipping);
  const cautions: Caution[] = [];

  pushMismatch(cautions, "Subtotal (sum of line totals)", itemsTotal, subtotal);
  if (tax < -TOLERANCE) {
    cautions.push({ level: "warning", message: `Grand total is ${fmt$(-tax)} less than subtotal + shipping. Check discounts or refunds.` });
  }
  if (order.preview?.total_items != null && order.preview.total_items !== units) {
    cautions.push({ level: "info", message: `Order header reports ${order.preview.total_items} units, line items add up to ${units}.` });
  }

  const warningCount = [...cautions, ...items.flatMap((i) => i.cautions)].filter((c) => c.level === "warning").length;

  return {
    items,
    itemsTotal,
    units,
    subtotal,
    shipping,
    tax,
    taxRate: subtotal > 0 ? round2((tax / subtotal) * 100) : 0,
    grandTotal,
    cautions,
    warningCount,
  };
};

// ─────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────
const ZoomIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const ImageOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

// ─────────────────────────────────────────────
// Lightbox
// ─────────────────────────────────────────────
interface LightboxProps {
  src: string | null;
  label?: string;
  onClose: () => void;
}

const Lightbox = ({ src, label, onClose }: LightboxProps) => {
  useEffect(() => {
    if (!src) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={label || "Image preview"}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close image preview">
        ✕
      </button>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={label || "Preview"} className="lightbox-img" />
        {label && <div className="lightbox-label">{label}</div>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Image thumbnail — zoom on click, placeholder on missing/broken image
// ─────────────────────────────────────────────
type OpenImage = (src: string, label: string) => void;

interface ImageThumbProps {
  src: string | null;
  caption: string;
  size?: "xs" | "sm" | "md";
  fit?: "cover" | "contain";
  lightboxLabel?: string;
  onOpen: OpenImage;
}

const ImageThumb = ({ src, caption, size = "md", fit = "cover", lightboxLabel, onOpen }: ImageThumbProps) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  const usable = Boolean(src) && !failed;

  return (
    <figure className="thumb-wrap">
      {usable ? (
        <button
          type="button"
          className={`thumb thumb-${size} thumb-${fit}`}
          onClick={() => onOpen(src as string, lightboxLabel ?? caption)}
          aria-label={`Enlarge ${caption} image`}
          title="Click to enlarge"
        >
          <img src={src as string} alt={caption} loading="lazy" onError={() => setFailed(true)} />
          <span className="thumb-zoom" aria-hidden="true">
            <ZoomIcon />
          </span>
        </button>
      ) : (
        <div className={`thumb thumb-${size} thumb-empty`} role="img" aria-label={`${caption} image unavailable`}>
          <ImageOffIcon />
          {size !== "xs" && <span>No image</span>}
        </div>
      )}
      {size !== "xs" && <figcaption className="thumb-caption">{caption}</figcaption>}
    </figure>
  );
};

// ─────────────────────────────────────────────
// Small reusable pieces
// ─────────────────────────────────────────────
const StatusBadge = ({ value, map }: { value: string; map: Record<string, BadgeConfig> }) => {
  const cfg = map[value] ?? map[value?.toUpperCase()] ?? {
    color: "var(--foreground)",
    bg: "var(--muted)",
    dot: "var(--placeholder)",
    label: humanize(value),
  };
  return (
    <span className="status-badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="status-dot" style={{ background: cfg.dot }} />
      {cfg.label || humanize(value)}
    </span>
  );
};

const KindBadge = ({ kind }: { kind: ItemKind }) => (
  <span className={`kind-badge ${KIND_META[kind].className}`}>{KIND_META[kind].label}</span>
);

const CheckPill = ({ warnings }: { warnings: number }) =>
  warnings ? (
    <span className="check-pill warn">
      ⚠ {warnings} {warnings === 1 ? "issue" : "issues"} to review
    </span>
  ) : (
    <span className="check-pill ok">✓ Calculations verified</span>
  );

const CautionList = ({ cautions }: { cautions: Caution[] }) => {
  if (!cautions.length) return null;
  return (
    <ul className="caution-list">
      {cautions.map((c, i) => (
        <li key={i} className={`caution caution-${c.level}`}>
          <span className="caution-icon" aria-hidden="true">
            {c.level === "warning" ? "!" : "i"}
          </span>
          <span>{c.message}</span>
        </li>
      ))}
    </ul>
  );
};

const KV = ({ label, value, mono, children }: { label: string; value?: string; mono?: boolean; children?: ReactNode }) => (
  <div className="kv-item">
    <div className="kv-label">{label}</div>
    {children ? (
      <div className="kv-value">{children}</div>
    ) : (
      <div className={`kv-value${mono ? " mono" : ""}`}>{value || "--"}</div>
    )}
  </div>
);

const PriceRow = ({
  label,
  detail,
  value,
  tone,
}: {
  label: string;
  detail?: string;
  value: number;
  tone?: "muted" | "bold" | "total";
}) => (
  <div className={`price-row${tone ? ` price-row-${tone}` : ""}`}>
    <span className="price-label-wrap">
      <span className="price-label">{label}</span>
      {detail && <span className="price-detail">{detail}</span>}
    </span>
    <span className="price-val">{fmt$(value)}</span>
  </div>
);

// ─────────────────────────────────────────────
// Order Detail Modal
// ─────────────────────────────────────────────
// Tab strip for the order modal; panels scroll inside the dialog.
const OrderTabs: React.FC<{
  items: { key: string; label: React.ReactNode; children: React.ReactNode }[];
}> = ({ items }) => (
  <Tabs defaultValue={items[0]?.key} className="om-tabs gap-0">
    <TabsList variant="line" className="om-tabs-nav">
      {items.map((item) => (
        <TabsTrigger key={item.key} value={item.key} className="om-tab">
          {item.label}
        </TabsTrigger>
      ))}
    </TabsList>
    {items.map((item) => (
      <TabsContent key={item.key} value={item.key} className="om-tab-panel">
        {item.children}
      </TabsContent>
    ))}
  </Tabs>
);

const OrderDetailModal = ({ order, open, onClose }: { order: Order | null; open: boolean; onClose: () => void }) => {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxLabel, setLightboxLabel] = useState("");

  const openLightbox = useCallback<OpenImage>((src, label) => {
    setLightboxSrc(src);
    setLightboxLabel(label);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxSrc(null);
    setLightboxLabel("");
  }, []);

  const calc = useMemo(() => (order ? calcOrder(order) : null), [order]);

  if (!order || !calc) return null;
  const lineCount = order.items?.length ?? 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="order-modal gap-0 overflow-hidden p-0 sm:max-w-[960px]">
        <DialogTitle className="sr-only">Order {order.order_number}</DialogTitle>
        <DialogDescription className="sr-only">Order details, items, pricing and shipping</DialogDescription>
        {/* ── Hero ── */}
        <div className="om-hero">
          <div className="om-hero-left">
            <div className="om-order-num">{order.order_number}</div>
            <div className="om-date">{fmtDate(order.created_at)}</div>
            <div className="om-badges">
              <StatusBadge value={order.status} map={ORDER_STATUS} />
              <StatusBadge value={order.payment_status} map={PAYMENT_STATUS} />
              <CheckPill warnings={calc.warningCount} />
            </div>
          </div>
          <div className="om-hero-right">
            <div className="om-total">{fmt$(order.total_amount)}</div>
            <div className="om-total-label">Grand Total</div>
            <div className="om-hero-meta">
              {lineCount} line {lineCount === 1 ? "item" : "items"} · {calc.units} units
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="om-body">
          <OrderTabs
            items={[
              { key: "overview", label: "Overview", children: <TabOverview order={order} calc={calc} onImageClick={openLightbox} /> },
              { key: "items", label: `Items (${lineCount})`, children: <TabItems order={order} calc={calc} onImageClick={openLightbox} /> },
              {
                key: "pricing",
                label: (
                  <span className="tab-label">
                    Pricing
                    {calc.warningCount > 0 && <span className="tab-dot" aria-label="Has calculation issues" />}
                  </span>
                ),
                children: <TabPricing order={order} calc={calc} />,
              },
              { key: "shipping", label: "Shipping", children: <TabShipping order={order} /> },
            ]}
          />
        </div>
        </DialogContent>
      </Dialog>

      {/* Rendered outside the modal so it covers everything */}
      <Lightbox src={lightboxSrc} label={lightboxLabel} onClose={closeLightbox} />
    </>
  );
};

interface TabProps {
  order: Order;
  calc: OrderCalc;
  onImageClick: OpenImage;
}

// ── Tab: Overview ────────────────────────────
const TabOverview = ({ order: o, calc, onImageClick }: TabProps) => (
  <div className="tab-content">
    <section className="section-card">
      <div className="section-title">Items at a glance</div>
      <div className="glance-list">
        {(o.items ?? []).map((item, i) => {
          const c = calc.items[i];
          const name = decodeEntities(item.product_name);
          const images = getItemImages(item).slice(0, 2);
          return (
            <div className="glance-row" key={`${item.variant_id}-${i}`}>
              <span className="item-index">{i + 1}</span>
              <div className="img-pair">
                {images.map((img, ii) => (
                  <ImageThumb
                    key={`${img.src ?? "empty"}-${ii}`}
                    src={img.src}
                    caption={img.caption}
                    fit={img.fit}
                    size="xs"
                    lightboxLabel={`${name} — ${img.caption}`}
                    onOpen={onImageClick}
                  />
                ))}
              </div>
              <div className="glance-meta">
                <div className="glance-name" title={name}>
                  {name}
                </div>
                <div className="product-chips">
                  <KindBadge kind={c.kind} />
                  {item.customization_config?.print_method && (
                    <span className="chip">{humanize(item.customization_config.print_method)}</span>
                  )}
                  {getVariantChips(item).map((chip) => (
                    <span className="chip" key={chip}>
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <div className="glance-price">
                <div className="glance-total">{fmt$(c.reportedTotal)}</div>
                <div className="glance-qty">
                  {c.quantity} × {fmt$(c.effectiveUnit)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>

    <div className="two-col">
      <section className="section-card">
        <div className="section-title">Customer</div>
        <div className="customer-row">
          <div className="avatar">{initials(o.user?.name)}</div>
          <div className="customer-text">
            <div className="cust-name">{o.user?.name || "--"}</div>
            <div className="cust-email">{o.user?.email || "--"}</div>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">Payment</div>
        <div className="kv-grid">
          <KV label="Method" value={humanize(o.payment_method)} />
          <KV label="Status">
            <StatusBadge value={o.payment_status} map={PAYMENT_STATUS} />
          </KV>
        </div>
      </section>
    </div>

    <section className="section-card">
      <div className="section-title">Order Details</div>
      <div className="kv-grid kv-grid-3">
        <KV label="Order Number" value={o.order_number} mono />
        <KV label="Order Date" value={fmtDate(o.created_at)} />
        <KV label="Carrier" value={formatCarrier(o.carrier)} />
        <KV label="Line Items" value={String(o.items?.length ?? 0)} />
        <KV label="Total Units" value={String(calc.units)} />
        <KV label="Grand Total" value={fmt$(o.total_amount)} />
      </div>
    </section>
  </div>
);

// ── Tab: Items ───────────────────────────────
const TabItems = ({ order: o, calc, onImageClick }: TabProps) => (
  <div className="tab-content">
    {(o.items ?? []).map((item, i) => (
      <ItemCard key={`${item.variant_id}-${i}`} item={item} index={i} calc={calc.items[i]} onImageClick={onImageClick} />
    ))}
  </div>
);

const ItemCard = ({ item, index, calc, onImageClick }: { item: OrderItem; index: number; calc: ItemCalc; onImageClick: OpenImage }) => {
  const name = decodeEntities(item.product_name);
  const images = getItemImages(item);

  return (
    <section className="section-card item-card">
      <div className="item-header">
        <div className="img-pair">
          {images.map((img, ii) => (
            <ImageThumb
              key={`${img.src ?? "empty"}-${ii}`}
              src={img.src}
              caption={img.caption}
              fit={img.fit}
              size="sm"
              lightboxLabel={`${name} — ${img.caption}`}
              onOpen={onImageClick}
            />
          ))}
        </div>
        <div className="item-meta">
          <div className="item-eyebrow">Item {index + 1}</div>
          <div className="product-name">{name}</div>
          <div className="product-chips">
            <KindBadge kind={calc.kind} />
            {item.customization_config?.print_method && (
              <span className="chip">{humanize(item.customization_config.print_method)}</span>
            )}
            {getVariantChips(item).map((chip) => (
              <span className="chip" key={chip}>
                {chip}
              </span>
            ))}
            <span className="chip">Variant #{item.variant_id}</span>
          </div>
        </div>
        <div className="item-price-block">
          <div className="item-total">{fmt$(calc.reportedTotal)}</div>
          <div className="item-qty">
            {calc.quantity} × {fmt$(calc.effectiveUnit)}
          </div>
        </div>
      </div>

      {calc.kind === "MANUAL" ? <ManualDetails item={item} onImageClick={onImageClick} /> : <DecoratedDetails item={item} />}

      <CautionList cautions={calc.cautions} />
    </section>
  );
};

const DecoratedDetails = ({ item }: { item: OrderItem }) => {
  const pb = item.pricing_breakdown;
  const rows = pb?.pricing_table ?? [];
  const qty = toNum(item.quantity);
  const locations = getLocations(item);
  const decoTotal = sum(rows.map((r) => toNum(r.price_per_item) * qty));

  return (
    <>
      <div className="kv-grid kv-grid-3">
        <KV label="Print Method" value={humanize(item.customization_config?.print_method)} />
        <KV label="Locations" value={locations.length ? locations.map(humanize).join(", ") : "--"} />
        <KV label="Setup Fee" value={toNum(pb?.setup_fee) ? fmt$(pb?.setup_fee) : "--"} />
        {item.customization_config?.custom_text && (
          <KV label="Custom Text" value={`"${item.customization_config.custom_text}"`} />
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="item-section-title">Decoration Pricing</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Method</th>
                  <th className="num">Qty</th>
                  <th className="num">Per Item</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className={toNum(row.price_per_item) === 0 ? "row-zero" : undefined}>
                    <td className="td-strong">{humanize(row.location)}</td>
                    <td>{humanize(row.print_method ?? row.type)}</td>
                    <td className="num">{row.quantity}</td>
                    <td className="num">{fmt$(row.price_per_item)}</td>
                    <td className="num td-bold">{fmt$(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Decoration subtotal</td>
                  <td className="num td-bold">{fmt$(decoTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </>
  );
};

const ManualDetails = ({ item, onImageClick }: { item: OrderItem; onImageClick: OpenImage }) => {
  const pb = item.pricing_breakdown;
  const qty = toNum(item.quantity);
  const productPrice = item.pricing_snapshot?.product_price;
  const custLines = pb?.customization?.items ?? [];
  const addons = pb?.addons ?? [];

  const artworkByOption = new Map(
    (item.customization_config?.customization ?? [])
      .filter((c) => c.logo_image)
      .map((c) => [c.customization_option_id, resolveImageUrl(c.logo_image, item.original_image)]),
  );
  const hasArtwork = artworkByOption.size > 0;

  return (
    <>
      <div className="kv-grid kv-grid-3">
        <KV
          label="Pricing Mode"
          value={productPrice?.pricing_mode === "quantity_fixed" ? "Pack (fixed quantity)" : humanize(productPrice?.pricing_mode)}
        />
        <KV label="Tier" value={tierRange(productPrice?.pricing_tier) || "--"} />
        <KV label="Product Total" value={fmt$(pb?.product_total)} />
      </div>

      <div className="item-section-title">Customization Options</div>
      {custLines.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {hasArtwork && <th>Artwork</th>}
                <th>Option</th>
                <th>Value</th>
                <th>Pricing</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {custLines.map((line, li) => {
                const art = artworkByOption.get(line.customization_option_id) ?? null;
                return (
                  <tr key={li} className={toNum(line.total) === 0 ? "row-zero" : undefined}>
                    {hasArtwork && (
                      <td>
                        {art ? (
                          <ImageThumb src={art} caption={line.option_name} size="xs" fit="contain" onOpen={onImageClick} />
                        ) : (
                          <span className="muted">--</span>
                        )}
                      </td>
                    )}
                    <td className="td-strong">{line.option_name}</td>
                    <td>{line.value_name}</td>
                    <td className="td-muted">{describeManualPricing(line, qty)}</td>
                    <td className="num td-bold">{fmt$(line.total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={hasArtwork ? 4 : 3}>Customization subtotal</td>
                <td className="num td-bold">{fmt$(sum(custLines.map((l) => l.total)))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-note">No customization options selected.</div>
      )}

      <div className="item-section-title">Add-ons</div>
      {addons.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Add-on</th>
                <th className="num">Qty</th>
                <th className="num">Unit</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {addons.map((addon, ai) => (
                <tr key={ai}>
                  <td className="td-strong">{addon.name}</td>
                  <td className="num">{addon.quantity}</td>
                  <td className="num">{fmt$(addon.unit_price)}</td>
                  <td className="num td-bold">{fmt$(addon.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-note">No add-ons.</div>
      )}
    </>
  );
};

// ── Tab: Pricing ─────────────────────────────
const TabPricing = ({ order: o, calc }: { order: Order; calc: OrderCalc }) => (
  <div className="tab-content">
    <section className="section-card">
      <div className="section-head">
        <div className="section-title">Order Totals</div>
        <CheckPill warnings={calc.warningCount} />
      </div>
      <div className="price-breakdown-list">
        {(o.items ?? []).map((item, i) => (
          <PriceRow
            key={`${item.variant_id}-${i}`}
            label={`${i + 1}. ${decodeEntities(item.product_name)}`}
            detail={`${calc.items[i].quantity} units · ${KIND_META[calc.items[i].kind].label}`}
            value={calc.items[i].reportedTotal}
            tone="muted"
          />
        ))}
        <div className="price-divider" />
        <PriceRow label="Subtotal" value={calc.subtotal} tone="bold" />
        <PriceRow label="Shipping" detail={formatCarrier(o.carrier)} value={calc.shipping} tone="muted" />
        {Math.abs(calc.tax) >= 0.005 && (
          <PriceRow
            label="Tax & fees"
            detail={`Derived: total − subtotal − shipping (${calc.taxRate.toFixed(2)}% of subtotal)`}
            value={calc.tax}
            tone="muted"
          />
        )}
        <PriceRow label="Grand Total" value={calc.grandTotal} tone="total" />
      </div>
      <CautionList cautions={calc.cautions} />
    </section>

    {(o.items ?? []).map((item, i) => {
      const c = calc.items[i];
      return (
        <section className="section-card" key={`${item.variant_id}-${i}`}>
          <div className="section-head">
            <div className="section-title">
              Item {i + 1} · {decodeEntities(item.product_name)}
            </div>
            <KindBadge kind={c.kind} />
          </div>
          <div className="price-breakdown-list">
            {c.lines.map((line, li) => (
              <PriceRow key={li} label={line.label} detail={line.detail} value={line.amount} tone="muted" />
            ))}
            <PriceRow label="Line total" value={c.reportedTotal} tone="total" />
          </div>
          <div className="unit-note">
            Effective price per unit: <strong>{fmt$(c.effectiveUnit)}</strong>
            {c.kind !== "MANUAL" && toNum(item.pricing_breakdown?.setup_fee) > 0 && (
              <> · {fmt$(item.price)} excluding setup fee</>
            )}
          </div>
          <CautionList cautions={c.cautions} />
        </section>
      );
    })}
  </div>
);

// ── Tab: Shipping ────────────────────────────
const TabShipping = ({ order: o }: { order: Order }) => (
  <div className="tab-content">
    <section className="section-card">
      <div className="section-title">Tracking</div>
      <div className="kv-grid kv-grid-3">
        <KV label="Carrier" value={formatCarrier(o.carrier)} />
        <KV label="Tracking Number" value={o.tracking_number || "--"} mono />
        <KV label="Shipment Status">
          <StatusBadge value={o.shipment_status || "--"} map={SHIPMENT_STATUS} />
        </KV>
      </div>
      {(o.tracking_url || o.label_url) && (
        <div className="tracking-actions">
          {o.tracking_url && (
            <a href={o.tracking_url} target="_blank" rel="noopener noreferrer" className="track-btn">
              Track Shipment
              <ArrowUpRight size={14} aria-hidden />
            </a>
          )}
          {o.label_url && (
            <a href={o.label_url} target="_blank" rel="noopener noreferrer" className="track-btn secondary">
              Download Label ↓
            </a>
          )}
        </div>
      )}
    </section>

    <section className="section-card">
      <div className="section-title">Shipment statuses</div>
      <div className="status-guide-grid">
        {Object.entries(SHIPMENT_STATUS).map(([key, cfg]) => (
          <div className="status-guide-item" key={key}>
            <StatusBadge value={key} map={SHIPMENT_STATUS} />
            <div className="status-guide-desc">{cfg.desc}</div>
          </div>
        ))}
      </div>
    </section>
  </div>
);

// ─────────────────────────────────────────────
// Main Orders Page
// ─────────────────────────────────────────────
const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("SUCCESS");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Debounce search so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch((prev) => {
        const next = searchInput.trim();
        if (prev !== next) setPage(1);
        return next;
      });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let active = true; // ignore stale responses
    (async () => {
      try {
        setLoading(true);
        const res = await GetAdminOrdersAPI({
          page,
          limit,
          search,
          status: statusFilter || undefined,
          payment_status: paymentFilter,
        });
        if (!active) return;
        const payload = res?.data?.data as OrdersPayload | undefined;
        setOrders(payload?.data ?? []);
        setTotal(payload?.pagination?.total ?? 0);
      } catch (err) {
        console.error("Failed to load orders", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, limit, search, statusFilter, paymentFilter]);

  const openOrder = useCallback((row: Order) => {
    setSelectedOrder(row);
    setModalOpen(true);
  }, []);

  const columns: DataTableColumn<Order>[] = useMemo(
    () => [
      {
        title: "Customer",
        render: (_v, row) => (
          <div className="cell-customer">
            <div className="cell-avatar">{initials(row.user?.name)}</div>
            <div className="min-w-0">
              <div className="cell-name">{row.user?.name || "--"}</div>
              <div className="cell-email" title={row.user?.email}>
                {row.user?.email || "--"}
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "Order",
        render: (_v, row) => {
          const first = row.items?.[0];
          const name = decodeEntities(first?.product_name ?? row.preview?.product_name);
          const more = (row.items?.length ?? 0) - 1;
          return (
            <div>
              <div className="cell-order-num">{row.order_number}</div>
              <div className="cell-product-line">
                <span className="cell-product-name" title={name}>
                  {name}
                </span>
                {more > 0 && <span className="cell-more">+{more} more</span>}
              </div>
            </div>
          );
        },
      },
      {
        title: "Items",
        render: (_v, row) => {
          const units = (row.items ?? []).reduce((acc, i) => acc + toNum(i.quantity), 0) || row.preview?.total_items || 0;
          const lines = row.items?.length ?? 0;
          return (
            <div className="cell-items-wrap">
              <span className="cell-items">{units}</span>
              <span className="cell-lines">
                {lines} {lines === 1 ? "line" : "lines"}
              </span>
            </div>
          );
        },
      },
      {
        title: "Customization",
        render: (_v, row) => {
          const kinds = Array.from(new Set((row.items ?? []).map(getItemKind)));
          if (!kinds.length && row.preview?.customization_type) kinds.push(row.preview.customization_type);
          return (
            <div className="cell-kinds">
              {kinds.length ? kinds.map((k) => <KindBadge key={k} kind={k} />) : <span className="muted">--</span>}
            </div>
          );
        },
      },
      {
        title: "Amount",
        render: (_v, row) => <span className="cell-amount">{fmt$(row.total_amount)}</span>,
      },
      {
        title: "Payment",
        render: (_v, row) => <StatusBadge value={row.payment_status} map={PAYMENT_STATUS} />,
      },
      {
        title: "Status",
        render: (_v, row) => <StatusBadge value={row.status} map={ORDER_STATUS} />,
      },
      {
        title: "Date",
        render: (_v, row) => <span className="cell-date">{fmtShortDate(row.created_at)}</span>,
      },
      {
        title: <span className="sr-only">Actions</span>,
        align: "right",
        render: (_v, row) => (
          <button
            type="button"
            className="view-btn"
            aria-label={`View order ${row.order_number}`}
            title="View order"
            onClick={(e) => {
              e.stopPropagation();
              openOrder(row);
            }}
          >
            <Eye size={15} aria-hidden />
          </button>
        ),
      },
    ],
    [openOrder],
  );

  return (
    <div className="orders-page">
      <div className="orders-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Manage and monitor all customer orders</p>
        </div>
        <div className="header-stat">
          <span className="stat-num">{total.toLocaleString()}</span>
          <span className="stat-label">
            {PAYMENT_FILTERS.find((p) => p.value === paymentFilter)?.stat ?? "Orders"}
          </span>
        </div>
      </div>

      <div className="filters-row">
        <SearchInput
          allowClear
          size="large"
          placeholder="Search by order number, customer, tracking…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          wrapperClassName="search-input"
          aria-label="Search orders"
        />
        <Combobox
          size="large"
          searchable={false}
          placeholder="Payment"
          style={{ width: 190 }}
          value={paymentFilter}
          onChange={(v?: string) => {
            setPaymentFilter(v || "SUCCESS");
            setPage(1);
          }}
          options={PAYMENT_FILTERS.map(({ value, label }) => ({ value, label }))}
        />
        <Combobox
          size="large"
          searchable={false}
          placeholder="Order status"
          style={{ width: 190 }}
          allowClear
          value={statusFilter || undefined}
          onChange={(v?: string) => {
            setStatusFilter(v || "");
            setPage(1);
          }}
          options={Object.entries(ORDER_STATUS).map(([value, cfg]) => ({ label: cfg.label, value }))}
        />
      </div>

      <div className="orders-card">
        <DataTable<Order>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={orders}
          scrollX={1000}
          rowClassName="order-row"
          onRowClick={openOrder}
          className="orders-table"
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 25, 50, 100],
            showTotal: (t) => `${t.toLocaleString()} ${t === 1 ? "order" : "orders"}`,
            onChange: (current, pageSize) => {
              setPage(pageSize !== limit ? 1 : current);
              setLimit(pageSize);
            },
          }}
          emptyText={<EmptyState description="No orders match these filters." />}
        />
      </div>

      <OrderDetailModal order={selectedOrder} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};

export default OrdersPage;