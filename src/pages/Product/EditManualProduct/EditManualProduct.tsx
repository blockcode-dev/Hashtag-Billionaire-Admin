/** @format */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AutoComplete, message, Modal, Pagination, Select, Spin } from "antd";

import {
  ArrowLeft,
  ArrowLeftCircle,
  ArrowRight,
  Save,
  Plus,
  Copy,
  Trash2,
  Info,
  Check,
  X,
  Search,
  Hand,
  Layers,
  Link2,
  UploadCloud,
  Lightbulb,
  ChevronDown,
} from "lucide-react";

import {
  GetProductByIdAPI,
  UpdateManualProductFullAPI,
} from "@/services/Api/ProductApi";
import {
  GetAllCategoriesAPI,
  CreateCategoryAPI,
  UpdateCategoryAPI,
  DeleteCategoryAPI,
  GetParentCategoriesAPI,
  AddCategoryToParentAPI,
  RemoveCategoryFromParentAPI,
} from "@/services/Api/ParentCategoryApi";
import {
  GetGrandCategoriesAPI,
  AddParentToGrandAPI,
  RemoveParentFromGrandAPI,
} from "@/services/Api/GrandCategoryApi";
import { GetPublishedBrandsAPI } from "@/services/Api/BrandsApi";
import {
  ClearUseCaseProductOverrideAPI,
  ExcludeProductsFromUseCaseAPI,
  GetUseCasesForProductAPI,
  AddProductsToUseCaseAPI,
  GetUseCasesAPI,
} from "@/services/Api/IndustryApi";

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
  parseJsonObject,
  pricingFromVariant,
} from "@/utils/variantPricing";

import styles from "./EditManualProduct.module.scss";
import ProductAddOnsStep from "@/pages/AddOns/ProductAddOnsStep";
import ProductCustomizationsStep from "@/pages/Customization/ProductCustomizationsStep";

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
  id?: number;
  // Stable local identity for this value, used for React keys AND for
  // variant selection — NOT the same as `id`. A brand-new value (added
  // via "Add value") has no `id` yet since the backend hasn't created
  // its Size row, but it still needs something stable to be selectable
  // in the Variants step immediately. Existing values get `_key =
  // String(id)`; new values get a generated placeholder key.
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

interface VariantImage {
  id: number;
  file_uri: string;
  is_primary: boolean;
}

// Pricing fields (price, case_price, pricing_mode, bulk_pricing,
// quantity_pricing) come from the shared VariantPricing shape so Create
// and Edit read/validate/send exactly the same thing.
interface VariantDraft extends VariantPricing {
  id?: number;
  sku: string;
  color: string;
  color_code: string;
  stock: number;
  // Index-aligned with the product's `options` array — option_selections[oi]
  // holds the selected OptionValueDraft's `_key` for options[oi], or null.
  option_selections: (string | null)[];
  existingImages: VariantImage[];
  keepImageIds: number[];
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

// Every step can be opened directly from the stepper — no step blocks
// another. Keep this list and `stepRenderers` (inside the component) in
// the same order.
const STEPS = [
  "Basic Info",
  "Customizations",
  "Options",
  "Variants",
  "Category Hierarchy",
  "Use Cases",
  "Add-ons",
] as const;

const BASIC_STEP = STEPS.indexOf("Basic Info");
const VARIANTS_STEP = STEPS.indexOf("Variants");

const OPTION_TYPE_LABELS: Record<OptionType, string> = {
  dropdown: "📋 Drop-down List",
  color: "🎨 Color",
  buttons: "🔘 Radio Buttons",
  size: "👕 Size",
  checkbox: "☑️ Checkboxes",
};

const DEFAULT_MEASUREMENTS = (): Measurements => ({
  chest: "",
  shoulder: "",
  length: "",
  sleeve_length: "",
  neck: "",
});

// Generates a stable local key for option values that don't have a
// backend Size id yet. Never sent to the backend.
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
  existingImages: [],
  keepImageIds: [],
  newFiles: [],
  newPreviews: [],
  hasCustomColor: false,
});

const CAT_LIMIT = 50;

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
            border: "1px solid #d9d9d9",
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
      filterOption={(inputValue, option) =>
        !!option?.value &&
        (option.value as string)
          .toLowerCase()
          .includes(inputValue.toLowerCase())
      }
      onSelect={(val) =>
        onSelectColor(val as string, getHexFromColorName(val as string))
      }
      onChange={(val) => onChangeText(val)}
      placeholder={placeholder || "Pick a color or type any name"}
    />
  );
};

