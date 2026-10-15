/** @format */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AutoComplete } from "@/components/common/AutoComplete";
import { Combobox } from "@/components/common/Combobox";
import { toast } from "sonner";
import { IMAGE_ACCEPT, checkImageFiles, checkUploadCounts } from "@/lib/uploads";
import { confirm } from "@/components/common/ConfirmDialog";
import { Pagination } from "@/components/common/Pagination";
import { Spinner } from "@/components/common/Spinner";
import {
  ArrowLeft,
  ArrowLeftCircle,
  ArrowRight,
  Plus,
  Copy,
  Trash2,
  Info,
  Check,
  X,
  Hand,
  Layers,
  UploadCloud,
  Lightbulb,
  ChevronDown,
  ImageOff,
  SlidersHorizontal,
} from "lucide-react";

import {
  AddProductVariantsAPI,
  CreateProductAPI,
  DuplicateProductAPI,
  DuplicateProductData,
  GetAllProductsAdminAPI,
  GetProductByIdAPI,
} from "@/services/Api/ProductApi";
import {
  GetAllCategoriesAPI,
  CreateCategoryAPI,
  UpdateCategoryAPI,
  DeleteCategoryAPI,
} from "@/services/Api/ParentCategoryApi";
import { GetPublishedBrandsAPI } from "@/services/Api/BrandsApi";
import {
  AddProductsToUseCaseAPI,
  GetUseCasesForProductAPI,
} from "@/services/Api/IndustryApi";
import {
  AssignProductAddOnsAPI,
  GetAddOnProductsAPI,
} from "@/services/Api/AddOnApi";
import {
  AssignProductCustomizationsAPI,
  GetCustomizationOptionsAPI,
  GetProductCustomizationsAPI,
} from "@/services/Api/CustomizationApi";

import NumberField from "@/components/common/Numberfield";
import {
  BulkTier,
  DEFAULT_BULK_TIER,
  DEFAULT_PRICING,
  DEFAULT_QUANTITY_PRICE,
  QUANTITY_MODE_INFO,
  QuantityPrice,
  QuantityPricingMode,
  VariantPricing,
  buildPricingPayload,
  clonePricing,
  getPricingError,
  nextTierMin,
  pricingFromVariant,
} from "@/utils/variantPricing";
import { filesFromImages, resolveImageUrl } from "@/utils/fileFromUrl";
import { IMAGE_BASE_URL } from "@/config/env";
import {
  CustomizationAssignment,
  CustomizationOption,
  CustomizationOptionCard,
  CustomizationSelection,
  findEmptyOptions,
  isValuePriced,
  normalizeCustomizationOptions,
  selectionToPayload,
  setValuesInSelection,
  toggleOptionInSelection,
  toggleValueInSelection,
} from "@/pages/Customization/CustomizationPicker";

import styles from "./DuplicateManualProduct.module.scss";
import { Thumbnail } from "@/components/common/Thumbnail";

/* ─── Types ────────────────────────────────────────────────────────── */

type OptionType = "dropdown" | "color" | "buttons" | "size" | "checkbox";

interface Measurements {
  chest: number | string;
  shoulder: number | string;
  length: number | string;
  sleeve_length: number | string;
  neck: number | string;
}

interface OptionValueDraft {
  // Local-only identity used for React keys and variant selection. A copy
  // has no Size rows yet, so there are no backend ids here.
  _key: string;
  name: string;
  color_code?: string;
  measurements?: Measurements;
}

interface OptionDraft {
  name: string;
  type: OptionType;
  display_style: OptionType;
  values: OptionValueDraft[];
}

// An image that already exists on the ORIGINAL product. It's shown as-is
// and re-uploaded as a new file for the copy when you press Create copy.
interface SourceImage {
  id: number;
  file_uri: string;
  file_name?: string;
  is_primary: boolean;
}

interface VariantDraft extends VariantPricing {
  sku: string;
  color: string;
  color_code: string;
  stock: number;
  // Index-aligned with `options` — each entry is the selected value's _key.
  option_selections: (string | null)[];
  sourceImages: SourceImage[];
  newFiles: File[];
  newPreviews: string[];
  hasCustomColor: boolean;
}

interface Brand {
  id: number;
  name: string;
}

interface CategoryRef {
  id: number;
  title: string;
  supplier?: string | null;
}

interface ProductUseCase {
  id: number;
  title: string;
  industry?: string | null;
  source: "manual" | "category";
}

// Add-on mapping as returned by the duplicate API (no ids, no product_id).
interface DuplicateAddOnRef {
  addon_product_id: number;
  price: number;
  sort_order: number;
}

// The duplicate response also carries `addons`.
type DuplicateResponse = DuplicateProductData & {
  addons?: DuplicateAddOnRef[];
};

// Row from GET /customization-option/product/:id/customizations
interface ProductCustomizationRow {
  customization_option_id: number;
  values?: {
    customization_option_value_id?: number;
    value?: { id: number } | null;
  }[];
}

// Master add-on from /add-on/addon-product (active ones only).
interface LibraryAddOn {
  id: number;
  name: string;
  image: string | null;
  price: number | string;
}

interface AddOnDraft {
  addon_product_id: number;
  name: string;
  image: string | null;
  // Master add-on price — null when the add-on is no longer available.
  addonPrice: number | null;
  // Price for the copy, kept as text while typing.
  price: string;
  selected: boolean;
  // False when the add-on was deleted/deactivated since — it can't be
  // assigned (the API rejects inactive add-ons).
  available: boolean;
}

// No Category Hierarchy step: the hierarchy belongs to the categories
// (shared by every product in them), so the copy inherits it by keeping
// the same categories. Same order as Edit Manual Product.
const STEPS = [
  "Basic Info",
  "Customizations",
  "Options",
  "Variants",
  "Use Cases",
  "Add-ons",
];
const BASIC_STEP = STEPS.indexOf("Basic Info");
const CUSTOMIZATIONS_STEP = STEPS.indexOf("Customizations");
const VARIANTS_STEP = STEPS.indexOf("Variants");
const ADD_ONS_STEP = STEPS.indexOf("Add-ons");

const OPTION_TYPE_LABELS: Record<OptionType, string> = {
  dropdown: "Drop-down list",
  color: "Color",
  buttons: "Radio buttons",
  size: "Size",
  checkbox: "Checkboxes",
};

const DEFAULT_MEASUREMENTS = (): Measurements => ({
  chest: "",
  shoulder: "",
  length: "",
  sleeve_length: "",
  neck: "",
});

let localKeyCounter = 0;
function genLocalKeyId(): string {
  localKeyCounter += 1;
  return `local-${Date.now()}-${localKeyCounter}`;
}

const DEFAULT_VARIANT = (optionsCount: number): VariantDraft => ({
  ...DEFAULT_PRICING(),
  sku: "",
  color: "",
  color_code: "#1E3A8A",
  stock: 0,
  option_selections: Array(optionsCount).fill(null),
  sourceImages: [],
  newFiles: [],
  newPreviews: [],
  hasCustomColor: false,
});

const CAT_LIMIT = 50;

const getAddOnImageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${IMAGE_BASE_URL}${path}`;
};

// Digits + one dot, max 2 decimals — so "0.10" can be typed.
const sanitizePrice = (raw: string) => {
  const v = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = v.split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
};

// Maps saved option_values ([{ name, value }]) onto option_selections.
function selectionsFromOptionValues(
  optionDrafts: OptionDraft[],
  optionValues: { name?: string; value?: string }[],
): (string | null)[] {
  const selections: (string | null)[] = optionDrafts.map(() => null);
  optionValues.forEach((ov) => {
    if (!ov?.name || !ov?.value) return;
    const oi = optionDrafts.findIndex((o) => o.name === ov.name);
    if (oi === -1) return;
    const match = optionDrafts[oi].values.find((val) => val.name === ov.value);
    if (match) selections[oi] = match._key;
  });
  return selections;
}

// The first uploaded image becomes primary on the backend, so keep the
// original's primary first.
const primaryFirst = <T extends { is_primary: boolean }>(list: T[]): T[] =>
  [...list].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

// Duplicate API images → absolute URLs the browser can show and re-fetch.
// A relative file_uri would otherwise resolve against the admin app
// (localhost:8080/...), which shows a broken image and — worse — fetches
// the app's index.html instead of the picture.
const toSourceImages = (
  list: {
    id: number;
    file_uri?: string | null;
    file_name?: string;
    is_primary: boolean;
  }[],
): SourceImage[] =>
  primaryFirst(list)
    .map((img) => ({
      id: img.id,
      file_name: img.file_name,
      is_primary: !!img.is_primary,
      file_uri: resolveImageUrl(img),
    }))
    .filter((img) => !!img.file_uri);

// Duplicate API add-ons + active add-on library → editable drafts,
// in the original's order.
const toAddOnDrafts = (
  refs: DuplicateAddOnRef[],
  library: LibraryAddOn[],
): AddOnDraft[] => {
  const libraryById = new Map(library.map((a) => [Number(a.id), a]));

  return [...refs]
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((ref) => {
      const id = Number(ref.addon_product_id);
      const lib = libraryById.get(id);
      return {
        addon_product_id: id,
        name: lib?.name || `Add-on #${id}`,
        image: lib?.image ?? null,
        addonPrice: lib ? Number(lib.price) || 0 : null,
        price: String(Number(ref.price) || 0),
        selected: !!lib,
        available: !!lib,
      };
    });
};

// GET product customizations rows → [{ customization_option_id, value_ids }].
const toCustomizationAssignments = (
  rows: ProductCustomizationRow[],
): CustomizationAssignment[] =>
  rows.map((row) => ({
    customization_option_id: Number(row.customization_option_id),
    value_ids: (row.values || [])
      .map((v) => Number(v.customization_option_value_id ?? v.value?.id))
      .filter((valueId) => Number.isInteger(valueId) && valueId > 0),
  }));

// The original's customizations → the copy's starting selection.
// Only keeps customizations and values that still exist and have a price;
// `dropped` counts what the original had but can't be copied any more.
const toCustomizationSelection = (
  refs: CustomizationAssignment[],
  library: CustomizationOption[],
): { selection: CustomizationSelection; dropped: number } => {
  const libraryById = new Map(library.map((o) => [Number(o.id), o]));
  const selection: CustomizationSelection = {};
  let dropped = 0;

  refs.forEach((ref) => {
    const option = libraryById.get(Number(ref.customization_option_id));
    if (!option) {
      dropped += 1;
      return;
    }

    const usable = new Set(
      option.values.filter(isValuePriced).map((v) => Number(v.id)),
    );
    const valueIds = (ref.value_ids || [])
      .map(Number)
      .filter((valueId) => usable.has(valueId));

    if (!valueIds.length) {
      dropped += 1;
      return;
    }

    selection[option.id] = valueIds;
  });

  return { selection, dropped };
};

/* ─── Color helpers ───────────────────────────────────────────────── */

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

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

const COLOR_NAMES = [
  { name: "Black", r: 0, g: 0, b: 0 },
  { name: "White", r: 255, g: 255, b: 255 },
  { name: "Red", r: 220, g: 38, b: 38 },
  { name: "Blue", r: 59, g: 130, b: 246 },
  { name: "Royal Blue", r: 37, g: 99, b: 235 },
  { name: "Navy Blue", r: 30, g: 58, b: 138 },
  { name: "Green", r: 34, g: 197, b: 94 },
  { name: "Teal", r: 20, g: 184, b: 166 },
  { name: "Gold", r: 202, g: 138, b: 4 },
  { name: "Yellow", r: 253, g: 224, b: 71 },
  { name: "Orange", r: 249, g: 115, b: 22 },
  { name: "Purple", r: 168, g: 85, b: 247 },
  { name: "Pink", r: 244, g: 114, b: 182 },
  { name: "Gray", r: 107, g: 114, b: 128 },
  { name: "Charcoal", r: 36, g: 36, b: 36 },
  { name: "Brown", r: 120, g: 53, b: 15 },
  { name: "Maroon", r: 128, g: 0, b: 0 },
];
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

function getColorNameFromHex(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "";
  let closest = COLOR_NAMES[0];
  let minDist = Infinity;
  for (const c of COLOR_NAMES) {
    const dist =
      Math.pow(c.r - rgb.r, 2) +
      Math.pow(c.g - rgb.g, 2) +
      Math.pow(c.b - rgb.b, 2);
    if (dist < minDist) {
      minDist = dist;
      closest = c;
    }
  }
  return closest.name;
}

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
            width: 14,
            height: 14,
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
      placeholder={placeholder || "Pick a color or type any name"}
    />
  );
};

/* ─── "How this works" guide ─────────────────────────────────────────── */
const GuideCard: React.FC<{ open: boolean; onToggle: () => void }> = ({
  open,
  onToggle,
}) => (
  <div className={styles.guideWrap}>
    <button
      className={`${styles.guideTrigger} ${open ? styles.guideTriggerOpen : ""}`}
      onClick={onToggle}
      type="button"
      aria-expanded={open}
    >
      <Lightbulb size={15} />
      How duplicating a product works
      <ChevronDown size={15} className={styles.guideChevron} />
    </button>
    {open && (
      <div className={styles.guideBody}>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>1</span>
          <span>
            Everything from the original is filled in — name, description,
            brand, categories, images, customizations, options, variants,
            pricing and add-ons. Nothing is saved until you press{" "}
            <strong>Create copy</strong>.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>2</span>
          <span>
            <strong>Change the name</strong> — a copy can't keep the original
            product's name. SKUs start empty; leave them blank to get
            auto-generated ones, or type your own.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>3</span>
          <span>
            Images are copied as new files when you save. Remove any you don't
            want on the copy first.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>4</span>
          <span>
            <strong>Customizations</strong>, <strong>Use Cases</strong> and{" "}
            <strong>Add-ons</strong> — the original's ones are ticked for you.
            Untick or change any before saving. They're applied right after the
            copy is created.
          </span>
        </div>
      </div>
    )}
  </div>
);

/* ─── Page ─────────────────────────────────────────────────────────── */

