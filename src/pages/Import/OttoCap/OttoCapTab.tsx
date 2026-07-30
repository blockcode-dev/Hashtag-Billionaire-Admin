import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

import {
  GetOttoProductsAPI,
  GetOttoProductVariantsAPI,
  ImportOttoAllVariantsAPI,
  ImportOttoSelectedVariantsAPI,
} from "@/services/Api/OttoImportApi";

import "./OttoCapTab.scss";

const fmt = (n: any) => Number(n || 0).toLocaleString();

/* ── icons ── */
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const UploadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const ArrowIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const EmptyIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <line x1="12" y1="12" x2="12" y2="16" />
    <line x1="10" y1="14" x2="14" y2="14" />
  </svg>
);
const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ── skeleton ── */
const SkeletonRow = () => (
  <tr className="skeleton-row">
    {[36, 110, 90, 75, 65, 65, 80].map((w, i) => (
      <td key={i}><span className="skel" style={{ width: w, height: 11 }} /></td>
    ))}
  </tr>
);

/* ── success toast bar ── */
const SuccessBar = ({
  productName,
  hasNext,
  onNext,
  onDismiss,
}: {
  productName: string;
  hasNext: boolean;
  onNext: () => void;
  onDismiss: () => void;
}) => (
  <div className="success-bar" role="status">
    <span className="sb-icon"><CheckCircleIcon /></span>
    <div className="sb-copy">
      <strong>Imported!</strong>
      <span>{productName} is now synced.</span>
    </div>
    <div className="sb-actions">
      {hasNext && (
        <button className="sb-next" onClick={onNext}>
          Next <ArrowIcon />
        </button>
      )}
      <button className="sb-dismiss" onClick={onDismiss} aria-label="Dismiss">
        <XIcon />
      </button>
    </div>
  </div>
);

/* ── full page import spinner ── */
const ImportingOverlay = () => (
  <div className="importing-overlay" role="alert" aria-live="assertive">
    <div className="io-card">
      <div className="io-spinner" aria-hidden="true" />
      <p className="io-label">Importing…</p>
      <p className="io-sub">Don't close or refresh this page.</p>
    </div>
  </div>
);