/* ─── Category hierarchy add-select ───────────────────────────────────
   Hoisted to module scope: it used to be declared inside the page
   component, which made React treat it as a brand-new component type on
   every render — unmounting it, losing its loaded options, and closing
   the dropdown whenever anything else on the page changed. */
const CategoryAddSelect: React.FC<{
  placeholder: string;
  fetchAllFn: () => Promise<{ id: number; title: string }[]>;
  excludeIds: number[];
  onAdd: (id: number, title: string) => Promise<void> | void;
}> = ({ placeholder, fetchAllFn, excludeIds, onAdd }) => {
  const [allOptions, setAllOptions] = useState<{ id: number; title: string }[]>(
    [],
  );
  const [loaded, setLoaded] = useState(false);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [adding, setAdding] = useState(false);

  const ensureLoaded = async () => {
    if (loaded || loadingOpts) return;
    setLoadingOpts(true);
    try {
      const results = await fetchAllFn();
      setAllOptions(results);
      setLoaded(true);
    } catch {
      setAllOptions([]);
    } finally {
      setLoadingOpts(false);
    }
  };

  const opts = allOptions
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
    <Select
      showSearch
      value={undefined}
      placeholder={placeholder}
      className={styles.catHierarchyAddSelect}
      optionFilterProp="label"
      onDropdownVisibleChange={(open) => {
        if (open) ensureLoaded();
      }}
      onChange={handleChange}
      loading={loadingOpts || adding}
      disabled={adding}
      notFoundContent={
        loadingOpts ? <Spin size="small" /> : "Nothing left to add"
      }
      options={opts}
      suffixIcon={<Plus size={13} />}
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
      How editing a manual product works
      <ChevronDown size={15} className={styles.guideChevron} />
    </button>
    {open && (
      <div className={styles.guideBody}>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>1</span>
          <span>
            Click any step above to jump straight to it — nothing here has to be
            done in order.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>2</span>
          <span>
            <strong>Customizations</strong> — tick the customizations this
            product offers (like Engraving or Material), then pick which of
            their values customers can choose. Prices come from the
            Customizations page and are added to every item in the order.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>3</span>
          <span>
            <strong>Options & Variants</strong> — add new option values, rename
            them, or add brand-new variants the same way you would on Add
            Product. A value you just added shows up tagged
            <strong> (New)</strong> in the Variants step right away — nothing is
            sent to the server until you press Save. Use{" "}
            <strong>Duplicate</strong> on a variant card to copy it, then change
            the one value that's different.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>4</span>
          <span>
            <strong>Pricing</strong> — Fixed price, or Quantity-based with two
            styles: <strong>Variable ranges</strong> (1–10 at $20, 11+ at $18)
            or <strong>Fixed quantities</strong> (25 for $100, 50 for $180).
            Prices can have decimals, like 0.10.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>5</span>
          <span>
            <strong>Customizations</strong>, <strong>Category Hierarchy</strong>
            , <strong>Use Cases</strong> and <strong>Add-ons</strong> save
            immediately when you make a change there — they don't wait for the
            main Save button.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>6</span>
          <span>
            <strong>Save Changes</strong> (top right) saves Basic Info, Options,
            and Variants together.
          </span>
        </div>
      </div>
    )}
  </div>
);

/* ─── Component ────────────────────────────────────────────────────── */

