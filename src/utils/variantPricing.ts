/** @format */

// One source of truth for variant pricing on the admin side — used by both
// Create Product and Edit Manual Product so they read, validate and send
// exactly the same shape the backend stores in ProductVariant.meta:
//
//   fixed          → { pricing_mode: "fixed",          bulk_pricing: null, quantity_pricing: null }
//   tiered         → { pricing_mode: "tiered",         bulk_pricing: [...], quantity_pricing: null }
//   quantity_fixed → { pricing_mode: "quantity_fixed", bulk_pricing: null, quantity_pricing: [...] }
//
// Older rows may not have a `quantity_pricing` key at all — treated as null.

export type PricingMode = "fixed" | "tiered" | "quantity_fixed";
export type QuantityPricingMode = Exclude<PricingMode, "fixed">;

export interface BulkTier {
  min_qty: number;
  max_qty: number | null;
  price: number;
}

export interface QuantityPrice {
  quantity: number;
  price: number;
}

export interface VariantPricing {
  price: number;
  case_price: number;
  pricing_mode: PricingMode;
  // Kept even when inactive so switching modes doesn't lose what was typed;
  // only the active list is sent (see buildPricingPayload).
  bulk_pricing: BulkTier[];
  quantity_pricing: QuantityPrice[];
}

export interface PricingPayload {
  price: number;
  case_price: number;
  pricing_mode: PricingMode;
  bulk_pricing: BulkTier[] | null;
  quantity_pricing: QuantityPrice[] | null;
}

export const DEFAULT_BULK_TIER = (): BulkTier => ({
  min_qty: 1,
  max_qty: null,
  price: 0,
});

export const DEFAULT_QUANTITY_PRICE = (): QuantityPrice => ({
  quantity: 0,
  price: 0,
});

export const DEFAULT_PRICING = (): VariantPricing => ({
  price: 0,
  case_price: 0,
  pricing_mode: "fixed",
  bulk_pricing: [DEFAULT_BULK_TIER()],
  quantity_pricing: [DEFAULT_QUANTITY_PRICE()],
});

export const QUANTITY_MODE_INFO: Record<
  QuantityPricingMode,
  { label: string; description: string }
> = {
  tiered: {
    label: "Variable ranges",
    description:
      "Price changes by range — e.g. 1–10 at $20, 11–50 at $18, 51+ at $16.",
  },
  quantity_fixed: {
    label: "Fixed quantities",
    description:
      "Shoppers pick an exact pack size — e.g. 25 for $100, 50 for $180.",
  },
};

export const clonePricing = (p: VariantPricing): VariantPricing => ({
  price: p.price,
  case_price: p.case_price,
  pricing_mode: p.pricing_mode,
  bulk_pricing: p.bulk_pricing.map((t) => ({ ...t })),
  quantity_pricing: p.quantity_pricing.map((q) => ({ ...q })),
});

export const formatMoney = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toFixed(2);

/* ─── Reading from the API ──────────────────────────────────────────── */

