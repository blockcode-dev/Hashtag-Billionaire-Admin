import React, { useEffect, useRef, useState } from "react";
import {
  AutoComplete,
  message,
  Modal,
  Pagination,
  Select,
  Tooltip,
  Upload,
} from "antd";
import type { UploadFile } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  EditOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  UploadOutlined,
  InfoCircleOutlined,
  UnorderedListOutlined,
  BgColorsOutlined,
  CheckSquareOutlined,
  TagsOutlined,
  DownOutlined,
  BulbOutlined,
} from "@ant-design/icons";

import {
  AddProductVariantsAPI,
  CreateProductAPI,
} from "@/services/Api/ProductApi";
import {
  GetAllCategoriesAPI,
  CreateCategoryAPI,
  UpdateCategoryAPI,
  DeleteCategoryAPI,
} from "@/services/Api/ParentCategoryApi";
import { GetPublishedBrandsAPI } from "@/services/Api/BrandsApi";

import NumberField from "@/components/common/Numberfield";
import {
  BulkTier,
  DEFAULT_BULK_TIER,
  DEFAULT_QUANTITY_PRICE,
  PricingMode,
  VariantPricing as SharedPriceFields,
  QUANTITY_MODE_INFO,
  QuantityPrice,
  QuantityPricingMode,
  buildPricingPayload,
  clonePricing,
  getPricingError,
  getPricingSummary,
  nextTierMin,
} from "@/utils/variantPricing";

import styles from "./CreateProductPage.module.scss";
import { useNavigate } from "react-router";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: number;
  title: string;
  supplier?: string | null;
}

interface Brand {
  id: number;
  name: string;
  logo_url?: string;
}

interface OptionValueType {
  name: string;
  color_code?: string;
  measurements?: {
    chest: number | string;
    shoulder: number | string;
    length: number | string;
    sleeve_length: number | string;
    neck: number | string;
  };
}

type OptionType = "dropdown" | "color" | "buttons" | "size" | "checkbox";

interface ProductOptionType {
  name: string;
  type: OptionType;
  values: OptionValueType[];
}

interface VariantType {
  sku: string;
  color: string;
  color_code: string;
  price: number;
  case_price: number;
  pricing_mode: PricingMode;

  stock: number;
  supplier: string;
  // Index-aligned with the product's `options` array. option_selections[oi]
  // is the index into options[oi].values this variant selects, or null.
  // Every option gets its own selection now — the backend keeps the full
  // set in ProductVariant.meta.option_values.
  option_selections: (number | null)[];
  images: UploadFile[];
  // Used when pricing_mode === "tiered"
  bulk_pricing: BulkTier[];
  // Used when pricing_mode === "quantity_fixed"
  quantity_pricing: QuantityPrice[];
  // Only relevant when the product has NO color-type option — most
  // products (books, mugs, ribbons, business cards...) don't need a
  // color at all, so the color fields stay hidden until this is checked.
  hasCustomColor: boolean;
}

// Pricing-related fields that get synced across variants when
// "Use the same price for all variants" is enabled.
type PriceFields = SharedPriceFields;

const STEPS = ["Product info", "Option values", "Variants", "Review"];

const DEFAULT_MEASUREMENTS = {
  chest: "",
  shoulder: "",
  length: "",
  sleeve_length: "",
  neck: "",
};

const DEFAULT_OPTION_VALUE = (): OptionValueType => ({
  name: "",
  color_code: "#1E3A8A",
  measurements: { ...DEFAULT_MEASUREMENTS },
});

const DEFAULT_OPTION = (): ProductOptionType => ({
  name: "",
  type: "dropdown",
  values: [],
});

const DEFAULT_VARIANT = (): VariantType => ({
  sku: "",
  color: "",
  color_code: "#1E3A8A",
  price: 0,
  case_price: 0,
  pricing_mode: "fixed",
  stock: 0,
  supplier: "MANUAL",
  option_selections: [],
  images: [],
  bulk_pricing: [DEFAULT_BULK_TIER()],
  quantity_pricing: [DEFAULT_QUANTITY_PRICE()],
  hasCustomColor: false,
});

const OPTION_TYPE_INFO: Record<
  OptionType,
  {
    label: string;
    icon: React.ReactNode;
    emoji: string;
    description: string;
    example: string;
    valuePlaceholder: string;
  }
> = {
  dropdown: {
    label: "Drop-down List",
    icon: <UnorderedListOutlined />,
    emoji: "📋",
    description: "Shoppers pick one value from a drop-down menu.",
    example: "Good for lots of choices, e.g. Pages: 100, 200, 500",
    valuePlaceholder: "e.g. 100 Pages",
  },

  color: {
    label: "Color",
    icon: <BgColorsOutlined />,
    emoji: "🎨",
    description: "Shoppers pick a value shown as a color swatch.",
    example: "Good for Color, e.g. Black, Royal Blue, Red",
    valuePlaceholder: "e.g. Royal Blue",
  },

  buttons: {
    label: "Radio Buttons",
    icon: <CheckSquareOutlined />,
    emoji: "🔘",
    description: "Shoppers pick exactly one value from visible buttons.",
    example: "Good for a short list, e.g. Capacity: 500ml, 1L, 2L",
    valuePlaceholder: "e.g. 500ml",
  },

  size: {
    label: "Size",
    icon: <TagsOutlined />,
    emoji: "👕",
    description: "Shown as size buttons, styled like clothing sizes.",
    example: "Good for Size, e.g. S, M, L, XL — optionally with measurements",
    valuePlaceholder: "e.g. M",
  },

  checkbox: {
    label: "Checkboxes",
    icon: <CheckSquareOutlined />,
    emoji: "☑️",
    description: "Shoppers can select more than one value at once.",
    example: "Good for add-ons, e.g. Gift Wrap, Extra Strap",
    valuePlaceholder: "e.g. Gift Wrap",
  },
};

const OPTION_NAME_SUGGESTIONS = [
  "Size (clothing, shoes)",
  "Capacity (bottles, containers)",
  "Pages (notebooks, journals)",
  "Storage (electronics)",
  "Color (wristbands, accessories)",
  "Material",
];

// ─── Color name lookup ────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6 && clean.length !== 3) return null;
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
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