const EditManualProduct: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);

  /* Basic info */
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [existingProductImages, setExistingProductImages] = useState<
    { id: number; file_uri: string; is_primary: boolean }[]
  >([]);
  const [keepProductImageIds, setKeepProductImageIds] = useState<number[]>([]);
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

  /* Category hierarchy */
  const [productCategoryHierarchy, setProductCategoryHierarchy] = useState<
    CategoryWithHierarchy[]
  >([]);
  const [removingChipId, setRemovingChipId] = useState<string | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);

  /* Use cases */
  const [productUseCases, setProductUseCases] = useState<ProductUseCase[]>([]);
  const [ucLoading, setUcLoading] = useState(false);
  const [ucActionId, setUcActionId] = useState<number | null>(null);
  const [ucPickerOpen, setUcPickerOpen] = useState(false);
  const [ucSearch, setUcSearch] = useState("");
  const [ucOptions, setUcOptions] = useState<UseCaseOption[]>([]);
  const [ucSearchLoading, setUcSearchLoading] = useState(false);
  const [ucAdding, setUcAdding] = useState(false);

  const productIdRef = useRef<number | null>(null);

  /* ─── Fetch product & bootstrap all drafts ─────────────────────────── */
  const fetchProduct = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await GetProductByIdAPI(id);
      const data = res?.data?.data;
      if (!data) throw new Error("Not found");

      if (data.supplier !== "MANUAL") {
        message.error("This page only supports manually-created products.");
        navigate(`/products/${id}/edit`);
        return;
      }

      productIdRef.current = data.id;
      setProductName(data.name || "");
      setDescription(data.description || "");
      setBrandId(data.brand_id ?? null);
      setExistingProductImages(data.attachments || []);
      setKeepProductImageIds((data.attachments || []).map((a: any) => a.id));

      const productMeta = parseJsonObject(data.meta);
      const metaOptions: any[] = Array.isArray(productMeta.options)
        ? (productMeta.options as any[])
        : [];

      const sizes: any[] = data.sizes || [];

      const optionDrafts: OptionDraft[] = metaOptions.map((opt: any) => {
        const displayStyle: OptionType =
          opt.display_style || opt.type || "dropdown";

        const type: OptionType = displayStyle;

        const values: OptionValueDraft[] = (opt.values || []).map((v: any) => {
          const matchingSize =
            (v.id && sizes.find((s) => s.id === Number(v.id))) ||
            sizes.find((s) => s.type === opt.name && s.name === v.name);

          return {
            id: matchingSize?.id,
            _key: matchingSize?.id ? String(matchingSize.id) : genLocalKeyId(),
            name: v.name,
            color_code: v.color_code,
            measurements: v.measurements || undefined,
          };
        });

        return {
          name: opt.name,
          type,
          display_style: displayStyle,
          values,
        };
      });

      const coveredSizeIds = new Set(
        optionDrafts.flatMap((o) => o.values.map((v) => v.id).filter(Boolean)),
      );
      const leftoverByType = new Map<
        string,
        {
          values: OptionValueDraft[];
          display_style: OptionType;
        }
      >();

      sizes.forEach((s) => {
        if (coveredSizeIds.has(s.id)) return;

        const displayStyle: OptionType = s.display_style || "dropdown";
        const existing = leftoverByType.get(s.type);

        if (existing) {
          existing.values.push({
            id: s.id,
            _key: String(s.id),
            name: s.name,
            measurements: s.measurements || undefined,
          });
        } else {
          leftoverByType.set(s.type, {
            display_style: displayStyle,
            values: [
              {
                id: s.id,
                _key: String(s.id),
                name: s.name,
                measurements: s.measurements || undefined,
              },
            ],
          });
        }
      });

      leftoverByType.forEach((data, typeName) => {
        optionDrafts.push({
          name: typeName,
          type: data.display_style,
          display_style: data.display_style,
          values: data.values,
        });
      });

      setOptions(optionDrafts);

      const hasColorOptionAtLoad = optionDrafts.some(
        (o) => o.type === "color" && o.values.some((v) => v.name.trim()),
      );

      const variantDrafts: VariantDraft[] = (data.variants || []).map(
        (v: any) => {
          const variantMeta = parseJsonObject(v.meta);
          const optionValues: any[] = Array.isArray(variantMeta.option_values)
            ? (variantMeta.option_values as any[])
            : [];

          // Index-aligned with optionDrafts, NOT keyed by name.
          const selections: (string | null)[] = optionDrafts.map(() => null);

          optionValues.forEach((ov) => {
            if (!ov?.name || !ov?.value) return;
            const oi = optionDrafts.findIndex((o) => o.name === ov.name);
            if (oi === -1) return;
            const matchedValue = optionDrafts[oi].values.find(
              (val) => val.name === ov.value,
            );
            if (matchedValue) selections[oi] = matchedValue._key;
          });

          if (v.size_id && optionValues.length === 0) {
            for (let oi = 0; oi < optionDrafts.length; oi++) {
              const match = optionDrafts[oi].values.find(
                (val) => val.id === v.size_id,
              );
              if (match) {
                selections[oi] = match._key;
                break;
              }
            }
          }

          const hasColor = !!(v.color && String(v.color).trim());

          return {
            // fixed / tiered / quantity_fixed — read the same way the
            // backend infers it.
            ...pricingFromVariant(v),
            id: v.id,
            sku: v.sku || "",
            color: v.color || "",
            color_code: v.color_code || "#1E3A8A",
            stock: Number(v.stock || 0),
            option_selections: selections,
            existingImages: v.images || [],
            keepImageIds: (v.images || []).map((img: any) => img.id),
            newFiles: [],
            newPreviews: [],
            hasCustomColor: !hasColorOptionAtLoad && hasColor,
          };
        },
      );

      setVariants(
        variantDrafts.length
          ? variantDrafts
          : [DEFAULT_VARIANT(optionDrafts.length)],
      );

      setProductCategoryHierarchy(data.categories || []);
      setSelectedCatIds((data.categories || []).map((c: any) => c.id));
      setAllLoadedCategories(data.categories || []);

      await fetchBrands();
      await fetchCategories(1, "");
    } catch (err) {
      console.error(err);
      message.error("Failed to load product");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  // Keep Category Hierarchy in sync with the category picker.
  useEffect(() => {
    setProductCategoryHierarchy((prev) => {
      const prevMap = new Map(prev.map((c) => [c.id, c]));
      return selectedCatIds.map((catId) => {
        const existing = prevMap.get(catId);
        if (existing) return existing;
        const catRef = allLoadedCategories.find((c) => c.id === catId);
        return {
          id: catId,
          title: catRef?.title || `Category #${catId}`,
          supplier: catRef?.supplier,
          parent_categories: [],
        };
      });
    });
  }, [selectedCatIds, allLoadedCategories]);

  /* ─── Brands & Categories fetch ──────────────────────────────────── */
  const fetchBrands = async () => {
    try {
      const res = await GetPublishedBrandsAPI({ page: 1, limit: 500 });
      setBrands(res?.data?.data?.data || []);
    } catch {
      message.error("Failed to fetch brands");
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
      message.error("Failed to fetch categories");
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

  const handleCreateCategory = async () => {
    const title = newCategoryName.trim();
    if (!title) return;
    setCreatingCategory(true);
    try {
      const res = await CreateCategoryAPI({ title, supplier: "MANUAL" });
      const created: CategoryRef | undefined = res?.data?.data;
      message.success("Category created");
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
      message.error(
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
      message.success("Category updated");
      setCategories((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, title } : c)),
      );
      setAllLoadedCategories((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, title } : c)),
      );
      cancelEditCategory();
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || "Failed to update category",
      );
    } finally {
      setSavingCategoryEdit(false);
    }
  };
  const handleDeleteCategory = (cat: CategoryRef) => {
    Modal.confirm({
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
          message.success("Category deleted");
          setCategories((prev) => prev.filter((c) => c.id !== cat.id));
          setAllLoadedCategories((prev) => prev.filter((c) => c.id !== cat.id));
          setSelectedCatIds((prev) => prev.filter((cid) => cid !== cat.id));
        } catch (err: any) {
          message.error(
            err?.response?.data?.message || "Failed to delete category",
          );
        } finally {
          setDeletingCategoryId(null);
        }
      },
    });
  };

  /* ─── Option helpers ─────────────────────────────────────────────── */
  const addOption = () => {
    setOptions((prev) => [
      ...prev,
      {
        name: "",
        type: "dropdown",
        display_style: "dropdown",
        values: [],
      },
    ]);
  };

  const removeOption = (oi: number) => {
    const opt = options[oi];
    const usedIds = new Set(
      variants.map((v) => v.option_selections[oi]).filter(Boolean),
    );
    if (usedIds.size > 0) {
      message.error(`Can't remove "${opt.name}" — a variant still uses it.`);
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

  const updateOptionName = (oi: number, name: string) => {
    setOptions((prev) => {
      const updated = [...prev];
      updated[oi] = { ...updated[oi], name };
      return updated;
    });
  };

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
    const opt = options[oi];
    const value = opt.values[vi];
    const usedByVariant = variants.some(
      (v) => v.option_selections[oi] === value._key,
    );
    if (usedByVariant) {
      message.error(`Can't remove "${value.name}" — a variant still uses it.`);
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

  // SKU auto-changes on duplicate so a copy never shares its source's SKU.
  const duplicateVariant = (i: number) => {
    setVariants((prev) => {
      const source = prev[i];
      const nextSku = source.sku
        ? `${source.sku.replace(/-COPY(-\d+)?$/i, "")}-COPY-${Math.floor(Math.random() * 900 + 100)}`
        : "";
      const clone: VariantDraft = {
        ...source,
        ...clonePricing(source),
        id: undefined,
        sku: nextSku,
        option_selections: [...source.option_selections],
        existingImages: [],
        keepImageIds: [],
        newFiles: [],
        newPreviews: [],
      };
      const updated = [...prev];
      updated.splice(i + 1, 0, clone);
      return updated;
    });
    message.info(
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

  // Applies pricing fields to variant i — or to every variant when
  // "same price for all" is on.
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

  // Fixed price vs Quantity-based. Switching INTO quantity-based defaults to
  // Variable ranges; if already quantity-based, its sub-mode is kept.
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

  // Variable ranges vs Fixed quantities.
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

  const addVariantImages = (i: number, files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
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
  const removeExistingVariantImage = (i: number, imgId: number) => {
    setVariants((prev) =>
      prev.map((v, idx) =>
        idx === i
          ? {
              ...v,
              existingImages: v.existingImages.filter(
                (img) => img.id !== imgId,
              ),
              keepImageIds: v.keepImageIds.filter((x) => x !== imgId),
            }
          : v,
      ),
    );
  };
  const removeNewVariantImage = (i: number, idx: number) => {
    setVariants((prev) =>
      prev.map((v, vidx) =>
        vidx === i
          ? {
              ...v,
              newFiles: v.newFiles.filter((_, fi) => fi !== idx),
              newPreviews: v.newPreviews.filter((_, fi) => fi !== idx),
            }
          : v,
      ),
    );
  };

  /* ─── Product image helpers ──────────────────────────────────────── */
  const removeExistingProductImage = (attId: number) => {
    setExistingProductImages((prev) => prev.filter((a) => a.id !== attId));
    setKeepProductImageIds((prev) => prev.filter((x) => x !== attId));
  };
  const addProductImages = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
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

  /* ─── Category Hierarchy handlers ────────────────────────────────── */
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
      message.success(`Added to "${parentTitle}"`);
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
      message.error(
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
      message.error(
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
      message.success(`Added to "${grandTitle}"`);
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
      message.error(err?.response?.data?.message || "Failed to add category");
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
      message.error(
        err?.response?.data?.message || "Failed to remove category",
      );
    } finally {
      setRemovingChipId(null);
    }
  };

  /* ─── Use Cases handlers ─────────────────────────────────────────── */
  const loadProductUseCases = useCallback(async () => {
    if (!id) return;
    try {
      setUcLoading(true);
      const res = await GetUseCasesForProductAPI(Number(id));
      setProductUseCases(res?.data?.data || []);
    } catch {
      message.error("Failed to load use cases");
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
    if (!productIdRef.current) return;
    try {
      setUcAdding(true);
      await AddProductsToUseCaseAPI(useCaseId, [productIdRef.current]);
      message.success(`Added to "${title}"`);
      setUcPickerOpen(false);
      setUcSearch("");
      setUcOptions([]);
      await loadProductUseCases();
    } catch {
      message.error("Failed to add to use case");
    } finally {
      setUcAdding(false);
    }
  };

  const handleRemoveFromUseCase = async (uc: ProductUseCase) => {
    if (!productIdRef.current) return;
    try {
      setUcActionId(uc.id);
      if (uc.source === "manual") {
        await ClearUseCaseProductOverrideAPI(uc.id, productIdRef.current);
      } else {
        await ExcludeProductsFromUseCaseAPI(uc.id, [productIdRef.current]);
      }
      setProductUseCases((prev) => prev.filter((x) => x.id !== uc.id));
      message.success(`Removed from "${uc.title}"`);
    } catch {
      message.error("Failed to remove from use case");
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

  /* ─── Validation ─────────────────────────────────────────────────── */
  const validateBasic = (): boolean => {
    if (!productName.trim()) {
      message.error("Product name is required");
      return false;
    }
    return true;
  };

  const validateVariants = (): boolean => {
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const label = `Variant ${i + 1}${v.sku ? ` (${v.sku})` : ""}`;

      for (let oi = 0; oi < options.length; oi++) {
        const opt = options[oi];
        if (!opt.name.trim() || opt.values.length === 0) continue;
        const selection = v.option_selections[oi];
        if (selection === null || selection === undefined) {
          message.error(`${label}: pick a value for "${opt.name}"`);
          return false;
        }
      }
    }

    const realOptionIndexes = options
      .map((opt, oi) => (opt.name.trim() && opt.values.length > 0 ? oi : null))
      .filter((oi): oi is number => oi !== null);

    if (realOptionIndexes.length > 0) {
      const seenSignatures = new Map<string, number>();
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const sig = realOptionIndexes
          .map((oi) => `${oi}:${v.option_selections[oi]}`)
          .join("|");
        if (seenSignatures.has(sig)) {
          const firstIdx = seenSignatures.get(sig)!;
          message.error(
            `Variant ${firstIdx + 1} and Variant ${i + 1} are the same — change one of them before saving.`,
          );
          return false;
        }
        seenSignatures.set(sig, i);
      }
    }

    const skuSet = new Set<string>();
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const label = `Variant ${i + 1}`;

      // SKU is optional — the backend generates one when it's blank. Only
      // SKUs typed here are checked for duplicates.
      const sku = v.sku.trim();
      if (sku) {
        if (skuSet.has(sku)) {
          message.error(`Duplicate SKU: ${sku}`);
          return false;
        }
        skuSet.add(sku);
      }

      // Same pricing rules as Create Product.
      const pricingError = getPricingError(v, label);
      if (pricingError) {
        message.error(pricingError);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === BASIC_STEP && !validateBasic()) return;
    if (currentStep === VARIANTS_STEP && !validateVariants()) return;
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  /* ─── Save ────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!validateBasic()) {
      setCurrentStep(BASIC_STEP);
      return;
    }
    if (!validateVariants()) {
      setCurrentStep(VARIANTS_STEP);
      return;
    }
    // if (!validateBasic()) {
    //   setCurrentStep(0);
    //   return;
    // }
    // if (!validateVariants()) {
    //   setCurrentStep(2);
    //   return;
    // }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("product_id", String(productIdRef.current));
      formData.append("name", productName.trim());
      formData.append("description", description || "");
      formData.append("brand_id", brandId ? String(brandId) : "");
      formData.append("category_ids", JSON.stringify(selectedCatIds));
      formData.append(
        "keep_product_image_ids",
        JSON.stringify(keepProductImageIds),
      );
      newProductFiles.forEach((file) => formData.append("images", file));

      const cleanedOptions = options
        .map((opt) => ({
          name: opt.name.trim(),
          type: opt.type,
          display_style: opt.display_style || opt.type || "dropdown",
          values: opt.values
            .filter((v) => v.name.trim())
            .map((v) => ({
              id: v.id,
              name: v.name.trim(),
              ...(opt.type === "color" ? { color_code: v.color_code } : {}),
              ...(opt.type === "size" && v.measurements
                ? { measurements: v.measurements }
                : {}),
            })),
        }))
        .filter((opt) => opt.name && opt.values.length > 0);

      formData.append("options", JSON.stringify(cleanedOptions));

      const formattedVariants = variants.map((v) => {
        const optionValues = options
          .map((opt, oi) => {
            const valueKey = v.option_selections[oi];
            if (valueKey === null || valueKey === undefined) return null;
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

        const includeColor = hasColorOption || v.hasCustomColor;

        return {
          id: v.id,
          // Blank = the backend generates one (MAN-<productId>-001…).
          sku: v.sku.trim(),
          // price, case_price, pricing_mode, bulk_pricing, quantity_pricing
          // — identical shape to Create Product.
          ...buildPricingPayload(v),
          stock: Number(v.stock || 0),
          color: includeColor ? v.color || null : null,
          color_code: includeColor ? v.color_code || null : null,
          option_values: optionValues,
          keep_image_ids: v.keepImageIds,
          image_count: v.newFiles.length,
        };
      });

      formData.append("variants", JSON.stringify(formattedVariants));
      variants.forEach((v) => {
        v.newFiles.forEach((file) => formData.append("variant_images", file));
      });

      await UpdateManualProductFullAPI(formData);
      message.success("Product updated successfully");
      navigate("/products");
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Spin size="large" />
      </div>
    );
  }

  /* ─── Step renderers ─────────────────────────────────────────────── */

  const renderStepBasic = () => (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Basic info</span>
        </div>
        <div className={styles.fieldGrid}>
          <div className={styles.fieldGroup}>
            <label>
              Product name <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label>Brand</label>
            <Select
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
                const manual = isManualCategory(cat);
                const isEditing = editingCategoryId === cat.id;
                if (isEditing) {
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
                    className={`${styles.catItem} ${selectedCatIds.includes(cat.id) ? styles.catItemSelected : ""}`}
                  >
                    <div
                      className={styles.catItemMain}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <span
                        className={`${styles.catCheck} ${selectedCatIds.includes(cat.id) ? styles.catCheckOn : ""}`}
                      >
                        {selectedCatIds.includes(cat.id) && <Check size={10} />}
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
                    {manual && (
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
                    <button onClick={() => toggleCategory(cat.id)}>×</button>
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
        </div>
        <div className={styles.imageGrid}>
          {existingProductImages.map((att) => (
            <div className={styles.imageTile} key={att.id}>
              <img src={att.file_uri} alt="" />
              <button
                className={styles.removeImg}
                onClick={() => removeExistingProductImage(att.id)}
                aria-label="Remove image"
              >
                <X size={12} />
              </button>
              {att.is_primary && (
                <span className={styles.primaryTag}>Primary</span>
              )}
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
              accept="image/*"
              multiple
              hidden
              onChange={(e) => addProductImages(e.target.files)}
            />
          </label>
        </div>
      </div>
    </>
  );

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
        options.map((option, oi) => {
          const isColorType = option.type === "color";
          return (
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
                    {isColorType && (
                      <input
                        type="color"
                        value={value.color_code || "#1E3A8A"}
                        onChange={(e) =>
                          updateOptionValueColorCode(oi, vi, e.target.value)
                        }
                        className={styles.colorPicker}
                      />
                    )}
                    <input
                      value={value.name}
                      onChange={(e) =>
                        updateOptionValueName(oi, vi, e.target.value)
                      }
                      placeholder="Value name"
                    />
                    {!value.id && <span className={styles.newBadge}>New</span>}
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
          );
        })
      )}
    </div>
  );

  /* ─── Pricing block (per variant) — same UI and rules as Create ───── */

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
            const valKey = v.option_selections[oi];
            const val = opt.values.find((ov) => ov._key === valKey);
            return val?.name;
          })
          .filter(Boolean) as string[];

        const variantHasVisibleColor = hasColorOption ? true : v.hasCustomColor;

        const variantTitle = selectedLabels.length
          ? selectedLabels.join(" • ")
          : v.hasCustomColor
            ? v.color || autoColorName || `Variant ${i + 1}`
            : `Variant ${i + 1}`;

        return (
          <div key={v.id ?? `new-${i}`} className={styles.subCard}>
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
                {!v.id && <span className={styles.newBadge}>New</span>}
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
                      color: isLightColor(v.color_code) ? "#333" : "#fff",
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
                                  title={val.name + (!val.id ? " (New)" : "")}
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
                                          ? "#333"
                                          : "#fff"
                                      }
                                    />
                                  )}
                                  {!val.id && (
                                    <span
                                      className={styles.swatchNewDot}
                                      title="Just added — not saved yet"
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
                                {!val.id ? " (New)" : ""}
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
              {v.existingImages.map((img) => (
                <div
                  className={`${styles.imageTile} ${styles.smallTile}`}
                  key={img.id}
                >
                  <img src={img.file_uri} alt="" />
                  <button
                    className={styles.removeImg}
                    onClick={() => removeExistingVariantImage(i, img.id)}
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
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => addVariantImages(i, e.target.files)}
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderStepHierarchy = () => (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Category Hierarchy</span>
        <button
          className={styles.howToTrigger}
          onClick={() => setHowToOpen((p) => !p)}
        >
          <Info size={13} /> How this works
        </button>
      </div>

      {howToOpen && (
        <div className={styles.howToBox}>
          Pick a Sub-Category for the product's category, then a Category for
          that Sub-Category. Changes save immediately — no separate Save step
          for this section.
        </div>
      )}

      {productCategoryHierarchy.length === 0 ? (
        <div className={styles.emptyState}>
          Pick at least one category in Basic Info first
        </div>
      ) : (
        productCategoryHierarchy.map((cat) => (
          <div key={cat.id} className={styles.hierarchyBlock}>
            <div className={styles.hierarchyProductRow}>
              <Layers size={14} />
              <span className={styles.hierarchyTitle}>{cat.title}</span>
            </div>

            <div className={styles.hierarchyRow}>
              <div className={styles.hierarchyRowLabel}>Sub-Category</div>
              <div className={styles.hierarchyRowBody}>
                {(cat.parent_categories || []).map((p) => {
                  const chipId = `parent-${cat.id}-${p.id}`;
                  return (
                    <span key={p.id} className={styles.hierarchyChip}>
                      {p.title}
                      <button
                        className={styles.hierarchyChipRemove}
                        disabled={removingChipId === chipId}
                        onClick={() =>
                          handleRemoveCategoryFromParent(cat.id, p.id)
                        }
                        aria-label={`Remove ${p.title}`}
                      >
                        {removingChipId === chipId ? (
                          <Spin size="small" />
                        ) : (
                          <X size={11} />
                        )}
                      </button>
                    </span>
                  );
                })}
                <CategoryAddSelect
                  placeholder="+ Add a Sub-Category"
                  fetchAllFn={fetchAllParentCategoriesFn}
                  excludeIds={(cat.parent_categories || []).map((p) => p.id)}
                  onAdd={(pid, ptitle) =>
                    handleAddCategoryToParent(cat.id, pid, ptitle)
                  }
                />
              </div>
            </div>

            {(cat.parent_categories || []).map((p) => (
              <div
                className={`${styles.hierarchyRow} ${styles.hierarchyRowNested}`}
                key={p.id}
              >
                <div className={styles.hierarchyRowLabel}>
                  Category
                  <span className={styles.hierarchyRowLabelSub}>
                    for "{p.title}"
                  </span>
                </div>
                <div className={styles.hierarchyRowBody}>
                  {(p.grand_categories || []).map((g) => {
                    const chipId = `grand-${p.id}-${g.id}`;
                    return (
                      <span key={g.id} className={styles.hierarchyChip}>
                        {g.title}
                        <button
                          className={styles.hierarchyChipRemove}
                          disabled={removingChipId === chipId}
                          onClick={() =>
                            handleRemoveParentFromGrand(p.id, g.id)
                          }
                          aria-label={`Remove ${g.title}`}
                        >
                          {removingChipId === chipId ? (
                            <Spin size="small" />
                          ) : (
                            <X size={11} />
                          )}
                        </button>
                      </span>
                    );
                  })}
                  <CategoryAddSelect
                    placeholder="+ Add a Category"
                    fetchAllFn={fetchAllGrandCategoriesFn}
                    excludeIds={(p.grand_categories || []).map((g) => g.id)}
                    onAdd={(gid, gtitle) =>
                      handleAddParentToGrand(p.id, gid, gtitle)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );

  const renderStepUseCases = () => (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Use Cases</span>
        <span className={styles.cardHint}>Updates immediately</span>
      </div>

      {ucLoading ? (
        <div className={styles.emptyState}>Loading…</div>
      ) : (
        <>
          {productUseCases.length === 0 ? (
            <div className={styles.emptyState}>
              Not assigned to any use case yet
            </div>
          ) : (
            <div className={styles.ucChipList}>
              {productUseCases.map((uc) => (
                <div
                  key={uc.id}
                  className={`${styles.ucChip} ${uc.source === "manual" ? styles.ucChipManual : styles.ucChipCategory}`}
                >
                  {uc.source === "manual" ? (
                    <Hand size={12} />
                  ) : (
                    <Layers size={12} />
                  )}
                  <span>
                    {uc.title}
                    {uc.industry && (
                      <span className={styles.ucChipIndustry}>
                        {" "}
                        ({uc.industry})
                      </span>
                    )}
                  </span>
                  <button
                    className={styles.ucChipRemove}
                    onClick={() => handleRemoveFromUseCase(uc)}
                    disabled={ucActionId === uc.id}
                    aria-label={`Remove from ${uc.title}`}
                  >
                    {ucActionId === uc.id ? (
                      <Spin size="small" />
                    ) : (
                      <X size={11} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.ucAddWrap}>
            {!ucPickerOpen ? (
              <button
                className={styles.ucAddTrigger}
                onClick={() => setUcPickerOpen(true)}
              >
                <Link2 size={13} /> Add to a use case
              </button>
            ) : (
              <div className={styles.ucPicker}>
                <div className={styles.ucPickerSearch}>
                  <Search size={14} />
                  <input
                    autoFocus
                    placeholder="Search use cases..."
                    value={ucSearch}
                    onChange={(e) => setUcSearch(e.target.value)}
                  />
                  <button
                    className={styles.ucPickerClose}
                    onClick={() => {
                      setUcPickerOpen(false);
                      setUcSearch("");
                      setUcOptions([]);
                    }}
                    aria-label="Close"
                  >
                    <X size={13} />
                  </button>
                </div>
                {ucSearch.trim() && (
                  <div className={styles.ucPickerResults}>
                    {ucSearchLoading && (
                      <div className={styles.ucPickerEmpty}>Searching…</div>
                    )}
                    {!ucSearchLoading && ucOptions.length === 0 && (
                      <div className={styles.ucPickerEmpty}>No matches</div>
                    )}
                    {!ucSearchLoading &&
                      ucOptions.map((opt) => (
                        <button
                          key={opt.id}
                          className={styles.ucPickerOption}
                          onClick={() => handleAddToUseCase(opt.id, opt.title)}
                          disabled={ucAdding}
                        >
                          <span>{opt.title}</span>
                          {opt.industry && (
                            <span className={styles.ucPickerOptionIndustry}>
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
  );

  // Same order as STEPS at the top of the file.
  const stepRenderers = [
    renderStepBasic,
    () => <ProductCustomizationsStep productId={Number(id)} />,
    renderStepOptions,
    renderStepVariants,
    renderStepHierarchy,
    renderStepUseCases,
    () => <ProductAddOnsStep productId={Number(id)} />,
  ];

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
          <h1>Edit Manual Product</h1>
          <p>{productName || "Untitled product"}</p>
        </div>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={16} />
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* Any step can be opened directly — no validation gate here. */}
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
        {currentStep < STEPS.length - 1 && (
          <button className={styles.btnPrimary} onClick={handleNext}>
            Next <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
};

export default EditManualProduct;
