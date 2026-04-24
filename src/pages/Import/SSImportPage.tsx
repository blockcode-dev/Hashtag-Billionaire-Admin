import {
  GetAllBrandsAPI,
  GetProductByStyleAPI,
  GetStylesByBrandAPI,
  ImportSSProductAPI,
} from "@/services/Api/ImportApi";
import React, { useEffect, useRef, useState } from "react";
import SageImportTab from "./Sage/SageImportTab";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Brand = { id: number; name: string };
type Style = { style_id: string; style_name: string };
type Variant = {
  sku: string;
  variant_name: string;
  stock: number;
  pricing: { piece: number; sale: number; retail: number };
};

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────
type ToastType = "success" | "error" | "info" | "loading";
type Toast = { id: number; message: string; type: ToastType };

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const show = (message: string, type: ToastType = "info", duration = 3500) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (type !== "loading") {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
    }
    return id;
  };

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, show, dismiss };
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "success") return <span style={{ fontSize: 16 }}>✅</span>;
  if (type === "error") return <span style={{ fontSize: 16 }}>❌</span>;
  if (type === "loading")
    return (
      <span
        style={{
          display: "inline-block",
          width: 16,
          height: 16,
          border: "2px solid #fff",
          borderTop: "2px solid transparent",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }}
      />
    );
  return <span style={{ fontSize: 16 }}>ℹ️</span>;
}

