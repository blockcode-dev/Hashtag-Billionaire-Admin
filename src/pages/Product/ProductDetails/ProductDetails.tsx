import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GetProductByIdAPI } from "@/services/Api/ProductApi";
import "./ProductDetail.scss";

/* ─── supplier badge ───────────────────────────────────────────────────── */
const SUPPLIER_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SAGE: "SAGE",
  SS: "S&S",
  SANMAR: "SanMar",
  OTTOCAP: "OTTOCAP",
};

function SupplierPill({ supplier }: { supplier?: string | null }) {
  const key = (supplier || "MANUAL").toUpperCase();
  const label = SUPPLIER_LABELS[key] || key;
  return (
    <span className={`pd-supplier-pill pd-supplier-pill--${key.toLowerCase()}`}>
      {label}
    </span>
  );
}

/* ─── generic helpers ──────────────────────────────────────────────────── */
function safeParseJSON(input: any): any {
  if (!input) return null;
  if (typeof input === "object") return input;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function formatMoney(v: any): string | null {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || isNaN(n) || n <= 0) return null;
  return `$${n.toFixed(2)}`;
}

function formatDate(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getStockLabel(stock: any): string {
  const n = Number(stock);
  if (stock === null || stock === undefined || isNaN(n)) return "—";
  if (n >= 999999) return "Made to order";
  return n.toLocaleString();
}

/* ─── color swatch (handles multi-color codes like "#000,#0f0") ────────── */
function ColorSwatch({ codes, size = 14 }: { codes?: string | null; size?: number }) {
  const list = (codes || "#ccc").split(",").map((c) => c.trim()).filter(Boolean);
  if (list.length <= 1) {
    return (
      <span
        className="pd-color-dot"
        style={{ background: list[0] || "#ccc", width: size, height: size }}
      />
    );
  }
  return (
    <span className="pd-color-dot pd-color-dot--multi" style={{ width: size, height: size }}>
      {list.slice(0, 4).map((c, i) => (
        <i key={i} style={{ background: c }} />
      ))}
    </span>
  );
}

/* ─── category hierarchy ─────────────────────────────────────────────────
   The admin API now returns the real DB hierarchy on each category:
   category -> parent_categories[] -> grand_categories[]. It's many-to-many
   at every level (a category can have multiple parents, a parent can have
   multiple grands), so we normalize it into a flat list of "chains" — one
   row per (category, parent, grand) combination — rather than guessing
   from supplier meta fields like the previous version did.
------------------------------------------------------------------------- */
type CategoryChain = { category: string; parent: string | null; grand: string | null };

function buildCategoryChains(categories: any[]): CategoryChain[] {
  const chains: CategoryChain[] = [];
  for (const cat of categories || []) {
    const parents = cat.parent_categories || [];
    if (!parents.length) {
      chains.push({ category: cat.title, parent: null, grand: null });
      continue;
    }
    for (const parent of parents) {
      const grands = parent.grand_categories || [];
      if (!grands.length) {
        chains.push({ category: cat.title, parent: parent.title, grand: null });
        continue;
      }
      for (const grand of grands) {
        chains.push({ category: cat.title, parent: parent.title, grand: grand.title });
      }
    }
  }
  return chains;
}

/* ─── quantity-tier pricing (legacy client-side fallback) ────────────────
   Two known tiered shapes so far:
   - SAGE: meta.priceTiers / meta.qtyTiers / meta.netTiers (parallel arrays)
   - OTTOCAP: meta.price_1 / price_144 / price_288 / price_576 / price_1296
   Both get normalized into the same {qty, price, net?} row shape.

   NOTE: for SAGE variants, the backend now sends pre-computed
   `pricing_tiers` (raw) and `pricing_tiers_customer` (with markup)
   directly on the variant object — those are used in preference to this
   client-side computation wherever available (see the variant detail
   render below). This function remains as the fallback for suppliers
   that don't yet have server-computed tiers (e.g. OTTOCAP).
------------------------------------------------------------------------- */
type TierRow = { qty: string; price: string; net?: string };

function getSageTiers(meta: any): TierRow[] {
  const priceTiers = meta?.priceTiers || [];
  const qtyTiers = meta?.qtyTiers || [];
  const netTiers = meta?.netTiers || [];
  const rows: TierRow[] = [];
  for (let i = 0; i < priceTiers.length; i++) {
    const p = Number(priceTiers[i]);
    if (!p || p <= 0) continue;
    const q = qtyTiers[i];
    const net = Number(netTiers[i]);
    rows.push({
      qty: q ? `${q}+` : "—",
      price: `$${p.toFixed(2)}`,
      net: net > 0 ? `$${net.toFixed(2)}` : undefined,
    });
  }
  return rows;
}

const OTTO_TIER_KEYS = [
  { key: "price_1", qty: "1" },
  { key: "price_144", qty: "144" },
  { key: "price_288", qty: "288" },
  { key: "price_576", qty: "576" },
  { key: "price_1296", qty: "1296" },
];

function getOttoTiers(meta: any): TierRow[] {
  if (!meta) return [];
  const rows: TierRow[] = [];
  for (const { key, qty } of OTTO_TIER_KEYS) {
    const p = Number(meta[key]);
    if (!p || p <= 0) continue;
    rows.push({ qty: `${qty}+`, price: `$${p.toFixed(2)}` });
  }
  return rows;
}

function getTierRows(meta: any): TierRow[] {
  if (!meta) return [];
  if (meta.priceTiers?.length) return getSageTiers(meta);
  if (OTTO_TIER_KEYS.some(({ key }) => meta[key] != null)) return getOttoTiers(meta);
  return [];
}

/* ─── warehouse / regional stock breakdown ──────────────────────────────
   OTTOCAP: flat meta.ca_stock / tx_stock / ga_stock
   S&S: meta.supplier_raw.warehouses = [{ warehouseAbbr, qty }, ...]
------------------------------------------------------------------------- */
function getWarehouseStock(meta: any): { code: string; qty: number }[] {
  if (!meta) return [];
  const flatKeys = Object.keys(meta).filter((k) => /_stock$/.test(k));
  if (flatKeys.length) {
    return flatKeys
      .map((k) => ({ code: k.replace("_stock", "").toUpperCase(), qty: Number(meta[k]) || 0 }))
      .filter((w) => w.qty > 0);
  }
  const warehouses = meta?.supplier_raw?.warehouses;
  if (Array.isArray(warehouses) && warehouses.length) {
    const merged: Record<string, number> = {};
    for (const w of warehouses) {
      const code = w.warehouseAbbr || "?";
      merged[code] = (merged[code] || 0) + (Number(w.qty) || 0);
    }
    return Object.entries(merged).map(([code, qty]) => ({ code, qty }));
  }
  return [];
}

/* ─── whitelisted "extra" supplier fields, shown as a clean table
   instead of a raw JSON dump. Anything not in this list is still
   visible via the "Raw supplier data" toggle so nothing is lost.
------------------------------------------------------------------------- */
const EXTRA_FIELD_CONFIG: { key: string; label: string; money?: boolean; link?: boolean }[] = [
  { key: "dozen_price", label: "Dozen Price", money: true },
  { key: "suggested_price", label: "Suggested Price", money: true },
  { key: "msrp", label: "MSRP", money: true },
  { key: "map_price", label: "MAP Price", money: true },
  { key: "category", label: "Supplier's Category (raw)" },
  { key: "subcategory", label: "Supplier's Subcategory (raw)" },
  { key: "case_size", label: "Case Size" },
  { key: "pms_color", label: "PMS Color" },
  { key: "gtin", label: "GTIN" },
  { key: "supplier_status", label: "Supplier Status" },
  { key: "material_content", label: "Material" },
  { key: "type", label: "Type" },
  { key: "themes", label: "Themes" },
  { key: "productionTime", label: "Production Time" },
  { key: "dimensions", label: "Dimensions" },
  { key: "supplier_url", label: "Supplier URL", link: true },
  { key: "spec_sheet", label: "Spec Sheet" },
  { key: "decoration_spec_sheet", label: "Decoration Spec Sheet", link: true },
];

function getExtraFields(meta: any): { label: string; value: string; link?: boolean }[] {
  if (!meta) return [];
  const rows: { label: string; value: string; link?: boolean }[] = [];
  for (const { key, label, money, link } of EXTRA_FIELD_CONFIG) {
    const raw = meta[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = money ? formatMoney(raw) : String(raw);
    if (!value) continue;
    rows.push({ label, value, link });
  }
  return rows;
}

/* ─── variant pricing (fixed vs tiered) ─────────────────────────────────── */
type VariantPricing =
  | { mode: "fixed"; price: string; retail: string | null; casePrice: string | null; salePrice: string | null; mapPrice: string | null }
  | { mode: "tiered"; tiers: TierRow[] }
  | { mode: "request" }
  | { mode: "unavailable" };

function getVariantPricing(variant: any): VariantPricing {
  const meta = safeParseJSON(variant.meta) || {};
  const tiers = getTierRows(meta);

  const fixedPrice = formatMoney(variant.price);
  if (fixedPrice && !tiers.length) {
    return {
      mode: "fixed",
      price: fixedPrice,
      retail: formatMoney(variant.retail_price),
      casePrice: formatMoney(variant.case_price),
      salePrice: formatMoney(variant.sale_price),
      mapPrice: formatMoney(variant.map_price),
    };
  }

  if (tiers.length) return { mode: "tiered", tiers };
  if (meta.priceOnRequest) return { mode: "request" };
  if (fixedPrice) {
    return {
      mode: "fixed",
      price: fixedPrice,
      retail: formatMoney(variant.retail_price),
      casePrice: formatMoney(variant.case_price),
      salePrice: formatMoney(variant.sale_price),
      mapPrice: formatMoney(variant.map_price),
    };
  }
  return { mode: "unavailable" };
}

// Product-level price range, tier-aware: if a variant relies on tiers,
// fall back to its lowest tier price rather than reading a 0.
function getProductPriceRange(variants: any[]): { min: number; max: number } | null {
  const effectivePrices: number[] = [];
  for (const v of variants) {
    const fixed = Number(v.price);
    const meta = safeParseJSON(v.meta) || {};
    const tiers = getTierRows(meta);
    if (tiers.length) {
      const lowest = Math.min(...tiers.map((t) => Number(t.price.replace("$", ""))));
      effectivePrices.push(lowest);
    } else if (fixed > 0) {
      effectivePrices.push(fixed);
    }
  }
  if (!effectivePrices.length) return null;
  return { min: Math.min(...effectivePrices), max: Math.max(...effectivePrices) };
}

// Requirement: if the product itself has no usable price, always fall back
// to the 0th variant's effective price/pricing mode.
function getFallbackVariant(variants: any[]): any | null {
  return variants?.[0] || null;
}

/* ─── raw data viewer (collapsible, so nothing in meta is ever hidden) ── */
function RawDataViewer({ data, label }: { data: any; label: string }) {
  const [open, setOpen] = useState(false);
  if (!data || (typeof data === "object" && !Object.keys(data).length)) return null;
  return (
    <div className="pd-raw-viewer">
      <button className="pd-raw-toggle" onClick={() => setOpen((o) => !o)} type="button">
        {open ? "▾" : "▸"} {label}
      </button>
      {open && <pre className="pd-raw-pre">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}

/* ─── image gallery — grid with an optional "show more" cap so a product
   with 50+ attachment images doesn't dump a giant unbroken wall on the
   page. ──────────────────────────────────────────────────────────────── */
type GalleryImage = { src: string; label?: string };

function ImageGalleryGrid({
  images,
  activeImage,
  onSelect,
  initialVisible = 12,
}: {
  images: GalleryImage[];
  activeImage: string | null;
  onSelect: (src: string) => void;
  initialVisible?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  if (!images.length) return <span className="pd-empty">None provided</span>;

  const visible = showAll ? images : images.slice(0, initialVisible);
  const hiddenCount = images.length - visible.length;

  return (
    <>
      <div className="pd-gallery-grid">
        {visible.map((img, i) => (
          <button
            key={`${img.src}-${i}`}
            type="button"
            className={`pd-gallery-cell ${activeImage === img.src ? "active" : ""}`}
            onClick={() => onSelect(img.src)}
            title={img.label || ""}
          >
            <img src={img.src} alt={img.label || `image ${i + 1}`} loading="lazy" />
            {img.label && <span className="pd-gallery-cell-label">{img.label}</span>}
          </button>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button type="button" className="pd-show-more-btn" onClick={() => setShowAll(true)}>
          Show {hiddenCount} more image{hiddenCount === 1 ? "" : "s"}
        </button>
      )}
      {showAll && images.length > initialVisible && (
        <button type="button" className="pd-show-more-btn" onClick={() => setShowAll(false)}>
          Show less
        </button>
      )}
    </>
  );
}

/* ─── variant images grouped by color ────────────────────────────────────
   The raw variant-image list is really "N sizes x same handful of photos
   per color" — SANMAR/S&S repeat the identical color photo across every
   size. Dumping all of that flat (84 near-duplicate cells for a 6-color,
   14-size product) is unreadable. Grouping by color and deduping by image
   URL gives one clean card per color, with a "view all" toggle for the
   rare case where a color really does have multiple distinct shots.
------------------------------------------------------------------------- */
type ColorImageGroup = {
  color: string;
  colorCode: string | null;
  sizes: string[];
  images: GalleryImage[];
};

function groupVariantImagesByColor(variants: any[]): ColorImageGroup[] {
  const order: string[] = [];
  const map = new Map<string, ColorImageGroup>();

  for (const v of variants) {
    const key = v.color || "Unspecified";
    if (!map.has(key)) {
      map.set(key, { color: key, colorCode: v.color_code || null, sizes: [], images: [] });
      order.push(key);
    }
    const group = map.get(key)!;
    if (v.size && !group.sizes.includes(v.size)) group.sizes.push(v.size);
    for (const img of v.images || []) {
      if (img.file_uri && !group.images.some((gi) => gi.src === img.file_uri)) {
        group.images.push({ src: img.file_uri, label: v.size || v.sku });
      }
    }
  }

  return order.map((key) => map.get(key)!).filter((g) => g.images.length > 0);
}

function ColorImageCard({
  group,
  activeImage,
  onSelect,
}: {
  group: ColorImageGroup;
  activeImage: string | null;
  onSelect: (src: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cover = group.images[0];

  return (
    <div className="pd-color-card">
      <button
        type="button"
        className={`pd-color-card-cover ${activeImage === cover?.src ? "active" : ""}`}
        onClick={() => cover && onSelect(cover.src)}
      >
        {cover ? (
          <img src={cover.src} alt={group.color} loading="lazy" />
        ) : (
          <span className="pd-color-card-placeholder">No image</span>
        )}
      </button>

      <div className="pd-color-card-meta">
        <div className="pd-color-card-title">
          <ColorSwatch codes={group.colorCode} size={13} />
          <span className="pd-cell-truncate" title={group.color}>{group.color}</span>
        </div>
        <div className="pd-color-card-badges">
          {group.sizes.length > 0 && (
            <span className="pd-mini-badge">{group.sizes.length} size{group.sizes.length === 1 ? "" : "s"}</span>
          )}
          <span className="pd-mini-badge">{group.images.length} img{group.images.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {group.images.length > 1 && (
        <button type="button" className="pd-color-card-expand" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Hide extra photos" : `View all ${group.images.length} photos`}
        </button>
      )}

      {expanded && (
        <div className="pd-color-card-strip">
          {group.images.map((img, i) => (
            <button
              key={`${img.src}-${i}`}
              type="button"
              className={`pd-color-card-thumb ${activeImage === img.src ? "active" : ""}`}
              onClick={() => onSelect(img.src)}
              title={img.label || ""}
            >
              <img src={img.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────────────── */
const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState<any>(null);

  const load = async () => {
    try {
      const res = await GetProductByIdAPI(id);
      const data = res.data.data;
      setProduct(data);
      const firstImage =
        data.attachments?.[0]?.file_uri ||
        data.variants?.[0]?.images?.[0]?.file_uri ||
        "/placeholder.png";
      setActiveImage(firstImage);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // These must stay above the "if (!product) return" guard below — hooks
  // can't be conditionally skipped between renders, or React throws
  // "Rendered more hooks than during the previous render." Using optional
  // chaining so they're safe to run even while product is still null on
  // the very first render (loading state).
  const variants: any[] = product?.variants || [];

  const productAttachmentImages: GalleryImage[] = useMemo(
    () =>
      (product?.attachments || [])
        .filter((a: any) => a.file_uri)
        .map((a: any) => ({
          src: a.file_uri,
          label: a.is_primary ? "Primary" : undefined,
        })),
    [product?.attachments]
  );

  const variantImageGroups: ColorImageGroup[] = useMemo(
    () => groupVariantImagesByColor(variants),
    [variants]
  );

  if (!product) return (
    <div className="pd-loading">
      <div className="pd-loading-spinner" />
      <span>Loading product…</span>
    </div>
  );

  const productMeta = safeParseJSON(product.meta) || {};
  const fallbackVariant = getFallbackVariant(variants);

  const priceRange = getProductPriceRange(variants);
  const fallbackPricing = !priceRange && fallbackVariant ? getVariantPricing(fallbackVariant) : null;

  const totalStock = variants.reduce(
    (acc: number, v: any) => acc + (Number(v.stock) < 999999 ? Number(v.stock) || 0 : 0),
    0
  );
  const hasUnlimited = variants.some((v: any) => Number(v.stock) >= 999999);
  const inStockCount = variants.filter((v: any) => v.stock > 0).length;

  const brand = product.brand;
  const categories: any[] = product.categories || [];
  const categoryChains = buildCategoryChains(categories);
  // Split into "real hierarchy" (has a parent set in the DB) vs. plain
  // tags (category with no parent/grand assigned) so the UI doesn't show
  // the same 15 categories twice in two different shapes — each category
  // appears in exactly one of these two lists.
  const hierarchicalChains = categoryChains.filter((c) => c.parent);
  const flatChains = categoryChains.filter((c) => !c.parent);

  const uniqueColors = [
    ...new Map(variants.filter((v: any) => v.color).map((v: any) => [v.color, v])).values(),
  ];

  const totalVariantImageCount = variantImageGroups.reduce((acc, g) => acc + g.images.length, 0);
  const allImagesForMainViewer = [
    ...productAttachmentImages.map((i) => i.src),
    ...variantImageGroups.flatMap((g) => g.images.map((i) => i.src)),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const activeVariantMeta = activeVariant ? safeParseJSON(activeVariant.meta) || {} : null;
  const activeVariantPricing = activeVariant ? getVariantPricing(activeVariant) : null;
  const activeVariantExtras = activeVariantMeta ? getExtraFields(activeVariantMeta) : [];
  const activeVariantWarehouses = activeVariantMeta ? getWarehouseStock(activeVariantMeta) : [];

  // Server-computed tiers (currently populated for SAGE variants only —
  // see pricing.util.js buildPricingTiers on the backend). When present,
  // these are preferred over the client-side getTierRows() computation
  // below, since they're guaranteed to match exactly what the live site
  // and cart/checkout will actually use.
  const hasServerPricingTiers = Array.isArray(activeVariant?.pricing_tiers);

  const productExtraFields = getExtraFields(productMeta);

  return (
    <div className="product-details-page">

      {/* BACK BUTTON + BREADCRUMB */}
      <div className="pd-topbar">
        <button className="pd-back-btn" type="button" onClick={() => navigate(-1)}>
          ← Back to Products
        </button>
        <div className="pd-breadcrumb">
          <span>Products</span>
          <span className="pd-breadcrumb-sep">/</span>
          <span className="pd-breadcrumb-active">{product.name}</span>
        </div>
      </div>

      {/* HEADER */}
      <div className="pd-header">
        <div className="pd-header-left">
          <div className="pd-title-row">
            <h1>{product.name}</h1>
            <SupplierPill supplier={product.supplier} />
            {product.sync_locked ? (
              <span className="pd-sync-badge locked" title={formatDate(product.sync_locked_at) || ""}>
                Locked
              </span>
            ) : (
              <span className="pd-sync-badge auto">Auto-sync</span>
            )}
            {product.is_discontinued && (
              <span className="pd-sync-badge discontinued">Discontinued</span>
            )}
            {product.is_brand_manually_assigned && (
              <span className="pd-sync-badge manual-brand">Brand: Manual</span>
            )}
          </div>
          {product.external_style_id && (
            <span className="pd-style-id">
              Style ID: {product.external_style_id}
              {product.external_style_name && product.external_style_name !== product.external_style_id
                ? ` · ${product.external_style_name}`
                : ""}
            </span>
          )}
        </div>
        <div className="pd-header-right">
          <div className="pd-stat-pill">
            <span className={`pd-stat-dot ${inStockCount > 0 ? "in" : "out"}`} />
            {inStockCount} / {variants.length} in stock
          </div>
        </div>
      </div>

      {/* SUPPLIER INFO BAR — supplier id/name, batch, sync timestamps */}
      <div className="pd-supplier-bar">
        <div className="pd-supplier-info-item">
          <label>Supplier</label>
          <p>{product.supplier || "N/A"}</p>
        </div>
        {product.supplier_id && (
          <div className="pd-supplier-info-item">
            <label>Supplier ID</label>
            <p className="mono">{product.supplier_id}</p>
          </div>
        )}
        {product.supplier_name && (
          <div className="pd-supplier-info-item">
            <label>Supplier Name</label>
            <p>{product.supplier_name}</p>
          </div>
        )}
        <div className="pd-supplier-info-item">
          <label>Last Synced</label>
          <p>{formatDate(product.last_supplier_sync_at) || "—"}</p>
        </div>
        <div className="pd-supplier-info-item">
          <label>Created</label>
          <p>{formatDate(product.created_at) || "—"}</p>
        </div>
      </div>

      {/* CATEGORY HIERARCHY — only categories that actually have a
          parent/grand set in the DB show up here, as a real breadcrumb
          tree. Categories with no parent are NOT repeated here — they go
          in "Other Tags" below instead, so every category appears exactly
          once instead of being shown twice in two different shapes. */}
      {hierarchicalChains.length > 0 && (
        <div className="pd-meta-card pd-category-card">
          <label>Category Hierarchy ({hierarchicalChains.length})</label>
          <div className="pd-category-chains">
            {hierarchicalChains.map((chain, i) => (
              <div className="pd-category-chain" key={`${chain.category}-${chain.parent}-${chain.grand}-${i}`}>
                {chain.grand && (
                  <>
                    <span className="pd-cat-crumb pd-cat-crumb--grand">{chain.grand}</span>
                    <span className="pd-cat-arrow">›</span>
                  </>
                )}
                {chain.parent && (
                  <>
                    <span className="pd-cat-crumb pd-cat-crumb--parent">{chain.parent}</span>
                    <span className="pd-cat-arrow">›</span>
                  </>
                )}
                <span className="pd-cat-crumb pd-cat-crumb--leaf">{chain.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pd-meta-row">
        <div className="pd-meta-card">
          <label>Brand</label>
          {brand ? (
            <div className="pd-brand-chip">
              {brand.logo_url && <img src={brand.logo_url} alt={brand.name} />}
              <div>
                <strong>{brand.name}</strong>
                {brand.supplier && <span className="pd-brand-sub">via {brand.supplier}</span>}
              </div>
            </div>
          ) : (
            <span className="pd-empty">No brand assigned</span>
          )}
        </div>
        <div className="pd-meta-card wide">
          <label>
            {hierarchicalChains.length > 0 ? `Other Tags (${flatChains.length})` : `Categories (${flatChains.length})`}
          </label>
          {flatChains.length ? (
            <div className="pd-chip-row">
              {flatChains.map((c) => (
                <span className="pd-chip" key={c.category}>{c.category}</span>
              ))}
            </div>
          ) : (
            <span className="pd-empty">No categories assigned</span>
          )}
        </div>
      </div>

      {/* TOP GRID */}
      <div className="pd-top">

        {/* IMAGE COLUMN */}
        <div className="pd-image-col">
          <div className="pd-main-image">
            <img src={activeImage || "/placeholder.png"} alt={product.name} />
            <span className="pd-image-count">
              {allImagesForMainViewer.length} image{allImagesForMainViewer.length === 1 ? "" : "s"} total
            </span>
          </div>
        </div>

        {/* INFO COLUMN */}
        <div className="pd-info-col">

          {/* STATS ROW */}
          <div className="pd-stats-row">
            <div className="pd-stat-card">
              <span className="pd-stat-label">Price</span>
              <span className="pd-stat-value price">
                {priceRange
                  ? priceRange.min === priceRange.max
                    ? `$${priceRange.min.toFixed(2)}`
                    : `$${priceRange.min.toFixed(2)} – $${priceRange.max.toFixed(2)}`
                  : fallbackPricing?.mode === "fixed"
                    ? fallbackPricing.price
                    : fallbackPricing?.mode === "tiered"
                      ? `From ${fallbackPricing.tiers[0]?.price ?? "—"}`
                      : "On request"}
              </span>
              {!priceRange && fallbackVariant && (
                <span className="pd-stat-note">from variant #{fallbackVariant.id}</span>
              )}
            </div>
            <div className="pd-stat-card">
              <span className="pd-stat-label">Cost Price</span>
              <span className="pd-stat-value">
                {formatMoney(fallbackVariant?.cost_price) || "—"}
              </span>
            </div>
            <div className="pd-stat-card">
              <span className="pd-stat-label">Retail Price</span>
              <span className="pd-stat-value">
                {formatMoney(fallbackVariant?.retail_price) || "—"}
              </span>
            </div>
            <div className="pd-stat-card">
              <span className="pd-stat-label">Total Stock</span>
              <span className="pd-stat-value">
                {totalStock.toLocaleString()}{hasUnlimited ? "+" : ""}
              </span>
            </div>
          </div>

          {/* DETAILS */}
          <div className="pd-details-card">
            <div className="pd-details-row">
              <div>
                <label>Supplier</label>
                <p>{product.supplier || "N/A"}</p>
              </div>
              <div>
                <label>Style ID</label>
                <p>{product.external_style_id || "—"}</p>
              </div>
              <div>
                <label>Variants</label>
                <p>{variants.length}</p>
              </div>
            </div>

            {/* SUPPLIER-SPECIFIC EXTRA FIELDS (msrp, themes, material, spec sheets, etc.) */}
            {productExtraFields.length > 0 && (
              <div className="pd-extra-fields">
                <label>Supplier Details</label>
                <div className="pd-extra-grid">
                  {productExtraFields.map((f) => (
                    <div key={f.label} className="pd-extra-field">
                      <span>{f.label}</span>
                      {f.link ? (
                        <a href={f.value} target="_blank" rel="noreferrer" className="mono truncate">
                          {f.value}
                        </a>
                      ) : (
                        <strong>{f.value}</strong>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COLORS PREVIEW */}
            {uniqueColors.length > 0 && (
              <div className="pd-colors">
                <label>Available Colors ({uniqueColors.length})</label>
                <div className="pd-color-swatches">
                  {uniqueColors.map((v: any) => (
                    <div key={v.color} className="pd-swatch-wrap" title={v.color}>
                      <ColorSwatch codes={v.color_code} size={24} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DESCRIPTION */}
            {product.description ? (
              <div className="pd-description">
                <label>Description</label>
                <div dangerouslySetInnerHTML={{ __html: product.description }} />
              </div>
            ) : (
              <div className="pd-description">
                <label>Description</label>
                <span className="pd-empty">No description available</span>
              </div>
            )}

            {/* RAW PRODUCT META — nothing supplier sent us is hidden */}
            <RawDataViewer data={productMeta} label="View raw supplier product data" />
          </div>
        </div>
      </div>

      {/* PRODUCT ATTACHMENTS — the product-level photos only (not per-variant) */}
      <div className="pd-image-section">
        <div className="pd-section-header">
          <h2>Product Attachments <span className="pd-count">{productAttachmentImages.length}</span></h2>
        </div>
        <div className="pd-image-section-body">
          <ImageGalleryGrid
            images={productAttachmentImages}
            activeImage={activeImage}
            onSelect={setActiveImage}
          />
        </div>
      </div>

      {/* VARIANT IMAGES — grouped by color and deduped, so a product with
          14 sizes doesn't repeat the same photo 14 times in one giant
          wall. Each card shows one cover photo + a "view all" toggle for
          colors that genuinely have more than one distinct shot. */}
      <div className="pd-image-section">
        <div className="pd-section-header">
          <h2>
            Variant Images <span className="pd-count">{totalVariantImageCount}</span>
          </h2>
          <span className="pd-section-subtext">
            {variantImageGroups.length} color{variantImageGroups.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="pd-image-section-body">
          {variantImageGroups.length ? (
            <div className="pd-color-card-grid">
              {variantImageGroups.map((group) => (
                <ColorImageCard
                  key={group.color}
                  group={group}
                  activeImage={activeImage}
                  onSelect={setActiveImage}
                />
              ))}
            </div>
          ) : (
            <span className="pd-empty">None provided</span>
          )}
        </div>
      </div>

      {/* VARIANTS TABLE */}
      <div className="pd-variants-section">
        <div className="pd-section-header">
          <h2>Variants <span className="pd-count">{variants.length}</span></h2>
        </div>

        <div className="pd-table-wrap pd-table-scroll">
          <table>
            {/* Fixed column widths (paired with table-layout: fixed in the
                SCSS) so the row width is always exactly the container
                width, regardless of how long a SKU or color name is — no
                x-axis scrollbar on any supplier, including OTTOCAP's long
                multi-word color names. Overflowing text truncates with an
                ellipsis and a title tooltip instead of forcing scroll. */}
            <colgroup>
              <col style={{ width: "64px" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Image</th>
                <th>SKU</th>
                <th>Color</th>
                <th>Size</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Retail</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v: any) => {
                const pricing = getVariantPricing(v);
                return (
                  <tr
                    key={v.id}
                    className={activeVariant?.id === v.id ? "active-row" : ""}
                    onClick={() => setActiveVariant(activeVariant?.id === v.id ? null : v)}
                  >
                    <td>
                      <div className="pd-variant-img">
                        {v.images?.[0]?.file_uri ? (
                          <img
                            src={v.images[0].file_uri}
                            alt={v.sku}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImage(v.images[0].file_uri);
                            }}
                          />
                        ) : (
                          <div className="pd-variant-img-placeholder">—</div>
                        )}
                      </div>
                    </td>
                    <td className="pd-sku pd-cell-truncate" title={v.sku || ""}>{v.sku || "—"}</td>
                    <td>
                      <div className="pd-color-cell">
                        <ColorSwatch codes={v.color_code} />
                        <span className="pd-cell-truncate" title={v.color || ""}>{v.color || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <span className="pd-size-badge">{v.size || "—"}</span>
                    </td>
                    <td>
                      <span className={`pd-stock-badge ${v.stock > 0 ? "in" : "out"}`}>
                        {getStockLabel(v.stock)}
                      </span>
                    </td>
                    <td className="pd-price">
                      {pricing.mode === "fixed" && pricing.price}
                      {pricing.mode === "tiered" && (
                        <span className="pd-tier-tag">Qty pricing</span>
                      )}
                      {pricing.mode === "request" && (
                        <span className="pd-tier-tag">On request</span>
                      )}
                      {pricing.mode === "unavailable" && (
                        <span className="pd-muted">—</span>
                      )}
                    </td>
                    <td className="pd-muted">{formatMoney(v.cost_price) || "—"}</td>
                    <td className="pd-muted">{formatMoney(v.retail_price) || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!variants.length && (
            <div className="pd-no-data">No variants found</div>
          )}
        </div>

        {/* EXPANDED VARIANT DETAIL */}
        {activeVariant && (
          <div className="pd-variant-detail">
            <div className="pd-variant-detail-header">
              <div>
                <strong>
                  {[activeVariant.color, activeVariant.size].filter(Boolean).join(" • ") || activeVariant.sku}
                </strong>
                <span className="pd-sku">{activeVariant.sku}</span>
              </div>
              <SupplierPill supplier={activeVariant.supplier} />
              <button className="pd-close-btn" onClick={() => setActiveVariant(null)}>×</button>
            </div>

            <div className="pd-variant-detail-grid">
              <div>
                <span>Color code</span>
                <strong className="mono">{activeVariant.color_code || "—"}</strong>
              </div>
              <div>
                <span>Weight</span>
                <strong>{activeVariant.unit_weight ? `${activeVariant.unit_weight} lb` : "—"}</strong>
              </div>
              <div>
                <span>Case qty</span>
                <strong>{activeVariant.case_qty ?? "—"}</strong>
              </div>
              <div>
                <span>Case dims</span>
                <strong>
                  {activeVariant.case_length && activeVariant.case_width && activeVariant.case_height
                    ? `${activeVariant.case_length} × ${activeVariant.case_width} × ${activeVariant.case_height}`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Case weight</span>
                <strong>{activeVariant.case_weight ? `${activeVariant.case_weight} lb` : "—"}</strong>
              </div>
              <div>
                <span>Country of origin</span>
                <strong>{activeVariant.country_of_origin || "—"}</strong>
              </div>
              <div>
                <span>Min order qty</span>
                <strong>{activeVariant.min_order_quantity ?? 1}</strong>
              </div>
              <div>
                <span>Max order qty</span>
                <strong>{activeVariant.max_order_quantity ?? "No limit"}</strong>
              </div>
              <div>
                <span>Stock</span>
                <strong>{getStockLabel(activeVariant.stock)}</strong>
              </div>
              <div>
                <span>Track inventory</span>
                <strong>{activeVariant.track_inventory ? "Yes" : "No"}</strong>
              </div>
              <div>
                <span>Last Synced</span>
                <strong>{formatDate(activeVariant.last_supplier_sync_at) || "—"}</strong>
              </div>
              <div>
                <span>External Variant ID</span>
                <strong>{activeVariant.external_variant_id || "—"}</strong>
              </div>
            </div>

            {/* FULL PRICE BREAKDOWN — not just the summary column shown in the table */}
            <div className="pd-price-breakdown">
              <label>Pricing (as provided by supplier)</label>
              <div className="pd-price-breakdown-grid">
                <div><span>Price</span><strong>{formatMoney(activeVariant.price) || "—"}</strong></div>
                <div><span>Cost Price</span><strong>{formatMoney(activeVariant.cost_price) || "—"}</strong></div>
                <div><span>Retail Price</span><strong>{formatMoney(activeVariant.retail_price) || "—"}</strong></div>
                <div><span>Sale Price</span><strong>{formatMoney(activeVariant.sale_price) || "—"}</strong></div>
                <div><span>Case Price</span><strong>{formatMoney(activeVariant.case_price) || "—"}</strong></div>
                <div><span>MAP Price</span><strong>{formatMoney(activeVariant.map_price) || "—"}</strong></div>
              </div>
            </div>

            {/* QUANTITY PRICING — two tables when the backend provides
                server-computed tiers (currently SAGE): the raw supplier
                numbers side by side with what the customer actually pays
                after markup. Falls back to the old single client-computed
                table for suppliers that don't have server tiers yet. */}
            {hasServerPricingTiers ? (
              activeVariant.pricing_tiers.length > 0 ? (
                <div className="pd-tier-pair">
                  <div className="pd-tier-block">
                    <label>Supplier Pricing (as provided, no markup)</label>
                    <table className="pd-tier-table">
                      <thead>
                        <tr>
                          <th>Qty</th>
                          <th>List Price</th>
                          <th>Net Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeVariant.pricing_tiers.map((t: any, i: number) => (
                          <tr key={i}>
                            <td>{t.quantity}+</td>
                            <td>{formatMoney(t.list_price) || "—"}</td>
                            <td>{formatMoney(t.net_price) || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pd-tier-block">
                    <label>Our Pricing (with markup applied)</label>
                    <table className="pd-tier-table">
                      <thead>
                        <tr>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeVariant.pricing_tiers_customer || []).map((t: any, i: number) => (
                          <tr key={i}>
                            <td>{t.quantity}+</td>
                            <td>{formatMoney(t.price) || "—"}</td>
                            <td>{formatMoney(t.net) || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="pd-tier-block">
                  <span className="pd-empty">
                    No quantity pricing provided by supplier for this variant
                  </span>
                </div>
              )
            ) : (
              activeVariantPricing?.mode === "tiered" && (
                <div className="pd-tier-block">
                  <label>Quantity pricing</label>
                  <table className="pd-tier-table">
                    <thead>
                      <tr>
                        <th>Qty</th>
                        <th>Price</th>
                        {activeVariantPricing.tiers.some((t) => t.net) && <th>Net</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {activeVariantPricing.tiers.map((t, i) => (
                        <tr key={i}>
                          <td>{t.qty}</td>
                          <td>{t.price}</td>
                          {t.net && <td>{t.net}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {!hasServerPricingTiers && activeVariantPricing?.mode === "request" && (
              <span className="pd-empty">Pricing available on request from supplier</span>
            )}

            {/* SUPPLIER-SPECIFIC EXTRA FIELDS FOR THIS VARIANT */}
            {activeVariantExtras.length > 0 && (
              <div className="pd-extra-fields">
                <label>Supplier Details</label>
                <div className="pd-extra-grid">
                  {activeVariantExtras.map((f) => (
                    <div key={f.label} className="pd-extra-field">
                      <span>{f.label}</span>
                      {f.link ? (
                        <a href={f.value} target="_blank" rel="noreferrer" className="mono truncate">{f.value}</a>
                      ) : (
                        <strong>{f.value}</strong>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WAREHOUSE / REGIONAL STOCK */}
            {activeVariantWarehouses.length > 0 && (
              <div className="pd-warehouse-block">
                <label>Stock by Warehouse</label>
                <div className="pd-warehouse-row">
                  {activeVariantWarehouses.map((w) => (
                    <div key={w.code} className="pd-warehouse-chip">
                      <span>{w.code}</span>
                      <strong>{w.qty.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeVariant.images?.length > 0 && (
              <div className="pd-variant-image-strip">
                {activeVariant.images.map((img: any) => (
                  <img
                    key={img.id}
                    src={img.file_uri}
                    alt=""
                    onClick={() => setActiveImage(img.file_uri)}
                  />
                ))}
              </div>
            )}

            {/* RAW VARIANT META — full supplier payload, always available */}
            <RawDataViewer data={activeVariantMeta} label="View raw supplier variant data" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetails;