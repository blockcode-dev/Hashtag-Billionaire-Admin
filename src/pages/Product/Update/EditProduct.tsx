/** @format */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Save,
  X,
  Plus,
  Lock,
  Info,
  AlertTriangle,
  ImagePlus,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Eraser,
  Check,
  Pencil,
  Trash2,
  Search,
  Hand,
  Layers,
  Link2,
} from "lucide-react";
import { AutoComplete } from "@/components/common/AutoComplete";
import { Combobox } from "@/components/common/Combobox";
import { toast } from "sonner";
import { IMAGE_ACCEPT, checkImageFiles, checkUploadCounts } from "@/lib/uploads";
import { confirm } from "@/components/common/ConfirmDialog";
import { Pagination } from "@/components/common/Pagination";
import { Spinner } from "@/components/common/Spinner";
import { Tip } from "@/components/common/Tip";
import { GetProductByIdAPI, UpdateProductAPI } from "@/services/Api/ProductApi";
import { ShippingWeightCard } from "../ShippingWeight";
import {
  GetAllCategoriesAPI,
  CreateCategoryAPI,
  UpdateCategoryAPI,
  DeleteCategoryAPI,
  GetParentCategoriesAPI, // for the "add Sub-Category" dropdown list
  AddCategoryToParentAPI,
  RemoveCategoryFromParentAPI, // NEW: undo a Sub-Category mapping
} from "@/services/Api/ParentCategoryApi";
import {
  GetGrandCategoriesAPI, // for the "add Category" dropdown list
  AddParentToGrandAPI,
  RemoveParentFromGrandAPI, // NEW: undo a Category mapping
} from "@/services/Api/GrandCategoryApi";
import { GetPublishedBrandsAPI } from "@/services/Api/BrandsApi";
import "./EditProduct.scss";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  ClearUseCaseProductOverrideAPI,
  ExcludeProductsFromUseCaseAPI,
  GetUseCasesForProductAPI,
  AddProductsToUseCaseAPI,
  GetUseCasesAPI,
} from "@/services/Api/IndustryApi";

/* ─── types ─────────────────────────────────────────────────── */
interface Attachment {
  id: number;
  file_uri: string;
  is_primary: boolean;
}

interface VariantImage {
  id: number;
  file_uri: string;
  is_primary: boolean;
}

interface Variant {
  id: number;
  sku: string;
  color: string | null;
  color_code: string | null;
  size: string | null;
  price: number;
  retail_price: string | null;
  case_price: string | number | null;
  stock: number;
  min_order_quantity: number;
  supplier?: string | null;
  country_of_origin?: string | null;
  case_qty?: number | null;
  meta?: string | Record<string, any> | null;
  images: VariantImage[];
}

interface CategoryRef {
  id: number;
  title: string;
  supplier?: string | null;
}

// ── NEW: hierarchy-aware category shape returned by GetProductByIdAPI.
// A product category can belong to multiple Parent Categories, and each
// Parent Category can belong to multiple Grand Categories.
interface GrandCategoryRef {
  id: number;
  title: string;
}

interface ParentCategoryWithGrand {
  id: number;
  title: string;
  grand_categories?: GrandCategoryRef[];
}

interface CategoryWithHierarchy {
  id: number;
  title: string;
  supplier?: string | null;
  parent_categories?: ParentCategoryWithGrand[];
}

interface Brand {
  id: number;
  name: string;
  logo_url?: string;
}

interface ProductUseCase {
  id: number;
  title: string;
  industry?: string | null;
  source: "manual" | "category";
}

interface UseCaseOption {
  id: number;
  title: string;
  industry?: string | null;
}

interface ProductDetail {
  id: number;
  name: string;
  description: string;
  external_style_name: string | null;
  supplier: string;
  sync_locked: boolean;
  brand_id: number | null;
  attachments: Attachment[];
  variants: Variant[];
  categories: CategoryWithHierarchy[]; // ── CHANGED: was CategoryRef[]
}

// One editable row of the quantity-pricing table — mirrors the raw
// supplier fields (meta.priceTiers / netTiers / qtyTiers, parallel
// arrays) as plain strings for controlled inputs.
interface TierRowDraft {
  qty: string;
  price: string; // -> meta.priceTiers[i] (supplier list price at this qty)
  net: string; // -> meta.netTiers[i] (supplier net price at this qty)
}

// Local editable draft state per variant
interface VariantDraft {
  id: number;
  sku: string;
  color: string;
  color_code: string;
  size: string;
  price: string;
  retail_price: string;
  case_price: string;
  stock: string;
  min_order_quantity: string;
  // Read-only context, shown but never sent back for edit
  supplier: string;
  country_of_origin: string | null;
  case_qty: number | null;
  keepImageIds: number[]; // existing images to retain
  existingImages: VariantImage[];
  newFiles: File[]; // newly added images (not yet uploaded)
  newPreviews: string[];
  // ── Quantity-based (tiered) pricing — currently a SAGE-only shape.
  // `meta` holds the FULL parsed meta object as loaded, so on save we
  // can spread it and only override priceTiers/netTiers/qtyTiers —
  // every other key (dimensions, themes, productionTime, etc.) is
  // preserved untouched rather than being wiped out.
  meta: Record<string, any>;
  hasTieredPricing: boolean;
  tierRows: TierRowDraft[];
}

/* ─── color helpers (small local set — mirrors the one used on
   Create Product; worth extracting to a shared util if both pages
   keep growing) ─────────────────────────────────────────────── */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = (hex || "").replace("#", "");
  if (clean.length !== 6 && clean.length !== 3) return null;
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.55;
}

const COLOR_NAMES: { name: string; r: number; g: number; b: number }[] = [
  { name: "Black", r: 0, g: 0, b: 0 },
  { name: "White", r: 255, g: 255, b: 255 },
  { name: "Red", r: 220, g: 38, b: 38 },
  { name: "Navy Blue", r: 30, g: 58, b: 138 },
  { name: "Royal Blue", r: 37, g: 99, b: 235 },
  { name: "Blue", r: 59, g: 130, b: 246 },
  { name: "Green", r: 34, g: 197, b: 94 },
  { name: "Forest Green", r: 21, g: 128, b: 61 },
  { name: "Charcoal", r: 36, g: 36, b: 36 },
  { name: "Gray", r: 107, g: 114, b: 128 },
  { name: "Light Gray", r: 209, g: 213, b: 219 },
  { name: "Brown", r: 120, g: 53, b: 15 },
  { name: "Tan", r: 180, g: 120, b: 70 },
  { name: "Cream", r: 255, g: 248, b: 220 },
  { name: "Pink", r: 244, g: 114, b: 182 },
  { name: "Baby Pink", r: 244, g: 194, b: 194 },
  { name: "Purple", r: 168, g: 85, b: 247 },
  { name: "Orange", r: 249, g: 115, b: 22 },
  { name: "Yellow", r: 253, g: 224, b: 71 },
  { name: "Maroon", r: 128, g: 0, b: 0 },
  { name: "Burgundy", r: 128, g: 0, b: 32 },
];

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

const COLOR_NAME_OPTIONS = COLOR_NAMES.map((c) => ({
  value: c.name,
  hex: rgbToHex(c.r, c.g, c.b),
}));

function getHexFromColorName(name: string): string | null {
  const trimmed = (name || "").trim().toLowerCase();
  if (!trimmed) return null;
  const match = COLOR_NAME_OPTIONS.find(
    (c) => c.value.toLowerCase() === trimmed,
  );
  return match ? match.hex : null;
}

