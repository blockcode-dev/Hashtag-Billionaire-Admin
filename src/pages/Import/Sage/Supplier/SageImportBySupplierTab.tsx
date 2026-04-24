import React, { useState } from "react";
import {
  GetSageProductDetailsAPI,
  ImportSageProductsAPI,
  SearchSageProductsAPI,
} from "@/services/Api/SageApi";

type ImportStatus = "idle" | "importing" | "done" | "error";

const SageImportBySupplierTab: React.FC = () => {
  const [supplierId, setSupplierId]       = useState<number | "">("");
  const [products, setProducts]           = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDetail, setProductDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [importStatus, setImportStatus]   = useState<ImportStatus>("idle");
  const [importMessage, setImportMessage] = useState("");
  const [supplierName, setSupplierName]   = useState<string>("");

  const [pagination, setPagination] = useState({
    total: 0, page: 1, limit: 100, totalPages: 1,
  });

  const resetAll = () => {
    setSupplierId("");
    setProducts([]);
    setSelectedProduct(null);
    setProductDetail(null);
    setImportStatus("idle");
    setImportMessage("");
    setSupplierName("");
    setPagination({ total: 0, page: 1, limit: 100, totalPages: 1 });
  };

  const fetchProducts = async (page = 1) => {
    if (!supplierId) return;
    setProductsLoading(true);
    try {
      const res = await SearchSageProductsAPI("", Number(supplierId), page, 100);
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
      `Importing products from ${supplierName || `Supplier #${supplierId}`}. This may take a few minutes for large catalogues — please don't close this tab.`
    );
    try {
      await ImportSageProductsAPI("", Number(supplierId));
      setImportStatus("done");
      setImportMessage(`All ${pagination.total || ""} products imported successfully!`);
    } catch {
      setImportStatus("error");
      setImportMessage("Something went wrong during import. Please try again.");
    }
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
            <div className={`sage-step ${products.length > 0 ? "sage-step--active" : ""}`}>
              <span className="sage-step__num">2</span>
              <span className="sage-step__label">Browse Products</span>
            </div>
            <span className="sage-step__arrow">→</span>
            <div className={`sage-step ${importStatus === "done" ? "sage-step--active" : ""}`}>
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
          {!productsLoading && !selectedProduct && products.length === 0 && importStatus !== "done" && importStatus !== "error" && (
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
          {!productsLoading && !selectedProduct && products.length > 0 && importStatus !== "done" && (
            <>
              <div className="sage-panel__label">Products</div>

              {pagination.total > 0 && (
                <div className="sage-count-badge">
                  Showing{" "}
                  <strong>
                    {(pagination.page - 1) * pagination.limit + 1}–
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
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
                    className="sage-preview__card"
                    onClick={() => handleViewDetail(p)}
                  >
                    <img
                      src={p.thumbPic}
                      alt={p.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://via.placeholder.com/160x120?text=No+Image";
                      }}
                    />
                    <div className="sage-preview__card-info">
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

          {/* Product detail */}
          {selectedProduct && importStatus !== "done" && (
            <div className="sage-detail">
              <button
                className="sage-btn sage-btn--ghost sage-detail__back"
                onClick={() => { setSelectedProduct(null); setProductDetail(null); }}
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
                  <h3 className="sage-detail__name">{productDetail?.name}</h3>
                  <p className="sage-detail__desc">{productDetail?.description}</p>
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

      {/* Footer */}
      <div className="sage-footer">
        <div className="sage-footer__info">
          {pagination.total > 0 && importStatus !== "done" && (
            <span>
              <strong>{pagination.total}</strong> products found
              {pagination.total > 100 && (
                <span className="sage-footer__hint">
                  {" "}· Large catalogue — import may take a few minutes
                </span>
              )}
            </span>
          )}
        </div>

        <button
          className="sage-btn sage-btn--primary"
          onClick={handleImport}
          disabled={
            !supplierId ||
            products.length === 0 ||
            importStatus === "importing" ||
            importStatus === "done"
          }
        >
          {importStatus === "importing"
            ? "⏳ Importing…"
            : importStatus === "done"
            ? "✅ Imported"
            : "🚀 Import All Products"}
        </button>
      </div>
    </div>
  );
};

export default SageImportBySupplierTab;