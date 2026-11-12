/** @format */

// How a variant is priced, read the way the shop charges it, for the read-only
// tables on the product and variant pages (hashtag-backend cartWishlist.service.js
// and utils/pricing):
//
// - Manual, "Variable ranges": the price per item of the range the quantity is
//   in. A quantity in no range can't be ordered.
// - Manual, "Fixed quantities": a total for exactly that quantity. No other
//   quantity can be ordered.
// - SAGE: the net price per item of the highest tier the quantity reaches, plus
//   the SAGE markup. Less than the first tier can't be ordered. The admin API
//   sends the tiers as pricing_tiers (no markup) and, for a product,
//   pricing_tiers_customer (with it).
// - OTTOCAP keeps the supplier's price breaks (meta.price_1 … price_1296), but
//   the shop charges one price at any quantity, so they're for reference.
// - Everything else has one price.

import {
  normalizeBulkTiers,
  normalizeQuantityPricing,
  parseJsonObject,
  pricingFromVariant,
} from "@/utils/variantPricing";

export interface PriceTableRow {
  quantity: string;
  cells: string[];
}

export interface PriceTable {
  title: string;
  // The price columns. The quantity column comes first.
  columns: string[];
  rows: PriceTableRow[];
  note?: string;
}

export type PricingStyle =
  | "fixed"
  | "tiered"
  | "quantity_fixed"
  | "supplier_tiers"
  | "request";

export const PRICING_STYLE_LABELS: Record<PricingStyle, string> = {
  fixed: "Fixed price",
  tiered: "Variable ranges",
  quantity_fixed: "Fixed quantities",
  supplier_tiers: "Qty pricing",
  request: "On request",
};

export interface VariantPricingView {
  style: PricingStyle;
  // Per item: the price, or the lowest one when it changes with quantity.
  // Supplier products show the supplier's prices, without markup.
  price: number | null;
  // The highest price per item, the same as price when there's one.
  maxPrice: number | null;
  tables: PriceTable[];
  // Says what's missing when quantity pricing is expected but has no rows.
  missing?: string;
  // Variants with the same key are priced the same way.
  key: string;
}

export interface VariantPricingSource {
  price?: number | string | null;
  case_price?: number | string | null;
  meta?: unknown;
  pricing_tiers?: unknown;
  pricing_tiers_customer?: unknown;
}

const positive = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const isNumber = (n: number | null): n is number => n !== null;

const cents = (n: number) => Math.round(n * 100) / 100;

// Prices as stored, so a supplier's $0.385 isn't rounded; at least 2 decimals.
export const formatPrice = (n: number | null): string =>
  n === null
    ? "—"
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

const formatCount = (n: number) => n.toLocaleString("en-US");

// "1–10", "51+", or "5" when a range holds one quantity.
const rangeLabel = (min: number, max: number | null) =>
  max === null
    ? `${formatCount(min)}+`
    : max <= min
      ? formatCount(min)
      : `${formatCount(min)}–${formatCount(max)}`;

// Price breaks: each one runs up to the next.
const breakLabels = (quantities: number[]) =>
  quantities.map((q, i) =>
    rangeLabel(q, i === quantities.length - 1 ? null : quantities[i + 1] - 1),
  );

const withKey = (view: Omit<VariantPricingView, "key">): VariantPricingView => ({
  ...view,
  key: JSON.stringify([view.style, view.price, view.tables, view.missing ?? null]),
});

const onePrice = (price: number | null, extra: Partial<VariantPricingView> = {}) =>
  withKey({ style: "fixed", price, maxPrice: price, tables: [], ...extra });

/* ─── Manual products ───────────────────────────────────────────────── */

