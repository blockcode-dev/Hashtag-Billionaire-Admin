import React, { useEffect, useRef, useState } from "react";
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
  pricing: {
    piece?: number;
    price?: number;
    case?: number;
    dozen?: number;
    msrp?: number;
  };
};

type Brand = { id: number | string; name: string };
type StyleItem = { style_name?: string; [key: string]: any };
type ProductImage = string;
type Product = {
  product?: { name?: string; product_images?: ProductImage[] };
  variants?: Variant[];
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

const Spinner: React.FC = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: 280,
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
        animation: "sanmarSpin 0.8s linear infinite",
      }}
    />
    <p style={{ margin: 0, fontSize: 14 }}>Loading…</p>
    <style>{`@keyframes sanmarSpin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ─── Shared: Searchable List ──────────────────────────────────────────────────

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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
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

                  {item.imported && (
                    <span
                      style={{
                        background: "#dcfce7",
                        color: "#15803d",
                        border: "1px solid #bbf7d0",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 999,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Imported
                    </span>
                  )}
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

// ─── Sticky Top Action Bar ────────────────────────────────────────────────────

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
  product: Product | null;
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
          {selectedBrand} · {selectedStyle}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onPrev}
          disabled={currentIndex <= 0}
          title="Previous style"
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "1.5px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.07)",
            color: currentIndex <= 0 ? "#475569" : "#e2e8f0",
            cursor: currentIndex <= 0 ? "not-allowed" : "pointer",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ‹
        </button>
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
        <button
          onClick={onNext}
          disabled={currentIndex >= totalStyles - 1}
          title="Next style"
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "1.5px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.07)",
            color: currentIndex >= totalStyles - 1 ? "#475569" : "#e2e8f0",
            cursor: currentIndex >= totalStyles - 1 ? "not-allowed" : "pointer",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ›
        </button>
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
                animation: "sanmarSpin 0.7s linear infinite",
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

// ─── Post-Import Success Banner ───────────────────────────────────────────────

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
        animation: "sanmarSlideIn 0.3s ease",
      }}
    >
      <style>{`@keyframes sanmarSlideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
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

// ─── Import Overlay (SanMar imports take a long time) ─────────────────────────

function ImportOverlay({
  styleName,
  brandName,
}: {
  styleName: string;
  brandName: string;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15,23,42,0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "40px 48px",
          maxWidth: 420,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Animated ring */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <div style={{ position: "relative", width: 64, height: 64 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "4px solid #e2e8f0",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "4px solid transparent",
                borderTopColor: "#2563eb",
                animation: "sanmarSpin 0.9s linear infinite",
              }}
            />
          </div>
        </div>
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 20,
            fontWeight: 800,
            color: "#0f172a",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Importing Product…
        </h3>
        <p
          style={{
            margin: "0 0 6px",
            fontSize: 14,
            color: "#475569",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Importing <strong>{styleName}</strong> from{" "}
          <strong>{brandName}</strong>.
        </p>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            color: "#94a3b8",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          SanMar imports may take a minute or two — please don't close this tab.
        </p>
        {/* Progress bar */}
        <div
          style={{
            height: 6,
            background: "#e2e8f0",
            borderRadius: 99,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "linear-gradient(90deg, #2563eb, #16a34a)",
              borderRadius: 99,
              animation: "sanmarProgress 2.5s ease-in-out infinite alternate",
              width: "60%",
            }}
          />
        </div>
        <p
          style={{
            marginTop: 16,
            fontSize: 12,
            color: "#f59e0b",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          ⚠️ Do not close or refresh this tab
        </p>
      </div>
      <style>{`
        @keyframes sanmarProgress { from { width: 20%; } to { width: 85%; } }
      `}</style>
    </div>
  );
}

// ─── Step Badge ───────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

const SanmarTab: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  const [styles, setStyles] = useState<
    {
      style_name: string;
      imported?: boolean;
    }[]
  >([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [styleSearch, setStyleSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedStyleIndex, setSelectedStyleIndex] = useState(-1);

  const [product, setProduct] = useState<Product | null>(null);
  const [productLoading, setProductLoading] = useState(false);

  const [importing, setImporting] = useState(false);
  const [lastImportedName, setLastImportedName] = useState<string | null>(null);

  const { show } = useToast();

  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase()),
  );
  const filteredStyles = styles.filter((s) =>
    s.style_name?.toLowerCase().includes(styleSearch.toLowerCase()),
  );

  // ── Load brands on mount ──
  useEffect(() => {
    GetSanmarBrandsAPI()
      .then((res) => setBrands(res.data.data?.data || []))
      .catch(() => show("Failed to load brands", "error"))
      .finally(() => setBrandsLoading(false));
  }, []);

  // ── Select brand → fetch styles ──
  const handleSelectBrand = async (brand: Brand) => {
    setSelectedBrand(brand);
    setSelectedStyle(null);
    setSelectedStyleIndex(-1);
    setProduct(null);
    setStyles([]);
    setStyleSearch("");
    setLastImportedName(null);
    setStylesLoading(true);
    try {
      const res = await GetSanmarStylesAPI(brand.name);
      const data = res.data.data?.data || [];
      setStyles(data);
    } catch {
      show("Failed to load styles", "error");
    } finally {
      setStylesLoading(false);
    }
  };

  // ── Load product by index in styles array ──
  const loadStyleByIndex = async (index: number, stylesList = styles) => {
    if (index < 0 || index >= stylesList.length || !selectedBrand) return;
    const style = stylesList[index]?.style_name;
    setSelectedStyle(style);
    setSelectedStyleIndex(index);
    setProduct(null);
    setProductLoading(true);
    setLastImportedName(null);
    try {
      const res = await GetSanmarProductAPI(selectedBrand.name, style);
      setProduct(res.data.data);
    } catch {
      show("Failed to load product", "error");
    } finally {
      setProductLoading(false);
    }
  };

  // ── Select style from sidebar ──
  const handleSelectStyle = (style: string) => {
    const index = styles.findIndex((s) => s.style_name === style);

    loadStyleByIndex(index);
  };

  // ── Import ──
  const handleImport = async () => {
    if (!selectedBrand || !selectedStyle) return;
    setImporting(true);
    try {
      await ImportSanmarProductAPI({
        brand: selectedBrand.name,
        style: selectedStyle,
      });
      setStyles((prev) =>
        prev.map((s) =>
          s.style_name === selectedStyle ? { ...s, imported: true } : s,
        ),
      );
      setLastImportedName(product?.product?.name ?? selectedStyle);
      show("Product imported successfully!", "success");
    } catch {
      show("Import failed. Please try again.", "error");
    } finally {
      setImporting(false);
    }
  };

  // ── Next from banner ──
  const handleNextFromBanner = () => {
    setLastImportedName(null);
    loadStyleByIndex(selectedStyleIndex + 1);
  };

  const step1Done = !!selectedBrand;
  const step2Done = !!selectedStyle;
  const step3Done = !!product;
  const totalStock =
    product?.variants?.reduce((sum, v) => sum + v.stock, 0) ?? 0;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes sanmarSpin { to { transform: rotate(360deg); } }`}</style>

      {/* Import Overlay */}
      {importing && (
        <ImportOverlay
          styleName={selectedStyle ?? ""}
          brandName={selectedBrand?.name ?? ""}
        />
      )}

      {/* Sticky Action Bar */}
      <StickyActionBar
        product={product}
        selectedStyle={selectedStyle ?? ""}
        selectedBrand={selectedBrand?.name ?? ""}
        importing={importing}
        currentIndex={selectedStyleIndex}
        totalStyles={styles.length}
        onImport={handleImport}
        onPrev={() => loadStyleByIndex(selectedStyleIndex - 1)}
        onNext={() => loadStyleByIndex(selectedStyleIndex + 1)}
      />

      {/* Post-Import Banner */}
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
          <SearchableList
            label="Step 1 · Select Brand"
            items={filteredBrands}
            selectedId={selectedBrand?.name ?? ""}
            getKey={(b) => b.name}
            getLabel={(b) => b.name}
            onSelect={handleSelectBrand}
            loading={brandsLoading}
            searchValue={brandSearch}
            onSearchChange={setBrandSearch}
            searchPlaceholder="Search brands…"
            emptyText="No brands found"
          />

          {selectedBrand && (
            <SearchableList
              label="Step 2 · Select Style"
              items={filteredStyles}
              selectedId={selectedStyle ?? ""}
              getKey={(s) => s.style_name}
              getLabel={(s) => s.style_name}
              onSelect={(s) => handleSelectStyle(s.style_name)}
              loading={stylesLoading}
              searchValue={styleSearch}
              onSearchChange={setStyleSearch}
              searchPlaceholder="Search styles…"
              emptyText="No styles found"
            />
          )}
        </div>

        {/* RIGHT PANEL */}
        <div>
          {/* Empty state */}
          {!selectedStyle && !productLoading && (
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

          {/* Loading */}
          {productLoading && <Spinner />}

          {/* Product detail */}
          {product && !productLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Header card */}
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
                  {product.product?.name ?? selectedStyle}
                </h3>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {selectedBrand?.name} · <strong>{selectedStyle}</strong>
                </div>

                {/* Product images */}
                {product.product?.product_images &&
                  product.product.product_images.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 14,
                        flexWrap: "wrap",
                      }}
                    >
                      {product.product.product_images
                        .slice(0, 5)
                        .map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt={`product-${i}`}
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 8,
                              objectFit: "cover",
                              border: "2px solid rgba(255,255,255,0.2)",
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://via.placeholder.com/56x56?text=?";
                            }}
                          />
                        ))}
                    </div>
                  )}

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
                      {totalStock.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      Total Stock
                    </div>
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
                          "Piece Price",
                          "Case Price",
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
                      {product.variants?.map((v, i) => (
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
                          <td
                            style={{
                              padding: "10px 16px",
                              color: "#475569",
                              borderBottom: "1px solid #f1f5f9",
                              fontWeight: 600,
                            }}
                          >
                            $
                            {(
                              v.pricing?.piece ??
                              v.pricing?.price ??
                              0
                            ).toFixed(2)}
                          </td>

                          <td
                            style={{
                              padding: "10px 16px",
                              color: "#0f766e",
                              borderBottom: "1px solid #f1f5f9",
                              fontWeight: 700,
                            }}
                          >
                            {v.pricing?.case
                              ? `$${Number(v.pricing.case).toFixed(2)}`
                              : "-"}
                          </td>
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
    </div>
  );
};

export default SanmarTab;
