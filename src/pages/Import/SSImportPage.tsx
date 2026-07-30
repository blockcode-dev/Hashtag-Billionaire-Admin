import {
  GetAllBrandsAPI,
  GetProductByStyleAPI,
  GetStylesByBrandAPI,
  ImportSSProductAPI,
} from "@/services/Api/ImportApi";
import React, { useEffect, useRef, useState } from "react";
import SageTabWrapper from "./Sage/SageTabWrapper";
import SanmarTab from "./Sanmar/SanmarTab";
import OttoCapTab from "./OttoCap/OttoCapTab";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Brand = { id: number; name: string };
type Style = { style_id: string; style_name: string };
type Variant = {
  sku: string;
  variant_name: string;
  stock: number;
  pricing: { case?: number; piece: number; sale: number; retail: number };
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
    if (type !== "loading")
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        duration,
      );
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
      <p
        style={{ fontSize: 14, margin: 0, textAlign: "center", maxWidth: 340 }}
      >
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
// Shared: Searchable List Panel
// ─────────────────────────────────────────────
function SearchableList({
  label,
  items,
  selectedId,
  getKey,
  getLabel,
  getSubLabel,
  onSelect,
  loading,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  emptyText,
}: {
  label: string;
  items: any[];
  selectedId: string;
  getKey: (item: any) => string;
  getLabel: (item: any) => string;
  getSubLabel?: (item: any) => string;
  onSelect: (item: any) => void;
  loading?: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  emptyText: string;
}) {
  return (
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
        {label}
        {items.length > 0 && (
          <span style={{ color: "#2563eb", marginLeft: 4 }}>
            ({items.length})
          </span>
        )}
      </label>

      {/* Search input */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <span
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          🔍
        </span>
        <input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px 8px 30px",
            borderRadius: 8,
            border: "1.5px solid #e2e8f0",
            fontSize: 13,
            outline: "none",
            fontFamily: "'DM Sans', sans-serif",
            boxSizing: "border-box",
          }}
        />
      </div>

      {loading ? (
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
          ⏳ Loading…
        </div>
      ) : items.length === 0 ? (
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
          {emptyText}
        </div>
      ) : (
        <div
          style={{
            maxHeight: 280,
            overflowY: "auto",
            border: "1.5px solid #e2e8f0",
            borderRadius: 8,
            background: "#fff",
          }}
        >
          {items.map((item, i) => {
            const key = getKey(item);
            const isSelected = selectedId === key;
            return (
              <div
                key={key}
                onClick={() => onSelect(item)}
                style={{
                  padding: "10px 14px",
                  cursor: "pointer",
                  background: isSelected ? "#eff6ff" : "transparent",
                  borderLeft: isSelected
                    ? "3px solid #2563eb"
                    : "3px solid transparent",
                  borderBottom:
                    i < items.length - 1 ? "1px solid #f1f5f9" : "none",
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isSelected ? "#1d4ed8" : "#1e293b",
                  }}
                >
                  {getLabel(item)}
                </div>
                {getSubLabel && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                    {getSubLabel(item)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sticky Top Action Bar
// ─────────────────────────────────────────────
function StickyActionBar({
  product,
  selectedStyle,
  selectedBrand,
  importing,
  currentIndex,
  totalStyles,
  onImport,
  onPrev,
  onNext,
}: {
  product: any;
  selectedStyle: string;
  selectedBrand: string;
  importing: boolean;
  currentIndex: number;
  totalStyles: number;
  onImport: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (!product) return null;
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
        borderRadius: 12,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 20,
        boxShadow: "0 4px 24px rgba(15,23,42,0.25)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          style={{
            fontSize: 11,
            color: "#94a3b8",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Ready to import
        </span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 260,
          }}
        >
          {product.product?.name ?? selectedStyle}
        </span>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {selectedBrand} · Style {selectedStyle}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {(["‹", "›"] as const).map((arrow, idx) => {
          const disabled =
            idx === 0 ? currentIndex <= 0 : currentIndex >= totalStyles - 1;
          return (
            <button
              key={arrow}
              onClick={idx === 0 ? onPrev : onNext}
              disabled={disabled}
              title={idx === 0 ? "Previous style" : "Next style"}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: "1.5px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.07)",
                color: disabled ? "#475569" : "#e2e8f0",
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {arrow}
            </button>
          );
        })}
        <span
          style={{
            fontSize: 13,
            color: "#94a3b8",
            minWidth: 80,
            textAlign: "center",
          }}
        >
          {currentIndex + 1} / {totalStyles}
        </span>
      </div>

      <button
        onClick={onImport}
        disabled={importing}
        style={{
          background: importing
            ? "#475569"
            : "linear-gradient(135deg, #2563eb, #16a34a)",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "10px 22px",
          fontSize: 14,
          fontWeight: 700,
          cursor: importing ? "not-allowed" : "pointer",
          fontFamily: "'DM Sans', sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: importing ? "none" : "0 4px 14px rgba(37,99,235,0.45)",
          transition: "all 0.2s",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {importing ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
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
  );
}

// ─────────────────────────────────────────────
// Post-Import Success Banner
// ─────────────────────────────────────────────
function PostImportBanner({
  importedName,
  hasNext,
  onNext,
  onDismiss,
}: {
  importedName: string;
  hasNext: boolean;
  onNext: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #052e16 0%, #14532d 100%)",
        border: "1.5px solid #16a34a",
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 20,
        animation: "slideIn 0.3s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 28 }}>🎉</span>
        <div>
          <div style={{ fontWeight: 700, color: "#4ade80", fontSize: 14 }}>
            Import successful!
          </div>
          <div style={{ fontSize: 13, color: "#86efac", marginTop: 2 }}>
            <strong>{importedName}</strong> has been added to your store.
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {hasNext && (
          <button
            onClick={onNext}
            style={{
              background: "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 10px rgba(22,163,74,0.4)",
              whiteSpace: "nowrap",
            }}
          >
            Next Product →
          </button>
        )}
        <button
          onClick={onDismiss}
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "#86efac",
            border: "1.5px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "9px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// S&S Activewear Tab
// ─────────────────────────────────────────────
function SSActivewearTab() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [styles, setStyles] = useState<Style[]>([]);
  const [styleSearch, setStyleSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [selectedStyleIndex, setSelectedStyleIndex] = useState(-1);
  const [product, setProduct] = useState<any>(null);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingStyles, setLoadingStyles] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastImportedName, setLastImportedName] = useState<string | null>(null);
  const { toasts, show, dismiss } = useToast();

  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase()),
  );
 const filteredStyles = styles.filter((s) => {
  const search = styleSearch.toLowerCase();

  return (
    String(s.style_name || "")
      .toLowerCase()
      .includes(search) ||
    String(s.style_id || "")
      .toLowerCase()
      .includes(search)
  );
});

const loadBrands = async () => {
  try {
    setLoadingBrands(true);

    const res = await GetAllBrandsAPI({
      page: 1,
      limit: 500,
      search: "",
    });

    setBrands(res?.data?.data?.data || []);
  } catch {
    show("Failed to load brands", "error");
  } finally {
    setLoadingBrands(false);
  }
};

useEffect(() => {
  loadBrands();
}, []);

  const handleBrandSelect = async (brand: Brand) => {
    const brandName = brand.name;
    setSelectedBrand(brandName);
    setProduct(null);
    setSelectedStyle("");
    setSelectedStyleIndex(-1);
    setStyles([]);
    setStyleSearch("");
    setLastImportedName(null);
    setLoadingStyles(true);
    try {
      const res = await GetStylesByBrandAPI(brandName);
      const fetched = res.data.data?.data || [];
      setStyles(fetched);
      show(`Loaded ${fetched.length} styles for ${brandName}`, "success");
    } catch {
      show("Failed to load styles for this brand", "error");
    } finally {
      setLoadingStyles(false);
    }
  };

  const loadStyleByIndex = async (
    index: number,
    stylesList: Style[] = styles,
  ) => {
    if (index < 0 || index >= stylesList.length) return;
    const s = stylesList[index];
    setSelectedStyle(s.style_id);
    setSelectedStyleIndex(index);
    setLoadingProduct(true);
    setProduct(null);
    setLastImportedName(null);
    try {
      const res = await GetProductByStyleAPI(s.style_id);
      setProduct(res.data.data);
    } catch {
      show("Failed to fetch product details", "error");
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleStyleSelect = (style: Style) => {
    const index = styles.findIndex((s) => s.style_id === style.style_id);
    loadStyleByIndex(index);
  };

  const handleImport = async () => {
    if (!selectedStyle) return;
    setImporting(true);
    const toastId = show("Importing product…", "loading");
    try {
      await ImportSSProductAPI(selectedStyle);
      dismiss(toastId);
      show("Product imported successfully!", "success");
      setLastImportedName(product?.product?.name ?? selectedStyle);
    } catch {
      dismiss(toastId);
      show("Import failed. Please try again.", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleNextFromBanner = () => {
    setLastImportedName(null);
    loadStyleByIndex(selectedStyleIndex + 1);
  };

  const step1Done = !!selectedBrand;
  const step2Done = !!selectedStyle;
  const step3Done = !!product;
  const totalStock =
    product?.variants?.reduce((sum: number, v: Variant) => sum + v.stock, 0) ??
    0;

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <StickyActionBar
        product={product}
        selectedStyle={selectedStyle}
        selectedBrand={selectedBrand}
        importing={importing}
        currentIndex={selectedStyleIndex}
        totalStyles={styles.length}
        onImport={handleImport}
        onPrev={() => loadStyleByIndex(selectedStyleIndex - 1)}
        onNext={() => loadStyleByIndex(selectedStyleIndex + 1)}
      />

      {lastImportedName && (
        <PostImportBanner
          importedName={lastImportedName}
          hasNext={selectedStyleIndex < styles.length - 1}
          onNext={handleNextFromBanner}
          onDismiss={() => setLastImportedName(null)}
        />
      )}

      {/* Progress Tracker */}
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
        <StepBadge
          number={1}
          label="Pick a Brand"
          done={step1Done}
          active={!step1Done}
        />
        <div style={{ color: "#cbd5e1", alignSelf: "center" }}>→</div>
        <StepBadge
          number={2}
          label="Choose a Style"
          done={step2Done}
          active={step1Done && !step2Done}
        />
        <div style={{ color: "#cbd5e1", alignSelf: "center" }}>→</div>
        <StepBadge
          number={3}
          label="Review Product"
          done={step3Done}
          active={step2Done && !step3Done}
        />
        <div style={{ color: "#cbd5e1", alignSelf: "center" }}>→</div>
        <StepBadge number={4} label="Import" done={false} active={step3Done} />
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24 }}
      >
        {/* LEFT PANEL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Brand — searchable list */}
          <SearchableList
            label="Step 1 · Select Brand"
            items={filteredBrands}
            selectedId={selectedBrand}
            getKey={(b) => b.name}
            getLabel={(b) => b.name}
            onSelect={handleBrandSelect}
            loading={loadingBrands}
            searchValue={brandSearch}
            onSearchChange={setBrandSearch}
            searchPlaceholder="Search brands…"
            emptyText="No brands found"
          />

          {/* Styles — searchable list */}
          {selectedBrand && (
            <SearchableList
              label="Step 2 · Select Style"
              items={filteredStyles}
              selectedId={selectedStyle}
              getKey={(s) => s.style_id}
              getLabel={(s) => s.style_name}
              getSubLabel={(s) => `ID: ${s.style_id}`}
              onSelect={handleStyleSelect}
              loading={loadingStyles}
              searchValue={styleSearch}
              onSearchChange={setStyleSearch}
              searchPlaceholder="Search styles…"
              emptyText={loadingStyles ? "Loading styles…" : "No styles found"}
            />
          )}
        </div>

        {/* RIGHT PANEL */}
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
              <p style={{ margin: 0, fontSize: 14 }}>
                Fetching product details…
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {product && !loadingProduct && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Product header */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
                  borderRadius: 12,
                  padding: "20px 24px",
                  color: "#fff",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.7,
                    marginBottom: 4,
                    letterSpacing: "0.08em",
                  }}
                >
                  STEP 3 · PRODUCT PREVIEW
                </div>
                <h3
                  style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}
                >
                  {product.product?.name}
                </h3>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  Style ID: <strong>{selectedStyle}</strong> &nbsp;·&nbsp;
                  Brand: <strong>{selectedBrand}</strong>
                </div>
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
                    <div style={{ fontSize: 22, fontWeight: 800 }}>
                      {totalStock}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      Total Stock
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>
                      $
                      {Math.min(
                        ...product.variants.map(
                          (v: Variant) => v.pricing?.piece ?? 0,
                        ),
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
                        {[
                          "SKU",
                          "Variant",
                          "Stock",
                          "Case $",
                          "Piece $",
                          "Sale $",
                          "Retail $",
                        ].map((h) => (
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
                        ))}
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
                          {["case", "piece", "sale", "retail"].map((key) => {
                            let displayPrice = 0;

                            if (key === "case") {
                              displayPrice = v.pricing?.case || 0;
                            } else {
                              displayPrice =
                                v.pricing?.[key as keyof typeof v.pricing] || 0;
                            }

                            return (
                              <td
                                key={key}
                                style={{
                                  padding: "10px 16px",
                                  color: "#475569",
                                  borderBottom: "1px solid #f1f5f9",
                                  fontWeight: key === "case" ? 700 : 500,
                                }}
                              >
                                ${Number(displayPrice).toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Tabs config — no emojis
// ─────────────────────────────────────────────
const TABS = [
  { key: "ss", label: "S&S Activewear" },
  { key: "sage", label: "Sage" },
  { key: "sanmar", label: "SanMar" },
  { key: "ottocap", label: "Otto Cap" },
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
        @keyframes slideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      <div style={{ marginBottom: 28, maxWidth: 1100, marginInline: "auto" }}>
        <div
          style={{
            fontSize: 12,
            color: "#94a3b8",
            marginBottom: 4,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Supplier Integration
        </div>
        <h1
          style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#0f172a" }}
        >
          Product Import Center
        </h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
          Browse supplier catalogues, preview products, and import them into
          your store.
        </p>
      </div>

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
                  borderBottom: isActive
                    ? "2.5px solid #2563eb"
                    : "2.5px solid transparent",
                  color: isActive ? "#2563eb" : "#64748b",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  whiteSpace: "nowrap",
                  transition: "color 0.2s, border-color 0.2s",
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 28 }}>
          {activeTab === "ss" && <SSActivewearTab />}
          {activeTab === "sage" && <SageTabWrapper />}
          {activeTab === "sanmar" && <SanmarTab />}
          {activeTab === "ottocap" && <OttoCapTab />}
        </div>
      </div>
    </div>
  );
};

export default SSImportPage;
