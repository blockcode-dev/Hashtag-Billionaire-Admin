import React, { useState } from "react";
import {
  GetSageProductDetailsAPI,
  ImportSageProductsAPI,
  ImportSelectedSageProductsAPI,
  SearchSageProductsAPI,
} from "@/services/Api/SageApi";

type ImportStatus = "idle" | "importing" | "done" | "error";

const SageImportBySupplierTab: React.FC = () => {
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDetail, setProductDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importMessage, setImportMessage] = useState("");
  const [supplierName, setSupplierName] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const toggleProduct = (prodEId: number) => {
    setSelectedProducts((prev) =>
      prev.includes(prodEId)
        ? prev.filter((id) => id !== prodEId)
        : [...prev, prodEId],
    );
  };

  const handleImportSelected = async () => {
    if (!selectedProducts.length) return;
    setImportStatus("importing");
    setImportMessage(
      `Importing ${selectedProducts.length} selected products...`,
    );
    try {
      await ImportSelectedSageProductsAPI(
        selectedProducts,
        "Manual selected supplier import",
      );
      setImportStatus("done");
      setImportMessage(
        `${selectedProducts.length} products imported successfully!`,
      );
    } catch {
      setImportStatus("error");
      setImportMessage("Something went wrong during import. Please try again.");
    }
  };

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 100,
    totalPages: 1,
  });

  const resetAll = () => {
    setSupplierId("");
    setProducts([]);
    setSelectedProduct(null);
    setProductDetail(null);
    setImportStatus("idle");
    setImportMessage("");
    setSupplierName("");
    setSelectedProducts([]);
    setActiveImageIndex(0);
    setPagination({ total: 0, page: 1, limit: 100, totalPages: 1 });
  };

  const fetchProducts = async (page = 1) => {
    if (!supplierId) return;
    setProductsLoading(true);
    try {
      const res = await SearchSageProductsAPI(
        "",
        Number(supplierId),
        page,
        100,
      );
      const data = res?.data?.data;
      const fetched = data?.products || [];
      setProducts(fetched);
      setPagination(data?.pagination || {});
      if (fetched.length > 0) setSupplierName(fetched[0].supplier);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleViewDetail = async (product: any) => {
    setSelectedProduct(product);
    setActiveImageIndex(0);
    setDetailLoading(true);
    try {
      const detail = await GetSageProductDetailsAPI(product.prodEId);
      setProductDetail(detail?.data?.data || product);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleImport = async () => {
    if (!supplierId) return;
    setImportStatus("importing");
    setImportMessage(
      `Importing products from ${supplierName || `Supplier #${supplierId}`}. This may take a few minutes for large catalogues — please don't close this tab.`,
    );
    try {
      await ImportSageProductsAPI("", Number(supplierId));
      setImportStatus("done");
      setImportMessage(
        `All ${pagination.total || ""} products imported successfully!`,
      );
    } catch {
      setImportStatus("error");
      setImportMessage("Something went wrong during import. Please try again.");
    }
  };

  // Build pricing rows from detail
  const getPricingRows = (detail: any) => {
    if (!detail?.qty || !detail?.prc) return [];
    return detail.qty
      .map((q: string, i: number) => ({
        qty: q,
        price: detail.prc[i],
        net: detail.net?.[i],
      }))
      .filter((row: any) => row.qty && row.qty !== "0" && row.price);
  };

  return (
    <div className="sage-import-tab">
      {/* ── Import Overlay ── */}
      {importStatus === "importing" && (
        <div className="sage-import-overlay">
          <div className="sage-import-overlay__card">
            <div className="sage-import-overlay__spinner" />
            <h3 className="sage-import-overlay__title">Importing Products…</h3>
            <p className="sage-import-overlay__msg">{importMessage}</p>
            <div className="sage-import-overlay__bar">
              <div className="sage-import-overlay__bar-fill" />
            </div>
            <p className="sage-import-overlay__hint">
              ⚠️ Please don't close or refresh this tab
            </p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="sage-body">
        {/* ── Left Panel ── */}
        <div className="sage-panel">
          {/* Mini stepper */}
          <div className="sage-stepper">
            <div className="sage-step sage-step--active">
              <span className="sage-step__num">1</span>
              <span className="sage-step__label">Enter Supplier</span>
            </div>
            <span className="sage-step__arrow">→</span>
            <div
              className={`sage-step ${products.length > 0 ? "sage-step--active" : ""}`}
            >
              <span className="sage-step__num">2</span>
              <span className="sage-step__label">Browse Products</span>
            </div>
            <span className="sage-step__arrow">→</span>
            <div
              className={`sage-step ${importStatus === "done" ? "sage-step--active" : ""}`}
            >
              <span className="sage-step__num">3</span>
              <span className="sage-step__label">Import</span>
            </div>
          </div>

          <div className="sage-panel__section">
            <div className="sage-panel__label">Step 1 · Enter Supplier ID</div>

            <input
              className="sage-input"
              type="number"
              value={supplierId}
              onChange={(e) => setSupplierId(Number(e.target.value))}
              placeholder="Enter supplier ID..."
            />

            {supplierName && (
              <div className="sage-supplier-badge">
                <span className="sage-supplier-badge__dot" />
                <strong>{supplierName}</strong>
                <span className="sage-supplier-badge__id">#{supplierId}</span>
              </div>
            )}

            <button
              className="sage-btn sage-btn--primary sage-btn--block"
              onClick={() => fetchProducts(1)}
              disabled={!supplierId || productsLoading}
            >
              {productsLoading ? "Fetching…" : "Fetch Products"}
            </button>
          </div>
        </div>

        {/* ── Right Preview Panel ── */}
        <div className="sage-preview">
          {/* Empty state */}
          {!productsLoading &&
            !selectedProduct &&
            products.length === 0 &&
            importStatus !== "done" &&
            importStatus !== "error" && (
              <div className="sage-preview__placeholder">
                <div className="sage-preview__placeholder-icon">📦</div>
                <span>Enter a supplier ID and fetch products to preview</span>
              </div>
            )}

          {/* Loading */}
          {productsLoading && (
            <div className="sage-loading">
              <div className="sage-loading__spinner" />
              <span>Loading products…</span>
            </div>
          )}

          {/* Product grid */}
          {!productsLoading &&
            !selectedProduct &&
            products.length > 0 &&
            importStatus !== "done" && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <div className="sage-panel__label">Products</div>
                    <div className="sage-count-badge">
                      {pagination.total} products found
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      className="sage-btn sage-btn--primary"
                      onClick={handleImportSelected}
                      disabled={
                        selectedProducts.length === 0 ||
                        importStatus === "importing"
                      }
                    >
                      🚀 Import Selected ({selectedProducts.length})
                    </button>

                    <button
                      className="sage-btn sage-btn--ghost"
                      onClick={handleImport}
                      disabled={
                        !supplierId ||
                        products.length === 0 ||
                        importStatus === "importing"
                      }
                    >
                      🚀 Import All
                    </button>
                  </div>
                </div>

                {pagination.total > 0 && (
                  <div className="sage-count-badge">
                    Showing{" "}
                    <strong>
                      {(pagination.page - 1) * pagination.limit + 1}–
                      {Math.min(
                        pagination.page * pagination.limit,
                        pagination.total,
                      )}
                    </strong>{" "}
                    of <strong>{pagination.total}</strong> products
                    {pagination.total > 100 && (
                      <span style={{ color: "#f59e0b", marginLeft: 6 }}>
                        · Large catalogue — import may take a few minutes
                      </span>
                    )}
                  </div>
                )}

                <div className="sage-preview__grid">
                  {products.map((p) => (
                    <div
                      key={p.prodEId}
                      className={`sage-preview__card ${
                        selectedProducts.includes(p.prodEId)
                          ? "sage-preview__card--selected"
                          : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(p.prodEId)}
                        onChange={() => toggleProduct(p.prodEId)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <img
                        src={p.thumbPic}
                        alt={p.name}
                        onClick={() => handleViewDetail(p)}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://via.placeholder.com/160x120?text=No+Image";
                        }}
                      />
                      <div className="sage-preview__card-info">
                        {p.imported && (
                          <div className="sage-imported-badge">
                            <span className="sage-imported-badge__dot" />
                            Imported
                          </div>
                        )}
                        <div className="sage-preview__card-name">{p.name}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {pagination.totalPages > 1 && (
                  <div className="sage-pagination">
                    <button
                      className="sage-btn sage-btn--ghost"
                      disabled={pagination.page === 1}
                      onClick={() => fetchProducts(pagination.page - 1)}
                    >
                      ← Prev
                    </button>
                    <span className="sage-pagination__info">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                      className="sage-btn sage-btn--ghost"
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() => fetchProducts(pagination.page + 1)}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}

          {/* ── Product detail ── */}
          {selectedProduct && importStatus !== "done" && (
            <div className="sage-detail">
              <button
                className="sage-btn sage-btn--ghost sage-detail__back"
                onClick={() => {
                  setSelectedProduct(null);
                  setProductDetail(null);
                  setActiveImageIndex(0);
                }}
              >
                ← Back to products
              </button>

              {detailLoading ? (
                <div className="sage-loading">
                  <div className="sage-loading__spinner" />
                  <span>Loading product detail…</span>
                </div>
              ) : (
                <div className="sage-detail__body">
                  {/* ── Header row: image gallery + core info ── */}
                  <div className="sage-detail__hero">
                    {/* Gallery */}
                    <div className="sage-detail__gallery">
                      <div className="sage-detail__gallery-main">
                        <img
                          src={
                            productDetail?.pics?.[activeImageIndex]?.url ||
                            selectedProduct?.thumbPic ||
                            "https://via.placeholder.com/280x220?text=No+Image"
                          }
                          alt={productDetail?.prName || productDetail?.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://via.placeholder.com/280x220?text=No+Image";
                          }}
                        />
                        {productDetail?.pics?.[activeImageIndex]?.hasLogo ===
                          1 && (
                          <div className="sage-detail__gallery-logo-badge">
                            With Logo
                          </div>
                        )}
                      </div>
                      {productDetail?.pics?.length > 1 && (
                        <div className="sage-detail__gallery-thumbs">
                          {productDetail.pics.map((pic: any, i: number) => (
                            <img
                              key={pic.index}
                              src={pic.url}
                              alt={pic.caption || `Image ${i + 1}`}
                              className={`sage-detail__gallery-thumb ${
                                activeImageIndex === i
                                  ? "sage-detail__gallery-thumb--active"
                                  : ""
                              }`}
                              onClick={() => setActiveImageIndex(i)}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://via.placeholder.com/56x44?text=–";
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Core info */}
                    <div className="sage-detail__info">
                      {/* Status badges */}
                      <div className="sage-detail__badges">
                        {productDetail?.imported ? (
                          <span className="sage-detail__status-badge sage-detail__status-badge--imported">
                            <span className="sage-detail__status-dot sage-detail__status-dot--green" />
                            Imported
                          </span>
                        ) : (
                          <span className="sage-detail__status-badge sage-detail__status-badge--not-imported">
                            <span className="sage-detail__status-dot sage-detail__status-dot--grey" />
                            Not Imported
                          </span>
                        )}
                        {productDetail?.newProduct === 1 && (
                          <span className="sage-detail__status-badge sage-detail__status-badge--new">
                            New
                          </span>
                        )}
                        {productDetail?.discontinued === 1 && (
                          <span className="sage-detail__status-badge sage-detail__status-badge--discontinued">
                            Discontinued
                          </span>
                        )}
                      </div>

                      <h3 className="sage-detail__name">
                        {productDetail?.prName || productDetail?.name}
                      </h3>

                      <div className="sage-detail__meta-row">
                        {productDetail?.itemNum && (
                          <div className="sage-detail__meta-chip">
                            <span>Item #</span>
                            <strong>{productDetail.itemNum}</strong>
                          </div>
                        )}
                        {productDetail?.lineName && (
                          <div className="sage-detail__meta-chip">
                            <span>Line</span>
                            <strong>{productDetail.lineName}</strong>
                          </div>
                        )}
                        {productDetail?.madeInCountry && (
                          <div className="sage-detail__meta-chip">
                            <span>Made in</span>
                            <strong>{productDetail.madeInCountry}</strong>
                          </div>
                        )}
                        {productDetail?.prodTime && (
                          <div className="sage-detail__meta-chip">
                            <span>Lead time</span>
                            <strong>{productDetail.prodTime}</strong>
                          </div>
                        )}
                      </div>

                      {productDetail?.imported && (
                        <div className="sage-detail__import-info">
                          <div>
                            <span className="sage-detail__import-info-label">
                              Product ID
                            </span>
                            <span className="sage-detail__import-info-val">
                              #{productDetail.importedProductId}
                            </span>
                          </div>
                          <div>
                            <span className="sage-detail__import-info-label">
                              Variants
                            </span>
                            <span className="sage-detail__import-info-val">
                              {productDetail.variantCount}
                            </span>
                          </div>
                        </div>
                      )}

                      {productDetail?.description && (
                        <p className="sage-detail__desc">
                          {productDetail.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Pricing table ── */}
                  {getPricingRows(productDetail).length > 0 && (
                    <div className="sage-detail__section">
                      <div className="sage-detail__section-title">
                        Pricing Tiers
                      </div>
                      <div className="sage-detail__pricing-table">
                        <div className="sage-detail__pricing-head">
                          <span>Qty</span>
                          <span>List Price</span>
                          <span>Net</span>
                        </div>
                        {getPricingRows(productDetail).map(
                          (row: any, i: number) => (
                            <div key={i} className="sage-detail__pricing-row">
                              <span>{Number(row.qty).toLocaleString()}</span>
                              <span className="sage-detail__pricing-price">
                                ${row.price}
                              </span>
                              <span className="sage-detail__pricing-net">
                                ${row.net}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                      {productDetail?.priceIncludes && (
                        <div className="sage-detail__pricing-note">
                          Price includes: {productDetail.priceIncludes}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Color variants ── */}
                  {productDetail?.variants?.length > 0 && (
                    <div className="sage-detail__section">
                      <div className="sage-detail__section-title">
                        Imported Variants ({productDetail.variants.length})
                      </div>
                      <div className="sage-detail__variants-grid">
                        {productDetail.variants.map((variant: any) => (
                          <div
                            key={variant.id}
                            className="sage-detail__variant-card"
                          >
                            <div className="sage-detail__variant-color-row">
                              <span
                                className="sage-detail__variant-swatch"
                                style={{
                                  background: getColorHex(variant.color),
                                }}
                              />
                              <span className="sage-detail__variant-color">
                                {variant.color}
                              </span>
                            </div>
                            <div className="sage-detail__variant-sku">
                              {variant.sku}
                            </div>
                            <div className="sage-detail__variant-stats">
                              <span>
                                Stock:{" "}
                                <strong>
                                  {Number(variant.stock).toLocaleString()}
                                </strong>
                              </span>
                              <span className="sage-detail__variant-price">
                                ${variant.price}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Imprint / decoration info ── */}
                  {(productDetail?.decorationMethod ||
                    productDetail?.imprintArea) && (
                    <div className="sage-detail__section">
                      <div className="sage-detail__section-title">
                        Decoration
                      </div>
                      <div className="sage-detail__deco-grid">
                        {productDetail.decorationMethod && (
                          <div className="sage-detail__deco-item">
                            <span className="sage-detail__deco-label">
                              Methods
                            </span>
                            <span>{productDetail.decorationMethod}</span>
                          </div>
                        )}
                        {productDetail.imprintArea && (
                          <div className="sage-detail__deco-item">
                            <span className="sage-detail__deco-label">
                              Imprint Area
                            </span>
                            <span>{productDetail.imprintArea}</span>
                          </div>
                        )}
                        {productDetail.imprintLoc && (
                          <div className="sage-detail__deco-item">
                            <span className="sage-detail__deco-label">
                              Location
                            </span>
                            <span>{productDetail.imprintLoc}</span>
                          </div>
                        )}
                        {productDetail.setupChg && (
                          <div className="sage-detail__deco-item">
                            <span className="sage-detail__deco-label">
                              Setup Charge
                            </span>
                            <span>${productDetail.setupChg}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Dimensions / packaging ── */}
                  {(productDetail?.dimensions || productDetail?.package) && (
                    <div className="sage-detail__section">
                      <div className="sage-detail__section-title">
                        Packaging & Shipping
                      </div>
                      <div className="sage-detail__deco-grid">
                        {productDetail.dimensions && (
                          <div className="sage-detail__deco-item">
                            <span className="sage-detail__deco-label">
                              Dimensions
                            </span>
                            <span>{productDetail.dimensions}</span>
                          </div>
                        )}
                        {productDetail.package && (
                          <div className="sage-detail__deco-item">
                            <span className="sage-detail__deco-label">
                              Packaging
                            </span>
                            <span>{productDetail.package}</span>
                          </div>
                        )}
                        {productDetail.unitsPerCarton && (
                          <div className="sage-detail__deco-item">
                            <span className="sage-detail__deco-label">
                              Units/Carton
                            </span>
                            <span>{productDetail.unitsPerCarton}</span>
                          </div>
                        )}
                        {productDetail.shipPointZip && (
                          <div className="sage-detail__deco-item">
                            <span className="sage-detail__deco-label">
                              Ships From
                            </span>
                            <span>
                              {productDetail.shipPointZip},{" "}
                              {productDetail.shipPointCountry}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import done – fresh start */}
          {importStatus === "done" && (
            <div className="sage-preview__placeholder">
              <div style={{ fontSize: 56 }}>✅</div>
              <span style={{ fontWeight: 600, color: "#16a34a", fontSize: 16 }}>
                Import complete!
              </span>
              <span>{importMessage}</span>
              <button className="sage-btn sage-btn--ghost" onClick={resetAll}>
                ← Start a new import
              </button>
            </div>
          )}

          {/* Import error */}
          {importStatus === "error" && (
            <div className="sage-preview__placeholder">
              <div style={{ fontSize: 56 }}>❌</div>
              <span style={{ fontWeight: 600, color: "#dc2626", fontSize: 16 }}>
                Import failed
              </span>
              <span>{importMessage}</span>
              <button
                className="sage-btn sage-btn--ghost"
                onClick={() => setImportStatus("idle")}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Best-effort color name → hex for swatches.
 * Falls back to a neutral grey for unknown names.
 */
function getColorHex(colorName: string): string {
  const name = colorName.toLowerCase();
  const map: Record<string, string> = {
    red: "#ef4444",
    "translucent red": "#fca5a5",
    blue: "#3b82f6",
    "translucent blue": "#93c5fd",
    "dark blue": "#1e3a5f",
    "translucent aqua blue": "#67e8f9",
    "translucent lime green": "#a3e635",
    "translucent frost white": "#e0f2fe",
    white: "#f9fafb",
    "translucent frost": "#e0f2fe",
    black: "#111827",
    green: "#22c55e",
    yellow: "#eab308",
    orange: "#f97316",
    purple: "#a855f7",
    pink: "#ec4899",
    brown: "#92400e",
    grey: "#9ca3af",
    gray: "#9ca3af",
    silver: "#d1d5db",
    gold: "#fbbf24",
    teal: "#14b8a6",
    navy: "#1e3a5f",
  };

  // exact match
  if (map[name]) return map[name];

  // partial match
  for (const [key, val] of Object.entries(map)) {
    if (name.includes(key)) return val;
  }

  return "#d1d5db";
}

export default SageImportBySupplierTab;