function manualPricing(variant: VariantPricingSource): VariantPricingView {
  const mode = pricingFromVariant(variant).pricing_mode;
  const meta = parseJsonObject(variant.meta);

  if (mode === "tiered") {
    const tiers = normalizeBulkTiers(meta.bulk_pricing)
      .filter((t) => t.min_qty > 0)
      .sort((a, b) => a.min_qty - b.min_qty);
    if (!tiers.length) {
      return withKey({
        style: mode,
        price: null,
        maxPrice: null,
        tables: [],
        missing: "No quantity ranges are saved.",
      });
    }

    // Prices as saved: the cart charges a $0 range $0.
    const prices = tiers.map((t) => t.price);
    // Every quantity from 1 up has a price only when the ranges start at 1,
    // follow on without gaps and the last has no upper limit.
    const coversAll =
      tiers[0].min_qty === 1 &&
      tiers[tiers.length - 1].max_qty === null &&
      tiers.every((t, i) => {
        const before = tiers[i - 1];
        return !before || (before.max_qty !== null && t.min_qty === before.max_qty + 1);
      });

    return withKey({
      style: mode,
      price: Math.min(...prices),
      maxPrice: Math.max(...prices),
      tables: [
        {
          title: "Variable ranges",
          columns: ["Price per item"],
          rows: tiers.map((t) => ({
            quantity: rangeLabel(t.min_qty, t.max_qty),
            cells: [formatPrice(t.price)],
          })),
          note: coversAll ? undefined : "Quantities outside these ranges can't be ordered.",
        },
      ],
    });
  }

  if (mode === "quantity_fixed") {
    const packs = normalizeQuantityPricing(meta.quantity_pricing)
      .filter((q) => q.quantity > 0)
      .sort((a, b) => a.quantity - b.quantity);
    if (!packs.length) {
      return withKey({
        style: mode,
        price: null,
        maxPrice: null,
        tables: [],
        missing: "No quantities are saved.",
      });
    }

    // The total is charged. Per item is shown to the cent, as on the edit page.
    const perItem = packs.map((q) => cents(q.price / q.quantity));

    return withKey({
      style: mode,
      price: Math.min(...perItem),
      maxPrice: Math.max(...perItem),
      tables: [
        {
          title: "Fixed quantities",
          columns: ["Total price", "Per item"],
          rows: packs.map((q, i) => ({
            quantity: formatCount(q.quantity),
            cells: [formatPrice(q.price), formatPrice(perItem[i])],
          })),
          note: "Shoppers can order only these quantities.",
        },
      ],
    });
  }

  return onePrice(positive(variant.price));
}

/* ─── Supplier products ─────────────────────────────────────────────── */

interface SupplierTier {
  quantity: number;
  list: number | null;
  net: number | null;
}

// Whole quantities above 0, smallest first, each once.
const byQuantity = <T extends { quantity: number }>(rows: T[]): T[] => {
  const seen = new Set<number>();
  return rows
    .filter((r) => Number.isInteger(r.quantity) && r.quantity > 0)
    .sort((a, b) => a.quantity - b.quantity)
    .filter((r) => {
      if (seen.has(r.quantity)) return false;
      seen.add(r.quantity);
      return true;
    });
};

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// SAGE tiers without markup. Older API answers have none, so read meta then.
function sageTiers(variant: VariantPricingSource, meta: Record<string, unknown>): SupplierTier[] {
  const rows = Array.isArray(variant.pricing_tiers)
    ? variant.pricing_tiers.map((t) => {
        const tier = (t ?? {}) as Record<string, unknown>;
        return { quantity: tier.quantity, list: tier.list_price, net: tier.net_price };
      })
    : asList(meta.qtyTiers).map((q, i) => ({
        quantity: q,
        list: asList(meta.priceTiers)[i],
        net: asList(meta.netTiers)[i],
      }));

  return byQuantity(
    rows
      .map((r) => ({ quantity: Number(r.quantity), list: positive(r.list), net: positive(r.net) }))
      .filter((r) => r.list !== null || r.net !== null),
  );
}