// meta is a STRING column and can arrive double-encoded — parse up to twice.
export function parseJsonObject(raw: unknown): Record<string, unknown> {
  let value: unknown = raw;
  for (let i = 0; i < 2 && typeof value === "string"; i++) {
    try {
      value = JSON.parse(value);
    } catch {
      break;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const toNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function normalizeBulkTiers(raw: unknown): BulkTier[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => {
    const tier = (t ?? {}) as Record<string, unknown>;
    return {
      min_qty: toNumber(tier.min_qty),
      max_qty:
        tier.max_qty === null || tier.max_qty === undefined || tier.max_qty === ""
          ? null
          : toNumber(tier.max_qty),
      price: toNumber(tier.price),
    };
  });
}

function normalizeQuantityPricing(raw: unknown): QuantityPrice[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((q) => {
    const row = (q ?? {}) as Record<string, unknown>;
    return { quantity: toNumber(row.quantity), price: toNumber(row.price) };
  });
}

// Builds editable pricing from an API variant row. Same inference as the
// backend: explicit pricing_mode wins; otherwise a non-empty bulk_pricing
// means tiered; otherwise fixed.
export function pricingFromVariant(v: {
  price?: number | string | null;
  case_price?: number | string | null;
  meta?: unknown;
}): VariantPricing {
  const meta = parseJsonObject(v.meta);
  const bulk = normalizeBulkTiers(meta.bulk_pricing);
  const qty = normalizeQuantityPricing(meta.quantity_pricing);
  const price = toNumber(v.price);

  const mode: PricingMode =
    meta.pricing_mode === "quantity_fixed" ||
    meta.pricing_mode === "tiered" ||
    meta.pricing_mode === "fixed"
      ? meta.pricing_mode
      : bulk.length > 0
        ? "tiered"
        : "fixed";

  return {
    price,
    case_price: toNumber(v.case_price),
    pricing_mode: mode,
    bulk_pricing: bulk.length ? bulk : [{ ...DEFAULT_BULK_TIER(), price }],
    quantity_pricing: qty.length ? qty : [DEFAULT_QUANTITY_PRICE()],
  };
}

/* ─── Sending to the API ────────────────────────────────────────────── */

export function buildPricingPayload(p: VariantPricing): PricingPayload {
  const sortedQuantities = [...p.quantity_pricing].sort(
    (a, b) => a.quantity - b.quantity,
  );

  // Flat `price` column = what listings/search show: the fixed price, the
  // first tier's price, or the smallest pack's price. Matches the backend.
  const flatPrice =
    p.pricing_mode === "fixed"
      ? p.price
      : p.pricing_mode === "tiered"
        ? p.bulk_pricing[0]?.price ?? 0
        : sortedQuantities[0]?.price ?? 0;

  return {
    price: Number(flatPrice || 0),
    case_price: Number(p.case_price || 0),
    pricing_mode: p.pricing_mode,
    bulk_pricing: p.pricing_mode === "tiered" ? p.bulk_pricing : null,
    quantity_pricing:
      p.pricing_mode === "quantity_fixed" ? sortedQuantities : null,
  };
}

/* ─── Validation (same rules on Create and Edit) ────────────────────── */

export function getPricingError(
  p: VariantPricing,
  variantLabel: string,
): string | null {
  if (p.pricing_mode === "fixed") {
    return !p.price || p.price <= 0
      ? `${variantLabel}: price must be more than 0`
      : null;
  }

  if (p.pricing_mode === "quantity_fixed") {
    if (!p.quantity_pricing.length) {
      return `${variantLabel}: add at least one quantity, or switch to Fixed price`;
    }
    const seen = new Set<number>();
    for (let qi = 0; qi < p.quantity_pricing.length; qi++) {
      const row = p.quantity_pricing[qi];
      const rowLabel = `${variantLabel}, Quantity ${qi + 1}`;
      if (!Number.isInteger(row.quantity) || row.quantity <= 0) {
        return `${rowLabel}: enter a whole number more than 0`;
      }
      if (!row.price || row.price <= 0) {
        return `${rowLabel}: price must be more than 0`;
      }
      if (seen.has(row.quantity)) {
        return `${variantLabel}: quantity ${row.quantity} is listed twice`;
      }
      seen.add(row.quantity);
    }
    return null;
  }

  // Tiered / variable ranges
  if (!p.bulk_pricing.length) {
    return `${variantLabel}: add a quantity tier, or switch to Fixed price`;
  }
  for (let ti = 0; ti < p.bulk_pricing.length; ti++) {
    const tier = p.bulk_pricing[ti];
    const isLast = ti === p.bulk_pricing.length - 1;
    const tierLabel = `${variantLabel}, Tier ${ti + 1}`;

    if (!tier.min_qty || tier.min_qty <= 0) {
      return `${tierLabel}: "From" must be more than 0`;
    }
    if (!tier.price || tier.price <= 0) {
      return `${tierLabel}: price must be more than 0`;
    }
    // Blank "To" is only valid on the LAST tier — it means "and above".
    if (!isLast && tier.max_qty === null) {
      return `${tierLabel}: only the last tier can leave "To" blank`;
    }
    if (tier.max_qty !== null && tier.max_qty <= tier.min_qty) {
      return `${tierLabel}: "To" must be more than "From"`;
    }
    if (ti > 0) {
      const prev = p.bulk_pricing[ti - 1];
      if (prev.max_qty !== null && tier.min_qty <= prev.max_qty) {
        return `${tierLabel}: "From" must continue after Tier ${ti}'s "To"`;
      }
    }
  }
  return null;
}

/* ─── Display ───────────────────────────────────────────────────────── */

export function getPricingSummary(p: VariantPricing): string {
  if (p.pricing_mode === "fixed") return `$${formatMoney(p.price)}`;

  if (p.pricing_mode === "tiered") {
    const prices = p.bulk_pricing.map((t) => t.price).filter((n) => n > 0);
    return prices.length
      ? `from $${formatMoney(Math.min(...prices))} / item`
      : "$0";
  }

  const rows = [...p.quantity_pricing]
    .filter((q) => q.quantity > 0)
    .sort((a, b) => a.quantity - b.quantity);
  return rows.length
    ? rows.map((q) => `${q.quantity} for $${formatMoney(q.price)}`).join(", ")
    : "$0";
}

// Next "From" for a new variable-range tier: continues right after the
// last tier's "To" so there's no gap or overlap.
export function nextTierMin(tiers: BulkTier[]): number {
  const last = tiers[tiers.length - 1];
  return last?.max_qty !== null && last?.max_qty !== undefined
    ? last.max_qty + 1
    : 1;
}