/* ─── quantity-tier pricing helpers ──────────────────────────────
   Same parallel-array shape SAGE ships in variant.meta
   (priceTiers / netTiers / qtyTiers), and the same shape the
   customer-facing pricing.util.js reads to compute pricing_tiers /
   pricing_tiers_customer at request time. Editing these here is what
   actually changes what shows up there — there's no separate stored
   "customer price"; it's always list price + markup, computed live. */
function buildTierRowsFromMeta(meta: Record<string, any> | null | undefined): TierRowDraft[] {
  const priceTiers = meta?.priceTiers || [];
  const netTiers = meta?.netTiers || [];
  const qtyTiers = meta?.qtyTiers || [];
  const rows: TierRowDraft[] = [];
  for (let i = 0; i < priceTiers.length; i++) {
    const p = priceTiers[i];
    if (p === null || p === undefined || Number(p) <= 0) continue;
    const n = netTiers[i];
    rows.push({
      qty: qtyTiers[i] != null ? String(qtyTiers[i]) : "",
      price: String(p),
      net: n !== null && n !== undefined && Number(n) > 0 ? String(n) : "",
    });
  }
  return rows;
}

function parseVariantMeta(raw: string | Record<string, any> | null | undefined): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/* ─── supplier badge styling ───────────────────────────────────── */
const SUPPLIER_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SAGE: "SAGE",
  SS: "S&S",
  SANMAR: "SanMar",
  OTTOCAP: "OTTOCAP",
};

function SupplierPill({ supplier }: { supplier?: string | null }) {
  const key = (supplier || "MANUAL").toUpperCase();
  const label = SUPPLIER_LABELS[key] || key;
  return (
    <span className={`supplier-pill supplier-pill--${key.toLowerCase()}`}>
      {label}
    </span>
  );
}

/* ─── color name autocomplete (hoisted to module scope so it
   doesn't remount / lose focus on every parent re-render) ───── */
const ColorNameAutocomplete: React.FC<{
  value: string;
  placeholder?: string;
  onSelectColor: (name: string, hex: string | null) => void;
  onChangeText: (name: string) => void;
}> = ({ value, placeholder, onSelectColor, onChangeText }) => {
  const options = COLOR_NAME_OPTIONS.map((c) => ({
    value: c.value,
    label: (
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: c.hex,
            border: "1px solid var(--input)",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        {c.value}
      </span>
    ),
  }));

  return (
    <AutoComplete
      value={value}
      options={options}
      style={{ width: "100%" }}
      onSelect={(val) =>
        onSelectColor(val as string, getHexFromColorName(val as string))
      }
      onChange={(val) => onChangeText(val)}
      placeholder={placeholder || "Color name"}
    />
  );
};

/* ─── rich text description editor ─────────────────────────────
   contentEditable instead of a plain textarea, so the admin edits
   and sees actual formatting (bullets, bold, etc.) instead of raw
   "<ul><li>" markup. The underlying HTML is what gets saved —
   nothing about the stored format changes, only what's shown while
   editing. Hoisted to module scope for the same remount reason as
   ColorNameAutocomplete above. ─────────────────────────────────── */
const RichTextEditor: React.FC<{
  initialHtml: string;
  editorRef: React.RefObject<HTMLDivElement>;
}> = ({ initialHtml, editorRef }) => {
  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  return (
    <div className="rich-text">
      <div className="rich-text-toolbar">
        <button type="button" onClick={() => exec("bold")} title="Bold">
          <Bold size={14} />
        </button>
        <button type="button" onClick={() => exec("italic")} title="Italic">
          <Italic size={14} />
        </button>
        <button
          type="button"
          onClick={() => exec("underline")}
          title="Underline"
        >
          <Underline size={14} />
        </button>
        <span className="rich-text-sep" />
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          title="Bulleted list"
        >
          <List size={14} />
        </button>
        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          title="Numbered list"
        >
          <ListOrdered size={14} />
        </button>
        <span className="rich-text-sep" />
        <button
          type="button"
          onClick={() => exec("removeFormat")}
          title="Clear formatting"
        >
          <Eraser size={14} />
        </button>
      </div>
      <div
        ref={editorRef}
        className="rich-text-body"
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(initialHtml) }}
      />
    </div>
  );
};

/* ─── category hierarchy "add" select ──────────────────────────
   One reusable dropdown for both "add Sub-Category" and "add
   Category" actions. Unlike a pure search box, it loads the full
   option list the first time it's opened and shows it right away
   — the person can scroll and pick, or type to filter the same
   list. It behaves as an "add" action (always shows its
   placeholder, never keeps a selected value) since the result
   shows up as a chip elsewhere on the row instead. Hoisted to
   module scope; each instance owns its own state, so multiple
   rows never interfere with each other. ─────────────────────── */
