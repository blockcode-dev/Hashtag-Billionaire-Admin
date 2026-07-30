import React, { useEffect, useState } from "react";
import {
  GetAllCategoriesAPI,
  GetSageProductDetailsAPI,
  GetSupplierByCategoryAPI,
  ImportSageProductsAPI,
  ImportSelectedSageProductsAPI,
  SearchSageProductsAPI,
} from "@/services/Api/SageApi";
import "./SageImportCategoryTab.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { id: number; title: string };
type Supplier = { supplierId: number; supplierName: string };
type Product = {
  prodEId: number;
  name: string;
  prc: string | string[];
  thumbPic: string;
  imported?: boolean;
};
type ProductDetail = Product & {
  description?: string;
  sku?: string;
  brand?: string;
  imported?: boolean;
  importedProductId?: number;
  variantCount?: number;
  variants?: {
    id: number;
    sku: string;
    color: string;
    stock: number;
    price: string;
  }[];
  [key: string]: any;
};
type Step = 1 | 2 | 3 | 4;
type ImportStatus = "idle" | "importing" | "done" | "error";

// ─── Step Bar ─────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Pick a Category" },
  { label: "Choose a Supplier" },
  { label: "Review Products" },
  { label: "Import Complete" },
];

const StepBar: React.FC<{ current: Step }> = ({ current }) => (
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
              {isDone ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                num
              )}
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
            <div className="sage-steps__connector">
              <div className={`sage-steps__line ${isDone ? "sage-steps__line--done" : ""}`} />
            </div>
          )}
        </React.Fragment>
      );
    })}
  </div>
);

const SuccessBanner = ({ supplierName, hasNext, onNext, onDismiss }: any) => (
  <div className="sage-success-banner">
    <div className="sage-success-banner__left">
      <div className="sage-success-banner__icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <div>
        <div className="sage-success-banner__title">Import Queue Initialized</div>
        <div className="sage-success-banner__text">
          Successfully triggered catalog batch synchronization for{" "}
          <strong>{supplierName}</strong>.
        </div>
      </div>
    </div>
    <div className="sage-success-banner__actions">
      {hasNext && (
        <button className="sage-btn sage-btn--primary sage-btn--sm" onClick={onNext}>
          Next Supplier
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 6 }}>
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      )}
      <button className="sage-btn sage-btn--secondary sage-btn--sm" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  </div>
);