const COLOR_NAMES: { name: string; r: number; g: number; b: number }[] = [
  { name: "Black", r: 0, g: 0, b: 0 },
  { name: "White", r: 255, g: 255, b: 255 },
  { name: "Red", r: 220, g: 38, b: 38 },
  { name: "Dark Red", r: 153, g: 27, b: 27 },
  { name: "Crimson", r: 220, g: 20, b: 60 },
  { name: "Orange", r: 249, g: 115, b: 22 },
  { name: "Dark Orange", r: 194, g: 65, b: 12 },
  { name: "Amber", r: 245, g: 158, b: 11 },
  { name: "Yellow", r: 253, g: 224, b: 71 },
  { name: "Gold", r: 202, g: 138, b: 4 },
  { name: "Lime", r: 132, g: 204, b: 22 },
  { name: "Green", r: 34, g: 197, b: 94 },
  { name: "Dark Green", r: 21, g: 128, b: 61 },
  { name: "Emerald", r: 16, g: 185, b: 129 },
  { name: "Teal", r: 20, g: 184, b: 166 },
  { name: "Cyan", r: 6, g: 182, b: 212 },
  { name: "Sky Blue", r: 56, g: 189, b: 248 },
  { name: "Blue", r: 59, g: 130, b: 246 },
  { name: "Navy Blue", r: 30, g: 58, b: 138 },
  { name: "Dark Blue", r: 30, g: 64, b: 175 },
  { name: "Royal Blue", r: 37, g: 99, b: 235 },
  { name: "Indigo", r: 99, g: 102, b: 241 },
  { name: "Violet", r: 139, g: 92, b: 246 },
  { name: "Purple", r: 168, g: 85, b: 247 },
  { name: "Fuchsia", r: 217, g: 70, b: 239 },
  { name: "Pink", r: 244, g: 114, b: 182 },
  { name: "Rose", r: 251, g: 113, b: 133 },
  { name: "Hot Pink", r: 236, g: 72, b: 153 },
  { name: "Light Pink", r: 253, g: 186, b: 212 },
  { name: "Brown", r: 120, g: 53, b: 15 },
  { name: "Dark Brown", r: 78, g: 35, b: 9 },
  { name: "Tan", r: 180, g: 120, b: 70 },
  { name: "Beige", r: 245, g: 235, b: 220 },
  { name: "Cream", r: 255, g: 248, b: 220 },
  { name: "Ivory", r: 255, g: 255, b: 240 },
  { name: "Off White", r: 248, g: 247, b: 242 },
  { name: "Light Gray", r: 209, g: 213, b: 219 },
  { name: "Gray", r: 107, g: 114, b: 128 },
  { name: "Dark Gray", r: 55, g: 65, b: 81 },
  { name: "Charcoal", r: 36, g: 36, b: 36 },
  { name: "Silver", r: 192, g: 192, b: 192 },
  { name: "Slate", r: 100, g: 116, b: 139 },
  { name: "Olive", r: 107, g: 114, b: 0 },
  { name: "Khaki", r: 189, g: 183, b: 107 },
  { name: "Mustard", r: 212, g: 175, b: 55 },
  { name: "Coral", r: 255, g: 127, b: 80 },
  { name: "Salmon", r: 250, g: 128, b: 114 },
  { name: "Peach", r: 255, g: 218, b: 185 },
  { name: "Lavender", r: 230, g: 230, b: 250 },
  { name: "Mint", r: 152, g: 255, b: 152 },
  { name: "Turquoise", r: 64, g: 224, b: 208 },
  { name: "Maroon", r: 128, g: 0, b: 0 },
  { name: "Burgundy", r: 128, g: 0, b: 32 },
  { name: "Wine", r: 114, g: 47, b: 55 },
];

const COLOR_NAME_OPTIONS = COLOR_NAMES.map((c) => ({
  value: c.name,
  hex: rgbToHex(c.r, c.g, c.b),
}));

function getHexFromColorName(name: string): string | null {
  const trimmed = name.trim().toLowerCase();
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

function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.55;
}

// ─── Color name autocomplete ──────────────────────────────────────────────────
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
      onSelect={(val) => {
        const hex = getHexFromColorName(val as string);
        onSelectColor(val as string, hex);
      }}
      onChange={(val) => onChangeText(val)}
      placeholder={placeholder || "Pick a color or type any name"}
    />
  );
};

// ─── "How this works" guide (collapsible, visible on every step) ────────────
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
      <BulbOutlined />
      How adding a manual product works
      <DownOutlined className={styles.guideChevron} />
    </button>

    {open && (
      <div className={styles.guideBody}>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>1</span>
          <span>
            <strong>Product info</strong> — name, brand, description,
            categories, and listing photos. Only the name is required.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>2</span>
          <span>
            <strong>Option values</strong> — every choice a shopper makes, e.g.
            Size, Capacity, Pages, Color. Skip this entirely for products with
            no choices, like a single plain candle. Color is just one possible
            option type — most products (books, mugs, ribbons) don't need it at
            all.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>3</span>
          <span>
            <strong>Variants</strong> — one sellable combination per row (e.g.
            "1000 Pages, $12.99, 40 in stock"). Use <strong>Duplicate</strong>{" "}
            to copy a variant exactly, then just change the one value that's
            different (like Capacity) — this saves re-entering price, stock, and
            pricing tiers each time. Color fields stay hidden unless you turn on
            "This variant has its own color" for a product that actually needs
            it.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>4</span>
          <span>
            <strong>Pricing</strong> — each variant is either a single Fixed
            price, or Quantity-based pricing. Quantity-based has two styles:{" "}
            <strong>Variable ranges</strong> (e.g. 1–10 at $20, 11+ at $18 —
            only the last range can leave "To" blank, and a new range continues
            right after the previous one) or <strong>Fixed quantities</strong>{" "}
            (exact pack sizes, e.g. 25 for $100, 50 for $180). Prices can have
            decimals, like 0.10.
          </span>
        </div>
        <div className={styles.guideStep}>
          <span className={styles.guideStepNum}>5</span>
          <span>
            <strong>Review</strong> — double-check everything, then create the
            product. If two variants end up with the exact same option values
            (usually from duplicating and forgetting to change one), you'll get
            a short error naming both — fix the one that should be different
            before you can continue.
          </span>
        </div>
      </div>
    )}
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

const CreateProductPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const [productName, setProductName] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [productImages, setProductImages] = useState<UploadFile[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [catSearch, setCatSearch] = useState("");
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [catPage, setCatPage] = useState(1);
  const [catTotal, setCatTotal] = useState(0);
  const [catLoading, setCatLoading] = useState(false);

  // Add / edit / delete category — only categories with supplier "MANUAL"
  // (i.e. created here, not pulled in from a supplier feed) are editable.
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

  // Any number of independent options — Size, Color, Material, Capacity...
  const [options, setOptions] = useState<ProductOptionType[]>([]);
  const CAT_LIMIT = 50;

  const [brands, setBrands] = useState<Brand[]>([]);
  const [allLoadedCategories, setAllLoadedCategories] = useState<Category[]>(
    [],
  );

  const [variants, setVariants] = useState<VariantType[]>([DEFAULT_VARIANT()]);

  // When on, editing any pricing field on ANY variant fans that change out
  // to every other variant, and any new variant added while this is on
  // inherits the current shared pricing.
  const [samePriceForAll, setSamePriceForAll] = useState(false);

  const catSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep every variant's option_selections array the same length as
  // `options` whenever an option is added or removed.
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

  // ─── Fetch ───────────────────────────────────────────────────────────────
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
        data.forEach((c: Category) => map.set(c.id, c));
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

  useEffect(() => {
    fetchBrands();
    fetchCategories(1, "");
  }, []);

  const handleCatSearch = (value: string) => {
    setCatSearch(value);
    if (catSearchTimer.current) clearTimeout(catSearchTimer.current);
    catSearchTimer.current = setTimeout(() => fetchCategories(1, value), 300);
  };

  const toggleCategory = (id: number) => {
    setSelectedCatIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const selectedCategories = allLoadedCategories.filter((c) =>
    selectedCatIds.includes(c.id),
  );

  const isManualCategory = (cat: Category) =>
    (cat.supplier || "MANUAL").toUpperCase() === "MANUAL";

  // ─── Category CRUD (manual categories only for edit/delete) ─────────────
  const handleCreateCategory = async () => {
    const title = newCategoryName.trim();
    if (!title) return;
    setCreatingCategory(true);
    try {
      const res = await CreateCategoryAPI({ title, supplier: "MANUAL" });
      const created: Category | undefined = res?.data?.data;
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

  const startEditCategory = (cat: Category) => {
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

  const handleDeleteCategory = (cat: Category) => {
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
          setSelectedCatIds((prev) => prev.filter((id) => id !== cat.id));
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

  // ─── Option helpers ────────────────────────────────────────────────────────
  const addOption = () => setOptions((prev) => [...prev, DEFAULT_OPTION()]);

  const removeOption = (oi: number) =>
    setOptions((prev) => prev.filter((_, idx) => idx !== oi));

  const updateOptionName = (oi: number, name: string) =>
    setOptions((prev) => {
      const updated = [...prev];
      updated[oi] = { ...updated[oi], name };
      return updated;
    });

  const updateOptionType = (oi: number, type: OptionType) =>
    setOptions((prev) => {
      const updated = [...prev];
      updated[oi] = { ...updated[oi], type };
      return updated;
    });

  const addOptionValue = (oi: number) =>
    setOptions((prev) => {
      const updated = [...prev];
      updated[oi] = {
        ...updated[oi],
        values: [...updated[oi].values, DEFAULT_OPTION_VALUE()],
      };
      return updated;
    });

  const removeOptionValue = (oi: number, vi: number) =>
    setOptions((prev) => {
      const updated = [...prev];
      updated[oi] = {
        ...updated[oi],
        values: updated[oi].values.filter((_, idx) => idx !== vi),
      };
      return updated;
    });

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
      const current = values[vi];
      const prevAutoName = getColorNameFromHex(current.color_code || "");
      const nextName =
        !current.name.trim() || current.name === prevAutoName
          ? getColorNameFromHex(hex)
          : current.name;
      values[vi] = { ...current, color_code: hex, name: nextName };
      updated[oi] = { ...updated[oi], values };
      return updated;
    });

  const updateOptionValueMeasurement = (
    oi: number,
    vi: number,
    field: keyof typeof DEFAULT_MEASUREMENTS,
    val: number,
  ) =>
    setOptions((prev) => {
      const updated = [...prev];
      const values = [...updated[oi].values];
      values[vi] = {
        ...values[vi],
        measurements: {
          ...(values[vi].measurements || DEFAULT_MEASUREMENTS),
          [field]: val,
        },
      };
      updated[oi] = { ...updated[oi], values };
      return updated;
    });

  // ─── Variant helpers ──────────────────────────────────────────────────────
  const addVariant = () =>
    setVariants((prev) => {
      const base = DEFAULT_VARIANT();
      // If pricing is synced, a freshly added variant should start with
      // the same pricing the rest of the group already shares.
      const priced =
        samePriceForAll && prev.length > 0
          ? { ...base, ...clonePricing(prev[0]) }
          : base;
      return [
        ...prev,
        { ...priced, option_selections: options.map(() => null) },
      ];
    });

  // Copies a variant exactly — same SKU, pricing, option selections,
  // color and images — and inserts it right after the source row.
  const duplicateVariant = (i: number) => {
    setVariants((prev) => {
      const source = prev[i];
      const clone: VariantType = {
        ...source,
        ...clonePricing(source),
        option_selections: [...source.option_selections],
        images: [...source.images],
      };
      const updated = [...prev];
      updated.splice(i + 1, 0, clone);
      return updated;
    });
    message.info(
      "Variant duplicated — change whichever value is different (e.g. Size, Capacity) before saving.",
    );
  };

  const removeVariant = (i: number) =>
    setVariants((prev) => prev.filter((_, idx) => idx !== i));

  const updateVariant = <K extends keyof VariantType>(
    i: number,
    field: K,
    val: VariantType[K],
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
    fields: Partial<PriceFields>,
  ) => {
    if (samePriceForAll) {
      setVariants((prev) => prev.map((v) => ({ ...v, ...fields })));
    } else {
      setVariants((prev) =>
        prev.map((v, idx) => (idx === i ? { ...v, ...fields } : v)),
      );
    }
  };

  const updateVariantPricing = <K extends keyof PriceFields>(
    i: number,
    field: K,
    val: PriceFields[K],
  ) => updateVariantPricingFields(i, { [field]: val } as Partial<PriceFields>);

  // Top-level toggle: Fixed price vs Quantity-based. Switching INTO
  // quantity-based defaults to Variable ranges (the original behaviour);
  // if the variant is already quantity-based, its sub-mode is kept.
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

  // Sub-toggle under Quantity-based: Variable ranges vs Fixed quantities.
  // Seeds an empty row so the admin always has something to type into.
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

  // ── Variable-range tiers ──
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

  // Auto-continue from where the last tier left off — no gap/overlap.
  const addBulkTier = (i: number) => {
    const tiers = variants[i].bulk_pricing;
    updateVariantPricing(i, "bulk_pricing", [
      ...tiers,
      { min_qty: nextTierMin(tiers), max_qty: null, price: 0 },
    ]);
  };

  // ── Fixed-quantity rows ──
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

  // Toggling the checkbox on immediately copies variant i's current
  // pricing to every other variant so they all match right away; toggling
  // it off just stops future edits from syncing.
  const handleToggleSamePrice = (i: number, checked: boolean) => {
    setSamePriceForAll(checked);
    if (checked) {
      const source = variants[i];
      setVariants((prev) =>
        prev.map((v) => ({ ...v, ...clonePricing(source) })),
      );
    }
  };

  // Selecting a value for ANY option updates option_selections. If that
  // option happens to be type "color", we also mirror the pick into the
  // variant's own color/color_code fields.
  const updateVariantOptionSelection = (
    i: number,
    oi: number,
    valueIndex: number | null,
  ) =>
    setVariants((prev) => {
      const updated = [...prev];
      const selections = [...(updated[i].option_selections || [])];
      selections[oi] = valueIndex;
      let next: VariantType = { ...updated[i], option_selections: selections };

      const opt = options[oi];
      if (opt?.type === "color" && valueIndex !== null) {
        const val = opt.values[valueIndex];
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

  const handleColorHexTextChange = (i: number, hex: string) => {
    updateVariant(i, "color_code", hex);
    if (hex.length === 7 && hex.startsWith("#")) {
      const name = getColorNameFromHex(hex);
      const current = variants[i];
      const prevAutoName = getColorNameFromHex(current.color_code);
      if (!current.color.trim() || current.color === prevAutoName) {
        updateVariant(i, "color", name);
      }
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep0()) return setCurrentStep(0);
    if (!validateStep1()) return setCurrentStep(1);
    if (!validateStep2()) return setCurrentStep(2);

    setLoading(true);
    try {
      const productFormData = new FormData();

      productFormData.append("name", productName.trim());

      if (description.trim()) {
        productFormData.append("description", description.trim());
      }

      if (brandId) {
        productFormData.append("brand_id", String(brandId));
      }

      if (selectedCatIds.length) {
        productFormData.append("category_ids", JSON.stringify(selectedCatIds));
      }

      // Matches createProduct's expected shape exactly.
      const cleanedOptions = options
        .map((option) => ({
          name: option.name.trim(),
          type: option.type,
            display_style: option.type,
          values: option.values
            .filter((value) => value.name.trim())
            .map((value) => ({
              name: value.name.trim(),
              ...(option.type === "color"
                ? { color_code: value.color_code }
                : {}),
              ...(option.type === "size" && value.measurements
                ? { measurements: value.measurements }
                : {}),
            })),
        }))
        .filter((option) => option.name && option.values.length > 0);

      if (cleanedOptions.length) {
        productFormData.append("options", JSON.stringify(cleanedOptions));
      }

      productImages.forEach((file) => {
        if (file.originFileObj)
          productFormData.append("images", file.originFileObj);
      });

      const productRes = await CreateProductAPI(productFormData);
      const product = productRes?.data?.data;
      if (!product?.id) throw new Error("Product creation failed");

      const variantFormData = new FormData();
      variantFormData.append("product_id", product.id.toString());

      const hasColorOption = options.some(
        (o) => o.type === "color" && o.values.some((v) => v.name.trim()),
      );

      const formattedVariants = variants.map((v) => {
        const includeColor = hasColorOption || v.hasCustomColor;
        const optionValues = options
          .map((opt, oi) => {
            const vi = v.option_selections?.[oi];
            if (vi === null || vi === undefined) return null;
            const val = opt.values[vi];
            if (!opt.name.trim() || !val?.name.trim()) return null;
            return {
              name: opt.name.trim(),
              value: val.name.trim(),
              type: opt.type,
              display_style: opt.type,
              ...(opt.type === "color" ? { color_code: val.color_code } : {}),
            };
          })
          .filter(Boolean);

        return {
          // Blank = the backend generates one (MAN-<productId>-001…).
          sku: v.sku.trim(),
          // price, case_price, pricing_mode, bulk_pricing, quantity_pricing
          // — identical shape to Edit Manual Product.
          ...buildPricingPayload(v),
          stock: Number(v.stock || 0),
          color: includeColor ? v.color || null : null,
          color_code: includeColor ? v.color_code || null : null,
          option_values: optionValues,
          image_count: v.images.length,
        };
      });

      variantFormData.append("variants", JSON.stringify(formattedVariants));
      variants.forEach((variant) => {
        variant.images.forEach((img) => {
          if (img.originFileObj)
            variantFormData.append("variant_images", img.originFileObj);
        });
      });

      await AddProductVariantsAPI(variantFormData);
      message.success("Product created successfully!");
      navigate("/products");
      setCurrentStep(0);
      setProductName("");
      setBrandId(null);
      setDescription("");
      setProductImages([]);
      setSelectedCatIds([]);
      setOptions([]);
      setVariants([DEFAULT_VARIANT()]);
      setSamePriceForAll(false);
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className={styles.stepContent}>
      <div className={styles.introBanner}>
        <InfoCircleOutlined className={styles.introIcon} />
        <div>
          <div className={styles.introTitle}>Add any type of product</div>
          <span className={styles.introText}>
            This wizard works for anything you sell — clothing, notebooks,
            bottles, wristbands, and more. Only the product name is required;
            fill in as much or as little of the rest as you like.
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
              Product name <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Men's Casual Checked Shirt, A5 Ruled Notebook, 750ml Steel Bottle"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label>
              Brand <span className={styles.fieldHint}>(optional)</span>
            </label>
            <Select
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
          <div className={`${styles.fieldGroup} ${styles.fieldFull}`}>
            <label>
              Description <span className={styles.fieldHint}>(optional)</span>
            </label>
            <textarea
              rows={4}
              placeholder="Describe the product — material, use case, what makes it stand out. e.g. Premium cotton casual shirt for daily wear..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            Categories <span className={styles.fieldHint}>(optional)</span>
            {selectedCatIds.length > 0 && (
              <span className={styles.badge}>
                {selectedCatIds.length} selected
              </span>
            )}
          </span>
          <span className={styles.cardHint}>
            Pick every category this product should appear under
          </span>
        </div>

        {/* Add a new manual category — becomes searchable/selectable
            immediately and shows up with (MANUAL) in the list below. */}
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
            <PlusOutlined /> {creatingCategory ? "Adding…" : "Add category"}
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
                        <CheckOutlined />
                      </button>
                      <button
                        className={styles.catEditIconBtn}
                        onClick={cancelEditCategory}
                        title="Cancel"
                      >
                        <CloseOutlined />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={cat.id}
                    className={`${styles.catItem} ${
                      selectedCatIds.includes(cat.id)
                        ? styles.catItemSelected
                        : ""
                    }`}
                  >
                    <div
                      className={styles.catItemMain}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <span
                        className={`${styles.catCheck} ${selectedCatIds.includes(cat.id) ? styles.catCheckOn : ""}`}
                      >
                        {selectedCatIds.includes(cat.id) && <CheckOutlined />}
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
                          <EditOutlined />
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
                          <DeleteOutlined />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>☐</div>
                <span>No categories yet</span>
                <span className={styles.emptyHint}>
                  Pick from the list on the left — this product will still be
                  created even if you skip it
                </span>
              </div>
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
        <div className={styles.catPagination}>
          <Pagination
            current={catPage}
            total={catTotal}
            pageSize={50}
            showSizeChanger={false}
            size="small"
            onChange={(page) => fetchCategories(page, catSearch)}
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            Product images <span className={styles.fieldHint}>(optional)</span>
          </span>
          <span className={styles.cardHint}>
            Shown as the main listing images. Add variant-specific photos later
            in the Variants step.
          </span>
        </div>
        <Upload
          multiple
          listType="picture-card"
          beforeUpload={() => false}
          fileList={productImages}
          onChange={({ fileList }) => setProductImages(fileList)}
        >
          <div className={styles.uploadBtn}>
            <UploadOutlined />
            <span>Upload</span>
          </div>
        </Upload>
      </div>
    </div>
  );

  const renderOptionCard = (option: ProductOptionType, oi: number) => {
    const info = OPTION_TYPE_INFO[option.type];
    const isColorType = option.type === "color";
    const isSizeType = option.type === "size";

    return (
      <div key={oi} className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            Option {oi + 1}
            {option.name && (
              <span className={styles.sizeNamePreview}>{option.name}</span>
            )}
          </span>
          <button className={styles.btnDanger} onClick={() => removeOption(oi)}>
            <DeleteOutlined /> Remove option
          </button>
        </div>

        <div className={styles.fieldGrid}>
          <div className={styles.fieldGroup}>
            <label>
              Customer selection label
              <Tooltip title="This is the name customers will see above the choice they make on the product page. Pick whatever fits your product.">
                <InfoCircleOutlined className={styles.labelInfo} />
              </Tooltip>
            </label>
            <input
              value={option.name}
              onChange={(e) => updateOptionName(oi, e.target.value)}
              placeholder="e.g. Size, Capacity, Pages, Storage, Color"
              list={`option-name-suggestions-${oi}`}
            />
            <datalist id={`option-name-suggestions-${oi}`}>
              {OPTION_NAME_SUGGESTIONS.map((s) => (
                <option key={s} value={s.split(" (")[0]} />
              ))}
            </datalist>
          </div>

          <div className={styles.fieldGroup}>
            <label>
              Display style
              <Tooltip title="Controls how the values below are shown to shoppers.">
                <InfoCircleOutlined className={styles.labelInfo} />
              </Tooltip>
            </label>
            <select
              value={option.type}
              onChange={(e) =>
                updateOptionType(oi, e.target.value as OptionType)
              }
            >
              {(Object.keys(OPTION_TYPE_INFO) as OptionType[]).map((key) => (
                <option key={key} value={key}>
                  {OPTION_TYPE_INFO[key].emoji} {OPTION_TYPE_INFO[key].label}
                </option>
              ))}
            </select>
            <span className={styles.fieldHint}>
              {info.description} {info.example}
            </span>
          </div>
        </div>

        <div className={styles.dividerLabel}>
          Values
          <span className={styles.dividerHint}>
            {option.name.trim()
              ? `Every value a shopper can choose for ${option.name}`
              : "Every value a shopper can choose"}
          </span>
        </div>

        {option.values.length === 0 ? (
          <div className={styles.emptyState} style={{ height: 130 }}>
            <span>No values yet</span>
            <span className={styles.emptyHint}>
              Add at least one value below, or remove this option
            </span>
          </div>
        ) : (
          option.values.map((value, vi) => (
            <div
              key={vi}
              className={styles.card}
              style={{ background: "#fafaf9", padding: 16, marginBottom: 12 }}
            >
              <div className={styles.cardHeader} style={{ marginBottom: 14 }}>
                <span className={styles.cardTitle} style={{ fontSize: 15 }}>
                  {option.name || "Value"} {vi + 1}
                  {value.name && (
                    <span className={styles.sizeNamePreview}>{value.name}</span>
                  )}
                </span>
                <button
                  className={styles.btnDanger}
                  onClick={() => removeOptionValue(oi, vi)}
                >
                  <DeleteOutlined /> Remove
                </button>
              </div>

              {isColorType ? (
                <div className={styles.colorSection}>
                  <div
                    className={styles.colorPreviewBlock}
                    style={{ background: value.color_code }}
                  >
                    <span
                      className={styles.colorPreviewLabel}
                      style={{
                        color: isLightColor(value.color_code || "#fff")
                          ? "#333"
                          : "#fff",
                      }}
                    >
                      {value.name}
                    </span>
                  </div>
                  <div className={styles.colorFields}>
                    <div className={styles.fieldGroup}>
                      <label>Color name</label>
                      <ColorNameAutocomplete
                        value={value.name}
                        placeholder="e.g. Royal Blue"
                        onSelectColor={(name, hex) => {
                          updateOptionValueName(oi, vi, name);
                          if (hex) updateOptionValueColorCode(oi, vi, hex);
                        }}
                        onChangeText={(name) =>
                          updateOptionValueName(oi, vi, name)
                        }
                      />
                      <span className={styles.fieldHint}>
                        Pick a common color, or type any name — if we don't
                        recognize it (e.g. "Edge"), just set the exact code
                        below.
                      </span>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Color code</label>
                      <div className={styles.colorRow}>
                        <input
                          type="color"
                          value={value.color_code}
                          onChange={(e) =>
                            updateOptionValueColorCode(oi, vi, e.target.value)
                          }
                          className={styles.colorPicker}
                          title="Pick a color"
                        />
                        <input
                          type="text"
                          value={value.color_code}
                          placeholder="#1E3A8A"
                          onChange={(e) =>
                            updateOptionValueColorCode(oi, vi, e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.fieldGroup} style={{ maxWidth: 320 }}>
                  <label>{option.name || "Value"} name</label>
                  <input
                    type="text"
                    placeholder={info.valuePlaceholder}
                    value={value.name}
                    onChange={(e) =>
                      updateOptionValueName(oi, vi, e.target.value)
                    }
                  />
                  <span className={styles.fieldHint}>
                    Include the unit if it helps shoppers, e.g. "250 ml", "500
                    Pages", "32 GB", "S".
                  </span>
                </div>
              )}

              {isSizeType && (
                <>
                  <div className={styles.dividerLabel}>
                    Garment measurements (inches) — optional, for clothing
                  </div>
                  <div className={styles.measureGrid}>
                    {(
                      [
                        ["chest", "Chest"],
                        ["shoulder", "Shoulder"],
                        ["length", "Length"],
                        ["sleeve_length", "Sleeve"],
                        ["neck", "Neck"],
                      ] as [keyof typeof DEFAULT_MEASUREMENTS, string][]
                    ).map(([field, label]) => (
                      <div key={field} className={styles.measureField}>
                        <label>{label}</label>
                        <input
                          type="number"
                          placeholder="—"
                          value={value.measurements?.[field] ?? ""}
                          onChange={(e) =>
                            updateOptionValueMeasurement(
                              oi,
                              vi,
                              field,
                              e.target.value === ""
                                ? ("" as unknown as number)
                                : Number(e.target.value),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))
        )}

        <button
          className={styles.btnOutline}
          onClick={() => addOptionValue(oi)}
        >
          <PlusOutlined /> Add value
        </button>
      </div>
    );
  };

  const renderStep1 = () => (
    <div className={styles.stepContent}>
      <div className={styles.stepHeader}>
        <div>
          <div className={styles.stepTitle}>Product options</div>
          <span className={styles.stepHint}>
            Add every choice a shopper makes for this product — Size, Color,
            Material, whatever applies. A product can have as many options as it
            needs, or none at all.
          </span>
        </div>
        <button className={styles.btnPrimary} onClick={addOption}>
          <PlusOutlined /> Add option
        </button>
      </div>

      <div className={styles.instructionNote}>
        <InfoCircleOutlined className={styles.introIcon} />
        <span>
          This whole step is optional; skip it for products with no choices,
          like a single plain candle. For clothing, add a Size option and a
          Color option separately — each keeps its own values and display style,
          and every option gets its own selector on every variant.
        </span>
      </div>

      {options.length === 0 ? (
        <div className={`${styles.card} ${styles.emptyCard}`}>
          <div className={styles.emptyCardIcon}>📐</div>
          <span className={styles.emptyCardText}>
            This product has no options
          </span>
          <span className={styles.emptyCardHint}>
            That's fine for products like ✓ Candle, ✓ Mug, or ✓ Sticker — click
            Next to continue, or add an option below (e.g. Size, Color) if this
            product needs one.
          </span>
          <button className={styles.btnOutline} onClick={addOption}>
            <PlusOutlined /> Add option
          </button>
        </div>
      ) : (
        options.map((option, oi) => renderOptionCard(option, oi))
      )}
    </div>
  );

  // ─── Pricing block (per variant) ──────────────────────────────────────────

  const renderCasePriceField = (v: VariantType, i: number) => (
    <div className={styles.fieldGroup} style={{ maxWidth: 220 }}>
      <label>
        Case price ($) <span className={styles.fieldHint}>(optional)</span>
      </label>
      <NumberField
        allowDecimal
        placeholder="0.00"
        value={v.case_price}
        onChange={(val) => updateVariantPricing(i, "case_price", val ?? 0)}
      />
    </div>
  );

  const renderTieredPricing = (v: VariantType, i: number) => (
    <>
      <span className={styles.fieldHint}>
        Set a lower price per item as quantity ordered goes up — shown to
        customers as bulk discount pricing.
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
            placeholder="Blank = and more"
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
            <DeleteOutlined />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.btnOutline}
        onClick={() => addBulkTier(i)}
      >
        <PlusOutlined /> Add quantity tier
      </button>
    </>
  );

  const renderFixedQuantityPricing = (v: VariantType, i: number) => (
    <>
      <span className={styles.fieldHint}>
        Add each exact quantity a shopper can order and the total price for
        that quantity — e.g. 25 for $100. Shoppers can only pick these
        quantities.
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
              <DeleteOutlined />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className={styles.btnOutline}
        onClick={() => addQuantityPrice(i)}
      >
        <PlusOutlined /> Add quantity
      </button>
    </>
  );

  const renderPricing = (v: VariantType, i: number) => {
    const isQuantityBased = v.pricing_mode !== "fixed";

    return (
      <>
        <div className={styles.dividerLabel}>Pricing</div>

        {/* Syncs every pricing field across every variant. Checking it here
            immediately copies THIS variant's pricing to all the others;
            unchecking it just stops future edits from fanning out. */}
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
            className={`${styles.pricingModeBtn} ${
              !isQuantityBased ? styles.pricingModeBtnActive : ""
            }`}
            onClick={() => setTopLevelPricing(i, false)}
          >
            Fixed price
          </button>
          <button
            type="button"
            aria-pressed={isQuantityBased}
            className={`${styles.pricingModeBtn} ${
              isQuantityBased ? styles.pricingModeBtnActive : ""
            }`}
            onClick={() => setTopLevelPricing(i, true)}
          >
            Quantity-based pricing
          </button>
        </div>

        {!isQuantityBased ? (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className={styles.fieldGroup} style={{ maxWidth: 220 }}>
              <label>
                Price ($) <span className={styles.fieldHint}>(optional)</span>
              </label>
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
                      className={`${styles.quantityModeCard} ${
                        active ? styles.quantityModeCardActive : ""
                      }`}
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

            <div style={{ marginTop: 6 }}>{renderCasePriceField(v, i)}</div>
          </div>
        )}
      </>
    );
  };

  const renderStep2 = () => {
    // Only used to decide whether to hide the free-standing color fallback
    // — real color options are handled per-option below.
    const hasColorOption = options.some(
      (o) => o.type === "color" && o.values.some((v) => v.name.trim()),
    );

    return (
      <div className={styles.stepContent}>
        <div className={styles.stepHeader}>
          <div>
            <div className={styles.stepTitle}>Variants</div>
            <span className={styles.stepHint}>
              Each variant is one sellable combination — e.g. "1000 Pages,
              $19.99, 20 in stock". Add one row per combination you actually
              stock. Nothing here is required except at least one variant row.
            </span>
          </div>
          <button className={styles.btnPrimary} onClick={addVariant}>
            <PlusOutlined /> Add variant
          </button>
        </div>

        {variants.length === 0 ? (
          <div className={`${styles.card} ${styles.emptyCard}`}>
            <span>No variants yet</span>
            <button className={styles.btnPrimary} onClick={addVariant}>
              <PlusOutlined /> Add first variant
            </button>
          </div>
        ) : (
          variants.map((v, i) => {
            const autoColorName = getColorNameFromHex(v.color_code);

            const selectedLabels = options
              .map((opt, oi) => {
                const vi = v.option_selections?.[oi];
                return vi !== null && vi !== undefined
                  ? opt.values[vi]?.name
                  : undefined;
              })
              .filter(Boolean) as string[];

            const variantHasVisibleColor = hasColorOption
              ? true
              : v.hasCustomColor;

            const variantTitle = selectedLabels.length
              ? selectedLabels.join(" • ")
              : v.hasCustomColor
                ? v.color || autoColorName || `Variant ${i + 1}`
                : `Variant ${i + 1}`;

            return (
              <div key={i} className={styles.card}>
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
                    {v.sku && <span className={styles.skuTag}>{v.sku}</span>}
                  </div>
                  <div className={styles.variantHeaderActions}>
                    <button
                      className={styles.btnOutline}
                      onClick={() => duplicateVariant(i)}
                      title="Copy this variant exactly, then change the one value that's different"
                    >
                      <CopyOutlined /> Duplicate
                    </button>
                    <button
                      className={styles.btnDanger}
                      onClick={() => removeVariant(i)}
                    >
                      <DeleteOutlined /> Remove
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
                          onChangeText={(name) =>
                            updateVariant(i, "color", name)
                          }
                        />
                        {v.color !== autoColorName && autoColorName && (
                          <button
                            className={styles.colorSuggest}
                            onClick={() =>
                              updateVariant(i, "color", autoColorName)
                            }
                          >
                            Suggest: <strong>{autoColorName}</strong>
                          </button>
                        )}
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
                            title="Pick a color"
                          />
                          <input
                            type="text"
                            value={v.color_code}
                            placeholder="#1E3A8A"
                            onChange={(e) =>
                              handleColorHexTextChange(i, e.target.value)
                            }
                          />
                        </div>
                        <span className={styles.colorHint}>
                          {autoColorName && `Closest match: ${autoColorName}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.dividerLabel}>Identity & stock</div>
                <div className={styles.fieldGrid3}>
                  <div className={styles.fieldGroup}>
                    <label>
                      SKU <span className={styles.fieldHint}>(optional)</span>
                      <Tooltip title="A unique code you use internally to track this exact variant, e.g. SHIRT-BLUE-M. Leave blank and we'll generate one.">
                        <InfoCircleOutlined className={styles.labelInfo} />
                      </Tooltip>
                    </label>
                    <input
                      type="text"
                      placeholder="SHIRT-BLUE-M"
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
                              {opt.values.map((val, vi) => {
                                if (!val.name.trim()) return null;
                                const active = v.option_selections?.[oi] === vi;
                                return (
                                  <button
                                    type="button"
                                    key={vi}
                                    className={`${styles.swatchOption} ${
                                      active ? styles.swatchOptionActive : ""
                                    }`}
                                    style={{ background: val.color_code }}
                                    title={val.name}
                                    aria-label={val.name}
                                    aria-pressed={active}
                                    onClick={() =>
                                      updateVariantOptionSelection(i, oi, vi)
                                    }
                                  >
                                    {active && (
                                      <CheckOutlined
                                        style={{
                                          color: isLightColor(
                                            val.color_code || "#fff",
                                          )
                                            ? "#333"
                                            : "#fff",
                                        }}
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <select
                              value={v.option_selections?.[oi] ?? ""}
                              onChange={(e) =>
                                updateVariantOptionSelection(
                                  i,
                                  oi,
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                                )
                              }
                            >
                              <option value="">
                                Select {opt.name || `Option ${oi + 1}`}
                              </option>
                              {opt.values.map((val, vi) => (
                                <option key={vi} value={vi}>
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

                <div className={styles.dividerLabel}>
                  Variant images
                  <span className={styles.dividerHint}>
                    Optional — only needed if this variant looks different from
                    the main product images
                  </span>
                </div>
                <Upload
                  multiple
                  listType="picture-card"
                  beforeUpload={() => false}
                  fileList={v.images}
                  onChange={({ fileList }) =>
                    updateVariant(i, "images", fileList)
                  }
                >
                  <div className={styles.uploadBtn}>
                    <UploadOutlined />
                    <span>Upload</span>
                  </div>
                </Upload>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderStep3 = () => (
    <div className={styles.stepContent}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Review & submit</span>
          <span className={styles.cardHint}>
            Double-check before creating the product
          </span>
        </div>
        <div className={styles.reviewSection}>
          <div className={styles.summaryLabel}>Product name</div>
          <div className={styles.summaryValue}>{productName || "—"}</div>
        </div>
        <div className={styles.reviewSection}>
          <div className={styles.summaryLabel}>Brand</div>
          <div className={styles.summaryValue}>
            {brands.find((b) => b.id === brandId)?.name || "—"}
          </div>
        </div>
        <div className={styles.reviewSection}>
          <div className={styles.summaryLabel}>Categories</div>
          <div className={styles.summaryValue}>
            {selectedCategories.length
              ? selectedCategories.map((c) => (
                  <span key={c.id} className={styles.tag}>
                    {c.title}
                    {c.supplier ? ` (${c.supplier})` : ""}
                  </span>
                ))
              : "None"}
          </div>
        </div>
        <div className={styles.reviewSection}>
          <div className={styles.summaryLabel}>Description</div>
          <div className={`${styles.summaryValue} ${styles.summaryMuted}`}>
            {description || "—"}
          </div>
        </div>
        <div className={styles.reviewSection}>
          <div className={styles.summaryLabel}>Product images</div>
          <div className={styles.summaryValue}>
            {productImages.length} file(s)
          </div>
        </div>
        <div className={`${styles.reviewSection} ${styles.reviewSectionLast}`}>
          <div className={styles.summaryLabel}>Options</div>
          <div className={styles.summaryValue}>
            {(() => {
              const cleanedForReview = options
                .map((opt) => ({
                  ...opt,
                  values: opt.values.filter((v) => v.name.trim()),
                }))
                .filter((opt) => opt.name.trim() && opt.values.length > 0);
              if (!cleanedForReview.length) return "None";
              return (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    alignItems: "flex-end",
                  }}
                >
                  {cleanedForReview.map((opt, oi) => (
                    <div key={oi}>
                      <strong>
                        {opt.name} ({OPTION_TYPE_INFO[opt.type].label})
                      </strong>{" "}
                      <span className={styles.summaryMuted}>
                        {opt.values.map((v) => v.name).join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
        <div className={`${styles.reviewSection} ${styles.reviewSectionLast}`}>
          <div className={styles.summaryLabel}>
            Variants ({variants.length})
          </div>
          <div className={styles.variantReviewList}>
            {variants.map((v, i) => {
              const selectedLabels = options
                .map((opt, oi) => {
                  const vi = v.option_selections?.[oi];
                  return vi !== null && vi !== undefined
                    ? opt.values[vi]?.name
                    : undefined;
                })
                .filter(Boolean) as string[];

              return (
                <div key={i} className={styles.variantReviewItem}>
                  <span
                    className={styles.colorDotSm}
                    style={{ background: v.color_code }}
                  />
                  <span className={styles.variantReviewName}>
                    {selectedLabels.length
                      ? selectedLabels.join(" • ")
                      : `Variant ${i + 1}`}
                  </span>
                  <span className={styles.variantReviewMeta}>
                    {v.sku || "auto-generated"} · {getPricingSummary(v)} ·{" "}
                    {v.stock} in stock
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.submitRow}>
        <button
          className={`${styles.btnPrimary} ${styles.btnLarge}`}
          onClick={handleSubmit}
          disabled={loading}
        >
          <CheckOutlined />
          {loading ? "Creating product…" : "Create product"}
        </button>
      </div>
    </div>
  );

  const stepContent = [renderStep0, renderStep1, renderStep2, renderStep3];

  const validateStep0 = () => {
    if (!productName.trim()) {
      message.error("Product name is required");
      return false;
    }
    return true;
  };

  const validateStep1 = () => true;

  const validateStep2 = () => {
    // ── 1. Every variant must have a selection for every real option ──
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const variantLabel = `Variant ${i + 1}`;

      for (let oi = 0; oi < options.length; oi++) {
        const opt = options[oi];
        if (!opt.name.trim() || opt.values.length === 0) continue;
        const selection = variant.option_selections?.[oi];
        if (selection === null || selection === undefined) {
          message.error(`${variantLabel}: pick a value for "${opt.name}"`);
          return false;
        }
      }
    }

    // ── 2. No two variants may share the exact same option selections ──
    const realOptionIndexes = options
      .map((opt, oi) => (opt.name.trim() && opt.values.length > 0 ? oi : null))
      .filter((oi): oi is number => oi !== null);

    if (realOptionIndexes.length > 0) {
      const seenSignatures = new Map<string, number>();
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const sig = realOptionIndexes
          .map((oi) => `${oi}:${v.option_selections?.[oi]}`)
          .join("|");

        if (seenSignatures.has(sig)) {
          const firstIdx = seenSignatures.get(sig)!;
          message.error(
            `Variant ${firstIdx + 1} and Variant ${i + 1} are the same — change one of them (e.g. Size or Capacity) before saving.`,
          );
          return false;
        }
        seenSignatures.set(sig, i);
      }
    }

    // ── 3. Pricing + SKU validation ──────────────────────────────────
    const skuSet = new Set<string>();

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const pricingError = getPricingError(variant, `Variant ${i + 1}`);
      if (pricingError) {
        message.error(pricingError);
        return false;
      }

      const sku = variant.sku.trim();
      if (!sku) continue;
      if (skuSet.has(sku)) {
        message.error(`Duplicate SKU: ${sku}`);
        return false;
      }
      skuSet.add(sku);
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 0 && !validateStep0()) return;
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    setCurrentStep((s) => s + 1);
  };

  return (
    <div className={styles.page}>
      <div className={styles.stepper}>
        {STEPS.map((label, i) => (
          <button
            key={i}
            className={`${styles.stepBtn} ${i === currentStep ? styles.stepActive : ""} ${
              i < currentStep ? styles.stepDone : ""
            }`}
            onClick={() => i < currentStep && setCurrentStep(i)}
            aria-current={i === currentStep ? "step" : undefined}
          >
            <span className={styles.stepNum}>
              {i < currentStep ? <CheckOutlined /> : i + 1}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <GuideCard open={guideOpen} onToggle={() => setGuideOpen((v) => !v)} />

      {stepContent[currentStep]()}

      <div className={styles.navBar}>
        {currentStep > 0 ? (
          <button
            className={styles.btnOutline}
            onClick={() => setCurrentStep((s) => s - 1)}
          >
            <ArrowLeftOutlined /> Back
          </button>
        ) : (
          <span />
        )}
        {currentStep < STEPS.length - 1 && (
          <button className={styles.btnPrimary} onClick={handleNext}>
            Next <ArrowRightOutlined />
          </button>
        )}
      </div>
    </div>
  );
};

export default CreateProductPage;