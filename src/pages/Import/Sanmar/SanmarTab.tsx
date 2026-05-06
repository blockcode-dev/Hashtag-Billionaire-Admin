import React, { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  GetSanmarBrandsAPI,
  GetSanmarStylesAPI,
  GetSanmarProductAPI,
  ImportSanmarProductAPI,
} from "@/services/Api/SanmarImportApi";

import "./SanmarTab.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = {
  sku: string;
  variant_name: string;
  stock: number;
  pricing: { price: number };
};

type Brand = { id: number | string; name: string };
type StyleItem = { style_name?: string; [key: string]: any };
type ProductImage = string;
type Product = {
  product?: { name?: string; product_images?: ProductImage[] };
  variants?: Variant[];
};

type Step = 1 | 2 | 3 | 4;
type ImportStatus = "idle" | "importing" | "done" | "error";

// ─── Step Bar ─────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Pick a Brand" },
  { label: "Choose a Style" },
  { label: "Review Product" },
  { label: "Import" },
];

const StepBar: React.FC<{ current: Step }> = ({ current }) => (
  <div className="sanmar-steps">
    {STEPS.map((s, i) => {
      const num = (i + 1) as Step;
      const isDone = num < current;
      const isActive = num === current;
      return (
        <React.Fragment key={num}>
          <div className="sanmar-steps__item">
            <div
              className={[
                "sanmar-steps__circle",
                isDone ? "sanmar-steps__circle--done" : "",
                isActive ? "sanmar-steps__circle--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {isDone ? "✓" : num}
            </div>
            <span
              className={[
                "sanmar-steps__label",
                isDone ? "sanmar-steps__label--done" : "",
                isActive ? "sanmar-steps__label--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <span className="sanmar-steps__arrow">→</span>
          )}
        </React.Fragment>
      );
    })}
  </div>
);

const Spinner: React.FC = () => (
  <div className="sanmar-spinner">
    <div className="sanmar-spinner__ring" />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const SanmarTab: React.FC = () => {
  const [step, setStep] = useState<Step>(1);

  // Step 1 – brand
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  // Step 2 – style
  const [styles, setStyles] = useState<string[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [styleSearch, setStyleSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  // Step 3 – product
  const [product, setProduct] = useState<Product | null>(null);
  const [productLoading, setProductLoading] = useState(false);

  // Step 4 – import
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");

  const { show } = useToast();

  // ── Load brands on mount ──
  useEffect(() => {
    GetSanmarBrandsAPI()
      .then((res) => setBrands(res.data.data?.data || []))
      .catch(() => show("Failed to load brands", "error"))
      .finally(() => setBrandsLoading(false));
  }, []);

  const resetAll = () => {
    setStep(1);
    setSelectedBrand(null);
    setSelectedStyle(null);
    setStyles([]);
    setProduct(null);
    setImportStatus("idle");
    setBrandSearch("");
    setStyleSearch("");
  };

  // ── Step 1 → 2: select brand ──
  const handleSelectBrand = async (brand: Brand) => {
    setSelectedBrand(brand);
    setSelectedStyle(null);
    setProduct(null);
    setStyles([]);
    setImportStatus("idle");
    setStyleSearch("");
    setStylesLoading(true);
    try {
      const res = await GetSanmarStylesAPI(brand.name);
      const data = res.data.data?.data || [];
      setStyles(data.map((s: StyleItem) => s.style_name || s));
    } catch {
      show("Failed to load styles", "error");
    } finally {
      setStylesLoading(false);
    }
    setStep(2);
  };

  // ── Step 2 → 3: select style ──
  const handleSelectStyle = async (style: string) => {
    setSelectedStyle(style);
    setProduct(null);
    setProductLoading(true);
    setImportStatus("idle");
    try {
      const res = await GetSanmarProductAPI(selectedBrand!.name, style);
      setProduct(res.data.data);
    } catch {
      show("Failed to load product", "error");
    } finally {
      setProductLoading(false);
    }
    setStep(3);
  };

  // ── Step 3 → 4: import ──
  const handleImport = async () => {
    if (!selectedBrand || !selectedStyle) return;
    setImportStatus("importing");
    setStep(4);
    try {
      await ImportSanmarProductAPI({
        brand: selectedBrand.name,
        style: selectedStyle,
      });
      setImportStatus("done");
    } catch {
      setImportStatus("error");
    }
  };

  // ── Go back ──
  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSelectedStyle(null);
    } else if (step === 3) {
      setStep(2);
      setProduct(null);
    } else if (step === 4) {
      setStep(3);
      setImportStatus("idle");
    }
  };

  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );
  const filteredStyles = styles.filter((s) =>
    s.toLowerCase().includes(styleSearch.toLowerCase())
  );

  const totalStock =
    product?.variants?.reduce((sum, v) => sum + v.stock, 0) || 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="sanmar-import-tab">

      {/* ── Import Overlay ── */}
      {importStatus === "importing" && (
        <div className="sanmar-import-overlay">
          <div className="sanmar-import-overlay__card">
            <div className="sanmar-import-overlay__spinner" />
            <h3 className="sanmar-import-overlay__title">Importing Product…</h3>
            <p className="sanmar-import-overlay__msg">
              Importing <strong>{selectedStyle}</strong> from{" "}
              <strong>{selectedBrand?.name}</strong>. This may take a few
              minutes — please don't close this tab.
            </p>
            <div className="sanmar-import-overlay__bar">
              <div className="sanmar-import-overlay__bar-fill" />
            </div>
            <p className="sanmar-import-overlay__hint">
              ⚠️ Please don't close or refresh this tab
            </p>
          </div>
        </div>
      )}

      {/* Step Bar */}
      <StepBar current={step} />

      {/* Body */}
      <div className="sanmar-body">

        {/* ── Left Panel ── */}
        <div className="sanmar-panel">

          {/* Brand list */}
          <div className="sanmar-panel__label">Step 1 · Select Brand</div>
          <div className="sanmar-panel__search">
            <span className="sanmar-panel__search-icon">🔍</span>
            <input
              placeholder="Search brand..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              disabled={step > 1}
            />
          </div>
          {brandsLoading ? (
            <Spinner />
          ) : (
            <div className="sanmar-panel__list">
              {filteredBrands.length === 0 ? (
                <div className="sanmar-panel__empty">No brands found</div>
              ) : (
                filteredBrands.map((b) => (
                  <div
                    key={b.id}
                    className={[
                      "sanmar-panel__list-item",
                      selectedBrand?.id === b.id
                        ? "sanmar-panel__list-item--selected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => step === 1 && handleSelectBrand(b)}
                  >
                    {b.name}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Style list – appears after brand chosen */}
          {step >= 2 && (
            <>
              <div className="sanmar-panel__label" style={{ marginTop: 8 }}>
                Step 2 · Select Style
              </div>
              <div className="sanmar-panel__search">
                <span className="sanmar-panel__search-icon">🔍</span>
                <input
                  placeholder="Search style..."
                  value={styleSearch}
                  onChange={(e) => setStyleSearch(e.target.value)}
                  disabled={step > 2}
                />
              </div>
              {stylesLoading ? (
                <Spinner />
              ) : (
                <div className="sanmar-panel__list">
                  {filteredStyles.length === 0 ? (
                    <div className="sanmar-panel__empty">No styles found</div>
                  ) : (
                    filteredStyles.map((s) => (
                      <div
                        key={s}
                        className={[
                          "sanmar-panel__list-item",
                          selectedStyle === s
                            ? "sanmar-panel__list-item--selected"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => step === 2 && handleSelectStyle(s)}
                      >
                        {s}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right Preview Panel ── */}
        <div className="sanmar-preview">

          {/* Step 1 placeholder */}
          {step === 1 && (
            <div className="sanmar-preview__placeholder">
              <div className="sanmar-preview__placeholder-icon">📦</div>
              <span>Select a brand &amp; style to preview product</span>
            </div>
          )}

          {/* Step 2 placeholder */}
          {step === 2 && !productLoading && !product && (
            <div className="sanmar-preview__placeholder">
              <div className="sanmar-preview__placeholder-icon">👕</div>
              <span>Now choose a style to load the product</span>
            </div>
          )}

          {/* Step 3 – loading */}
          {step === 3 && productLoading && <Spinner />}

          {/* Step 3 – product detail */}
          {step === 3 && !productLoading && product && (
            <div className="sanmar-product">

              {/* Header */}
              <div className="sanmar-product__header">
                <div>
                  <div className="sanmar-product__name">
                    {product.product?.name || selectedStyle}
                  </div>
                  <div className="sanmar-product__sub">
                    {selectedBrand?.name} · {selectedStyle}
                  </div>
                </div>
              </div>

              {/* Images */}
              {product.product?.product_images &&
                product.product.product_images.length > 0 && (
                  <div className="sanmar-product__images">
                    {product.product.product_images.slice(0, 5).map(
                      (img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt={`product-${i}`}
                          onError={(e) => {
                            (
                              e.target as HTMLImageElement
                            ).src =
                              "https://via.placeholder.com/100x100?text=No+Image";
                          }}
                        />
                      )
                    )}
                  </div>
                )}

              {/* Stats */}
              <div className="sanmar-product__stats">
                <div className="sanmar-product__stat">
                  <span className="sanmar-product__stat-value">
                    {product.variants?.length || 0}
                  </span>
                  <span className="sanmar-product__stat-label">Variants</span>
                </div>
                <div className="sanmar-product__stat">
                  <span className="sanmar-product__stat-value">
                    {totalStock.toLocaleString()}
                  </span>
                  <span className="sanmar-product__stat-label">
                    Total Stock
                  </span>
                </div>
              </div>

              {/* Variants Table */}
              <div className="sanmar-product__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Variant</th>
                      <th>Stock</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants?.map((v) => (
                      <tr key={v.sku}>
                        <td>
                          <code>{v.sku}</code>
                        </td>
                        <td>{v.variant_name}</td>
                        <td>{v.stock}</td>
                        <td>${v.pricing?.piece || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4 – done */}
          {step === 4 && importStatus === "done" && (
            <div className="sanmar-preview__placeholder">
              <div style={{ fontSize: 48 }}>✅</div>
              <span
                style={{
                  fontWeight: 600,
                  color: "#16a34a",
                  fontSize: 16,
                }}
              >
                Import complete!
              </span>
              <span>
                <strong>{selectedStyle}</strong> from{" "}
                <strong>{selectedBrand?.name}</strong> has been imported
                successfully.
              </span>
              <button className="sanmar-btn sanmar-btn--ghost" onClick={resetAll}>
                ← Start a new import
              </button>
            </div>
          )}

          {/* Step 4 – error */}
          {step === 4 && importStatus === "error" && (
            <div className="sanmar-preview__placeholder">
              <div style={{ fontSize: 48 }}>❌</div>
              <span
                style={{
                  fontWeight: 600,
                  color: "#dc2626",
                  fontSize: 16,
                }}
              >
                Import failed
              </span>
              <span>Something went wrong. Please try again.</span>
              <button
                className="sanmar-btn sanmar-btn--ghost"
                onClick={() => {
                  setStep(3);
                  setImportStatus("idle");
                }}
              >
                ← Go Back
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="sanmar-footer">
        <div className="sanmar-footer__info">
          {selectedBrand && (
            <>
              Brand: <strong>{selectedBrand.name}</strong>
            </>
          )}
          {selectedStyle && (
            <>
              {" · "}Style: <strong>{selectedStyle}</strong>
            </>
          )}
          {product?.variants && step >= 3 && (
            <>
              {" · "}
              <strong>{product.variants.length}</strong> variants
            </>
          )}
        </div>

        <div className="sanmar-footer__actions">
          {step > 1 && step < 4 && importStatus !== "importing" && (
            <button className="sanmar-btn sanmar-btn--ghost" onClick={handleBack}>
              ← Back
            </button>
          )}
          {step === 3 && !productLoading && product && (
            <button
              className="sanmar-btn sanmar-btn--primary"
              onClick={handleImport}
              disabled={importStatus === "importing"}
            >
              🚀 Import Product
            </button>
          )}
        </div>
      </div>

    
    </div>
  );
};

export default SanmarTab;