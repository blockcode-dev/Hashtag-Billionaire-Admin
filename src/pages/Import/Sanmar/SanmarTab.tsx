import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, ChevronRight, CircleCheck, Download, Package, Search, TriangleAlert } from "lucide-react";
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
      color: "var(--muted-foreground)",
    }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        border: "3px solid var(--border)",
        borderTop: "3px solid var(--primary)",
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
          color: "var(--muted-foreground)",
          marginBottom: 6,
        }}
      >
        {label}
        {items.length > 0 && (
          <span style={{ color: "var(--primary)", marginLeft: 4 }}>
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
            color: "var(--muted-foreground)",
          }}
        >
          <Search size={14} aria-hidden />
        </span>
        <input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px 8px 30px",
            borderRadius: "var(--radius-lg)",
            border: "1.5px solid var(--border)",
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
            color: "var(--muted-foreground)",
            fontSize: 13,
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          ⏳ Loading…
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            color: "var(--muted-foreground)",
            fontSize: 13,
            border: "1.5px dashed var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          {emptyText}
        </div>
      ) : (
        <div
          style={{
            maxHeight: 280,
            overflowY: "auto",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--background)",
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
                  background: isSelected ? "var(--primary-soft)" : "transparent",
                  borderLeft: isSelected
                    ? "3px solid var(--primary)"
                    : "3px solid transparent",
                  borderBottom:
                    i < items.length - 1 ? "1px solid var(--muted)" : "none",
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
                      color: isSelected ? "var(--primary)" : "var(--foreground)",
                    }}
                  >
                    {getLabel(item)}
                  </div>

                  {item.imported && (
                    <span
                      style={{
                        background: "var(--success-soft)",
                        color: "var(--success-soft-foreground)",
                        border: "1px solid var(--success-border)",
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
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
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
        background: "linear-gradient(135deg, var(--foreground) 0%, var(--foreground) 100%)",
        borderRadius: "var(--radius-xl)",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 20,
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          style={{
            fontSize: 11,
            color: "var(--muted-foreground)",
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
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          {selectedBrand} · {selectedStyle}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onPrev}
          disabled={currentIndex <= 0}
          title="Previous style"
          aria-label="Previous style"
          style={{
            width: 34,
            height: 34,
            borderRadius: "var(--radius-lg)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.07)",
            color: currentIndex <= 0 ? "var(--muted-foreground)" : "var(--border)",
            cursor: currentIndex <= 0 ? "not-allowed" : "pointer",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <span
          style={{
            fontSize: 13,
            color: "var(--muted-foreground)",
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
          aria-label="Next style"
          style={{
            width: 34,
            height: 34,
            borderRadius: "var(--radius-lg)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.07)",
            color: currentIndex >= totalStyles - 1 ? "var(--muted-foreground)" : "var(--border)",
            cursor: currentIndex >= totalStyles - 1 ? "not-allowed" : "pointer",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      <button
        onClick={onImport}
        disabled={importing}
        style={{
          background: importing
            ? "var(--muted-foreground)"
            : "linear-gradient(135deg, var(--primary), var(--success-soft-foreground))",
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius-lg)",
          padding: "10px 22px",
          fontSize: 14,
          fontWeight: 700,
          cursor: importing ? "not-allowed" : "pointer",
          fontFamily: "'DM Sans', sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: importing ? "none" : "0 4px 14px color-mix(in srgb, var(--primary) 45%, transparent)",
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
                border: "2px solid var(--background)",
                borderTop: "2px solid transparent",
                borderRadius: "50%",
                animation: "sanmarSpin 0.7s linear infinite",
              }}
            />
            Importing…
          </>
        ) : (
          <><Download size={16} aria-hidden /> Import product</>
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
        background: "linear-gradient(135deg, var(--success-soft-foreground) 0%, var(--success-soft-foreground) 100%)",
        border: "1.5px solid var(--success-hover)",
        borderRadius: "var(--radius-xl)",
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
        <CircleCheck size={28} color="var(--success)" aria-hidden />
        <div>
          <div style={{ fontWeight: 700, color: "var(--success)", fontSize: 14 }}>
            Import successful!
          </div>
          <div style={{ fontSize: 13, color: "var(--success)", marginTop: 2 }}>
            <strong>{importedName}</strong> has been added to your store.
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {hasNext && (
          <button
            onClick={onNext}
            style={{
              background: "var(--success-hover)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-lg)",
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "var(--shadow-md)",
              whiteSpace: "nowrap",
            }}
          >
            Next Product
            <ArrowRight size={14} aria-hidden />
          </button>
        )}
        <button
          onClick={onDismiss}
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "var(--success)",
            border: "1.5px solid rgba(255,255,255,0.12)",
            borderRadius: "var(--radius-lg)",
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
        background: "color-mix(in srgb, var(--foreground) 75%, transparent)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--background)",
          borderRadius: "var(--radius-2xl)",
          padding: "40px 48px",
          maxWidth: 420,
          width: "90%",
          textAlign: "center",
          boxShadow: "var(--shadow-lg)",
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
                border: "4px solid var(--border)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "4px solid transparent",
                borderTopColor: "var(--primary)",
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
            color: "var(--foreground)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Importing Product…
        </h3>
        <p
          style={{
            margin: "0 0 6px",
            fontSize: 14,
            color: "var(--muted-foreground)",
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
            color: "var(--muted-foreground)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          SanMar imports may take a minute or two — please don't close this tab.
        </p>
        {/* Progress bar */}
        <div
          style={{
            height: 6,
            background: "var(--muted-strong)",
            borderRadius: 99,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "linear-gradient(90deg, var(--primary), var(--success-soft-foreground))",
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
            color: "var(--warning)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <TriangleAlert size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> Don&apos;t close or refresh this tab
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
          background: done ? "var(--success-hover)" : active ? "var(--primary)" : "var(--border)",
          color: done || active ? "#fff" : "var(--muted-foreground)",
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
          color: active ? "var(--foreground)" : "var(--muted-foreground)",
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
      .catch(() => toast.error("Failed to load brands"))
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
      toast.error("Failed to load styles");
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
      toast.error("Failed to load product");
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
      toast.success("Product imported successfully!");
    } catch {
      toast.error("Import failed. Please try again.");
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
          background: "var(--muted)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
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
        <div style={{ color: "var(--placeholder)", alignSelf: "center" }}>→</div>
        <StepBadge
          number={2}
          label="Choose a Style"
          done={step2Done}
          active={step1Done && !step2Done}
        />
        <div style={{ color: "var(--placeholder)", alignSelf: "center" }}>→</div>
        <StepBadge
          number={3}
          label="Review Product"
          done={step3Done}
          active={step2Done && !step3Done}
        />
        <div style={{ color: "var(--placeholder)", alignSelf: "center" }}>→</div>
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
                background: "var(--muted)",
                borderRadius: "var(--radius-xl)",
                border: "2px dashed var(--border)",
                color: "var(--muted-foreground)",
                gap: 10,
              }}
            >
              <Package size={40} strokeWidth={1.5} aria-hidden />
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
                    "linear-gradient(135deg, var(--foreground) 0%, var(--primary) 100%)",
                  borderRadius: "var(--radius-xl)",
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
                              borderRadius: "var(--radius-lg)",
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
                  background: "var(--background)",
                  borderRadius: "var(--radius-xl)",
                  border: "1.5px solid var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}
                  >
                    Variants
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      background: "var(--primary-soft)",
                      color: "var(--primary)",
                      padding: "2px 10px",
                      borderRadius: "var(--radius-2xl)",
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
                      <tr style={{ background: "var(--muted)" }}>
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
                              color: "var(--muted-foreground)",
                              borderBottom: "1px solid var(--border)",
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
                            background: i % 2 === 0 ? "var(--background)" : "var(--muted)",
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 16px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              color: "var(--muted-foreground)",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            {v.sku}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              fontWeight: 600,
                              color: "var(--foreground)",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            {v.variant_name}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <span
                              style={{
                                background:
                                  v.stock > 10
                                    ? "var(--success-soft)"
                                    : v.stock > 0
                                      ? "var(--warning-border)"
                                      : "var(--destructive-soft)",
                                color:
                                  v.stock > 10
                                    ? "var(--success-soft-foreground)"
                                    : v.stock > 0
                                      ? "var(--warning-soft-foreground)"
                                      : "var(--destructive)",
                                padding: "2px 8px",
                                borderRadius: "var(--radius-2xl)",
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
                              color: "var(--muted-foreground)",
                              borderBottom: "1px solid var(--border)",
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
                              color: "var(--info-soft-foreground)",
                              borderBottom: "1px solid var(--border)",
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