const CategoryAddSelect: React.FC<{
  placeholder: string;
  fetchAllFn: () => Promise<{ id: number; title: string }[]>;
  excludeIds: number[];
  onAdd: (id: number, title: string) => Promise<void> | void;
}> = ({ placeholder, fetchAllFn, excludeIds, onAdd }) => {
  const [allOptions, setAllOptions] = useState<
    { id: number; title: string }[]
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  // Fetch once, the first time the dropdown is opened — after that,
  // reopening just reuses what's already loaded (typing filters the
  // same in-memory list, no extra requests).
  const ensureLoaded = async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const results = await fetchAllFn();
      setAllOptions(results);
      setLoaded(true);
    } catch {
      setAllOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const options = allOptions
    .filter((o) => !excludeIds.includes(o.id))
    .map((o) => ({ value: o.id, label: o.title }));

  const handleChange = async (value: number) => {
    const match = allOptions.find((o) => o.id === value);
    if (!match) return;
    setAdding(true);
    try {
      await onAdd(match.id, match.title);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Combobox
      value={undefined}
      placeholder={placeholder}
      className="cat-hierarchy-add-select"
      onOpenChange={(open) => {
        if (open) ensureLoaded();
      }}
      onChange={(v) => v !== undefined && handleChange(v)}
      loading={loading || adding}
      disabled={adding}
      emptyText={
        loading ? <Spinner size="small" /> : "Nothing left to add"
      }
      options={options}
      triggerIcon={<Plus size={13} />}
    />
  );
};

const CAT_LIMIT = 50;


const EditProduct: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const isManual = product?.supplier === "MANUAL";

  // Top-level product fields
  const [name, setName] = useState("");
  // Description is read from this ref at save time (uncontrolled —
  // see RichTextEditor comment above for why).
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [descriptionHtml, setDescriptionHtml] = useState(""); // only set once, on load

  // Product images
  const [keepProductImageIds, setKeepProductImageIds] = useState<number[]>([]);
  const [existingProductImages, setExistingProductImages] = useState<
    Attachment[]
  >([]);
  const [newProductFiles, setNewProductFiles] = useState<File[]>([]);
  const [newProductPreviews, setNewProductPreviews] = useState<string[]>([]);

  // Brand & categories — only editable for MANUAL products (the backend
  // also enforces this; supplier-sourced products get these from the
  // supplier feed and shouldn't drift from it via manual edits here).
  const [brandId, setBrandId] = useState<number | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [allLoadedCategories, setAllLoadedCategories] = useState<CategoryRef[]>(
    [],
  );
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [catSearch, setCatSearch] = useState("");
  const [catPage, setCatPage] = useState(1);
  const [catTotal, setCatTotal] = useState(0);
  const [catLoading, setCatLoading] = useState(false);
  const catSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add / edit / delete category — only categories with supplier "MANUAL"
  // (i.e. not pulled in from a supplier feed) are editable here.
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null,
  );
  const [editCategoryValue, setEditCategoryValue] = useState("");
  const [savingCategoryEdit, setSavingCategoryEdit] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(
    null,
  );

  // Variant drafts
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);

  // ── Use Cases (fully independent of Save/sync-lock) ─────────────
  const [productUseCases, setProductUseCases] = useState<ProductUseCase[]>([]);
  const [ucLoading, setUcLoading] = useState(false);
  const [ucActionId, setUcActionId] = useState<number | null>(null); // which chip is mid-action
  const [ucPickerOpen, setUcPickerOpen] = useState(false);
  const [ucSearch, setUcSearch] = useState("");
  const [ucOptions, setUcOptions] = useState<UseCaseOption[]>([]);
  const [ucSearchLoading, setUcSearchLoading] = useState(false);
  const [ucAdding, setUcAdding] = useState(false);

  // ── Category Hierarchy (Product Category -> Parent -> Grand).
  // Fully independent of Save/sync-lock, same as Use Cases — updates
  // apply immediately via their own endpoints. Admins can only ADD
  // missing mappings here, never remove/change existing ones. Each
  // row's search/select UI is self-contained inside <CategoryAddSelect>,
  // so no per-row picker state is needed up here.
  const [productCategoryHierarchy, setProductCategoryHierarchy] = useState<
    CategoryWithHierarchy[]
  >([]);
  const [howToOpen, setHowToOpen] = useState(false);

  const fetchBrands = async () => {
    try {
      const res = await GetPublishedBrandsAPI({ page: 1, limit: 500 });
      setBrands(res?.data?.data?.data || []);
    } catch {
      toast.error("Failed to fetch brands");
    }
  };

  const fetchCategories = async (page = 1, search = "") => {
    setCatLoading(true);
    try {
      const res = await GetAllCategoriesAPI({ page, limit: CAT_LIMIT, search });
      const data = res?.data?.data?.data || [];
      const total = res?.data?.data?.pagination?.total || 0;
      setCategories(data);
      setAllLoadedCategories((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]));
        data.forEach((c: CategoryRef) => map.set(c.id, c));
        return Array.from(map.values());
      });
      setCatTotal(total);
      setCatPage(page);
    } catch {
      toast.error("Failed to fetch categories");
    } finally {
      setCatLoading(false);
    }
  };

  const handleCatSearch = (value: string) => {
    setCatSearch(value);
    if (catSearchTimer.current) clearTimeout(catSearchTimer.current);
    catSearchTimer.current = setTimeout(() => fetchCategories(1, value), 300);
  };

  const toggleCategory = (catId: number) => {
    setSelectedCatIds((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId],
    );
  };

  const selectedCategories = allLoadedCategories.filter((c) =>
    selectedCatIds.includes(c.id),
  );

  const isManualCategory = (cat: CategoryRef) =>
    (cat.supplier || "MANUAL").toUpperCase() === "MANUAL";

  // ─── Category CRUD (manual categories only for edit/delete) ─────────────
  const handleCreateCategory = async () => {
    const title = newCategoryName.trim();
    if (!title) return;
    setCreatingCategory(true);
    try {
      const res = await CreateCategoryAPI({ title, supplier: "MANUAL" });
      const created: CategoryRef | undefined = res?.data?.data;
      toast.success("Category created");
      setNewCategoryName("");
      await fetchCategories(1, catSearch);
      if (created?.id) {
        setSelectedCatIds((prev) =>
          prev.includes(created.id) ? prev : [...prev, created.id],
        );
        setAllLoadedCategories((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]));
          map.set(created.id, created);
          return Array.from(map.values());
        });
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to create category",
      );
    } finally {
      setCreatingCategory(false);
    }
  };

  const startEditCategory = (cat: CategoryRef) => {
    setEditingCategoryId(cat.id);
    setEditCategoryValue(cat.title);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryValue("");
  };

  const handleSaveCategoryEdit = async (catId: number) => {
    const title = editCategoryValue.trim();
    if (!title) return;
    setSavingCategoryEdit(true);
    try {
      await UpdateCategoryAPI(catId, { title });
      toast.success("Category updated");
      setCategories((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, title } : c)),
      );
      setAllLoadedCategories((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, title } : c)),
      );
      cancelEditCategory();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to update category",
      );
    } finally {
      setSavingCategoryEdit(false);
    }
  };

  const handleDeleteCategory = (cat: CategoryRef) => {
    confirm({
      title: "Delete category",
      content: (
        <span>
          Delete <strong>{cat.title}</strong>? This can't be undone.
        </span>
      ),
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        setDeletingCategoryId(cat.id);
        try {
          await DeleteCategoryAPI(cat.id);
          toast.success("Category deleted");
          setCategories((prev) => prev.filter((c) => c.id !== cat.id));
          setAllLoadedCategories((prev) => prev.filter((c) => c.id !== cat.id));
          setSelectedCatIds((prev) => prev.filter((cid) => cid !== cat.id));
        } catch (err: any) {
          toast.error(
            err?.response?.data?.message || "Failed to delete category",
          );
        } finally {
          setDeletingCategoryId(null);
        }
      },
    });
  };

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await GetProductByIdAPI(id);
      const data: ProductDetail = res?.data?.data;
      setProduct(data);
      setName(data.name || "");
      setDescriptionHtml(data.description || "");
      setExistingProductImages(data.attachments || []);
      setKeepProductImageIds((data.attachments || []).map((a) => a.id));

      // ── NEW: hierarchy comes straight off the product payload, no
      // extra fetch needed. Applies for both MANUAL and supplier products.
      setProductCategoryHierarchy(data.categories || []);

      if (data.supplier === "MANUAL") {
        setBrandId(data.brand_id ?? null);
        setSelectedCatIds((data.categories || []).map((c) => c.id));
        // Seed with the product's current categories so their titles show
        // up as selected badges immediately, even before page 1 loads.
        setAllLoadedCategories(data.categories || []);
        fetchBrands();
        fetchCategories(1, "");
      }

      setVariantDrafts(
        (data.variants || []).map((v) => {
          const meta = parseVariantMeta(v.meta);
          // Quantity-based pricing — currently only SAGE ships this
          // shape (meta.priceTiers / netTiers / qtyTiers). Gated on
          // supplier so other suppliers' variants render exactly as
          // before, even if they happen to have similarly-named keys.
          const tierRows =
            data.supplier === "SAGE" ? buildTierRowsFromMeta(meta) : [];

          return {
            id: v.id,
            sku: v.sku || "",
            color: v.color || "",
            color_code: v.color_code || "",
            size: v.size || "",
            price: v.price?.toString() ?? "",
            retail_price: v.retail_price ?? "",
            case_price: v.case_price != null ? String(v.case_price) : "",
            stock: v.stock?.toString() ?? "",
            min_order_quantity: v.min_order_quantity?.toString() ?? "1",
            supplier: v.supplier || data.supplier || "MANUAL",
            country_of_origin: v.country_of_origin ?? null,
            case_qty: v.case_qty ?? null,
            keepImageIds: (v.images || []).map((img) => img.id),
            existingImages: v.images || [],
            newFiles: [],
            newPreviews: [],
            meta,
            hasTieredPricing: tierRows.length > 0,
            tierRows,
          };
        }),
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // Sync the rich text editor's content whenever a fresh product loads
  // (not on every keystroke — that would fight the user's cursor).
  useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.innerHTML = sanitizeHtml(descriptionHtml);
    }
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── use case handlers — all hooks kept up here, above the
     early returns further down, so hook order never changes
     between renders (loading -> loaded). ─────────────────── */
  const loadProductUseCases = useCallback(async () => {
    if (!id) return;
    try {
      setUcLoading(true);
      const res = await GetUseCasesForProductAPI(Number(id));
      setProductUseCases(res?.data?.data || []);
    } catch {
      toast.error("Failed to load use cases");
    } finally {
      setUcLoading(false);
    }
  }, [id]);

  const searchUseCases = async (term: string) => {
    if (!term.trim()) {
      setUcOptions([]);
      return;
    }
    try {
      setUcSearchLoading(true);
      const res = await GetUseCasesAPI(1, 20, term);
      const list = res?.data?.data?.data || [];
      const assignedIds = new Set(productUseCases.map((u) => u.id));
      setUcOptions(
        list
          .filter((u: any) => !assignedIds.has(u.id))
          .map((u: any) => ({
            id: u.id,
            title: u.title,
            industry: u.industry?.title || null,
          })),
      );
    } catch {
      setUcOptions([]);
    } finally {
      setUcSearchLoading(false);
    }
  };

  const handleAddToUseCase = async (useCaseId: number, title: string) => {
    if (!product) return;
    try {
      setUcAdding(true);
      await AddProductsToUseCaseAPI(useCaseId, [product.id]);
      toast.success(`Added to "${title}"`);
      setUcPickerOpen(false);
      setUcSearch("");
      setUcOptions([]);
      await loadProductUseCases();
    } catch {
      toast.error("Failed to add to use case");
    } finally {
      setUcAdding(false);
    }
  };

  const handleRemoveFromUseCase = async (uc: ProductUseCase) => {
    if (!product) return;
    try {
      setUcActionId(uc.id);
      if (uc.source === "manual") {
        await ClearUseCaseProductOverrideAPI(uc.id, product.id);
      } else {
        await ExcludeProductsFromUseCaseAPI(uc.id, [product.id]);
      }
      setProductUseCases((prev) => prev.filter((x) => x.id !== uc.id));
      toast.success(`Removed from "${uc.title}"`);
    } catch {
      toast.error("Failed to remove from use case");
    } finally {
      setUcActionId(null);
    }
  };

  useEffect(() => {
    loadProductUseCases();
  }, [loadProductUseCases]);

  useEffect(() => {
    const timer = setTimeout(() => searchUseCases(ucSearch), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ucSearch]);

  /* ─── Category Hierarchy handlers ─────────────────────────────
     "Sub-Category" here is the ParentCategory model, "Category" is
     the GrandCategory model — renamed in the UI to match the plain
     language non-technical admins already see in the left nav
     (Categories / Sub Categories). Both add and remove are allowed:
     these mapping tables are fully admin-managed (not something the
     nightly supplier sync touches), so undoing a mapping here is
     safe the same way it's safe on the Sub-Category/Category
     management pages. Multiple Sub-Categories per product category,
     and multiple Categories per Sub-Category, are both allowed, so
     the add control stays visible even when mappings already exist.
  ─────────────────────────────────────────────────────────────── */
  const [removingChipId, setRemovingChipId] = useState<string | null>(null);

  const fetchAllParentCategoriesFn = async () => {
    const res = await GetParentCategoriesAPI(1, 200, "");
    const list = res?.data?.data?.data || [];
    return list.map((p: any) => ({ id: p.id, title: p.title }));
  };

  const fetchAllGrandCategoriesFn = async () => {
    const res = await GetGrandCategoriesAPI(1, 200, "");
    const list = res?.data?.data?.data || [];
    return list.map((g: any) => ({ id: g.id, title: g.title }));
  };

  const handleAddCategoryToParent = async (
    categoryId: number,
    parentId: number,
    parentTitle: string,
  ) => {
    try {
      const res = await AddCategoryToParentAPI({
        parent_category_id: parentId,
        product_category_id: categoryId,
      });
      toast.success(`Added to "${parentTitle}"`);
      // Use whatever the backend actually knows about this parent's
      // existing Grand Category mappings — this Sub-Category may have
      // already belonged to a Category before it was ever linked to
      // this product. Hardcoding an empty array here was the bug: it
      // showed "not mapped" until a refresh re-fetched the real data.
      const existingGrandCategories =
        res?.data?.data?.parent?.grand_categories || [];
      setProductCategoryHierarchy((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? {
                ...c,
                parent_categories: [
                  ...(c.parent_categories || []),
                  {
                    id: parentId,
                    title: parentTitle,
                    grand_categories: existingGrandCategories,
                  },
                ],
              }
            : c,
        ),
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to add sub-category",
      );
    }
  };

  const handleRemoveCategoryFromParent = async (
    categoryId: number,
    parentId: number,
  ) => {
    const chipId = `parent-${categoryId}-${parentId}`;
    try {
      setRemovingChipId(chipId);
      await RemoveCategoryFromParentAPI({
        parent_category_id: parentId,
        product_category_id: categoryId,
      });
      setProductCategoryHierarchy((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? {
                ...c,
                parent_categories: (c.parent_categories || []).filter(
                  (p) => p.id !== parentId,
                ),
              }
            : c,
        ),
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to remove sub-category",
      );
    } finally {
      setRemovingChipId(null);
    }
  };

  const handleAddParentToGrand = async (
    parentId: number,
    grandId: number,
    grandTitle: string,
  ) => {
    try {
      await AddParentToGrandAPI({
        grand_category_id: grandId,
        parent_category_id: parentId,
      });
      toast.success(`Added to "${grandTitle}"`);
      // A sub-category could appear under more than one product category
      // row — update every occurrence, not just the one that triggered this.
      setProductCategoryHierarchy((prev) =>
        prev.map((c) => ({
          ...c,
          parent_categories: (c.parent_categories || []).map((p) =>
            p.id === parentId
              ? {
                  ...p,
                  grand_categories: [
                    ...(p.grand_categories || []),
                    { id: grandId, title: grandTitle },
                  ],
                }
              : p,
          ),
        })),
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add category");
    }
  };

  const handleRemoveParentFromGrand = async (
    parentId: number,
    grandId: number,
  ) => {
    const chipId = `grand-${parentId}-${grandId}`;
    try {
      setRemovingChipId(chipId);
      await RemoveParentFromGrandAPI({
        grand_category_id: grandId,
        parent_category_id: parentId,
      });
      setProductCategoryHierarchy((prev) =>
        prev.map((c) => ({
          ...c,
          parent_categories: (c.parent_categories || []).map((p) =>
            p.id === parentId
              ? {
                  ...p,
                  grand_categories: (p.grand_categories || []).filter(
                    (g) => g.id !== grandId,
                  ),
                }
              : p,
          ),
        })),
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to remove category",
      );
    } finally {
      setRemovingChipId(null);
    }
  };

  /* ─── product image handlers ─────────────────────────────── */
  const removeExistingProductImage = (attId: number) => {
    setExistingProductImages((prev) => prev.filter((a) => a.id !== attId));
    setKeepProductImageIds((prev) => prev.filter((x) => x !== attId));
  };

  const addProductImages = (files: FileList | null) => {
    if (!files) return;
    const { accepted: arr, error } = checkImageFiles(Array.from(files));
    if (error) toast.error(error);
    if (!arr.length) return;
    setNewProductFiles((prev) => [...prev, ...arr]);
    setNewProductPreviews((prev) => [
      ...prev,
      ...arr.map((f) => URL.createObjectURL(f)),
    ]);
  };

  const removeNewProductImage = (idx: number) => {
    setNewProductFiles((prev) => prev.filter((_, i) => i !== idx));
    setNewProductPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ─── variant field / image handlers ─────────────────────── */
  const updateVariantField = (
    variantId: number,
    field: keyof VariantDraft,
    value: string,
  ) => {
    setVariantDrafts((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, [field]: value } : v)),
    );
  };

  const removeExistingVariantImage = (variantId: number, imgId: number) => {
    setVariantDrafts((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              existingImages: v.existingImages.filter((i) => i.id !== imgId),
              keepImageIds: v.keepImageIds.filter((x) => x !== imgId),
            }
          : v,
      ),
    );
  };

  const addVariantImages = (variantId: number, files: FileList | null) => {
    if (!files) return;
    const { accepted: arr, error } = checkImageFiles(Array.from(files));
    if (error) toast.error(error);
    if (!arr.length) return;
    setVariantDrafts((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              newFiles: [...v.newFiles, ...arr],
              newPreviews: [
                ...v.newPreviews,
                ...arr.map((f) => URL.createObjectURL(f)),
              ],
            }
          : v,
      ),
    );
  };

  const removeNewVariantImage = (variantId: number, idx: number) => {
    setVariantDrafts((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              newFiles: v.newFiles.filter((_, i) => i !== idx),
              newPreviews: v.newPreviews.filter((_, i) => i !== idx),
            }
          : v,
      ),
    );
  };

  /* ─── quantity-tier pricing handlers ─────────────────────────
     Edits only ever touch tierRows in local state; the merge back
     into the variant's full `meta` object happens once, at save
     time (see handleSave) — so nothing here needs to know or care
     about anything else meta contains. ─────────────────────── */
  const updateTierRow = (
    variantId: number,
    index: number,
    field: keyof TierRowDraft,
    value: string,
  ) => {
    setVariantDrafts((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              tierRows: v.tierRows.map((t, i) =>
                i === index ? { ...t, [field]: value } : t,
              ),
            }
          : v,
      ),
    );
  };

  const addTierRow = (variantId: number) => {
    setVariantDrafts((prev) =>
      prev.map((v) => {
        if (v.id !== variantId) return v;
        const last = v.tierRows[v.tierRows.length - 1];
        const nextQty = last?.qty && !isNaN(Number(last.qty))
          ? String(Number(last.qty) + 1)
          : "";
        return {
          ...v,
          tierRows: [...v.tierRows, { qty: nextQty, price: "", net: "" }],
        };
      }),
    );
  };

  const removeTierRow = (variantId: number, index: number) => {
    setVariantDrafts((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? { ...v, tierRows: v.tierRows.filter((_, i) => i !== index) }
          : v,
      ),
    );
  };

  const validateTierRows = (): boolean => {
    for (const v of variantDrafts) {
      if (!v.hasTieredPricing) continue;
      const label = v.sku ? `Variant ${v.sku}` : "This variant";
      if (v.tierRows.length === 0) {
        toast.error(`${label}: add at least one quantity tier, or the pricing will show as unavailable`);
        return false;
      }
      const qtySeen = new Set<string>();
      for (let i = 0; i < v.tierRows.length; i++) {
        const t = v.tierRows[i];
        if (!t.qty.trim()) {
          toast.error(`${label}, tier ${i + 1}: quantity is required`);
          return false;
        }
        if (qtySeen.has(t.qty.trim())) {
          toast.error(`${label}: duplicate quantity break "${t.qty}"`);
          return false;
        }
        qtySeen.add(t.qty.trim());
        if (!t.price.trim() || Number(t.price) <= 0) {
          toast.error(`${label}, tier ${i + 1}: list price must be more than 0`);
          return false;
        }
      }
    }
    return true;
  };

  /* ─── submit ──────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!product) return;
    if (!validateTierRows()) return;
    const countError = checkUploadCounts(
      newProductFiles.length,
      variantDrafts.reduce((n, v) => n + v.newFiles.length, 0),
    );
    if (countError) {
      toast.error(countError);
      return;
    }
    try {
      setSaving(true);

      const formData = new FormData();
      formData.append("product_id", String(product.id));
      formData.append("name", name);
      formData.append("description", descriptionRef.current?.innerHTML || "");

      // Product-level image retention list
      formData.append(
        "keep_product_image_ids",
        JSON.stringify(keepProductImageIds),
      );
      newProductFiles.forEach((file) => formData.append("images", file));

      // Brand + categories — only sent for MANUAL products. Backend
      // enforces this too, but no reason to even send it for supplier
      // products since the fields aren't editable there.
      if (isManual) {
        // Explicit empty string (not omitted) so a cleared brand
        // reaches the backend as an intentional "clear it" signal —
        // the service coerces "" to NULL for the BIGINT column.
        formData.append("brand_id", brandId ? String(brandId) : "");
        formData.append("category_ids", JSON.stringify(selectedCatIds));
      }

      // Variants payload — only fields the admin can actually edit.
      // supplier / country_of_origin / case_qty are shown for context
      // but never sent back, so we can't accidentally corrupt them.
      const variantsPayload = variantDrafts.map((v) => {
        const base: Record<string, any> = {
          id: v.id,
          sku: v.sku,
          color: v.color,
          color_code: v.color_code,
          size: v.size,
          price: v.price.trim() !== "" ? Number(v.price) : 0,
          retail_price:
            v.retail_price.trim() !== "" ? Number(v.retail_price) : null,
          case_price: v.case_price.trim() !== "" ? Number(v.case_price) : null,
          stock: v.stock.trim() !== "" ? Number(v.stock) : 0,
          min_order_quantity:
            v.min_order_quantity.trim() !== ""
              ? Number(v.min_order_quantity)
              : 1,
          keep_image_ids: v.keepImageIds,
          image_count: v.newFiles.length,
        };

        // Quantity-based pricing (SAGE) — send the FULL merged meta
        // object, not a partial one. `meta` is a native JSON column on
        // the backend and updateProduct's variant loop does a plain
        // variant.update(variantUpdateData) pass-through with no
        // per-field merge logic, so sending only {priceTiers: [...]}
        // here would silently wipe out every other key already in
        // meta (dimensions, themes, productionTime, etc.). Spreading
        // v.meta first keeps everything else intact.
        if (v.hasTieredPricing) {
          base.meta = {
            ...v.meta,
            priceTiers: v.tierRows.map((t) =>
              t.price.trim() !== "" ? Number(t.price) : null,
            ),
            netTiers: v.tierRows.map((t) =>
              t.net.trim() !== "" ? Number(t.net) : null,
            ),
            qtyTiers: v.tierRows.map((t) => t.qty.trim()),
          };
        }

        return base;
      });

      formData.append("variants", JSON.stringify(variantsPayload));

      variantDrafts.forEach((v) => {
        v.newFiles.forEach((file) => formData.append("variant_images", file));
      });

      await UpdateProductAPI(formData);

      toast.success(
        "Product updated. Supplier sync is now paused for this product.",
      );
      navigate("/products");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  // ── Early returns come AFTER every hook declared above.
  // Never move a hook (useState/useEffect/useCallback/etc.) below
  // this point — that's what caused the "Rendered more hooks than
  // during the previous render" crash.
  if (loading) {
    return (
      <div className="edit-product-loading">
        <Spinner size="large" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="edit-product-loading">
        <p>Product not found.</p>
      </div>
    );
  }

  return (
    <div className="edit-product-root">
      {/* Header */}
      <div className="edit-product-header">
        <button className="back-btn" onClick={() => navigate("/products")}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="title-row">
            <h1>Edit Product</h1>
            <SupplierPill supplier={product.supplier} />
          </div>
          <p>{product.external_style_name || product.name}</p>
        </div>
        <button className="save-btn" onClick={handleSave} disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Sync notice */}
      <div className="sync-notice">
        <AlertTriangle size={18} />
        <div>
          <strong>
            {product.sync_locked
              ? "Supplier sync is already paused for this product."
              : "Saving will pause supplier sync for this product."}
          </strong>
          <p>
            Once edited, the monthly supplier sync will no longer overwrite your
            changes to this product automatically. You'll be able to re-sync it
            individually whenever you want using the sync feature we'll add
            separately.
          </p>
        </div>
        {product.sync_locked && (
          <span className="locked-pill">
            <Lock size={12} /> Locked
          </span>
        )}
      </div>

      {/* Basic info */}
      <div className="edit-card">
        <div className="edit-card-header">
          <h2>Basic Information</h2>
        </div>
        <div className="field">
          <label>Product Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Description</label>
          <RichTextEditor
            key={product.id}
            initialHtml={descriptionHtml}
            editorRef={descriptionRef}
          />
        </div>
      </div>

      {/* Brand & Categories — manual products only. Supplier products get
          these from the feed; editing them here would drift on next sync,
          so the backend rejects it and we don't even offer it. */}
      {isManual && (
        <div className="edit-card">
          <div className="edit-card-header">
            <h2>Brand & Categories</h2>
            <span className="edit-card-hint">
              Editable for manual products only
            </span>
          </div>

          <div className="field" style={{ maxWidth: 320 }}>
            <label>Brand</label>
            <Combobox
              placeholder="Select brand"
              style={{ width: "100%" }}
              allowClear
              value={brandId ?? undefined}
              onChange={(value) => setBrandId(value ?? null)}
              options={brands.map((brand) => ({
                label: brand.name,
                value: brand.id,
              }))}
            />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>
              Categories
              {selectedCatIds.length > 0 && (
                <span className="cat-count-badge">
                  {selectedCatIds.length} selected
                </span>
              )}
            </label>

            {/* Add a new manual category — becomes searchable/selectable
                immediately and shows up with (MANUAL) in the list below. */}
            <div className="add-category-row">
              <input
                type="text"
                placeholder="New category name, e.g. Eco-Friendly"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
              />
              <button
                className="add-category-btn"
                onClick={handleCreateCategory}
                disabled={creatingCategory || !newCategoryName.trim()}
              >
                <Plus size={14} />
                {creatingCategory ? "Adding…" : "Add category"}
              </button>
            </div>

            <div className="cat-panel">
              <div className="cat-list">
                <div className="cat-search-bar">
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={catSearch}
                    onChange={(e) => handleCatSearch(e.target.value)}
                  />
                </div>
                <div className="cat-items">
                  {catLoading && (
                    <div className="cat-loading-row">Loading…</div>
                  )}
                  {!catLoading && categories.length === 0 && (
                    <div className="cat-loading-row">No categories found</div>
                  )}
                  {categories.map((cat) => {
                    const manual = isManualCategory(cat);
                    const isEditing = editingCategoryId === cat.id;

                    if (isEditing) {
                      return (
                        <div key={cat.id} className="cat-item-editing">
                          <input
                            autoFocus
                            value={editCategoryValue}
                            onChange={(e) =>
                              setEditCategoryValue(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleSaveCategoryEdit(cat.id);
                              if (e.key === "Escape") cancelEditCategory();
                            }}
                          />
                          <button
                            className="cat-edit-icon-btn"
                            onClick={() => handleSaveCategoryEdit(cat.id)}
                            disabled={savingCategoryEdit}
                            title="Save"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            className="cat-edit-icon-btn"
                            onClick={cancelEditCategory}
                            title="Cancel"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={cat.id}
                        className={`cat-item ${
                          selectedCatIds.includes(cat.id)
                            ? "cat-item-selected"
                            : ""
                        }`}
                      >
                        <div
                          className="cat-item-main"
                          onClick={() => toggleCategory(cat.id)}
                        >
                          <span
                            className={`cat-check ${
                              selectedCatIds.includes(cat.id)
                                ? "cat-check-on"
                                : ""
                            }`}
                          >
                            {selectedCatIds.includes(cat.id) && (
                              <Check size={10} />
                            )}
                          </span>
                          <span>
                            {cat.title}
                            {cat.supplier && (
                              <span className="cat-supplier-tag">
                                {" "}
                                ({cat.supplier})
                              </span>
                            )}
                          </span>
                        </div>
                        {manual && (
                          <div className="cat-item-actions">
                            <button
                              className="cat-edit-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditCategory(cat);
                              }}
                              title="Rename"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className="cat-edit-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCategory(cat);
                              }}
                              disabled={deletingCategoryId === cat.id}
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="cat-pagination">
                  <Pagination
                    current={catPage}
                    total={catTotal}
                    pageSize={CAT_LIMIT}
                    showSizeChanger={false}
                    size="small"
                    onChange={(page) => fetchCategories(page, catSearch)}
                  />
                </div>
              </div>
              <div className="cat-selected">
                <div className="cat-selected-title">
                  Selected
                  {selectedCategories.length > 0 && (
                    <span className="cat-selected-count">
                      {selectedCategories.length}
                    </span>
                  )}
                </div>
                {selectedCategories.length === 0 ? (
                  <div className="cat-empty-state">
                    <span>No categories yet</span>
                  </div>
                ) : (
                  <div className="cat-badge-list">
                    {selectedCategories.map((cat) => (
                      <div key={cat.id} className="cat-badge">
                        <span>
                          {cat.title}
                          {cat.supplier && (
                            <span className="cat-supplier-tag">
                              {" "}
                              ({cat.supplier})
                            </span>
                          )}
                        </span>
                        <button onClick={() => toggleCategory(cat.id)}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Hierarchy — shows the product category this product came
          in with (from the supplier or manual assignment), and lets admins
          group it under one of the site's Sub-Categories, and that
          Sub-Category under a top-level Category. Named "Sub-Category" /
          "Category" here (not "Parent"/"Grand") to match the same wording
          already used in the left nav, so non-technical admins recognize
          it. Both levels support add AND remove — these mapping tables are
          fully admin-managed, the nightly supplier sync doesn't touch them.
          Runs for every product, not just MANUAL ones. */}
      <div className="edit-card">
        <div className="edit-card-header">
          <h2>Category Hierarchy</h2>
          <button
            className="cat-hierarchy-howto-trigger"
            onClick={() => setHowToOpen((prev) => !prev)}
          >
            <Info size={13} />
            How this works
          </button>
        </div>

        {howToOpen && (
          <ol className="cat-hierarchy-howto">
            <li>
              <span className="cat-hierarchy-howto-num">1</span>
              <span>
                Every product already has a <strong>Category</strong> (shown
                below, e.g. "Bags") — this comes from the supplier or from
                manual setup, and can't be changed on this screen.
              </span>
            </li>
            <li>
              <span className="cat-hierarchy-howto-num">2</span>
              <span>
                Click <strong>"+ Add a Sub-Category"</strong> and pick from
                the list to group it under one of your site's Sub-Categories
                (the same ones under "Sub Categories" in the sidebar). Click
                the <strong>×</strong> on a chip any time to remove it.
              </span>
            </li>
            <li>
              <span className="cat-hierarchy-howto-num">3</span>
              <span>
                Once a Sub-Category is added, click{" "}
                <strong>"+ Add a Category"</strong> underneath it to place
                that Sub-Category under one of your top-level Categories.
                Same rule — click <strong>×</strong> to remove it.
              </span>
            </li>
            <li>
              <span className="cat-hierarchy-howto-num">4</span>
              <span>
                Changes here save immediately — there's no separate "Save"
                step, and it doesn't affect the supplier sync notice at the
                top of the page.
              </span>
            </li>
          </ol>
        )}

        {productCategoryHierarchy.length === 0 ? (
          <div className="uc-empty-state">
            This product has no category assigned yet
          </div>
        ) : (
          <div className="cat-hierarchy-list">
            {productCategoryHierarchy.map((cat) => (
              <div key={cat.id} className="cat-hierarchy-block">
                {/* The product's own category, as given by the supplier
                    (or set manually) — this is the starting point of the
                    chain and isn't editable from this card. */}
                <div className="cat-hierarchy-product-row">
                  <Layers size={14} />
                  <span className="cat-hierarchy-title">{cat.title}</span>
                  <SupplierPill supplier={cat.supplier} />
                </div>

                {/* Level 1: Sub-Category (ParentCategory model) */}
                <div className="cat-hierarchy-row">
                  <div className="cat-hierarchy-row-label">Sub-Category</div>
                  <div className="cat-hierarchy-row-body">
                    {(cat.parent_categories || []).map((p) => {
                      const chipId = `parent-${cat.id}-${p.id}`;
                      return (
                        <span key={p.id} className="cat-hierarchy-chip">
                          {p.title}
                          <button
                            className="cat-hierarchy-chip-remove"
                            title="Remove this Sub-Category"
                            disabled={removingChipId === chipId}
                            onClick={() =>
                              handleRemoveCategoryFromParent(cat.id, p.id)
                            }
                          >
                            {removingChipId === chipId ? (
                              <Spinner size="small" />
                            ) : (
                              <X size={11} />
                            )}
                          </button>
                        </span>
                      );
                    })}
                    {(cat.parent_categories || []).length === 0 && (
                      <span className="cat-hierarchy-empty-hint">
                        Not added to a Sub-Category yet
                      </span>
                    )}
                    <CategoryAddSelect
                      placeholder="+ Add a Sub-Category"
                      fetchAllFn={fetchAllParentCategoriesFn}
                      excludeIds={(cat.parent_categories || []).map(
                        (p) => p.id,
                      )}
                      onAdd={(pid, ptitle) =>
                        handleAddCategoryToParent(cat.id, pid, ptitle)
                      }
                    />
                  </div>
                </div>

                {/* Level 2: Category (GrandCategory model) — one row per
                    mapped Sub-Category, since it's scoped to that one. */}
                {(cat.parent_categories || []).map((p) => (
                  <div
                    className="cat-hierarchy-row cat-hierarchy-row--nested"
                    key={p.id}
                  >
                    <div className="cat-hierarchy-row-label">
                      Category
                      <span className="cat-hierarchy-row-label-sub">
                        for "{p.title}"
                      </span>
                    </div>
                    <div className="cat-hierarchy-row-body">
                      {(p.grand_categories || []).map((g) => {
                        const chipId = `grand-${p.id}-${g.id}`;
                        return (
                          <span key={g.id} className="cat-hierarchy-chip">
                            {g.title}
                            <button
                              className="cat-hierarchy-chip-remove"
                              title="Remove this Category"
                              disabled={removingChipId === chipId}
                              onClick={() =>
                                handleRemoveParentFromGrand(p.id, g.id)
                              }
                            >
                              {removingChipId === chipId ? (
                                <Spinner size="small" />
                              ) : (
                                <X size={11} />
                              )}
                            </button>
                          </span>
                        );
                      })}
                      {(p.grand_categories || []).length === 0 && (
                        <span className="cat-hierarchy-empty-hint">
                          Not added to a Category yet
                        </span>
                      )}
                      <CategoryAddSelect
                        placeholder="+ Add a Category"
                        fetchAllFn={fetchAllGrandCategoriesFn}
                        excludeIds={(p.grand_categories || []).map(
                          (g) => g.id,
                        )}
                        onAdd={(gid, gtitle) =>
                          handleAddParentToGrand(p.id, gid, gtitle)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product images */}
      <div className="edit-card">
        <div className="edit-card-header">
          <h2>Product Images</h2>
        </div>
        <div className="image-grid">
          {existingProductImages.map((att) => (
            <div className="image-tile" key={att.id}>
              <img src={att.file_uri} alt="" />
              <button
                className="remove-img"
                onClick={() => removeExistingProductImage(att.id)}
              >
                <X size={12} />
              </button>
              {att.is_primary && <span className="primary-tag">Primary</span>}
            </div>
          ))}

          {newProductPreviews.map((src, idx) => (
            <div className="image-tile new" key={`new-${idx}`}>
              <img src={src} alt="" />
              <button
                className="remove-img"
                onClick={() => removeNewProductImage(idx)}
              >
                <X size={12} />
              </button>
              <span className="new-tag">New</span>
            </div>
          ))}

          <label className="image-tile add-tile">
            <ImagePlus size={20} />
            <span>Add</span>
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                addProductImages(e.target.files);
                // Reset so picking the same file again still works.
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {/* Use Cases — fully independent action, does NOT trigger sync lock */}
      <div className="edit-card">
        <div className="edit-card-header">
          <h2>Use Cases</h2>
          <span className="edit-card-hint">
            Updates immediately — doesn't affect supplier sync
          </span>
        </div>

        {ucLoading ? (
          <div className="uc-loading-row">Loading…</div>
        ) : (
          <>
            {productUseCases.length === 0 ? (
              <div className="uc-empty-state">
                Not assigned to any use case yet
              </div>
            ) : (
              <div className="uc-chip-list">
                {productUseCases.map((uc) => (
                  <div key={uc.id} className={`uc-chip uc-chip--${uc.source}`}>
                    {uc.source === "manual" ? (
                      <Hand size={12} />
                    ) : (
                      <Layers size={12} />
                    )}
                    <span>
                      {uc.title}
                      {uc.industry && (
                        <span className="uc-chip-industry"> ({uc.industry})</span>
                      )}
                    </span>
                    <button
                      className="uc-chip-remove"
                      onClick={() => handleRemoveFromUseCase(uc)}
                      disabled={ucActionId === uc.id}
                      title={
                        uc.source === "manual"
                          ? "Remove manual assignment"
                          : "Exclude from this use case (stays elsewhere)"
                      }
                    >
                      {ucActionId === uc.id ? (
                        <Spinner size="small" />
                      ) : (
                        <X size={11} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="uc-add-wrap">
              {!ucPickerOpen ? (
                <button
                  className="uc-add-trigger"
                  onClick={() => setUcPickerOpen(true)}
                >
                  <Link2 size={13} />
                  Add to a use case
                </button>
              ) : (
                <div className="uc-picker">
                  <div className="uc-picker-search">
                    <Search size={14} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search use cases..."
                      value={ucSearch}
                      onChange={(e) => setUcSearch(e.target.value)}
                    />
                    <button
                      className="uc-picker-close"
                      onClick={() => {
                        setUcPickerOpen(false);
                        setUcSearch("");
                        setUcOptions([]);
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {ucSearch.trim() && (
                    <div className="uc-picker-results">
                      {ucSearchLoading && (
                        <div className="uc-picker-empty">Searching…</div>
                      )}
                      {!ucSearchLoading && ucOptions.length === 0 && (
                        <div className="uc-picker-empty">No matches</div>
                      )}
                      {!ucSearchLoading &&
                        ucOptions.map((opt) => (
                          <button
                            key={opt.id}
                            className="uc-picker-option"
                            onClick={() =>
                              handleAddToUseCase(opt.id, opt.title)
                            }
                            disabled={ucAdding}
                          >
                            <span className="uc-picker-option-title">
                              {opt.title}
                            </span>
                            {opt.industry && (
                              <span className="uc-picker-option-industry">
                                ({opt.industry})
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Shipping weight: saved on its own, so it doesn't lock the product
          against supplier updates the way Save does. */}
      <ShippingWeightCard className="mb-5" productId={Number(id)} />

      {/* Variants */}
      <div className="edit-card">
        <div className="edit-card-header">
          <h2>Variants</h2>
          <span className="edit-card-count">{variantDrafts.length}</span>
        </div>

        {variantDrafts.map((v) => {
          const title =
            [v.color, v.size].filter(Boolean).join(" • ") || "Variant";
          const isSupplierSourced = v.supplier && v.supplier !== "MANUAL";

          return (
            <div className="variant-block" key={v.id}>
              <div className="variant-block-header">
                <div className="variant-title-row">
                  <span
                    className="variant-swatch"
                    style={{ background: v.color_code || "var(--muted-strong)" }}
                  />
                  <span className="variant-title">{title}</span>
                  <SupplierPill supplier={v.supplier} />
                </div>
                {isSupplierSourced && (
                  <div className="variant-meta-strip">
                    {v.country_of_origin && (
                      <span>Origin: {v.country_of_origin}</span>
                    )}
                    {v.case_qty != null && <span>Case qty: {v.case_qty}</span>}
                  </div>
                )}
              </div>

              <div className="variant-fields">
                <div className="field">
                  <label>SKU</label>
                  <input
                    value={v.sku}
                    onChange={(e) =>
                      updateVariantField(v.id, "sku", e.target.value)
                    }
                  />
                </div>

                <div className="field">
                  <label>Color</label>
                  <ColorNameAutocomplete
                    value={v.color}
                    placeholder="e.g. Navy Blue"
                    onSelectColor={(name, hex) => {
                      updateVariantField(v.id, "color", name);
                      if (hex) updateVariantField(v.id, "color_code", hex);
                    }}
                    onChangeText={(text) =>
                      updateVariantField(v.id, "color", text)
                    }
                  />
                </div>

                <div className="field small">
                  <label>Color Code</label>
                  <div className="swatch-input">
                    <span
                      className="swatch"
                      style={{
                        background: v.color_code || "var(--muted)",
                        color: isLightColor(v.color_code || "#fff")
                          ? "var(--foreground)"
                          : "var(--background)",
                      }}
                    />
                    <input
                      value={v.color_code}
                      onChange={(e) =>
                        updateVariantField(v.id, "color_code", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="field small">
                  <label>Size</label>
                  <input
                    value={v.size}
                    onChange={(e) =>
                      updateVariantField(v.id, "size", e.target.value)
                    }
                  />
                </div>

                <div className="field small">
                  <label>
                    Price
                    {v.hasTieredPricing && (
                      <Tip content="This variant uses the quantity-based pricing below instead — this flat price is only a fallback for places that can't show tiers.">
                        <span className="field-hint-icon">i</span>
                      </Tip>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={v.price}
                    onChange={(e) =>
                      updateVariantField(v.id, "price", e.target.value)
                    }
                  />
                </div>

                <div className="field small">
                  <label>Retail Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={v.retail_price}
                    onChange={(e) =>
                      updateVariantField(v.id, "retail_price", e.target.value)
                    }
                  />
                </div>

                <div className="field small">
                  <label>
                    Case Price
                    <Tip content="Per-unit price when ordered by the case — used for bulk/wholesale pricing.">
                      <span className="field-hint-icon">i</span>
                    </Tip>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={v.case_price}
                    onChange={(e) =>
                      updateVariantField(v.id, "case_price", e.target.value)
                    }
                  />
                </div>

                <div className="field small">
                  <label>Stock</label>
                  <input
                    type="number"
                    value={v.stock}
                    onChange={(e) =>
                      updateVariantField(v.id, "stock", e.target.value)
                    }
                  />
                </div>

                <div className="field small">
                  <label>Min Order Qty</label>
                  <input
                    type="number"
                    value={v.min_order_quantity}
                    onChange={(e) =>
                      updateVariantField(
                        v.id,
                        "min_order_quantity",
                        e.target.value,
                      )
                    }
                  />
                </div>
              </div>

              {/* Quantity-based pricing — SAGE only, sourced from
                  meta.priceTiers/netTiers/qtyTiers. This is exactly the
                  data pricing.util.js turns into pricing_tiers (raw) and
                  pricing_tiers_customer (with markup) on the Product
                  Detail view — editing it here changes what shows up
                  there and on the live site immediately once saved. */}
              {v.hasTieredPricing && (
                <div className="variant-tier-section">
                  <div className="variant-tier-header">
                    <span>Quantity Pricing</span>
                    <Tip content="List Price and Net Price are the supplier's numbers at each quantity break. Your configured markup is applied automatically on top of List Price to produce what the customer actually pays — that happens live wherever pricing is shown, so there's nothing extra to save for it.">
                      <span className="field-hint-icon">i</span>
                    </Tip>
                  </div>

                  <div className="variant-tier-table">
                    <div className="variant-tier-row variant-tier-row--head">
                      <span>Qty</span>
                      <span>List Price ($)</span>
                      <span>Net Price ($)</span>
                      <span />
                    </div>
                    {v.tierRows.map((t, ti) => (
                      <div className="variant-tier-row" key={ti}>
                        <input
                          type="number"
                          min={0}
                          placeholder="Qty"
                          value={t.qty}
                          onChange={(e) =>
                            updateTierRow(v.id, ti, "qty", e.target.value)
                          }
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="List price"
                          value={t.price}
                          onChange={(e) =>
                            updateTierRow(v.id, ti, "price", e.target.value)
                          }
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Net price"
                          value={t.net}
                          onChange={(e) =>
                            updateTierRow(v.id, ti, "net", e.target.value)
                          }
                        />
                        <button
                          className="variant-tier-remove"
                          onClick={() => removeTierRow(v.id, ti)}
                          title="Remove this tier"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    className="variant-tier-add-btn"
                    onClick={() => addTierRow(v.id)}
                  >
                    <Plus size={13} /> Add quantity tier
                  </button>
                </div>
              )}

              {/* Variant images */}
              <div className="variant-images">
                {v.existingImages.map((img) => (
                  <div className="image-tile small-tile" key={img.id}>
                    <img src={img.file_uri} alt="" />
                    <button
                      className="remove-img"
                      onClick={() => removeExistingVariantImage(v.id, img.id)}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}

                {v.newPreviews.map((src, idx) => (
                  <div className="image-tile small-tile new" key={`nv-${idx}`}>
                    <img src={src} alt="" />
                    <button
                      className="remove-img"
                      onClick={() => removeNewVariantImage(v.id, idx)}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}

                <label className="image-tile small-tile add-tile">
                  <Plus size={14} />
                  <input
                    type="file"
                    accept={IMAGE_ACCEPT}
                    multiple
                    hidden
                    onChange={(e) => {
                      addVariantImages(v.id, e.target.files);
                      // Reset so picking the same file again still works.
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EditProduct;