const DuplicateManualProduct: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);

  /* Basic info */
  const [originalName, setOriginalName] = useState("");
  // The name the duplicate API prefilled ("<original> Copy"). If the admin
  // saves without changing it, we ask once whether to keep it.
  const [suggestedName, setSuggestedName] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sourceProductImages, setSourceProductImages] = useState<SourceImage[]>(
    [],
  );
  const [newProductFiles, setNewProductFiles] = useState<File[]>([]);
  const [newProductPreviews, setNewProductPreviews] = useState<string[]>([]);

  /* Options & Variants */
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [samePriceForAll, setSamePriceForAll] = useState(false);

  /* Categories */
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

  /* Customizations — library + the copy's selection, applied after create */
  const [customizationOptions, setCustomizationOptions] = useState<
    CustomizationOption[]
  >([]);
  const [customizationSelection, setCustomizationSelection] =
    useState<CustomizationSelection>({});
  const [droppedCustomizations, setDroppedCustomizations] = useState(0);

  /* Use cases — the ORIGINAL's list; only read, never changed here */
  const [sourceUseCases, setSourceUseCases] = useState<ProductUseCase[]>([]);
  const [copyUseCaseIds, setCopyUseCaseIds] = useState<number[]>([]);

  /* Add-ons — the ORIGINAL's add-ons, applied to the copy after create */
  const [addOnDrafts, setAddOnDrafts] = useState<AddOnDraft[]>([]);

  /* ─── Brands & Categories fetch ──────────────────────────────────── */
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

  /* ─── Load: prefill from DuplicateProductAPI ─────────────────────────
     The duplicate endpoint strips ids and SKUs and appends " Copy" to the
     name. Its response only has category and add-on ids, so the original
     product (category titles), its use cases, the add-on library, the
     customization library and the ORIGINAL's customizations (existing
     GET /product/:id/customizations — no backend change needed) are
     fetched alongside it. */
  const loadDuplicate = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);

      const [
        dupRes,
        srcRes,
        ucRes,
        addOnRes,
        customizationRes,
        originalCustomizationRes,
      ] = await Promise.all([
        DuplicateProductAPI(id),
        GetProductByIdAPI(id).catch(() => null),
        GetUseCasesForProductAPI(Number(id)).catch(() => null),
        GetAddOnProductsAPI(1, 100, "").catch(() => null),
        GetCustomizationOptionsAPI(1, 100, "").catch(() => null),
        GetProductCustomizationsAPI(Number(id)).catch(() => null),
      ]);

      const dup: DuplicateResponse | undefined = dupRes?.data?.data;
      if (!dup) throw new Error("Not found");

      setOriginalName(dup.original_product_name || "");
      setProductName(dup.name || "");
      setDescription(dup.description || "");
      setBrandId(dup.brand_id ?? null);
      setSuggestedName(dup.name || "");
      setSourceProductImages(toSourceImages(dup.images || []));

      const optionDrafts: OptionDraft[] = (dup.options || []).map((opt) => {
        const displayStyle: OptionType = (opt.display_style ||
          opt.type ||
          "dropdown") as OptionType;

        return {
          name: opt.name,
          type: displayStyle,
          display_style: displayStyle,
          values: (opt.values || []).map((val) => ({
            _key: genLocalKeyId(),
            name: val.name,
            color_code: val.color_code,
            measurements: (val as any).measurements as Measurements | undefined,
          })),
        };
      });
      setOptions(optionDrafts);

      const hasColorOptionAtLoad = optionDrafts.some(
        (o) => o.type === "color" && o.values.some((v) => v.name.trim()),
      );

      const variantDrafts: VariantDraft[] = (dup.variants || []).map((v) => ({
        // Same pricing reader as Edit — the duplicate response carries the
        // pricing fields flat instead of inside meta.
        ...pricingFromVariant({
          price: v.price,
          case_price: v.case_price,
          meta: {
            pricing_mode: v.pricing_mode,
            bulk_pricing: v.bulk_pricing,
            quantity_pricing: v.quantity_pricing,
          },
        }),
        sku: v.sku || "",
        color: v.color || "",
        color_code: v.color_code || "#1E3A8A",
        stock: Number(v.stock || 0),
        option_selections: selectionsFromOptionValues(
          optionDrafts,
          v.option_values || [],
        ),
        sourceImages: toSourceImages(v.images || []),
        newFiles: [],
        newPreviews: [],
        hasCustomColor:
          !hasColorOptionAtLoad && !!(v.color && String(v.color).trim()),
      }));
      setVariants(
        variantDrafts.length
          ? variantDrafts
          : [DEFAULT_VARIANT(optionDrafts.length)],
      );

      const categoryIds: number[] = dup.category_ids || [];
      const sourceCategories: CategoryRef[] =
        srcRes?.data?.data?.categories || [];
      setSelectedCatIds(categoryIds);
      setAllLoadedCategories(
        categoryIds.map(
          (cid) =>
            sourceCategories.find((c) => c.id === cid) || {
              id: cid,
              title: `Category #${cid}`,
            },
        ),
      );

      // Customizations: the original's ones first, then the rest.
      const customizationLibrary = normalizeCustomizationOptions(
        customizationRes?.data?.data?.data,
      );
      const originalRows: ProductCustomizationRow[] = Array.isArray(
        originalCustomizationRes?.data?.data,
      )
        ? originalCustomizationRes.data.data
        : [];
      const { selection, dropped } = toCustomizationSelection(
        toCustomizationAssignments(originalRows),
        customizationLibrary,
      );
      customizationLibrary.sort(
        (a, b) =>
          Number(selection[b.id] !== undefined) -
          Number(selection[a.id] !== undefined),
      );
      setCustomizationOptions(customizationLibrary);
      setCustomizationSelection(selection);
      setDroppedCustomizations(dropped);

      const sourceUc: ProductUseCase[] = ucRes?.data?.data || [];
      setSourceUseCases(sourceUc);
      setCopyUseCaseIds(
        sourceUc.filter((u) => u.source === "manual").map((u) => u.id),
      );

      const libraryRows = addOnRes?.data?.data?.data;
      const library: LibraryAddOn[] = Array.isArray(libraryRows)
        ? libraryRows
        : [];
      setAddOnDrafts(toAddOnDrafts(dup.addons || [], library));

      await fetchBrands();
      await fetchCategories(1, "");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load the product to duplicate");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadDuplicate();
  }, [loadDuplicate]);

  // Keep every variant's option_selections the same length as `options`.
  useEffect(() => {
    setVariants((prev) =>
      prev.map((v) => {
        const selections = [...v.option_selections];
        while (selections.length < options.length) selections.push(null);
        if (selections.length > options.length) {
          selections.length = options.length;
        }
        return { ...v, option_selections: selections };
      }),
    );
  }, [options.length]);

  /* ─── Categories ─────────────────────────────────────────────────── */
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

  /* ─── Customization helpers ──────────────────────────────────────── */
  const toggleCustomizationOption = useCallback(
    (option: CustomizationOption) =>
      setCustomizationSelection((prev) =>
        toggleOptionInSelection(prev, option),
      ),
    [],
  );

  const toggleCustomizationValue = useCallback(
    (optionId: number, valueId: number) =>
      setCustomizationSelection((prev) =>
        toggleValueInSelection(prev, optionId, valueId),
      ),
    [],
  );

  const setCustomizationValues = useCallback(
    (optionId: number, valueIds: number[]) =>
      setCustomizationSelection((prev) =>
        setValuesInSelection(prev, optionId, valueIds),
      ),
    [],
  );

  /* ─── Option helpers ─────────────────────────────────────────────── */
  const addOption = () =>
    setOptions((prev) => [
      ...prev,
      {
        name: "",
        type: "dropdown",
        display_style: "dropdown",
        values: [],
      },
    ]);

  const removeOption = (oi: number) => {
    const opt = options[oi];
    if (variants.some((v) => v.option_selections[oi])) {
      toast.error(`Can't remove "${opt.name}" — a variant still uses it.`);
      return;
    }
    setOptions((prev) => prev.filter((_, idx) => idx !== oi));
    setVariants((prev) =>
      prev.map((v) => ({
        ...v,
        option_selections: v.option_selections.filter((_, idx) => idx !== oi),
      })),
    );
  };

  const updateOptionName = (oi: number, name: string) =>
    setOptions((prev) => {
      const updated = [...prev];
      updated[oi] = { ...updated[oi], name };
      return updated;
    });

  const updateOptionType = (oi: number, type: OptionType) =>
    setOptions((prev) => {
      const updated = [...prev];
      updated[oi] = {
        ...updated[oi],
        type,
        display_style: type,
      };
      return updated;
    });

  const addOptionValue = (oi: number) =>
    setOptions((prev) => {
      const updated = [...prev];
      updated[oi] = {
        ...updated[oi],
        values: [
          ...updated[oi].values,
          {
            _key: genLocalKeyId(),
            name: "",
            color_code: "#1E3A8A",
            measurements: DEFAULT_MEASUREMENTS(),
          },
        ],
      };
      return updated;
    });

  const removeOptionValue = (oi: number, vi: number) => {
    const value = options[oi].values[vi];
    if (variants.some((v) => v.option_selections[oi] === value._key)) {
      toast.error(`Can't remove "${value.name}" — a variant still uses it.`);
      return;
    }
    setOptions((prev) => {
      const updated = [...prev];
      updated[oi] = {
        ...updated[oi],
        values: updated[oi].values.filter((_, idx) => idx !== vi),
      };
      return updated;
    });
  };

  const updateOptionValueName = (oi: number, vi: number, val: string) =>
    setOptions((prev) => {
      const updated = [...prev];
      const values = [...updated[oi].values];
      values[vi] = { ...values[vi], name: val };
      updated[oi] = { ...updated[oi], values };
      return updated;
    });

  const updateOptionValueColorCode = (oi: number, vi: number, hex: string) =>
    setOptions((prev) => {
      const updated = [...prev];
      const values = [...updated[oi].values];
      values[vi] = { ...values[vi], color_code: hex };
      updated[oi] = { ...updated[oi], values };
      return updated;
    });

  /* ─── Variant helpers ─────────────────────────────────────────────── */
  const hasColorOption = options.some(
    (o) => o.type === "color" && o.values.some((v) => v.name.trim()),
  );

  const addVariant = () =>
    setVariants((prev) => {
      const base = DEFAULT_VARIANT(options.length);
      return [
        ...prev,
        samePriceForAll && prev.length > 0
          ? { ...base, ...clonePricing(prev[0]) }
          : base,
      ];
    });

  const duplicateVariant = (i: number) => {
    setVariants((prev) => {
      const source = prev[i];
      const nextSku = source.sku
        ? `${source.sku.replace(/-COPY(-\d+)?$/i, "")}-COPY-${Math.floor(Math.random() * 900 + 100)}`
        : "";
      const clone: VariantDraft = {
        ...source,
        ...clonePricing(source),
        sku: nextSku,
        option_selections: [...source.option_selections],
        sourceImages: [],
        newFiles: [],
        newPreviews: [],
      };
      const updated = [...prev];
      updated.splice(i + 1, 0, clone);
      return updated;
    });
    toast.info(
      "Variant duplicated — change whichever value is different before saving.",
    );
  };

  const removeVariant = (i: number) =>
    setVariants((prev) => prev.filter((_, idx) => idx !== i));

  const updateVariant = <K extends keyof VariantDraft>(
    i: number,
    field: K,
    val: VariantDraft[K],
  ) =>
    setVariants((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], [field]: val };
      return updated;
    });

  const updateVariantPricingFields = (
    i: number,
    fields: Partial<VariantPricing>,
  ) => {
    if (samePriceForAll) {
      setVariants((prev) => prev.map((v) => ({ ...v, ...fields })));
    } else {
      setVariants((prev) =>
        prev.map((v, idx) => (idx === i ? { ...v, ...fields } : v)),
      );
    }
  };

  const updateVariantPricing = <K extends keyof VariantPricing>(
    i: number,
    field: K,
    val: VariantPricing[K],
  ) =>
    updateVariantPricingFields(i, { [field]: val } as Partial<VariantPricing>);

  const setTopLevelPricing = (i: number, quantityBased: boolean) => {
    const v = variants[i];
    if (!quantityBased) {
      updateVariantPricing(i, "pricing_mode", "fixed");
      return;
    }
    if (v.pricing_mode !== "fixed") return;
    updateVariantPricingFields(i, {
      pricing_mode: "tiered",
      bulk_pricing: v.bulk_pricing.length
        ? v.bulk_pricing
        : [DEFAULT_BULK_TIER()],
    });
  };

  const setQuantityPricingMode = (i: number, mode: QuantityPricingMode) => {
    const v = variants[i];
    if (mode === "tiered") {
      updateVariantPricingFields(i, {
        pricing_mode: "tiered",
        bulk_pricing: v.bulk_pricing.length
          ? v.bulk_pricing
          : [DEFAULT_BULK_TIER()],
      });
    } else {
      updateVariantPricingFields(i, {
        pricing_mode: "quantity_fixed",
        quantity_pricing: v.quantity_pricing.length
          ? v.quantity_pricing
          : [DEFAULT_QUANTITY_PRICE()],
      });
    }
  };

  const updateBulkTier = (i: number, ti: number, patch: Partial<BulkTier>) =>
    updateVariantPricing(
      i,
      "bulk_pricing",
      variants[i].bulk_pricing.map((t, idx) =>
        idx === ti ? { ...t, ...patch } : t,
      ),
    );

  const removeBulkTier = (i: number, ti: number) =>
    updateVariantPricing(
      i,
      "bulk_pricing",
      variants[i].bulk_pricing.filter((_, idx) => idx !== ti),
    );

  const addBulkTier = (i: number) => {
    const tiers = variants[i].bulk_pricing;
    updateVariantPricing(i, "bulk_pricing", [
      ...tiers,
      { min_qty: nextTierMin(tiers), max_qty: null, price: 0 },
    ]);
  };

  const updateQuantityPrice = (
    i: number,
    qi: number,
    patch: Partial<QuantityPrice>,
  ) =>
    updateVariantPricing(
      i,
      "quantity_pricing",
      variants[i].quantity_pricing.map((q, idx) =>
        idx === qi ? { ...q, ...patch } : q,
      ),
    );

  const removeQuantityPrice = (i: number, qi: number) =>
    updateVariantPricing(
      i,
      "quantity_pricing",
      variants[i].quantity_pricing.filter((_, idx) => idx !== qi),
    );

  const addQuantityPrice = (i: number) =>
    updateVariantPricing(i, "quantity_pricing", [
      ...variants[i].quantity_pricing,
      DEFAULT_QUANTITY_PRICE(),
    ]);

  const handleToggleSamePrice = (i: number, checked: boolean) => {
    setSamePriceForAll(checked);
    if (checked) {
      const source = clonePricing(variants[i]);
      setVariants((prev) =>
        prev.map((v) => ({ ...v, ...clonePricing(source) })),
      );
    }
  };

  const updateVariantOptionSelection = (
    i: number,
    oi: number,
    valueKey: string | null,
  ) =>
    setVariants((prev) => {
      const updated = [...prev];
      const selections = [...updated[i].option_selections];
      selections[oi] = valueKey;
      let next = { ...updated[i], option_selections: selections };

      const opt = options[oi];
      if (opt?.type === "color" && valueKey !== null) {
        const val = opt.values.find((v) => v._key === valueKey);
        if (val) {
          next = {
            ...next,
            color: val.name,
            color_code: val.color_code || "#000000",
          };
        }
      }
      updated[i] = next;
      return updated;
    });

  const handleColorCodeChange = (i: number, hex: string) => {
    updateVariant(i, "color_code", hex);
    const current = variants[i];
    const prevAutoName = getColorNameFromHex(current.color_code);
    if (!current.color.trim() || current.color === prevAutoName) {
      updateVariant(i, "color", getColorNameFromHex(hex));
    }
  };

  /* ─── Images ─────────────────────────────────────────────────────── */
  const addVariantImages = (i: number, files: FileList | null) => {
    if (!files) return;
    const { accepted: arr, error } = checkImageFiles(Array.from(files));
    if (error) toast.error(error);
    if (!arr.length) return;
    setVariants((prev) =>
      prev.map((v, idx) =>
        idx === i
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
  const removeSourceVariantImage = (i: number, imgId: number) =>
    setVariants((prev) =>
      prev.map((v, idx) =>
        idx === i
          ? {
              ...v,
              sourceImages: v.sourceImages.filter((img) => img.id !== imgId),
            }
          : v,
      ),
    );
  const removeNewVariantImage = (i: number, fileIdx: number) =>
    setVariants((prev) =>
      prev.map((v, vidx) =>
        vidx === i
          ? {
              ...v,
              newFiles: v.newFiles.filter((_, fi) => fi !== fileIdx),
              newPreviews: v.newPreviews.filter((_, fi) => fi !== fileIdx),
            }
          : v,
      ),
    );

  const removeSourceProductImage = (imgId: number) =>
    setSourceProductImages((prev) => prev.filter((img) => img.id !== imgId));
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

  const toggleCopyUseCase = (ucId: number) =>
    setCopyUseCaseIds((prev) =>
      prev.includes(ucId) ? prev.filter((x) => x !== ucId) : [...prev, ucId],
    );

  /* ─── Add-on helpers ─────────────────────────────────────────────── */
  const toggleCopyAddOn = (addonId: number) =>
    setAddOnDrafts((prev) =>
      prev.map((a) =>
        a.addon_product_id === addonId && a.available
          ? { ...a, selected: !a.selected }
          : a,
      ),
    );

  const updateAddOnPrice = (addonId: number, raw: string) =>
    setAddOnDrafts((prev) =>
      prev.map((a) =>
        a.addon_product_id === addonId
          ? { ...a, price: sanitizePrice(raw) }
          : a,
      ),
    );

  // "0100" → "100", "5." → "5" once the admin leaves the field.
  const normalizeAddOnPrice = (addonId: number) =>
    setAddOnDrafts((prev) =>
      prev.map((a) =>
        a.addon_product_id === addonId && a.price !== "" && a.price !== "."
          ? { ...a, price: String(Number(a.price)) }
          : a,
      ),
    );

  const resetAddOnPrice = (addonId: number) =>
    setAddOnDrafts((prev) =>
      prev.map((a) =>
        a.addon_product_id === addonId && a.addonPrice !== null
          ? { ...a, price: String(a.addonPrice) }
          : a,
      ),
    );

  const addOnsToCopy = addOnDrafts.filter((a) => a.selected && a.available);

  /* ─── Validation ─────────────────────────────────────────────────── */
  const validateBasic = (): boolean => {
    if (!productName.trim()) {
      toast.error("Product name is required");
      return false;
    }
    if (
      originalName &&
      productName.trim().toLowerCase() === originalName.trim().toLowerCase()
    ) {
      toast.error(
        "Give the copy a different name — it can't match the original product.",
      );
      return false;
    }
    return true;
  };

  const validateCustomizations = (): boolean => {
    const emptyIds = findEmptyOptions(customizationSelection);
    if (!emptyIds.length) return true;

    const name =
      customizationOptions.find((o) => o.id === emptyIds[0])?.name ||
      "a customization";
    toast.error(
      `Pick at least one value for "${name}", or untick it before creating the copy.`,
    );
    return false;
  };

  const validateVariants = (): boolean => {
    if (!variants.length) {
      toast.error("Add at least one variant");
      return false;
    }

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      for (let oi = 0; oi < options.length; oi++) {
        const opt = options[oi];
        if (!opt.name.trim() || opt.values.length === 0) continue;
        if (!v.option_selections[oi]) {
          toast.error(`Variant ${i + 1}: pick a value for "${opt.name}"`);
          return false;
        }
      }
    }

    const realOptionIndexes = options
      .map((opt, oi) => (opt.name.trim() && opt.values.length > 0 ? oi : null))
      .filter((oi): oi is number => oi !== null);

    if (realOptionIndexes.length > 0) {
      const seen = new Map<string, number>();
      for (let i = 0; i < variants.length; i++) {
        const sig = realOptionIndexes
          .map((oi) => `${oi}:${variants[i].option_selections[oi]}`)
          .join("|");
        if (seen.has(sig)) {
          toast.error(
            `Variant ${seen.get(sig)! + 1} and Variant ${i + 1} are the same — change one of them before saving.`,
          );
          return false;
        }
        seen.set(sig, i);
      }
    }

    const skuSet = new Set<string>();
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const label = `Variant ${i + 1}`;
      const sku = v.sku.trim();
      // SKU is optional on a copy — blank ones are auto-generated.
      if (sku) {
        if (skuSet.has(sku)) {
          toast.error(`Duplicate SKU: ${sku}`);
          return false;
        }
        skuSet.add(sku);
      }
      const pricingError = getPricingError(v, label);
      if (pricingError) {
        toast.error(pricingError);
        return false;
      }
    }
    return true;
  };

  const validateAddOns = (): boolean => {
    for (const a of addOnsToCopy) {
      const value = Number(a.price);
      if (a.price === "" || !Number.isFinite(value) || value < 0) {
        toast.error(`Enter a price of 0 or more for the "${a.name}" add-on.`);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === BASIC_STEP && !validateBasic()) return;
    if (currentStep === CUSTOMIZATIONS_STEP && !validateCustomizations())
      return;
    if (currentStep === VARIANTS_STEP && !validateVariants()) return;
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  /* ─── Payload builders ───────────────────────────────────────────── */
  const buildCleanedOptions = () =>
    options
      .map((opt) => ({
        name: opt.name.trim(),
        type: opt.type,
        display_style: opt.display_style || opt.type || "dropdown",
        values: opt.values
          .filter((v) => v.name.trim())
          .map((v) => ({
            name: v.name.trim(),
            ...(opt.type === "color" ? { color_code: v.color_code } : {}),
            ...(opt.type === "size" && v.measurements
              ? { measurements: v.measurements }
              : {}),
          })),
      }))
      .filter((opt) => opt.name && opt.values.length > 0);

  const buildOptionValues = (v: VariantDraft) =>
    options
      .map((opt, oi) => {
        const valueKey = v.option_selections[oi];
        if (!valueKey) return null;
        const val = opt.values.find((ov) => ov._key === valueKey);
        if (!val) return null;
        return {
          name: opt.name,
          value: val.name,
          type: opt.type,
          display_style: opt.display_style || opt.type || "dropdown",
          ...(opt.type === "color" ? { color_code: val.color_code } : {}),
        };
      })
      .filter(Boolean);

  /* ─── Name checks (run on Create copy) ───────────────────────────── */

  // True when another product already uses exactly this name. If the
  // lookup itself fails we don't block saving — the backend is the last
  // line of defence.
  const isNameTaken = async (name: string): Promise<boolean> => {
    try {
      const res = await GetAllProductsAdminAPI({
        page: 1,
        limit: 50,
        search: name,
      });
      const list: { name?: string }[] = res?.data?.data?.data || [];
      const target = name.trim().toLowerCase();
      return list.some((p) => (p.name || "").trim().toLowerCase() === target);
    } catch {
      return false;
    }
  };

  const confirmKeepSuggestedName = (name: string) =>
    new Promise<boolean>((resolve) => {
      confirm({
        title: "Keep this name?",
        content: (
          <span>
            The copy is still called <strong>{name}</strong>. Keep it, or go
            back and give it a name of its own.
          </span>
        ),
        okText: "Keep name",
        cancelText: "Change name",
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

  /* ─── Create copy ────────────────────────────────────────────────── */
  const handleCreateCopy = async () => {
    if (!validateBasic()) {
      setCurrentStep(BASIC_STEP);
      return;
    }
    if (!validateCustomizations()) {
      setCurrentStep(CUSTOMIZATIONS_STEP);
      return;
    }
    if (!validateVariants()) {
      setCurrentStep(VARIANTS_STEP);
      return;
    }
    if (!validateAddOns()) {
      setCurrentStep(ADD_ONS_STEP);
      return;
    }

    setSaving(true);

    const name = productName.trim();
    if (await isNameTaken(name)) {
      toast.error(
        `A product named "${name}" already exists — give the copy a different name.`,
      );
      setCurrentStep(BASIC_STEP);
      setSaving(false);
      return;
    }
    if (suggestedName && name === suggestedName.trim()) {
      const keep = await confirmKeepSuggestedName(name);
      if (!keep) {
        setCurrentStep(BASIC_STEP);
        setSaving(false);
        return;
      }
    }

    let newProductId: number | null = null;

    try {
      // 1. Re-download the original's kept images so the copy gets its
      //    own files (not a shared file that deleting one could remove).
      const [productCopy, ...variantCopies] = await Promise.all([
        filesFromImages(sourceProductImages),
        ...variants.map((v) => filesFromImages(v.sourceImages)),
      ]);
      const failedImages =
        productCopy.failed +
        variantCopies.reduce((sum, c) => sum + c.failed, 0);

      const countError = checkUploadCounts(
        productCopy.files.length + newProductFiles.length,
        variants.reduce((n, v, vi) => n + variantCopies[vi].files.length + v.newFiles.length, 0),
      );
      if (countError) {
        toast.error(countError);
        return;
      }

      // 2. Create the product — same shape as Create Product.
      const productFormData = new FormData();
      productFormData.append("name", productName.trim());
      if (description.trim()) {
        productFormData.append("description", description.trim());
      }
      if (brandId) productFormData.append("brand_id", String(brandId));
      if (selectedCatIds.length) {
        productFormData.append("category_ids", JSON.stringify(selectedCatIds));
      }
      const cleanedOptions = buildCleanedOptions();
      if (cleanedOptions.length) {
        productFormData.append("options", JSON.stringify(cleanedOptions));
      }
      [...productCopy.files, ...newProductFiles].forEach((file) =>
        productFormData.append("images", file),
      );

      const productRes = await CreateProductAPI(productFormData);
      newProductId = productRes?.data?.data?.id ?? null;
      if (!newProductId) throw new Error("Product creation failed");

      // 3. Variants. Copied images first (original primary stays primary),
      //    then new uploads; image_count must equal the files appended.
      const variantFiles = variants.map((v, vi) => [
        ...variantCopies[vi].files,
        ...v.newFiles,
      ]);

      const formattedVariants = variants.map((v, index) => {
        const includeColor = hasColorOption || v.hasCustomColor;
        return {
          // Blank = the backend generates one (MAN-<productId>-001…).
          sku: v.sku.trim(),
          ...buildPricingPayload(v),
          stock: Number(v.stock || 0),
          color: includeColor ? v.color || null : null,
          color_code: includeColor ? v.color_code || null : null,
          option_values: buildOptionValues(v),
          image_count: variantFiles[index].length,
        };
      });

      const variantFormData = new FormData();
      variantFormData.append("product_id", String(newProductId));
      variantFormData.append("variants", JSON.stringify(formattedVariants));
      variantFiles.forEach((files) =>
        files.forEach((file) => variantFormData.append("variant_images", file)),
      );
      await AddProductVariantsAPI(variantFormData);

      // 4. Copy the chosen manual use-case assignments.
      const copyId = newProductId;
      const ucResults = await Promise.allSettled(
        copyUseCaseIds.map((ucId) => AddProductsToUseCaseAPI(ucId, [copyId])),
      );
      const failedUseCases = ucResults.filter(
        (r) => r.status === "rejected",
      ).length;

      // 5. Copy the chosen add-ons (one call — the API sets the whole list).
      let addOnsFailed = false;
      if (addOnsToCopy.length) {
        try {
          await AssignProductAddOnsAPI(
            copyId,
            addOnsToCopy.map((a, index) => ({
              addon_product_id: a.addon_product_id,
              price: Number(a.price),
              sort_order: index,
            })),
          );
        } catch {
          addOnsFailed = true;
        }
      }

      // 6. Copy the chosen customizations and their values (one call).
      let customizationsFailed = false;
      const customizationPayload = selectionToPayload(customizationSelection);
      if (customizationPayload.length) {
        try {
          await AssignProductCustomizationsAPI(copyId, customizationPayload);
        } catch {
          customizationsFailed = true;
        }
      }

      toast.success("Copy created");
      if (failedImages > 0) {
        toast.warning(
          `${failedImages} image${failedImages === 1 ? "" : "s"} couldn't be copied — add ${failedImages === 1 ? "it" : "them"} again in Edit.`,
        );
      }
      if (failedUseCases > 0) {
        toast.warning(
          `${failedUseCases} use case${failedUseCases === 1 ? "" : "s"} couldn't be assigned — add ${failedUseCases === 1 ? "it" : "them"} in Edit.`,
        );
      }
      if (addOnsFailed) {
        toast.warning(
          "Add-ons couldn't be copied — add them from the Add-ons step in Edit.",
        );
      }
      if (customizationsFailed) {
        toast.warning(
          "Customizations couldn't be copied — add them from the Customizations step in Edit.",
        );
      }
      navigate("/products");
    } catch (err: any) {
      const apiMessage = err?.response?.data?.message;
      if (newProductId) {
        // The product exists but its variants didn't save — open it in Edit
        // rather than leave a half-made copy the admin can't find.
        toast.error(
          apiMessage
            ? `Copy created, but its variants didn't save: ${apiMessage}. Finish it in Edit.`
            : "Copy created, but its variants didn't save. Finish it in Edit.",
        );
        navigate(`/products/${newProductId}/edit-manual`);
      } else {
        toast.error(apiMessage || "Failed to create the copy");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner size="large" />
      </div>
    );
  }

  /* ─── Step: Basic Info ───────────────────────────────────────────── */
  const renderStepBasic = () => (
    <>
      <div className={styles.duplicateBanner}>
        <Copy size={16} className={styles.duplicateBannerIcon} />
        <div>
          <div className={styles.duplicateBannerTitle}>
            Copying “{originalName || "product"}”
          </div>
          <span>
            Everything below is prefilled from the original. Change the name so
            the two are easy to tell apart — nothing is saved until you press
            Create copy.
          </span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Basic info</span>
        </div>
        <div className={styles.fieldGrid}>
          <div className={styles.fieldGroup}>
            <label>
              Product name <span style={{ color: "var(--destructive)" }}>*</span>
            </label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              autoFocus
            />
            {suggestedName && productName.trim() === suggestedName.trim() && (
              <span className={styles.fieldHint}>
                Suggested name — change it so the copy is easy to tell apart.
              </span>
            )}
          </div>
          <div className={styles.fieldGroup}>
            <label>Brand</label>
            <Combobox
              placeholder="Select brand"
              style={{ width: "100%" }}
              allowClear
              value={brandId ?? undefined}
              onChange={(value) => setBrandId(value ?? null)}
              options={brands.map((b) => ({ label: b.name, value: b.id }))}
            />
          </div>
          <div className={`${styles.fieldGroup} ${styles.fieldFull}`}>
            <label>Description</label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            Categories
            {selectedCatIds.length > 0 && (
              <span className={styles.badge}>
                {selectedCatIds.length} selected
              </span>
            )}
          </span>
        </div>

        <div className={styles.addCategoryRow}>
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
            className={styles.btnOutline}
            onClick={handleCreateCategory}
            disabled={creatingCategory || !newCategoryName.trim()}
          >
            <Plus size={14} /> {creatingCategory ? "Adding…" : "Add category"}
          </button>
        </div>

        <div className={styles.catPanel}>
          <div className={styles.catList}>
            <div className={styles.catSearchBar}>
              <input
                type="text"
                placeholder="Search categories..."
                value={catSearch}
                onChange={(e) => handleCatSearch(e.target.value)}
              />
            </div>
            <div className={styles.catItems}>
              {catLoading && (
                <div className={styles.catLoadingRow}>Loading…</div>
              )}
              {!catLoading && categories.length === 0 && (
                <div className={styles.catLoadingRow}>No categories found</div>
              )}
              {categories.map((cat) => {
                const selected = selectedCatIds.includes(cat.id);
                if (editingCategoryId === cat.id) {
                  return (
                    <div key={cat.id} className={styles.catItemEditing}>
                      <input
                        autoFocus
                        value={editCategoryValue}
                        onChange={(e) => setEditCategoryValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveCategoryEdit(cat.id);
                          if (e.key === "Escape") cancelEditCategory();
                        }}
                      />
                      <button
                        className={styles.catEditIconBtn}
                        onClick={() => handleSaveCategoryEdit(cat.id)}
                        disabled={savingCategoryEdit}
                        title="Save"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        className={styles.catEditIconBtn}
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
                    className={`${styles.catItem} ${selected ? styles.catItemSelected : ""}`}
                  >
                    <div
                      className={styles.catItemMain}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <span
                        className={`${styles.catCheck} ${selected ? styles.catCheckOn : ""}`}
                      >
                        {selected && <Check size={10} />}
                      </span>
                      <span>
                        {cat.title}
                        {cat.supplier && (
                          <span className={styles.catSupplierTag}>
                            {" "}
                            ({cat.supplier})
                          </span>
                        )}
                      </span>
                    </div>
                    {isManualCategory(cat) && (
                      <div className={styles.catItemActions}>
                        <button
                          className={styles.catEditIconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditCategory(cat);
                          }}
                          title="Rename"
                        >
                          <Info size={13} />
                        </button>
                        <button
                          className={styles.catEditIconBtn}
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
            <div className={styles.catPagination}>
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
          <div className={styles.catSelected}>
            <div className={styles.catSelectedTitle}>
              Selected
              {selectedCategories.length > 0 && (
                <span className={styles.catSelectedCount}>
                  {selectedCategories.length}
                </span>
              )}
            </div>
            {selectedCategories.length === 0 ? (
              <div className={styles.emptyState}>No categories yet</div>
            ) : (
              <div className={styles.catBadgeList}>
                {selectedCategories.map((cat) => (
                  <div key={cat.id} className={styles.catBadge}>
                    <span>
                      {cat.title}
                      {cat.supplier && (
                        <span className={styles.catSupplierTag}>
                          {" "}
                          ({cat.supplier})
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      aria-label={`Remove ${cat.title}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Product images</span>
          <span className={styles.cardHint}>
            Copied as new files when you save
          </span>
        </div>
        <div className={styles.imageGrid}>
          {sourceProductImages.map((img, idx) => (
            <div className={styles.imageTile} key={img.id}>
              <img src={img.file_uri} alt="" />
              <button
                className={styles.removeImg}
                onClick={() => removeSourceProductImage(img.id)}
                aria-label="Remove image"
              >
                <X size={12} />
              </button>
              {idx === 0 && <span className={styles.primaryTag}>Primary</span>}
            </div>
          ))}
          {newProductPreviews.map((src, idx) => (
            <div
              className={`${styles.imageTile} ${styles.newTile}`}
              key={`new-${idx}`}
            >
              <img src={src} alt="" />
              <button
                className={styles.removeImg}
                onClick={() => removeNewProductImage(idx)}
                aria-label="Remove image"
              >
                <X size={12} />
              </button>
              <span className={styles.newTag}>New</span>
            </div>
          ))}
          <label className={`${styles.imageTile} ${styles.addTile}`}>
            <UploadCloud size={20} />
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
    </>
  );

  /* ─── Step: Customizations (applied after the copy is created) ───── */
  const renderStepCustomizations = () => {
    const selectedCount = Object.keys(customizationSelection).length;

    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            Customizations
            {selectedCount > 0 && (
              <span className={styles.badge}>{selectedCount} selected</span>
            )}
          </span>
          <span className={styles.cardHint}>
            Applied when the copy is created
          </span>
        </div>

        <p className={styles.stepIntro}>
          The original's customizations are ticked for you. Untick any the copy
          shouldn't offer, change which values customers can pick, or tick new
          ones. Prices come from the{" "}
          <Link to="/customizations">Customizations page</Link>.
        </p>

        {droppedCustomizations > 0 && (
          <div className={styles.stepNotice}>
            {droppedCustomizations} customization
            {droppedCustomizations === 1 ? "" : "s"} on the original{" "}
            {droppedCustomizations === 1 ? "was" : "were"} deleted or no longer
            {droppedCustomizations === 1 ? " has" : " have"} a priced value, so{" "}
            {droppedCustomizations === 1 ? "it" : "they"} won't be copied.
          </div>
        )}

        {customizationOptions.length === 0 ? (
          <div className={styles.emptyCard}>
            <SlidersHorizontal size={20} />
            <span>No customizations exist yet</span>
            <span className={styles.fieldHint}>
              Create them on the Customizations page, then add them to the copy
              from Edit.
            </span>
          </div>
        ) : (
          <div className="customization__pc-list">
            {customizationOptions.map((option) => (
              <CustomizationOptionCard
                key={option.id}
                option={option}
                selectedValueIds={customizationSelection[option.id]}
                onToggleOption={toggleCustomizationOption}
                onToggleValue={toggleCustomizationValue}
                onSetValues={setCustomizationValues}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ─── Step: Options ──────────────────────────────────────────────── */
  const renderStepOptions = () => (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Product options</span>
        <button className={styles.btnPrimary} onClick={addOption}>
          <Plus size={14} /> Add option
        </button>
      </div>

      {options.length === 0 ? (
        <div className={styles.emptyCard}>
          <span>This product has no options</span>
          <span className={styles.fieldHint}>
            That's fine for products like candles or mugs with no choices.
          </span>
          <button className={styles.btnOutline} onClick={addOption}>
            <Plus size={14} /> Add option
          </button>
        </div>
      ) : (
        options.map((option, oi) => (
          <div key={oi} className={styles.subCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                Option {oi + 1}
                {option.name && (
                  <span className={styles.pillTag}>{option.name}</span>
                )}
              </span>
              <button
                className={styles.btnDanger}
                onClick={() => removeOption(oi)}
              >
                <Trash2 size={13} /> Remove option
              </button>
            </div>

            <div className={styles.fieldGrid}>
              <div className={styles.fieldGroup}>
                <label>Customer selection label</label>
                <input
                  value={option.name}
                  onChange={(e) => updateOptionName(oi, e.target.value)}
                  placeholder="e.g. Size, Capacity, Color"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label>Display style</label>
                <select
                  value={option.type}
                  onChange={(e) =>
                    updateOptionType(oi, e.target.value as OptionType)
                  }
                >
                  {(Object.keys(OPTION_TYPE_LABELS) as OptionType[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {OPTION_TYPE_LABELS[key]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div className={styles.dividerLabel}>Values</div>
            {option.values.length === 0 ? (
              <div className={styles.emptyState}>
                No values yet — add one below
              </div>
            ) : (
              option.values.map((value, vi) => (
                <div key={value._key} className={styles.valueRow}>
                  {option.type === "color" && (
                    <input
                      type="color"
                      value={value.color_code || "#1E3A8A"}
                      onChange={(e) =>
                        updateOptionValueColorCode(oi, vi, e.target.value)
                      }
                      className={styles.colorPicker}
                      aria-label="Color"
                    />
                  )}
                  <input
                    value={value.name}
                    onChange={(e) =>
                      updateOptionValueName(oi, vi, e.target.value)
                    }
                    placeholder="Value name"
                  />
                  <button
                    className={styles.iconDanger}
                    onClick={() => removeOptionValue(oi, vi)}
                    title="Remove value"
                    aria-label="Remove value"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
            <button
              className={styles.btnOutline}
              onClick={() => addOptionValue(oi)}
            >
              <Plus size={13} /> Add value
            </button>
          </div>
        ))
      )}
    </div>
  );

  /* ─── Pricing (same UI and rules as Create / Edit) ───────────────── */
  const renderCasePriceField = (v: VariantDraft, i: number) => (
    <div className={styles.fieldGroup} style={{ maxWidth: 200 }}>
      <label>Case price ($)</label>
      <NumberField
        allowDecimal
        placeholder="0.00"
        value={v.case_price}
        onChange={(val) => updateVariantPricing(i, "case_price", val ?? 0)}
      />
    </div>
  );

  const renderTieredPricing = (v: VariantDraft, i: number) => (
    <>
      <span className={styles.fieldHint}>
        Set a lower price per item as quantity ordered goes up.
      </span>
      <div className={styles.bulkPricingHeader}>
        <span>From</span>
        <span>To</span>
        <span>Price per item ($)</span>
        <span />
      </div>
      {v.bulk_pricing.map((tier, ti) => (
        <div key={ti} className={styles.bulkRow}>
          <NumberField
            ariaLabel={`Tier ${ti + 1} from quantity`}
            placeholder="Min qty"
            value={tier.min_qty}
            onChange={(val) => updateBulkTier(i, ti, { min_qty: val ?? 0 })}
          />
          <NumberField
            ariaLabel={`Tier ${ti + 1} to quantity`}
            placeholder="Blank = and up"
            emptyValue={null}
            value={tier.max_qty}
            onChange={(val) => updateBulkTier(i, ti, { max_qty: val })}
          />
          <NumberField
            allowDecimal
            ariaLabel={`Tier ${ti + 1} price per item`}
            placeholder="0.00"
            value={tier.price}
            onChange={(val) => updateBulkTier(i, ti, { price: val ?? 0 })}
          />
          <button
            type="button"
            className={styles.btnDanger}
            aria-label={`Remove tier ${ti + 1}`}
            onClick={() => removeBulkTier(i, ti)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.btnOutline}
        onClick={() => addBulkTier(i)}
      >
        <Plus size={13} /> Add quantity tier
      </button>
    </>
  );

  const renderFixedQuantityPricing = (v: VariantDraft, i: number) => (
    <>
      <span className={styles.fieldHint}>
        Add each exact quantity a shopper can order and the total price for it —
        e.g. 25 for $100. Shoppers can only pick these quantities.
      </span>
      <div className={styles.qtyPricingHeader}>
        <span>Quantity</span>
        <span>Total price ($)</span>
        <span>Per item</span>
        <span />
      </div>
      {v.quantity_pricing.map((row, qi) => {
        const perItem =
          row.quantity > 0 && row.price > 0 ? row.price / row.quantity : null;
        return (
          <div key={qi} className={styles.qtyRow}>
            <NumberField
              ariaLabel={`Quantity ${qi + 1}`}
              placeholder="e.g. 25"
              value={row.quantity}
              onChange={(val) =>
                updateQuantityPrice(i, qi, { quantity: val ?? 0 })
              }
            />
            <NumberField
              allowDecimal
              ariaLabel={`Total price for quantity ${qi + 1}`}
              placeholder="e.g. 100"
              value={row.price}
              onChange={(val) =>
                updateQuantityPrice(i, qi, { price: val ?? 0 })
              }
            />
            <span className={styles.qtyPerItem}>
              {perItem !== null ? `$${perItem.toFixed(2)} each` : "—"}
            </span>
            <button
              type="button"
              className={styles.btnDanger}
              aria-label={`Remove quantity ${qi + 1}`}
              onClick={() => removeQuantityPrice(i, qi)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className={styles.btnOutline}
        onClick={() => addQuantityPrice(i)}
      >
        <Plus size={13} /> Add quantity
      </button>
    </>
  );

  const renderPricing = (v: VariantDraft, i: number) => {
    const isQuantityBased = v.pricing_mode !== "fixed";
    return (
      <>
        <div className={styles.dividerLabel}>Pricing</div>
        <label className={styles.samePriceCheckbox}>
          <input
            type="checkbox"
            checked={samePriceForAll}
            onChange={(e) => handleToggleSamePrice(i, e.target.checked)}
          />
          Use the same price for all variants
        </label>

        <div className={styles.pricingModeToggle}>
          <button
            type="button"
            aria-pressed={!isQuantityBased}
            className={`${styles.pricingModeBtn} ${!isQuantityBased ? styles.pricingModeBtnActive : ""}`}
            onClick={() => setTopLevelPricing(i, false)}
          >
            Fixed price
          </button>
          <button
            type="button"
            aria-pressed={isQuantityBased}
            className={`${styles.pricingModeBtn} ${isQuantityBased ? styles.pricingModeBtnActive : ""}`}
            onClick={() => setTopLevelPricing(i, true)}
          >
            Quantity-based pricing
          </button>
        </div>

        {!isQuantityBased ? (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className={styles.fieldGroup} style={{ maxWidth: 200 }}>
              <label>Price ($) *</label>
              <NumberField
                allowDecimal
                placeholder="12.99"
                value={v.price}
                onChange={(val) => updateVariantPricing(i, "price", val ?? 0)}
              />
            </div>
            {renderCasePriceField(v, i)}
          </div>
        ) : (
          <div className={styles.bulkPricing}>
            <div
              className={styles.quantityModeOptions}
              role="radiogroup"
              aria-label="Quantity pricing style"
            >
              {(Object.keys(QUANTITY_MODE_INFO) as QuantityPricingMode[]).map(
                (mode) => {
                  const active = v.pricing_mode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`${styles.quantityModeCard} ${active ? styles.quantityModeCardActive : ""}`}
                      onClick={() => setQuantityPricingMode(i, mode)}
                    >
                      <strong>
                        <span className={styles.quantityModeRadio} />
                        {QUANTITY_MODE_INFO[mode].label}
                      </strong>
                      <span>{QUANTITY_MODE_INFO[mode].description}</span>
                    </button>
                  );
                },
              )}
            </div>

            {v.pricing_mode === "tiered"
              ? renderTieredPricing(v, i)
              : renderFixedQuantityPricing(v, i)}

            <div style={{ marginTop: 8 }}>{renderCasePriceField(v, i)}</div>
          </div>
        )}
      </>
    );
  };

  /* ─── Step: Variants ─────────────────────────────────────────────── */
  const renderStepVariants = () => (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          Variants <span className={styles.countBadge}>{variants.length}</span>
        </span>
        <button className={styles.btnPrimary} onClick={addVariant}>
          <Plus size={14} /> Add variant
        </button>
      </div>

      {variants.map((v, i) => {
        const autoColorName = getColorNameFromHex(v.color_code);
        const selectedLabels = options
          .map((opt, oi) => {
            const val = opt.values.find(
              (ov) => ov._key === v.option_selections[oi],
            );
            return val?.name;
          })
          .filter(Boolean) as string[];

        const variantHasVisibleColor = hasColorOption || v.hasCustomColor;
        const variantTitle = selectedLabels.length
          ? selectedLabels.join(" • ")
          : v.hasCustomColor
            ? v.color || autoColorName || `Variant ${i + 1}`
            : `Variant ${i + 1}`;

        return (
          <div key={i} className={styles.subCard}>
            <div className={styles.variantCardHeader}>
              <div className={styles.variantTitleRow}>
                {variantHasVisibleColor ? (
                  <span
                    className={styles.colorBubble}
                    style={{ background: v.color_code }}
                  />
                ) : (
                  <span className={styles.variantIndexBubble}>{i + 1}</span>
                )}
                <span className={styles.cardTitle}>{variantTitle}</span>
                {v.sku && <span className={styles.pillTag}>{v.sku}</span>}
              </div>
              <div className={styles.variantHeaderActions}>
                <button
                  className={styles.btnOutline}
                  onClick={() => duplicateVariant(i)}
                  title="Copy this variant, then change the one value that's different"
                >
                  <Copy size={13} /> Duplicate
                </button>
                <button
                  className={styles.btnDanger}
                  onClick={() => removeVariant(i)}
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>

            {!hasColorOption && (
              <label className={styles.customColorToggle}>
                <input
                  type="checkbox"
                  checked={v.hasCustomColor}
                  onChange={(e) =>
                    updateVariant(i, "hasCustomColor", e.target.checked)
                  }
                />
                This variant has its own color{" "}
                <span className={styles.fieldHint}>
                  (optional — skip for books, mugs, ribbons, etc.)
                </span>
              </label>
            )}

            {!hasColorOption && v.hasCustomColor && (
              <div className={styles.colorSection}>
                <div
                  className={styles.colorPreviewBlock}
                  style={{ background: v.color_code }}
                >
                  <span
                    className={styles.colorPreviewLabel}
                    style={{
                      color: isLightColor(v.color_code) ? "var(--foreground)" : "var(--background)",
                    }}
                  >
                    {v.color || autoColorName}
                  </span>
                </div>
                <div className={styles.colorFields}>
                  <div className={styles.fieldGroup}>
                    <label>Color name</label>
                    <ColorNameAutocomplete
                      value={v.color}
                      placeholder="e.g. Navy Blue"
                      onSelectColor={(name, hex) => {
                        updateVariant(i, "color", name);
                        if (hex) updateVariant(i, "color_code", hex);
                      }}
                      onChangeText={(name) => updateVariant(i, "color", name)}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Color code</label>
                    <div className={styles.colorRow}>
                      <input
                        type="color"
                        value={v.color_code}
                        onChange={(e) =>
                          handleColorCodeChange(i, e.target.value)
                        }
                        className={styles.colorPicker}
                        aria-label="Color"
                      />
                      <input
                        value={v.color_code}
                        onChange={(e) =>
                          handleColorCodeChange(i, e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.dividerLabel}>Identity & stock</div>
            <div className={styles.fieldGrid3}>
              <div className={styles.fieldGroup}>
                <label>
                  SKU{" "}
                  <span className={styles.fieldHint}>
                    (optional — auto-generated if blank)
                  </span>
                </label>
                <input
                  value={v.sku}
                  onChange={(e) => updateVariant(i, "sku", e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label>Stock</label>
                <NumberField
                  placeholder="20"
                  value={v.stock}
                  onChange={(val) => updateVariant(i, "stock", val ?? 0)}
                />
              </div>
            </div>

            {options.length > 0 && (
              <>
                <div className={styles.dividerLabel}>Options</div>
                <div className={styles.fieldGrid3}>
                  {options.map((opt, oi) => (
                    <div key={oi} className={styles.fieldGroup}>
                      <label>{opt.name || `Option ${oi + 1}`}</label>
                      {opt.type === "color" ? (
                        <div className={styles.swatchPicker}>
                          {opt.values
                            .filter((val) => val.name.trim())
                            .map((val) => {
                              const active =
                                v.option_selections[oi] === val._key;
                              return (
                                <button
                                  type="button"
                                  key={val._key}
                                  className={`${styles.swatchOption} ${active ? styles.swatchOptionActive : ""}`}
                                  style={{ background: val.color_code }}
                                  title={val.name}
                                  aria-label={val.name}
                                  aria-pressed={active}
                                  onClick={() =>
                                    updateVariantOptionSelection(
                                      i,
                                      oi,
                                      val._key,
                                    )
                                  }
                                >
                                  {active && (
                                    <Check
                                      size={12}
                                      color={
                                        isLightColor(val.color_code || "#fff")
                                          ? "var(--foreground)"
                                          : "var(--background)"
                                      }
                                    />
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      ) : (
                        <select
                          value={v.option_selections[oi] ?? ""}
                          onChange={(e) =>
                            updateVariantOptionSelection(
                              i,
                              oi,
                              e.target.value === "" ? null : e.target.value,
                            )
                          }
                        >
                          <option value="">
                            Select {opt.name || `Option ${oi + 1}`}
                          </option>
                          {opt.values
                            .filter((val) => val.name.trim())
                            .map((val) => (
                              <option key={val._key} value={val._key}>
                                {val.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {renderPricing(v, i)}

            <div className={styles.dividerLabel}>Variant images</div>
            <div className={styles.imageGrid}>
              {v.sourceImages.map((img) => (
                <div
                  className={`${styles.imageTile} ${styles.smallTile}`}
                  key={img.id}
                >
                  <img src={img.file_uri} alt="" />
                  <button
                    className={styles.removeImg}
                    onClick={() => removeSourceVariantImage(i, img.id)}
                    aria-label="Remove image"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {v.newPreviews.map((src, idx) => (
                <div
                  className={`${styles.imageTile} ${styles.smallTile} ${styles.newTile}`}
                  key={`nv-${idx}`}
                >
                  <img src={src} alt="" />
                  <button
                    className={styles.removeImg}
                    onClick={() => removeNewVariantImage(i, idx)}
                    aria-label="Remove image"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              <label
                className={`${styles.imageTile} ${styles.smallTile} ${styles.addTile}`}
              >
                <Plus size={14} />
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  hidden
                  onChange={(e) => {
                    addVariantImages(i, e.target.files);
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
  );

  /* ─── Step: Use Cases (applied after the copy is created) ────────── */
  const renderStepUseCases = () => {
    const manual = sourceUseCases.filter((u) => u.source === "manual");
    const fromCategory = sourceUseCases.filter((u) => u.source === "category");

    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Use Cases</span>
          <span className={styles.cardHint}>
            Applied when the copy is created
          </span>
        </div>

        {sourceUseCases.length === 0 ? (
          <div className={styles.emptyState}>
            The original isn't in any use case. You can add the copy to use
            cases from Edit after it's created.
          </div>
        ) : (
          <>
            {manual.length > 0 && (
              <>
                <div className={styles.dividerLabel}>
                  Added manually to the original
                </div>
                <div className={styles.ucCopyList}>
                  {manual.map((uc) => (
                    <label key={uc.id} className={styles.ucCopyRow}>
                      <input
                        type="checkbox"
                        checked={copyUseCaseIds.includes(uc.id)}
                        onChange={() => toggleCopyUseCase(uc.id)}
                      />
                      <Hand size={12} />
                      <span>
                        {uc.title}
                        {uc.industry && (
                          <span className={styles.ucChipIndustry}>
                            {" "}
                            ({uc.industry})
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {fromCategory.length > 0 && (
              <>
                <div className={styles.dividerLabel}>
                  Comes from the product's categories
                </div>
                <div className={styles.ucChipList}>
                  {fromCategory.map((uc) => (
                    <div key={uc.id} className={styles.ucChip}>
                      <Layers size={12} />
                      <span>
                        {uc.title}
                        {uc.industry && (
                          <span className={styles.ucChipIndustry}>
                            {" "}
                            ({uc.industry})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <span className={styles.fieldHint}>
                  The copy gets these automatically as long as it keeps the same
                  categories.
                </span>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  /* ─── Step: Add-ons (applied after the copy is created) ──────────── */
  const renderStepAddOns = () => (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          Add-ons
          {addOnsToCopy.length > 0 && (
            <span className={styles.badge}>{addOnsToCopy.length} selected</span>
          )}
        </span>
        <span className={styles.cardHint}>
          Applied when the copy is created
        </span>
      </div>

      {addOnDrafts.length === 0 ? (
        <div className={styles.emptyState}>
          The original has no add-ons. You can add them to the copy from the
          Add-ons step in Edit after it's created.
        </div>
      ) : (
        <>
          <div className={styles.dividerLabel}>From the original</div>
          <div className={styles.addonList}>
            {addOnDrafts.map((a) => {
              const image = getAddOnImageUrl(a.image);
              const priceNum = Number(a.price);
              const isCustomPrice =
                a.addonPrice !== null &&
                a.price !== "" &&
                priceNum !== a.addonPrice;

              return (
                <div
                  key={a.addon_product_id}
                  className={`${styles.addonRow} ${
                    !a.selected ? styles.addonRowOff : ""
                  }`}
                >
                  <label className={styles.addonMain}>
                    <input
                      type="checkbox"
                      checked={a.selected}
                      disabled={!a.available}
                      onChange={() => toggleCopyAddOn(a.addon_product_id)}
                    />
                    <span className={styles.addonThumb}>
                      {image ? (
                        <Thumbnail src={image} />
                      ) : (
                        <ImageOff size={14} />
                      )}
                    </span>
                    <span className={styles.addonInfo}>
                      <span className={styles.addonName}>{a.name}</span>
                      {a.available ? (
                        <span className={styles.addonMeta}>
                          Default ${(a.addonPrice ?? 0).toFixed(2)}
                          {isCustomPrice && " · custom price on the original"}
                        </span>
                      ) : (
                        <span className={styles.addonUnavailable}>
                          No longer available — won't be copied
                        </span>
                      )}
                    </span>
                  </label>

                  {a.available && (
                    <div className={styles.addonPriceWrap}>
                      <label
                        className={styles.addonPriceLabel}
                        htmlFor={`addon-price-${a.addon_product_id}`}
                      >
                        Price on copy
                      </label>
                      <div
                        className={`${styles.addonPrice} ${
                          isCustomPrice ? styles.addonPriceCustom : ""
                        }`}
                      >
                        <span>$</span>
                        <input
                          id={`addon-price-${a.addon_product_id}`}
                          type="text"
                          inputMode="decimal"
                          value={a.price}
                          disabled={!a.selected}
                          onChange={(e) =>
                            updateAddOnPrice(a.addon_product_id, e.target.value)
                          }
                          onBlur={() => normalizeAddOnPrice(a.addon_product_id)}
                          placeholder="0.00"
                        />
                      </div>
                      {isCustomPrice && a.selected && (
                        <button
                          type="button"
                          className={styles.addonReset}
                          onClick={() => resetAddOnPrice(a.addon_product_id)}
                        >
                          Use default
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <span className={styles.fieldHint}>
            Prices start at what the original charges. Untick an add-on to leave
            it off the copy.
          </span>
        </>
      )}
    </div>
  );

  // Same order as STEPS at the top of the file.
  const stepRenderers = [
    renderStepBasic,
    renderStepCustomizations,
    renderStepOptions,
    renderStepVariants,
    renderStepUseCases,
    renderStepAddOns,
  ];
  const isLastStep = currentStep === STEPS.length - 1;

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => navigate("/products")}
          aria-label="Back to products"
        >
          <ArrowLeft size={18} />
        </button>
        <div className={styles.headerTitle}>
          <h1>Duplicate Product</h1>
          <p>Copy of {originalName || "product"}</p>
        </div>
        <button
          className={styles.saveBtn}
          onClick={handleCreateCopy}
          disabled={saving}
        >
          <Copy size={16} />
          {saving ? "Creating copy…" : "Create copy"}
        </button>
      </div>

      <div className={styles.stepper}>
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`${styles.stepBtn} ${i === currentStep ? styles.stepActive : ""}`}
            onClick={() => setCurrentStep(i)}
            aria-current={i === currentStep ? "step" : undefined}
          >
            <span className={styles.stepNum}>{i + 1}</span>
            <span className={styles.stepLabel}>{label}</span>
          </button>
        ))}
      </div>

      <GuideCard open={guideOpen} onToggle={() => setGuideOpen((v) => !v)} />

      {stepRenderers[currentStep]()}

      <div className={styles.navBar}>
        {currentStep > 0 ? (
          <button
            className={styles.btnOutline}
            onClick={() => setCurrentStep((s) => s - 1)}
          >
            <ArrowLeftCircle size={15} /> Back
          </button>
        ) : (
          <span />
        )}
        {isLastStep ? (
          <button
            className={styles.btnPrimary}
            onClick={handleCreateCopy}
            disabled={saving}
          >
            <Copy size={15} />
            {saving ? "Creating copy…" : "Create copy"}
          </button>
        ) : (
          <button className={styles.btnPrimary} onClick={handleNext}>
            Next <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
};

export default DuplicateManualProduct;