/* ══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
const OttoCapTab = () => {
  const { show } = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);

  const [importingAll, setImportingAll] = useState(false);
  const [importingSelected, setImportingSelected] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ name: string; sku: string } | null>(null);

  /* ── load sidebar ── */
  const loadProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const res = await GetOttoProductsAPI();
      setProducts(res.data.data?.data || []);
    } catch {
      show("Failed to load products", "error");
    } finally {
      setLoadingProducts(false);
    }
  }, [show]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const v = search.toLowerCase();
    return products.filter(
      (p) => p.sku_no?.toLowerCase().includes(v) || p.name?.toLowerCase().includes(v)
    );
  }, [products, search]);

  /* ── load detail ── */
  const loadProductDetails = useCallback(
    async (sku: string) => {
      try {
        setDetailsLoading(true);
        setVariants([]);
        setSelectedVariants([]);
        setSuccessInfo(null);
        const res = await GetOttoProductVariantsAPI(sku);
        setSelectedProduct(res.data.data.product);
        setVariants(res.data.data.variants || []);
      } catch {
        show("Failed to load product details", "error");
      } finally {
        setDetailsLoading(false);
      }
    },
    [show]
  );

  /* ── advance ── */
  const getNextProduct = useCallback(
    (currentSku: string) => {
      const idx = filteredProducts.findIndex((p) => p.sku_no === currentSku);
      return filteredProducts[idx + 1] ?? null;
    },
    [filteredProducts]
  );

  const advanceToNext = useCallback(
    (currentSku: string) => {
      const next = getNextProduct(currentSku);
      if (next) loadProductDetails(next.sku_no);
      else setSelectedProduct(null);
    },
    [getNextProduct, loadProductDetails]
  );

  /* ── variants selection ── */
  const toggleVariant = (sku: string) =>
    setSelectedVariants((prev) =>
      prev.includes(sku) ? prev.filter((x) => x !== sku) : [...prev, sku]
    );

  const toggleAll = () =>
    setSelectedVariants(
      selectedVariants.length === variants.length ? [] : variants.map((v) => v.sku_no)
    );

  /* ── import all ── */
  const handleImportAll = async () => {
    if (!selectedProduct) return;
    try {
      setImportingAll(true);
      const res = await ImportOttoAllVariantsAPI(selectedProduct.sku_no);
      if (res?.data?.success || res?.status === 200 || res?.data?.status === 200) {
        await loadProducts();
        await loadProductDetails(selectedProduct.sku_no);
        setSuccessInfo({ name: selectedProduct.name, sku: selectedProduct.sku_no });
        show("Imported successfully", "success");
      } else {
        show(res?.data?.message || "Import failed", "error");
      }
    } catch {
      show("Import failed", "error");
    } finally {
      setImportingAll(false);
    }
  };

  /* ── import selected ── */
  const handleImportSelected = async () => {
    if (!selectedProduct) return;
    if (!selectedVariants.length) { show("Select variants first", "error"); return; }
    try {
      setImportingSelected(true);
      const res = await ImportOttoSelectedVariantsAPI(selectedProduct.sku_no, selectedVariants);
      if (res?.data?.success || res?.status === 200 || res?.data?.status === 200) {
        await loadProducts();
        await loadProductDetails(selectedProduct.sku_no);
        setSuccessInfo({ name: selectedProduct.name, sku: selectedProduct.sku_no });
        show("Imported successfully", "success");
      } else {
        show(res?.data?.message || "Import failed", "error");
      }
    } catch {
      show("Import failed", "error");
    } finally {
      setImportingSelected(false);
    }
  };

  const totalStock = useMemo(() => variants.reduce((s, v) => s + (Number(v.instock) || 0), 0), [variants]);
  const syncedCount = useMemo(() => variants.filter((v) => v.is_imported).length, [variants]);
  const lowestPrice = useMemo(() => {
    const prices = variants.map((v) => Number(v.price_1 || 0)).filter((p) => p > 0);
    return prices.length ? Math.min(...prices) : 0;
  }, [variants]);

  const isImporting = importingAll || importingSelected;
  const allChecked = variants.length > 0 && selectedVariants.length === variants.length;
  const someChecked = selectedVariants.length > 0 && !allChecked;

  return (
    <div className="otto-page">
      {/* full-page import overlay */}
      {isImporting && <ImportingOverlay />}

      {/* ══════ SIDEBAR ══════ */}
      <aside className="otto-sidebar">
        <div className="sidebar-head">
          <div className="sidebar-title-row">
            <span className="step-badge">1</span>
            <span className="sidebar-title">Select a Product</span>
          </div>
          <div className="sidebar-search">
            <SearchIcon />
            <input
              placeholder="Search name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear">
                <XIcon />
              </button>
            )}
          </div>
          <p className="sidebar-count">
            {loadingProducts ? "Loading…" : `${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="sidebar-list">
          {loadingProducts
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="product-card product-card--skeleton">
                  <span className="skel" style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="skel" style={{ width: 52, height: 9 }} />
                    <span className="skel" style={{ width: 120, height: 12 }} />
                  </div>
                </div>
              ))
            : filteredProducts.length === 0
            ? (
              <div className="sidebar-empty">
                <p>No results for<br /><strong>"{search}"</strong></p>
              </div>
            )
            : filteredProducts.map((item) => {
                const active = selectedProduct?.sku_no === item.sku_no;
                return (
                  <div
                    key={item.sku_no}
                    className={`product-card${active ? " product-card--active" : ""}${item.is_imported ? " product-card--synced" : ""}`}
                    onClick={() => !isImporting && !active && loadProductDetails(item.sku_no)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && !isImporting && !active && loadProductDetails(item.sku_no)}
                    aria-pressed={active}
                  >
                    <div className="pc-thumb">
                      <img src={item.image_main} alt={item.name} loading="lazy" />
                      {item.is_imported && <span className="pc-synced-dot" />}
                    </div>
                    <div className="pc-body">
                      <span className="pc-sku">{item.sku_no}</span>
                      <span className="pc-name">{item.name}</span>
                    </div>
                  </div>
                );
              })}
        </div>
      </aside>

      {/* ══════ MAIN PANEL ══════ */}
      <main className="otto-main">

        {/* empty */}
        {!selectedProduct && !detailsLoading && (
          <div className="panel-empty">
            <div className="pe-icon"><EmptyIcon /></div>
            <h3>Select a product</h3>
            <p>Choose from the sidebar to preview variants and import them.</p>
          </div>
        )}

        {/* skeleton */}
        {detailsLoading && (
          <div className="panel-skeleton">
            <div className="ps-hero">
              <span className="skel" style={{ width: 80, height: 80, borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <span className="skel" style={{ height: 9, width: 80 }} />
                <span className="skel" style={{ height: 20, width: 220 }} />
                <span className="skel" style={{ height: 10, width: 140 }} />
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span className="skel" style={{ height: 34, width: 100, borderRadius: 8 }} />
                  <span className="skel" style={{ height: 34, width: 120, borderRadius: 8 }} />
                </div>
              </div>
            </div>
            <span className="skel" style={{ height: 36, borderRadius: 8 }} />
            <div style={{ flex: 1 }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          </div>
        )}

        {/* workspace */}
        {selectedProduct && !detailsLoading && (
          <div className="otto-workspace">

            {/* success bar — sits at top, doesn't cover content */}
            {successInfo && (
              <SuccessBar
                productName={successInfo.name}
                hasNext={!!getNextProduct(successInfo.sku)}
                onNext={() => {
                  advanceToNext(successInfo.sku);
                  setSuccessInfo(null);
                }}
                onDismiss={() => setSuccessInfo(null)}
              />
            )}

            {/* ── HERO ── */}
            <div className="product-hero">
              <img className="ph-img" src={selectedProduct.image_main} alt={selectedProduct.name} />
              <div className="ph-body">
                <div className="ph-meta-row">
                  <span className="ph-sku">{selectedProduct.sku_no}</span>
                  {selectedProduct.brand && (
                    <span className="ph-brand-tag">{selectedProduct.brand}</span>
                  )}
                </div>
                <h2 className="ph-name">{selectedProduct.name}</h2>
                <div className="ph-stats">
                  <div className="ph-stat">
                    <span className="ph-stat-val">{variants.length}</span>
                    <span className="ph-stat-key">Variants</span>
                  </div>
                  <div className="ph-stat-divider" />
                  <div className="ph-stat">
                    <span className="ph-stat-val">{fmt(totalStock)}</span>
                    <span className="ph-stat-key">In Stock</span>
                  </div>
                  <div className="ph-stat-divider" />
                  <div className="ph-stat ph-stat--green">
                    <span className="ph-stat-val">{syncedCount}</span>
                    <span className="ph-stat-key">Synced</span>
                  </div>
                  <div className="ph-stat-divider" />
                  <div className="ph-stat">
                    <span className="ph-stat-val">${lowestPrice.toFixed(2)}</span>
                    <span className="ph-stat-key">From</span>
                  </div>
                </div>
              </div>
              <div className="ph-actions">
                <button className="btn-import-all" onClick={handleImportAll} disabled={isImporting}>
                  <UploadIcon /> Import All
                </button>
                <button
                  className="btn-import-sel"
                  onClick={handleImportSelected}
                  disabled={isImporting || !selectedVariants.length}
                >
                  Import Selected ({selectedVariants.length})
                </button>
              </div>
            </div>

            {/* ── PRODUCT DETAILS — collapsible, clean ── */}
            {selectedProduct.description && (
              <details className="desc-card">
                <summary>
                  <span className="desc-summary-label">Product Details</span>
                  <span className="desc-chevron">›</span>
                </summary>
                <div
                  className="desc-body"
                  dangerouslySetInnerHTML={{ __html: selectedProduct.description }}
                />
              </details>
            )}

            {/* ── VARIANTS ── */}
            <div className="variants-wrap">
              <div className="vw-header">
                <div className="vw-header-left">
                  <span className="vw-title">Variants</span>
                  <span className="vw-count">{variants.length}</span>
                  {selectedVariants.length > 0 && (
                    <span className="vw-sel-pill">{selectedVariants.length} selected</span>
                  )}
                </div>
                {selectedVariants.length > 0 && (
                  <button className="vw-clear" onClick={() => setSelectedVariants([])}>
                    Clear
                  </button>
                )}
              </div>

              {/* scroll container */}
              <div className="vw-scroll">
                <table className="vt" aria-label="Product variants">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <label className="cb-label" aria-label="Select all">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => el && (el.indeterminate = someChecked)}
                            onChange={toggleAll}
                            disabled={isImporting}
                          />
                          <span className="cb-box" />
                        </label>
                      </th>
                      <th>SKU</th>
                      <th>Color</th>
                      <th>Size</th>
                      <th>Stock</th>
                      <th>Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => {
                      const checked = selectedVariants.includes(v.sku_no);
                      const inStock = Number(v.instock) > 0;
                      return (
                        <tr
                          key={v.sku_no}
                          className={checked ? "vt-row vt-row--sel" : "vt-row"}
                          onClick={() => !isImporting && toggleVariant(v.sku_no)}
                          aria-selected={checked}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <label className="cb-label" aria-label={`Select ${v.sku_no}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleVariant(v.sku_no)}
                                disabled={isImporting}
                              />
                              <span className="cb-box" />
                            </label>
                          </td>
                          <td className="vt-sku">{v.sku_no}</td>
                          <td className="vt-color">{v.color || <span className="vt-empty">—</span>}</td>
                          <td><span className="pill pill--size">{v.size || "OS"}</span></td>
                          <td>
                            <span className={`pill ${inStock ? "pill--in" : "pill--out"}`}>
                              {fmt(v.instock)}
                            </span>
                          </td>
                          <td className="vt-price">${Number(v.price_1 || 0).toFixed(2)}</td>
                          <td>
                            {v.is_imported
                              ? <span className="status-pill status-pill--synced">Synced</span>
                              : <span className="status-pill status-pill--ready">Ready</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default OttoCapTab;