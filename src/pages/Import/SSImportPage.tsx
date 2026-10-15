import {
  GetAllBrandsAPI,
  GetProductByStyleAPI,
  GetStylesByBrandAPI,
  ImportSSProductAPI,
} from "@/services/Api/ImportApi";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, ChevronRight, CircleCheck, Download, Package, Search } from "lucide-react";
import SageTabWrapper from "./Sage/SageTabWrapper";
import SanmarTab from "./Sanmar/SanmarTab";
import OttoCapTab from "./OttoCap/OttoCapTab";
import { PageHeader } from "@/components/common/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

      {/* Search input */}
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
                    fontSize: 13,
                    fontWeight: 600,
                    color: isSelected ? "var(--primary)" : "var(--foreground)",
                  }}
                >
                  {getLabel(item)}
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
          {selectedBrand} · Style {selectedStyle}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {([ChevronLeft, ChevronRight] as const).map((Arrow, idx) => {
          const disabled =
            idx === 0 ? currentIndex <= 0 : currentIndex >= totalStyles - 1;
          return (
            <button
              key={idx}
              onClick={idx === 0 ? onPrev : onNext}
              disabled={disabled}
              title={idx === 0 ? "Previous style" : "Next style"}
              aria-label={idx === 0 ? "Previous style" : "Next style"}
              style={{
                width: 34,
                height: 34,
                borderRadius: "var(--radius-lg)",
                border: "1.5px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.07)",
                color: disabled ? "var(--muted-foreground)" : "var(--border)",
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Arrow size={18} aria-hidden />
            </button>
          );
        })}
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
                animation: "spin 0.7s linear infinite",
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
        animation: "slideIn 0.3s ease",
      }}
    >
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
    toast.error("Failed to load brands");
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
      toast.success(`Loaded ${fetched.length} styles for ${brandName}`);
    } catch {
      toast.error("Failed to load styles for this brand");
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
      toast.error("Failed to fetch product details");
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
    const toastId = toast.loading("Importing product…");
    try {
      await ImportSSProductAPI(selectedStyle);
      toast.dismiss(toastId);
      toast.success("Product imported successfully!");
      setLastImportedName(product?.product?.name ?? selectedStyle);
    } catch {
      toast.dismiss(toastId);
      toast.error("Import failed. Please try again.");
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

          {loadingProduct && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 320,
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
                      {product.variants.map((v: Variant, i: number) => (
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
                                  color: "var(--muted-foreground)",
                                  borderBottom: "1px solid var(--border)",
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
    <div>
      {/* Animations used by the supplier tabs. */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      <PageHeader
        title="Product import"
        description="Browse supplier catalogues, preview products and import them into your store."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0 overflow-hidden rounded-xl border bg-card shadow-xs">
        <TabsList variant="line" className="h-12 w-full justify-start gap-6 overflow-x-auto rounded-none border-b px-6">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="flex-none px-1">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="p-6">
          {activeTab === "ss" && <SSActivewearTab />}
          {activeTab === "sage" && <SageTabWrapper />}
          {activeTab === "sanmar" && <SanmarTab />}
          {activeTab === "ottocap" && <OttoCapTab />}
        </div>
      </Tabs>
    </div>
  );
};

export default SSImportPage;
