import React, { useEffect, useState } from "react";
import "./SageImportTab.scss";
import {
  GetAllCategoriesAPI,
  GetSageProductDetailsAPI,
  GetSupplierByCategoryAPI,
  ImportSageProductsAPI,
  SearchSageProductsAPI,
} from "@/services/Api/SageApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = {
  id: number;
  title: string;
};

type Supplier = {
  supplierId: number;
  supplierName: string;
};

type Product = {
  prodEId: number;
  name: string;
  prc: string;
  thumbPic: string;
};

type ProductDetail = Product & {
  description?: string;
  sku?: string;
  brand?: string;
  [key: string]: any;
};

type Step = 1 | 2 | 3 | 4;

// ─── Step Bar ────────────────────────────────────────────────────────────────

const STEPS: { label: string }[] = [
  { label: "Pick a Category" },
  { label: "Choose a Supplier" },
  { label: "Review Product" },
  { label: "Import" },
];

interface StepBarProps {
  current: Step;
}

const StepBar: React.FC<StepBarProps> = ({ current }) => (
  <div className="sage-steps">
    {STEPS.map((s, i) => {
      const num = (i + 1) as Step;
      const isDone = num < current;
      const isActive = num === current;

      return (
        <React.Fragment key={num}>
          <div className="sage-steps__item">
            <div
              className={[
                "sage-steps__circle",
                isDone ? "sage-steps__circle--done" : "",
                isActive ? "sage-steps__circle--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {isDone ? "✓" : num}
            </div>
            <span
              className={[
                "sage-steps__label",
                isDone ? "sage-steps__label--done" : "",
                isActive ? "sage-steps__label--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <span style={{ color: "#d1d5db", margin: "0 4px", fontSize: 16 }}>
              →
            </span>
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Loading Spinner ──────────────────────────────────────────────────────────

const Spinner: React.FC = () => (
  <div className="sage-spinner">
    <div className="sage-spinner__ring" />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const SageImportTab: React.FC = () => {
  const [step, setStep] = useState<Step>(1);

  // Step 1 – category
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );

  // Step 2 – supplier
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );

  // Step 3 – products
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);

  // Step 4 – import
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  // ── Load categories on mount ──
  useEffect(() => {
    GetAllCategoriesAPI().then((res) =>
      setCategories(res?.data?.data?.rows || []),
    );
  }, []);

  // ── Step 1 → 2: pick category ──
  const handleSelectCategory = async (cat: Category) => {
    setSelectedCategory(cat);
    setSelectedSupplier(null);
    setProducts([]);
    setSelectedProduct(null);
    setProductDetail(null);
    setImported(false);
    setSuppliersLoading(true);

    const res = await GetSupplierByCategoryAPI(cat.title);
    setSuppliers(res?.data?.data?.suppliers || []);
    setSuppliersLoading(false);
    setStep(2);
  };

  // ── Step 2 → 3: pick supplier ──
  const handleSelectSupplier = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setProducts([]);
    setSelectedProduct(null);
    setProductDetail(null);
    setImported(false);
    setProductsLoading(true);

    try {
      const res = await SearchSageProductsAPI(
        selectedCategory!.title,
        supplier.supplierId,
        1,
        100,
      );

      const data = res?.data?.data;

      setProducts(data?.products || []);
      setPagination({
        total: data?.pagination?.total || 0,
        page: data?.pagination?.page || 1,
        limit: data?.pagination?.limit || 20,
        totalPages: data?.pagination?.totalPages || 1,
      });
    } catch (err) {
      console.error("Product fetch failed", err);
    } finally {
      setProductsLoading(false);
    }

    setStep(3);
  };

  // ── Step 3: view product detail ──
  const handleViewDetail = async (product: Product) => {
    setSelectedProduct(product);
    setDetailLoading(true);
    setProductDetail(null);

    try {
      const detail = await GetSageProductDetailsAPI(product.prodEId);
      setProductDetail(detail?.data?.data || product);
    } catch (err) {
      setProductDetail(product as ProductDetail);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBackToGrid = () => {
    setSelectedProduct(null);
    setProductDetail(null);
  };

  // ── Step 3 → 4: import ──
  const handleImport = async () => {
    if (!selectedCategory || !selectedSupplier) return;
    setImporting(true);
    setStep(4);

    await ImportSageProductsAPI(
      selectedCategory.title,
      selectedSupplier.supplierId,
    );
    setImporting(false);
    setImported(true);
  };

  // ── Go back ──
  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSelectedSupplier(null);
    } else if (step === 3) {
      setStep(2);
      setSelectedProduct(null);
      setProductDetail(null);
    } else if (step === 4) {
      setStep(3);
      setImported(false);
    }
  };

  const fetchPage = async (page: number) => {
    if (!selectedSupplier || !selectedCategory) return;

    setProductsLoading(true);

    try {
      const res = await SearchSageProductsAPI(
        selectedCategory.title,
        selectedSupplier.supplierId,
        page,
        pagination.limit,
      );

      const data = res?.data?.data;

      setProducts(data?.products || []);
      setPagination(data?.pagination || {});
    } catch (err) {
      console.error("Pagination fetch failed", err);
    } finally {
      setProductsLoading(false);
    }
  };

  // ── Filtered categories ──
  const filteredCategories = categories.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="sage-import-tab">
      {/* Step Bar */}
      <StepBar current={step} />

      {/* Body */}
      <div className="sage-body">
        {/* ── Left Panel ── */}
        <div className="sage-panel">
          {/* Step 1: Category */}
          {(step === 1 || step >= 1) && (
            <>
              <div className="sage-panel__label">Step 1 · Select Category</div>
              <div className="sage-panel__search">
                <span className="sage-panel__search-icon">🔍</span>
                <input
                  placeholder="Search category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={step > 1}
                />
              </div>
              <div className="sage-panel__list">
                {filteredCategories.length === 0 ? (
                  <div className="sage-panel__empty">No categories found</div>
                ) : (
                  filteredCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className={[
                        "sage-panel__list-item",
                        selectedCategory?.id === cat.id
                          ? "sage-panel__list-item--selected"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => step === 1 && handleSelectCategory(cat)}
                    >
                      {cat.title}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Step 2: Supplier */}
          {step >= 2 && (
            <>
              <div className="sage-panel__label" style={{ marginTop: 8 }}>
                Step 2 · Select Supplier
              </div>
              {suppliersLoading ? (
                <Spinner />
              ) : (
                <div className="sage-panel__list">
                  {suppliers.length === 0 ? (
                    <div className="sage-panel__empty">No suppliers found</div>
                  ) : (
                    suppliers.map((s) => (
                      <div
                        key={s.supplierId}
                        className={[
                          "sage-panel__list-item",
                          selectedSupplier?.supplierId === s.supplierId
                            ? "sage-panel__list-item--selected"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => step === 2 && handleSelectSupplier(s)}
                      >
                       {s.supplierName} ({s.supplierId})
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right Preview Panel ── */}
        <div className="sage-preview">
          {/* Placeholder (no selection yet) */}
          {step === 1 && (
            <div className="sage-preview__placeholder">
              <div className="sage-preview__placeholder-icon">📦</div>
              <span>Select a category &amp; supplier to preview products</span>
            </div>
          )}

          {/* Products loading */}
          {step === 3 && productsLoading && <Spinner />}

          {/* Products grid */}
          {step === 3 && !productsLoading && !selectedProduct && (
            <>
              <div className="sage-panel__label">
                Step 3 · Choose a Product to Review
              </div>
              {pagination.total > 0 && (
                <div
                  style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}
                >
                  Showing {(pagination.page - 1) * pagination.limit + 1}
                  {" - "}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )}
                  {" of "}
                  {pagination.total}
                </div>
              )}
              {products.length === 0 ? (
                <div className="sage-preview__placeholder">
                  <div className="sage-preview__placeholder-icon">🔍</div>
                  <span>No products found for this supplier</span>
                </div>
              ) : (
               <div>
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
                        <div className="sage-preview__card-price">{p.prc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {pagination.totalPages > 1 && (
  <div style={{ marginTop: 12, textAlign: "center" }}>
    <button
      className="sage-btn sage-btn--ghost"
      disabled={pagination.page === 1}
      onClick={() => fetchPage(pagination.page - 1)}
    >
      ← Prev
    </button>

    <span style={{ margin: "0 10px", fontSize: 13 }}>
      Page {pagination.page} / {pagination.totalPages}
    </span>

    <button
      className="sage-btn sage-btn--ghost"
      disabled={pagination.page === pagination.totalPages}
      onClick={() => fetchPage(pagination.page + 1)}
    >
      Next →
    </button>
  </div>
)}
               </div>
                
              )}
            </>
          )}

          {/* Product detail */}
          {step === 3 && selectedProduct && (
            <div>
              <button
                className="sage-preview__detail-back"
                onClick={handleBackToGrid}
              >
                ← Back to products
              </button>
              {detailLoading ? (
                <Spinner />
              ) : (
                <div className="sage-preview__detail">
                  <img
                    src={productDetail?.thumbPic || selectedProduct.thumbPic}
                    alt={productDetail?.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://via.placeholder.com/260x240?text=No+Image";
                    }}
                  />
                  <div className="sage-preview__detail-meta">
                    <div className="sage-preview__detail-name">
                      {productDetail?.name}
                    </div>
                    <div className="sage-preview__detail-price">
                      {productDetail?.prc}
                    </div>
                    {productDetail?.sku && (
                      <div className="sage-preview__detail-row">
                        <strong>SKU</strong>
                        <span>{productDetail.sku}</span>
                      </div>
                    )}
                    {productDetail?.brand && (
                      <div className="sage-preview__detail-row">
                        <strong>Brand</strong>
                        <span>{productDetail.brand}</span>
                      </div>
                    )}
                    {productDetail?.description && (
                      <div className="sage-preview__detail-row">
                        <strong>Description</strong>
                        <span>{productDetail.description}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import step */}
          {step === 4 && (
            <div className="sage-preview__placeholder">
              {importing ? (
                <>
                  <Spinner />
                  <span>
                    Importing products from{" "}
                    <strong>{selectedSupplier?.supplierName}</strong>…
                  </span>
                </>
              ) : imported ? (
                <>
                  <div style={{ fontSize: 56 }}>✅</div>
                  <span
                    style={{ fontWeight: 600, color: "#16a34a", fontSize: 16 }}
                  >
                    Import complete!
                  </span>
                  <span>
                    Products from{" "}
                    <strong>{selectedSupplier?.supplierName}</strong> have been
                    imported successfully.
                  </span>
                  <button
                    className="sage-btn sage-btn--ghost"
                    onClick={() => {
                      setStep(1);
                      setSelectedCategory(null);
                      setSelectedSupplier(null);
                      setProducts([]);
                      setSelectedProduct(null);
                      setProductDetail(null);
                      setImported(false);
                    }}
                  >
                    ← Start Over
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="sage-footer">
        <div className="sage-footer__info">
          {selectedCategory && (
            <>
              Category: <strong>{selectedCategory.title}</strong>
            </>
          )}
          {selectedSupplier && (
            <>
              {" · "}Supplier: <strong>{selectedSupplier.supplierName}</strong>
            </>
          )}
          {products.length > 0 && step >= 3 && (
            <>
              {" · "}
              <strong>{pagination.total}</strong> products found
            </>
          )}
        </div>

        <div className="sage-footer__actions">
          {step > 1 && step < 4 && !importing && (
            <button className="sage-btn sage-btn--ghost" onClick={handleBack}>
              ← Back
            </button>
          )}

          {step === 3 && !productsLoading && products.length > 0 && (
            <button
              className="sage-btn sage-btn--primary"
              onClick={handleImport}
              disabled={importing}
            >
              🚀 Import All Products
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SageImportTab;