function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: number) => void;
}) {
  const colors: Record<ToastType, string> = {
    success: "#16a34a",
    error: "#dc2626",
    info: "#2563eb",
    loading: "#7c3aed",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          style={{
            background: colors[t.type],
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            maxWidth: 340,
            animation: "slideIn 0.25s ease",
          }}
        >
          <ToastIcon type={t.type} />
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
// Coming Soon Placeholder
// ─────────────────────────────────────────────
function ComingSoon({ name }: { name: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 20px",
        gap: 16,
        color: "#94a3b8",
      }}
    >
      <div style={{ fontSize: 56 }}>🚧</div>
      <h3
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#475569",
          margin: 0,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {name} — Coming Soon
      </h3>
      <p style={{ fontSize: 14, margin: 0, textAlign: "center", maxWidth: 340 }}>
        We're working on integrating the <strong>{name}</strong> supplier. Check
        back soon!
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step Badge
// ─────────────────────────────────────────────
function StepBadge({
  number,
  label,
  done,
  active,
}: {
  number: number;
  label: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: active || done ? 1 : 0.4,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: done ? "#16a34a" : active ? "#2563eb" : "#e2e8f0",
          color: done || active ? "#fff" : "#64748b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
          transition: "background 0.3s",
        }}
      >
        {done ? "✓" : number}
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: active ? 600 : 400,
          color: active ? "#1e3a5f" : "#64748b",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// S&S Activewear Tab Content
// ─────────────────────────────────────────────
function SSActivewearTab() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [styles, setStyles] = useState<Style[]>([]);
  const [styleSearch, setStyleSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingStyles, setLoadingStyles] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [importing, setImporting] = useState(false);
  const { toasts, show, dismiss } = useToast();

  // Fetch brands on mount
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const res = await GetAllBrandsAPI();
        setBrands(res.data.data);
      } catch {
        show("Failed to load brands", "error");
      } finally {
        setLoadingBrands(false);
      }
    };
    fetchBrands();
  }, []);

  // Brand change → fetch styles
  const handleBrandChange = async (brand: string) => {
    setSelectedBrand(brand);
    setProduct(null);
    setSelectedStyle("");
    setStyles([]);
    setStyleSearch("");
    if (!brand) return;
    setLoadingStyles(true);
    try {
      const res = await GetStylesByBrandAPI(brand);
      const fetched = res.data.data?.data || [];
      setStyles(fetched);
      show(`Loaded ${fetched.length} styles for ${brand}`, "success");
    } catch {
      show("Failed to load styles for this brand", "error");
    } finally {
      setLoadingStyles(false);
    }
  };

  // Style click → fetch product details
  const handleStyleClick = async (styleId: string) => {
    setSelectedStyle(styleId);
    setLoadingProduct(true);
    setProduct(null);
    try {
      const res = await GetProductByStyleAPI(styleId);
      setProduct(res.data.data);
      show("Product details loaded", "success");
    } catch {
      show("Failed to fetch product details", "error");
    } finally {
      setLoadingProduct(false);
    }
  };

  // Import
  const handleImport = async () => {
    if (!selectedStyle) return;
    setImporting(true);
    const toastId = show("Importing product…", "loading");
    try {
      await ImportSSProductAPI(selectedStyle);
      dismiss(toastId);
      show("Product imported successfully!", "success");
    } catch {
      dismiss(toastId);
      show("Import failed. Please try again.", "error");
    } finally {
      setImporting(false);
    }
  };

  const step1Done = !!selectedBrand;
  const step2Done = !!selectedStyle;
  const step3Done = !!product;

  const filteredStyles = styles.filter(
    (s) =>
      s.style_name.toLowerCase().includes(styleSearch.toLowerCase()) ||
      s.style_id.toLowerCase().includes(styleSearch.toLowerCase())
  );

  const totalStock =
    product?.variants?.reduce((sum: number, v: Variant) => sum + v.stock, 0) ?? 0;

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* ── Progress Tracker ── */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "16px 24px",
          display: "flex",
          gap: 32,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        <StepBadge number={1} label="Pick a Brand" done={step1Done} active={!step1Done} />
        <div style={{ color: "#cbd5e1", alignSelf: "center" }}>→</div>
        <StepBadge number={2} label="Choose a Style" done={step2Done} active={step1Done && !step2Done} />
        <div style={{ color: "#cbd5e1", alignSelf: "center" }}>→</div>
        <StepBadge number={3} label="Review Product" done={step3Done} active={step2Done && !step3Done} />
        <div style={{ color: "#cbd5e1", alignSelf: "center" }}>→</div>
        <StepBadge number={4} label="Import" done={false} active={step3Done} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24 }}>
        {/* ── LEFT PANEL ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Brand selector */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#64748b",
                marginBottom: 6,
              }}
            >
              Step 1 · Select Brand
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => handleBrandChange(e.target.value)}
              disabled={loadingBrands}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1.5px solid #e2e8f0",
                fontSize: 14,
                background: "#fff",
                color: selectedBrand ? "#0f172a" : "#94a3b8",
                cursor: "pointer",
                outline: "none",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <option value="">
                {loadingBrands ? "Loading brands…" : "Choose a brand…"}
              </option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Style list */}
          {selectedBrand && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Step 2 · Select Style{" "}
                {styles.length > 0 && (
                  <span style={{ color: "#2563eb" }}>({styles.length})</span>
                )}
              </label>

              {loadingStyles ? (
                <div
                  style={{
                    padding: 20,
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: 13,
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 8,
                  }}
                >
                  ⏳ Loading styles…
                </div>
              ) : styles.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: 13,
                    border: "1.5px dashed #e2e8f0",
                    borderRadius: 8,
                  }}
                >
                  No styles found
                </div>
              ) : (
                <>
                  <input
                    placeholder="Search styles…"
                    value={styleSearch}
                    onChange={(e) => setStyleSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #e2e8f0",
                      fontSize: 13,
                      marginBottom: 8,
                      outline: "none",
                      fontFamily: "'DM Sans', sans-serif",
                      boxSizing: "border-box",
                    }}
                  />
                  <div
                    style={{
                      maxHeight: 300,
                      overflowY: "auto",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: 8,
                      background: "#fff",
                    }}
                  >
                    {filteredStyles.map((s, i) => (
                      <div
                        key={s.style_id}
                        onClick={() => handleStyleClick(s.style_id)}
                        style={{
                          padding: "10px 14px",
                          cursor: "pointer",
                          background:
                            selectedStyle === s.style_id ? "#eff6ff" : "transparent",
                          borderLeft:
                            selectedStyle === s.style_id
                              ? "3px solid #2563eb"
                              : "3px solid transparent",
                          borderBottom:
                            i < filteredStyles.length - 1
                              ? "1px solid #f1f5f9"
                              : "none",
                          transition: "background 0.15s",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color:
                              selectedStyle === s.style_id ? "#1d4ed8" : "#1e293b",
                          }}
                        >
                          {s.style_name}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          ID: {s.style_id}
                        </div>
                      </div>
                    ))}
                    {filteredStyles.length === 0 && (
                      <div
                        style={{
                          padding: 16,
                          textAlign: "center",
                          color: "#94a3b8",
                          fontSize: 13,
                        }}
                      >
                        No matches found
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div>
          {!selectedStyle && !loadingProduct && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 320,
                background: "#f8fafc",
                borderRadius: 12,
                border: "2px dashed #e2e8f0",
                color: "#94a3b8",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 40 }}>📦</div>
              <p style={{ margin: 0, fontSize: 14 }}>
                Select a brand & style to preview the product
              </p>
            </div>
          )}

          {loadingProduct && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 320,
                gap: 14,
                color: "#64748b",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  border: "3px solid #e2e8f0",
                  borderTop: "3px solid #2563eb",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <p style={{ margin: 0, fontSize: 14 }}>Fetching product details…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {product && !loadingProduct && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Product header */}
              <div
                style={{
                  background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
                  borderRadius: 12,
                  padding: "20px 24px",
                  color: "#fff",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, letterSpacing: "0.08em" }}>
                  STEP 3 · PRODUCT PREVIEW
                </div>
                <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
                  {product.product?.name}
                </h3>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  Style ID: <strong>{selectedStyle}</strong> &nbsp;·&nbsp; Brand:{" "}
                  <strong>{selectedBrand}</strong>
                </div>
                {/* Stats row */}
                <div
                  style={{
                    display: "flex",
                    gap: 24,
                    marginTop: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>
                      {product.variants?.length ?? 0}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Variants</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{totalStock}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Total Stock</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>
                      $
                      {Math.min(
                        ...product.variants.map((v: Variant) => v.pricing?.piece ?? 0)
                      ).toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Min Price</div>
                  </div>
                </div>
              </div>

              {/* Variants table */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: "1.5px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid #f1f5f9",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}
                  >
                    Variants
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      background: "#eff6ff",
                      color: "#2563eb",
                      padding: "2px 10px",
                      borderRadius: 20,
                      fontWeight: 600,
                    }}
                  >
                    {product.variants?.length} items
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["SKU", "Variant", "Stock", "Piece $", "Sale $", "Retail $"].map(
                          (h) => (
                            <th
                              key={h}
                              style={{
                                padding: "10px 16px",
                                textAlign: "left",
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: "#64748b",
                                borderBottom: "1px solid #e2e8f0",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {product.variants.map((v: Variant, i: number) => (
                        <tr
                          key={v.sku}
                          style={{
                            background: i % 2 === 0 ? "#fff" : "#fafafa",
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 16px",
                              fontFamily: "monospace",
                              fontSize: 12,
                              color: "#475569",
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            {v.sku}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              fontWeight: 600,
                              color: "#1e293b",
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            {v.variant_name}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            <span
                              style={{
                                background:
                                  v.stock > 10
                                    ? "#dcfce7"
                                    : v.stock > 0
                                    ? "#fef9c3"
                                    : "#fee2e2",
                                color:
                                  v.stock > 10
                                    ? "#16a34a"
                                    : v.stock > 0
                                    ? "#b45309"
                                    : "#dc2626",
                                padding: "2px 8px",
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {v.stock}
                            </span>
                          </td>
                          {["piece", "sale", "retail"].map((key) => (
                            <td
                              key={key}
                              style={{
                                padding: "10px 16px",
                                color: "#475569",
                                borderBottom: "1px solid #f1f5f9",
                              }}
                            >
                              $
                              {(
                                v.pricing?.[key as keyof typeof v.pricing] ?? 0
                              ).toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import button */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  style={{
                    background: importing
                      ? "#94a3b8"
                      : "linear-gradient(135deg, #1e3a5f, #2563eb)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 28px",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: importing ? "not-allowed" : "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: importing ? "none" : "0 4px 14px rgba(37,99,235,0.4)",
                    transition: "all 0.2s",
                  }}
                >
                  {importing ? (
                    <>
                      <span
                        style={{
                          display: "inline-block",
                          width: 16,
                          height: 16,
                          border: "2px solid #fff",
                          borderTop: "2px solid transparent",
                          borderRadius: "50%",
                          animation: "spin 0.7s linear infinite",
                        }}
                      />
                      Importing…
                    </>
                  ) : (
                    <>🚀 Import Product</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Tabs config
// ─────────────────────────────────────────────
const TABS = [
  { key: "ss", label: "S&S Activewear", emoji: "👕" },
  { key: "sage", label: "Sage",  },
  { key: "sanmar", label: "SanMar", },
  { key: "autocar", label: "AutoCat", },
];

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
const SSImportPage = () => {
  const [activeTab, setActiveTab] = useState("ss");

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: "32px 24px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        select:focus, input:focus { outline: 2px solid #2563eb !important; outline-offset: 1px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 28, maxWidth: 1100, marginInline: "auto" }}>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Supplier Integration
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          Product Import Center
        </h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
          Browse supplier catalogues, preview products, and import them into your store.
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          maxWidth: 1100,
          marginInline: "auto",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          overflow: "hidden",
        }}
      >
        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1.5px solid #e2e8f0",
            background: "#f8fafc",
            overflowX: "auto",
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "14px 24px",
                  border: "none",
                  background: "transparent",
                  borderBottom: isActive ? "2.5px solid #2563eb" : "2.5px solid transparent",
                  color: isActive ? "#2563eb" : "#64748b",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                  transition: "color 0.2s, border-color 0.2s",
                  marginBottom: -1,
                }}
              >
                <span>{tab.emoji}</span>
                {tab.label}
                {/* {tab.key === "ss" && (
                  <span
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 20,
                      marginLeft: 2,
                    }}
                  >
                    LIVE
                  </span>
                )} */}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ padding: 28 }}>
          {activeTab === "ss" && <SSActivewearTab />}
          {activeTab === "sage" && <SageImportTab />}
          {activeTab === "sanmar" && <ComingSoon name="SanMar" />}
          {activeTab === "autocat" && <ComingSoon name="AutoCat" />}
        </div>
      </div>
    </div>
  );
};

export default SSImportPage;