const Spinner: React.FC = () => (
  <div className="sage-spinner-container">
    <div className="sage-spinner" />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const SageImportTab: React.FC = () => {
  const [step, setStep] = useState<Step>(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  const filteredSuppliers = suppliers.filter((s) =>
    `${s.supplierName} ${s.supplierId}`.toLowerCase().includes(supplierSearch.toLowerCase())
  );

const getLowestPrice = (
  price: string | string[],
) => {
  if (!price) return "—";

  if (Array.isArray(price)) {
    const values = price
      .map(Number)
      .filter((n) => !isNaN(n));

    if (!values.length) return "—";

    return `$${Math.min(...values).toFixed(2)}`;
  }

  const matches =
    String(price).match(
      /\d+(\.\d+)?/g,
    );

  if (!matches?.length)
    return String(price);

  return `$${Math.min(
    ...matches.map(Number),
  ).toFixed(2)}`;
};

  const toggleProduct = (prodEId: number) => {
    setSelectedProducts((prev) =>
      prev.includes(prodEId) ? prev.filter((id) => id !== prodEId) : [...prev, prodEId]
    );
  };

  const toggleAllPageProducts = () => {
    const pageIds = products.map((p) => p.prodEId);
    const allSelected = pageIds.every((id) => selectedProducts.includes(id));
    if (allSelected) {
      setSelectedProducts((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedProducts((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const handleImportSelected = async () => {
    if (!selectedProducts.length) return;
    setImportStatus("importing");
    try {
      await ImportSelectedSageProductsAPI(selectedProducts, "Manual selected import");
      setImportStatus("idle");
      setStep(3);
      setSelectedProducts([]);
      setShowSuccessBanner(true);
    } catch {
      setImportStatus("error");
    }
  };

  useEffect(() => {
    GetAllCategoriesAPI().then((res) => setCategories(res?.data?.data?.rows || []));
  }, []);

  const handleSelectCategory = async (cat: Category) => {
    setSelectedCategory(cat);
    setSelectedSupplier(null);
    setProducts([]);
    setSelectedProduct(null);
    setProductDetail(null);
    setImportStatus("idle");
    setSuppliersLoading(true);
    setSupplierSearch("");
    setShowSuccessBanner(false);
    const res = await GetSupplierByCategoryAPI(cat.title);
    setSuppliers(res?.data?.data?.suppliers || []);
    setSuppliersLoading(false);
    setStep(2);
  };

  const handleSelectSupplier = async (supplier: Supplier) => {
    setSelectedProducts([]);
    setSelectedSupplier(supplier);
    setProducts([]);
    setSelectedProduct(null);
    setProductDetail(null);
    setImportStatus("idle");
    setProductsLoading(true);
    try {
      const res = await SearchSageProductsAPI(selectedCategory!.title, supplier.supplierId, 1, 100);
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

  const handleViewDetail = async (product: Product) => {
    setSelectedProduct(product);
    setDetailLoading(true);
    setProductDetail(null);
    try {
      const detail = await GetSageProductDetailsAPI(product.prodEId);
      setProductDetail(detail?.data?.data || product);
    } catch {
      setProductDetail(product as ProductDetail);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedCategory || !selectedSupplier) return;
    setImportStatus("importing");
    try {
      await ImportSageProductsAPI(selectedCategory.title, selectedSupplier.supplierId);
      setSelectedProducts([]);
      setImportStatus("idle");
      setStep(3);
      setShowSuccessBanner(true);
    } catch {
      setImportStatus("error");
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
        pagination.limit
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

  const currentSupplierIndex = suppliers.findIndex(
    (s) => s.supplierId === selectedSupplier?.supplierId
  );

  const handleNextSupplier = () => {
    const nextSupplier = suppliers[currentSupplierIndex + 1];
    if (!nextSupplier) return;
    setShowSuccessBanner(false);
    setSupplierSearch("");
    setSelectedProducts([]);
    handleSelectSupplier(nextSupplier);
  };

  const filteredCategories = categories.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const isAllPageSelected =
    products.length > 0 &&
    products.map((p) => p.prodEId).every((id) => selectedProducts.includes(id));

  return (
    <div className="sage-import-tab">
      {/* Import Overlay */}
      {importStatus === "importing" && (
        <div className="sage-import-overlay">
          <div className="sage-import-overlay__card">
            <div className="sage-spinner layout-center" />
            <h3 className="sage-import-overlay__title">Processing Data Import</h3>
            <p className="sage-import-overlay__msg">
              Mapping and caching <strong>{pagination.total || "all"}</strong> entries from{" "}
              <strong>{selectedSupplier?.supplierName}</strong> into the database backend.
            </p>
            <div className="sage-import-overlay__bar">
              <div className="sage-import-overlay__bar-fill" />
            </div>
            <p className="sage-import-overlay__hint">
              Do not modify fields, refresh, or close your session until this completes.
            </p>
          </div>
        </div>
      )}

      <StepBar current={step} />

      <div className="sage-body">
        {/* Left Panel */}
        <div className="sage-panel">
          <div className="sage-panel__section">
            <div className="sage-panel__label">Step 1 · Category Scope</div>
            <div className="sage-panel__search">
              <span className="sage-panel__search-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <input
                placeholder="Filter categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                      selectedCategory?.id === cat.id ? "sage-panel__list-item--selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleSelectCategory(cat)}
                  >
                    <span>{cat.title}</span>
                    {selectedCategory?.id === cat.id && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {step >= 2 && (
            <div className="sage-panel__section animated-fade-in">
              <div className="sage-panel__label">Step 2 · Source Supplier</div>
              <div className="sage-panel__search">
                <span className="sage-panel__search-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </span>
                <input
                  placeholder="Filter suppliers..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                />
              </div>
              {suppliersLoading ? (
                <Spinner />
              ) : (
                <div className="sage-panel__list">
                  {suppliers.length === 0 ? (
                    <div className="sage-panel__empty">No suppliers match scope</div>
                  ) : (
                    filteredSuppliers.map((s) => (
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
                        onClick={() => handleSelectSupplier(s)}
                      >
                        <div className="sage-panel__list-item-main">
                          <span className="sage-title-txt">{s.supplierName}</span>
                          <span className="sage-sub-id">ID: {s.supplierId}</span>
                        </div>
                        {selectedSupplier?.supplierId === s.supplierId && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Preview Panel */}
        <div className="sage-preview">
          {showSuccessBanner && (
            <SuccessBanner
              supplierName={selectedSupplier?.supplierName}
              hasNext={currentSupplierIndex < suppliers.length - 1}
              onNext={handleNextSupplier}
              onDismiss={() => setShowSuccessBanner(false)}
            />
          )}

          {step === 1 && (
            <div className="sage-preview__placeholder">
              <div className="sage-preview__placeholder-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>
              <div className="sage-preview__placeholder-title">Awaiting Scope Definition</div>
              <p>Select a category from the left panel to begin.</p>
            </div>
          )}

          {step === 2 && (
            <div className="sage-preview__placeholder">
              <div className="sage-preview__placeholder-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div className="sage-preview__placeholder-title">Select a Supplier</div>
              <p>Choose a supplier from the left panel to load their product catalog.</p>
            </div>
          )}

          {step === 3 && productsLoading && <Spinner />}

          {/* Product Grid */}
          {step === 3 && !productsLoading && !selectedProduct && (
            <div className="sage-workbench animated-fade-in">
              <div className="sage-review-header">
                <div>
                  <h2 className="sage-review-header__title">Review Source Catalog</h2>
                  {pagination.total > 0 && (
                    <div className="sage-review-header__meta">
                      Showing {(pagination.page - 1) * pagination.limit + 1}–
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                      <strong>{pagination.total}</strong> products
                      {pagination.total > 100 && (
                        <span className="sage-badge-warning">High Density Batch</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="sage-review-header__actions">
                  <button className="sage-btn sage-btn--secondary" onClick={handleImport}>
                    Sync Complete Catalog
                  </button>
                  <button
                    className="sage-btn sage-btn--primary"
                    onClick={handleImportSelected}
                    disabled={selectedProducts.length === 0}
                  >
                    Import Selected ({selectedProducts.length})
                  </button>
                </div>
              </div>

              {products.length === 0 ? (
                <div className="sage-preview__placeholder">
                  <div className="sage-preview__placeholder-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                  <div className="sage-preview__placeholder-title">No Products Found</div>
                  <p>This supplier has no products in this category.</p>
                </div>
              ) : (
                <>
                  <div className="sage-table-controls">
                    <label className="sage-checkbox-label">
                      <input
                        type="checkbox"
                        className="sage-custom-checkbox"
                        checked={isAllPageSelected}
                        onChange={toggleAllPageProducts}
                      />
                      <span>Select all on this page</span>
                    </label>
                  </div>

                  <div className="sage-preview__grid">
                    {products.map((p) => {
                      const isChecked = selectedProducts.includes(p.prodEId);
                      return (
                        <div
                          key={p.prodEId}
                          className={`sage-preview__card ${isChecked ? "sage-preview__card--selected" : ""}`}
                          onClick={() => handleViewDetail(p)}
                        >
                          <div
                            className="sage-preview__card-checkbox"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="sage-custom-checkbox"
                              checked={isChecked}
                              onChange={() => toggleProduct(p.prodEId)}
                            />
                          </div>

                          {/* ── Imported badge on card ── */}
                          {p.imported && (
                            <div className="sage-card-imported-badge">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              Imported
                            </div>
                          )}

                          <div className="sage-preview__card-img-container">
                            <img
                              src={p.thumbPic}
                              alt={p.name}
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=160&h=120&fit=crop&auto=format&q=60";
                              }}
                            />
                          </div>
                          <div className="sage-preview__card-info">
                            <div className="sage-preview__card-name" title={p.name}>
                              {p.name}
                            </div>
                            <div className="sage-preview__card-footer">
                              <span className="sage-preview__card-price">
                                {getLowestPrice(p.prc)}
                              </span>
                              <span className="sage-preview__card-id">#{p.prodEId}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {pagination.totalPages > 1 && (
                    <div className="sage-pagination">
                      <button
                        className="sage-btn sage-btn--secondary sage-btn--sm"
                        disabled={pagination.page === 1}
                        onClick={() => fetchPage(pagination.page - 1)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                          <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        Previous
                      </button>
                      <span className="sage-pagination__info">
                        Page <strong>{pagination.page}</strong> of {pagination.totalPages}
                      </span>
                      <button
                        className="sage-btn sage-btn--secondary sage-btn--sm"
                        disabled={pagination.page === pagination.totalPages}
                        onClick={() => fetchPage(pagination.page + 1)}
                      >
                        Next
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4 }}>
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Product Detail View ── */}
          {step === 3 && selectedProduct && (
            <div className="sage-detail-view animated-fade-in">
              <button
                className="sage-detail-view__back-btn"
                onClick={() => {
                  setSelectedProduct(null);
                  setProductDetail(null);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Back to Products
              </button>

              {detailLoading ? (
                <Spinner />
              ) : (
                <div className="sage-detail-view__body">
                  {/* Left: Image */}
                  <div className="sage-detail-view__image-panel">
                    <img
                      src={productDetail?.thumbPic || selectedProduct.thumbPic}
                      alt={productDetail?.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=300&h=300&fit=crop";
                      }}
                    />
                    {/* Imported status pill inside image panel */}
                    <div className={`sage-detail-import-status ${productDetail?.imported ? "sage-detail-import-status--yes" : "sage-detail-import-status--no"}`}>
                      {productDetail?.imported ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Imported
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                          </svg>
                          Not Imported
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Content */}
                  <div className="sage-detail-view__content-panel">
                    <h1 className="sage-detail-view__name">
                      {productDetail?.name}
                    </h1>

                    {/* Price + ID row */}
                    <div className="sage-detail-view__top-row">
                      <span className="sage-detail-view__price-badge">
                        {getLowestPrice(productDetail?.prc || "")}
                      </span>
                      <span className="sage-detail-view__prod-id">
                        Product #{productDetail?.prodEId || selectedProduct.prodEId}
                      </span>
                    </div>

                    {/* Key-value meta grid */}
                    <div className="sage-detail-view__meta-list">
                      {productDetail?.imported && productDetail?.importedProductId && (
                        <div className="sage-detail-view__meta-item">
                          <span className="label">Imported Product ID</span>
                          <span className="value value--mono">{productDetail.importedProductId}</span>
                        </div>
                      )}

                      {productDetail?.imported && productDetail?.variantCount !== undefined && (
                        <div className="sage-detail-view__meta-item">
                          <span className="label">Variant Count</span>
                          <span className="value">
                            <span className="value--count">{productDetail.variantCount}</span>
                          </span>
                        </div>
                      )}

                      {productDetail?.sku && (
                        <div className="sage-detail-view__meta-item">
                          <span className="label">SKU</span>
                          <span className="value value--mono">{productDetail.sku}</span>
                        </div>
                      )}

                      {productDetail?.brand && (
                        <div className="sage-detail-view__meta-item">
                          <span className="label">Brand</span>
                          <span className="value">{productDetail.brand}</span>
                        </div>
                      )}

                      {productDetail?.description && (
                        <div className="sage-detail-view__meta-item full-width">
                          <span className="label">Description</span>
                          <p className="value value--desc">{productDetail.description}</p>
                        </div>
                      )}
                    </div>

                    {/* Variants */}
                    {productDetail?.variants?.length > 0 && (
                      <div className="sage-detail-variants">
                        <div className="sage-detail-variants__header">
                          <span className="sage-detail-variants__title">
                            Variants
                          </span>
                          <span className="sage-detail-variants__count">
                            {productDetail.variants.length}
                          </span>
                        </div>
                        <div className="sage-detail-variants__grid">
                          {productDetail.variants.map((variant) => (
                            <div key={variant.id} className="sage-variant-card">
                              <div className="sage-variant-card__color-row">
                                <div
                                  className="sage-variant-card__swatch"
                                  style={{ background: variant.color?.toLowerCase() || "#ccc" }}
                                  title={variant.color}
                                />
                                <span className="sage-variant-card__color-name">
                                  {variant.color}
                                </span>
                              </div>
                              <div className="sage-variant-card__meta">
                                <div className="sage-variant-card__row">
                                  <span className="sage-variant-card__label">SKU</span>
                                  <span className="sage-variant-card__val sage-variant-card__val--mono">
                                    {variant.sku}
                                  </span>
                                </div>
                                <div className="sage-variant-card__row">
                                  <span className="sage-variant-card__label">Stock</span>
                                  <span className={`sage-variant-card__val ${variant.stock > 0 ? "sage-variant-card__val--in-stock" : "sage-variant-card__val--out"}`}>
                                    {variant.stock > 0 ? variant.stock : "Out of stock"}
                                  </span>
                                </div>
                                <div className="sage-variant-card__row">
                                  <span className="sage-variant-card__label">Price</span>
                                  <span className="sage-variant-card__val sage-variant-card__val--price">
                                    ${variant.price}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && importStatus === "error" && (
            <div className="sage-preview__placeholder error-state">
              <div className="sage-preview__placeholder-icon text-error">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <div className="sage-preview__placeholder-title">Synchronization Failed</div>
              <p>The API rejected the request. Please try again.</p>
              <button
                className="sage-btn sage-btn--secondary sage-btn--sm"
                onClick={() => { setStep(3); setImportStatus("idle"); }}
              >
                Go Back
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sage-footer">
        <div className="sage-footer__info">
          {selectedCategory ? (
            <span className="sage-footer__tag">
              Category: <strong>{selectedCategory.title}</strong>
            </span>
          ) : (
            <span className="sage-footer__tag muted">No category selected</span>
          )}
          {selectedSupplier && (
            <span className="sage-footer__tag">
              Supplier: <strong>{selectedSupplier.supplierName}</strong>
            </span>
          )}
          {products.length > 0 && step >= 3 && (
            <span className="sage-footer__tag success">
              Products: <strong>{pagination.total}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SageImportTab;