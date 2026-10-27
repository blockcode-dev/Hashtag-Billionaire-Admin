// Variant status, stock and shipping weight as the backend reports them
// (hashtag-backend docs/admin-panel-changes.md: 16 Oct status markers and SAGE
// stock; client decision Q31 for weights).

export type VariantStatus = "active" | "inactive" | "discontinued" | "removed";

export const VARIANT_STATUSES: Record<VariantStatus, { label: string; color: string; hint: string }> = {
  active: { label: "Active", color: "green", hint: "On sale." },
  inactive: { label: "Inactive", color: "default", hint: "Switched off, so not on sale." },
  discontinued: {
    label: "Discontinued",
    color: "orange",
    hint: "The supplier marks it discontinued. It stays on sale until it's removed.",
  },
  removed: {
    label: "Removed",
    color: "red",
    hint: "Deleted, by an admin or because the supplier stopped listing it.",
  },
};

// The `?status=` filter on the Variants page. Without one, the backend lists
// variants on sale, of products that aren't discontinued.
export const VARIANT_STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "discontinued", label: "Discontinued" },
  { value: "restored", label: "Restored by a sync" },
  { value: "removed", label: "Removed" },
];

interface StockFields {
  stock?: number | string | null;
  track_inventory?: boolean | number | null;
}

// SAGE doesn't always report stock. Those variants come back with stock null and
// track_inventory off, and orders aren't limited. Until the first SAGE sync after
// 16 Oct they still carry the old placeholder, 999999.
const LEGACY_UNREPORTED_STOCK = 999999;

export const isStockUnreported = (v: StockFields) =>
  v.track_inventory === false ||
  v.track_inventory === 0 ||
  Number(v.stock) >= LEGACY_UNREPORTED_STOCK;

// Same rule as the shop: in stock, or stock the supplier doesn't report.
export const isInStock = (v: StockFields) => isStockUnreported(v) || Number(v.stock) > 0;

export const UNREPORTED_STOCK_HINT = "Not reported by supplier, so orders aren't limited.";

// `short` fits table cells; pair it with UNREPORTED_STOCK_HINT as a tooltip.
export const stockLabel = (v: StockFields, { short = false } = {}) => {
  if (isStockUnreported(v)) return short ? "Not reported" : "Not reported by supplier";
  if (v.stock == null || v.stock === "" || !Number.isFinite(Number(v.stock))) return "—";
  return Number(v.stock).toLocaleString();
};

export const formatShortDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// Shipping uses the admin's weight first, then the supplier's, then the store's
// default, which is a backend setting the panel can't read (1 lb unless changed).
export const MAX_WEIGHT_LB = 150;
// The backend keeps 3 decimals, so anything smaller would be saved as 0.
export const MIN_WEIGHT_LB = 0.001;

export interface WeightFields {
  admin_weight_lb?: number | string | null;
  unit_weight?: number | string | null;
}

export type WeightSource = "admin" | "supplier" | "default";

const positive = (value: unknown) => {
  const n = Number(value);
  return value != null && value !== "" && Number.isFinite(n) && n > 0 ? n : null;
};

// `lb` is null when shipping falls back to the store's default.
export const shippingWeight = (v: WeightFields): { lb: number | null; source: WeightSource } => {
  const admin = positive(v.admin_weight_lb);
  if (admin) return { lb: admin, source: "admin" };
  const supplier = positive(v.unit_weight);
  if (supplier) return { lb: supplier, source: "supplier" };
  return { lb: null, source: "default" };
};

export const supplierWeight = (v: WeightFields) => positive(v.unit_weight);

export const formatWeight = (lb: number) => `${Number(lb.toFixed(3))} lb`;

export const WEIGHT_SOURCE_LABELS: Record<WeightSource, string> = {
  admin: "set by an admin",
  supplier: "from the supplier",
  default: "the store's default weight",
};

// What shipping uses for one variant, e.g. "0.75 lb (set by an admin)".
export const describeShippingWeight = (v: WeightFields) => {
  const { lb, source } = shippingWeight(v);
  return lb == null ? WEIGHT_SOURCE_LABELS.default : `${formatWeight(lb)} (${WEIGHT_SOURCE_LABELS[source]})`;
};