// What shoppers pay per item at each SAGE tier: the net price plus markup. The
// cart skips a tier with no net price, which the API fills in from the list price.
function sageShopperTiers(variant: VariantPricingSource, meta: Record<string, unknown>) {
  const netTiers = asList(meta.netTiers);
  const withNet = new Set(
    asList(meta.qtyTiers)
      .map((q, i) => (positive(netTiers[i]) !== null ? Number(q) : null))
      .filter(isNumber),
  );

  return byQuantity(
    asList(variant.pricing_tiers_customer)
      .map((t) => {
        const tier = (t ?? {}) as Record<string, unknown>;
        return { quantity: Number(tier.quantity), price: positive(tier.net) };
      })
      .filter((t) => t.price !== null && (!withNet.size || withNet.has(t.quantity))),
  );
}

const OTTOCAP_BREAKS = [1, 144, 288, 576, 1296];

function supplierPricing(
  variant: VariantPricingSource,
  supplier: string,
): VariantPricingView {
  const meta = parseJsonObject(variant.meta);
  const tiers = sageTiers(variant, meta);

  if (tiers.length) {
    const quantities = tiers.map((t) => t.quantity);
    const tables: PriceTable[] = [
      {
        title: "From SAGE, no markup",
        columns: ["List price", "Net price"],
        rows: breakLabels(quantities).map((quantity, i) => ({
          quantity,
          cells: [formatPrice(tiers[i].list), formatPrice(tiers[i].net)],
        })),
      },
    ];

    const shopper = sageShopperTiers(variant, meta);
    const minimum = shopper[0]?.quantity ?? quantities[0];
    const minimumNote = minimum > 1 ? ` Minimum order ${formatCount(minimum)}.` : "";
    if (shopper.length) {
      tables.push({
        title: "Shopper price",
        columns: ["Price per item"],
        rows: breakLabels(shopper.map((t) => t.quantity)).map((quantity, i) => ({
          quantity,
          cells: [formatPrice(shopper[i].price)],
        })),
        note: `The net price plus the SAGE markup.${minimumNote}`,
      });
    } else {
      tables[0].note = `Shoppers pay the net price plus the SAGE markup.${minimumNote}`;
    }

    // The lowest list price, as the product's price has always shown for SAGE.
    const lists = tiers.map((t) => t.list).filter(isNumber);
    const price = lists.length ? Math.min(...lists) : null;
    return withKey({ style: "supplier_tiers", price, maxPrice: price, tables });
  }

  const fixed = positive(variant.price);
  const breaks = OTTOCAP_BREAKS.map((quantity) => ({
    quantity,
    price: positive(meta[`price_${quantity}`]),
  })).filter((b) => b.price !== null);

  if (breaks.length) {
    return onePrice(fixed, {
      tables: [
        {
          title: "Supplier price breaks",
          columns: ["Price"],
          rows: breakLabels(breaks.map((b) => b.quantity)).map((quantity, i) => ({
            quantity,
            cells: [formatPrice(breaks[i].price)],
          })),
          note: "For reference. The shop charges one price at any quantity.",
        },
      ],
    });
  }

  if (fixed === null && meta.priceOnRequest) {
    return withKey({ style: "request", price: null, maxPrice: null, tables: [] });
  }

  return onePrice(
    fixed,
    supplier === "SAGE" ? { missing: "SAGE sent no price tiers." } : {},
  );
}

export function variantPricingView(
  variant: VariantPricingSource,
  supplier: string | null | undefined,
): VariantPricingView {
  const source = String(supplier || "").toUpperCase();
  return source === "MANUAL" ? manualPricing(variant) : supplierPricing(variant, source);
}

export interface PricingGroup<V> {
  view: VariantPricingView;
  variants: V[];
}

// Variants that share the same tables, in list order. Variants with one price
// and nothing missing aren't in any group.
export function groupByPricing<V>(variants: V[], views: VariantPricingView[]): PricingGroup<V>[] {
  const groups = new Map<string, PricingGroup<V>>();
  variants.forEach((variant, i) => {
    const view = views[i];
    if (!view || (!view.tables.length && !view.missing)) return;
    const group = groups.get(view.key);
    if (group) group.variants.push(variant);
    else groups.set(view.key, { view, variants: [variant] });
  });
  return [...groups.values()];
}
