import React, { useEffect, useRef, useState } from "react";
import { message, Pagination, Select, Tooltip, Upload } from "antd";
import type { UploadFile } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  UploadOutlined,
  InfoCircleOutlined,
  UnorderedListOutlined,
  BgColorsOutlined,
  CheckSquareOutlined,
  TagsOutlined,
} from "@ant-design/icons";

import {
  AddProductVariantsAPI,
  CreateProductAPI,
} from "@/services/Api/ProductApi";
import { GetAllCategoriesAPI } from "@/services/Api/ParentCategoryApi";
import { GetPublishedBrandsAPI } from "@/services/Api/BrandsApi";

import styles from "./CreateProductPage.module.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: number;
  title: string;
}

interface Brand {
  id: number;
  name: string;
  logo_url?: string;
}

// One selectable value for the product's custom option (e.g. "M", "250 ml",
// "100 Pages", "Navy Blue"...). Garment measurements are optional and only
// shown when the option is being used for clothing sizing.
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

type PricingMode = "fixed" | "tiered";

interface VariantType {
  sku: string;
  color: string;
  color_code: string;
  price: number;
  pricing_mode: PricingMode;

  stock: number;
  supplier: string;
  option_value_index: number | null;
  option_value: string;
  images: UploadFile[];
  bulk_pricing: {
    min_qty: number;
    max_qty: number | null;
    price: number;
  }[];
}

// Option "display style" — how the value picker appears to shoppers.
type OptionType = "dropdown" | "color" | "buttons" | "size" | "checkbox";

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

const DEFAULT_VARIANT = (): VariantType => ({
  sku: "",
  color: "",
  color_code: "#1E3A8A",
  price: 0,
  pricing_mode: "fixed",
  stock: 0,
  supplier: "MANUAL",
  option_value_index: null,
  option_value: "",
  images: [],
  bulk_pricing: [
    {
      min_qty: 1,
      max_qty: null,
      price: 0,
    },
  ],
});

// Reference info shown to first-time users so the wizard reads the same
// whether they're listing a t-shirt, a notebook, a water bottle, or a
// wristband.
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

// Converts hex to RGB
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

// Named color map — extended list covering most common product colors
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

// Helper — is a hex color light or dark (for label contrast)
function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.55;
}

// Turns "Size" / "Pages" / "Capacity" etc. into a natural step-2 heading —
// "Sizes", "Page Options", "Capacity Options" — instead of the generic
// "Option values" label.
function getOptionValuesStepTitle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Option values";
  const lower = trimmed.toLowerCase();
  if (lower === "size" || lower === "sizes") return "Sizes";
  if (lower === "color" || lower === "colors") return "Colors";
  if (lower === "material" || lower === "materials") return "Materials";
  if (lower === "page" || lower === "pages") return "Page Options";
  if (lower === "capacity") return "Capacity Options";
  if (lower === "storage") return "Storage Options";
  return `${trimmed} Options`;
}

// Gives a few realistic example values for the customer selection label the
// admin typed, so step 2 shows something concrete instead of an abstract
// instruction.
function getExampleValues(name: string): string[] {
  const lower = name.trim().toLowerCase();
  if (!lower) return [];
  if (lower.includes("size")) return ["S", "M", "L", "XL"];
  if (lower.includes("capacity")) return ["500ml", "750ml", "1L"];
  if (lower.includes("storage")) return ["64GB", "128GB", "256GB"];
  if (lower.includes("page")) return ["100 Pages", "200 Pages", "300 Pages"];
  if (lower.includes("color")) return ["Black", "Red", "Blue"];
  if (lower.includes("material")) return ["Cotton", "Polyester", "Wool"];
  return [];
}

// ─── Component ────────────────────────────────────────────────────────────────

const CreateProductPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Product info
  const [productName, setProductName] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [productImages, setProductImages] = useState<UploadFile[]>([]);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [catSearch, setCatSearch] = useState("");
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [catPage, setCatPage] = useState(1);
  const [catTotal, setCatTotal] = useState(0);
  const [catLoading, setCatLoading] = useState(false);

  // The product's single custom option (e.g. "Size", "Pages", "Capacity")
  const [optionValues, setOptionValues] = useState<OptionValueType[]>([]);
  const [optionName, setOptionName] = useState("");
  const [optionType, setOptionType] = useState<OptionType>("dropdown");
  const CAT_LIMIT = 50;

  // Brands
  const [brands, setBrands] = useState<Brand[]>([]);
  const [allLoadedCategories, setAllLoadedCategories] = useState<Category[]>(
    [],
  );

  // Variants
  const [variants, setVariants] = useState<VariantType[]>([
    DEFAULT_VARIANT(),
  ]);

  const catSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeOptionInfo = OPTION_TYPE_INFO[optionType];
  const hasDefinedOptionValues = optionValues.some((s) => s.name.trim());

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

  // ─── Category helpers ────────────────────────────────────────────────────
  const toggleCategory = (id: number) => {
    setSelectedCatIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const selectedCategories = allLoadedCategories.filter((c) =>
    selectedCatIds.includes(c.id),
  );

  // ─── Option value helpers ─────────────────────────────────────────────────
  const addOptionValue = () =>
    setOptionValues((prev) => [...prev, DEFAULT_OPTION_VALUE()]);
  const removeOptionValue = (i: number) =>
    setOptionValues((prev) => prev.filter((_, idx) => idx !== i));
  const updateOptionValueName = (i: number, val: string) =>
    setOptionValues((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], name: val };
      return updated;
    });
  const updateOptionValueColorCode = (i: number, hex: string) =>
    setOptionValues((prev) => {
      const updated = [...prev];
      const current = updated[i];
      const prevAutoName = getColorNameFromHex(current.color_code || "");
      const nextName =
        !current.name.trim() || current.name === prevAutoName
          ? getColorNameFromHex(hex)
          : current.name;
      updated[i] = { ...current, color_code: hex, name: nextName };
      return updated;
    });
  const updateOptionValueMeasurement = (
    i: number,
    field: keyof typeof DEFAULT_MEASUREMENTS,
    val: number,
  ) =>
    setOptionValues((prev) => {
      const updated = [...prev];
      updated[i] = {
        ...updated[i],
        measurements: {
          ...(updated[i].measurements || DEFAULT_MEASUREMENTS),
          [field]: val,
        },
      };
      return updated;
    });

  // ─── Variant helpers ──────────────────────────────────────────────────────
  const addVariant = () =>
    setVariants((prev) => [...prev, DEFAULT_VARIANT()]);
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

  // When color picker changes: update code + auto-suggest color name if field is empty
  const handleColorCodeChange = (i: number, hex: string) => {
    updateVariant(i, "color_code", hex);
    // Auto-fill color name only if the field is currently empty or was previously auto-set
    const current = variants[i];
    const prevAutoName = getColorNameFromHex(current.color_code);
    if (!current.color.trim() || current.color === prevAutoName) {
      updateVariant(i, "color", getColorNameFromHex(hex));
    }
  };

  // When hex text input changes: validate and auto-suggest name
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

      productFormData.append("name", productName.trim() || "Draft Product");
      productFormData.append("description", description || "");
      productFormData.append("brand_id", String(brandId || 1));
      productFormData.append(
        "category_ids",
        JSON.stringify(selectedCatIds.length ? selectedCatIds : [2]),
      );
      productFormData.append("option_name", optionName);
      productFormData.append("option_type", optionType);

      const cleanedOptionValues = optionValues.filter((s) => s.name.trim());
      productFormData.append("option_values", JSON.stringify(cleanedOptionValues));
      productImages.forEach((file) => {
        if (file.originFileObj)
          productFormData.append("images", file.originFileObj);
      });

      const productRes = await CreateProductAPI(productFormData);
      const product = productRes?.data?.data;
      if (!product?.id) throw new Error("Product creation failed");

      const variantFormData = new FormData();
      variantFormData.append("product_id", product.id.toString());

      const formattedVariants = variants.map((v, index) => ({
        sku: v.sku || `DRAFT-${Date.now()}-${index}`,
        color: v.color || "Default",
        color_code: v.color_code || "#000000",
        pricing_mode: v.pricing_mode,
        price:
          v.pricing_mode === "fixed"
            ? Number(v.price || 0)
            : Number(v.bulk_pricing[0]?.price || 0),
        supplier: "MANUAL",
        stock: Number(v.stock || 0),
        ...(hasDefinedOptionValues
          ? { option_value: optionValues[v.option_value_index!]?.name }
          : { option_value: v.option_value }),
        image_count: v.images.length,
        bulk_pricing: v.pricing_mode === "tiered" ? v.bulk_pricing : [],
      }));

      variantFormData.append("variants", JSON.stringify(formattedVariants));
      variants.forEach((variant) => {
        variant.images.forEach((img) => {
          if (img.originFileObj)
            variantFormData.append("variant_images", img.originFileObj);
        });
      });

      await AddProductVariantsAPI(variantFormData);
      message.success("Product created successfully!");

      setCurrentStep(0);
      setProductName("");
      setBrandId(null);
      setDescription("");
      setProductImages([]);
      setSelectedCatIds([]);
      setOptionValues([]);
      setOptionName("");
      setOptionType("dropdown");
      setVariants([DEFAULT_VARIANT()]);
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
            bottles, wristbands, and more. Fill in the basics here, then
            you'll define the choice customers make (like Size or Capacity)
            and finally the exact variants you stock (like "Blue, Large,
            $19.99, 20 in stock").
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
              Product name 
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
              Brand 
            </label>
            <Select
              placeholder="Select brand"
              style={{ width: "100%" }}
              value={brandId ?? undefined}
              onChange={(value) => setBrandId(value)}
              options={brands.map((brand) => ({
                label: brand.name,
                value: brand.id,
              }))}
            />
          </div>
          <div className={`${styles.fieldGroup} ${styles.fieldFull}`}>
            <label>
              Description 
            </label>
            <textarea
              rows={4}
              placeholder="Describe the product — material, use case, what makes it stand out. e.g. Premium cotton casual shirt for daily wear..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label>
              Customer selection label
              <Tooltip title="This is the name customers will see above the choice they make on the product page. Pick whatever fits your product.">
                <InfoCircleOutlined className={styles.labelInfo} />
              </Tooltip>
            </label>
            <input
              value={optionName}
              onChange={(e) => setOptionName(e.target.value)}
              placeholder="e.g. Size, Capacity, Pages, Storage, Color"
              list="option-name-suggestions"
            />
            <datalist id="option-name-suggestions">
              {OPTION_NAME_SUGGESTIONS.map((s) => (
                <option key={s} value={s.split(" (")[0]} />
              ))}
            </datalist>
            <span className={styles.fieldHint}>
              Not every product needs this — skip it for items like a single
              plain candle that has no choices.
            </span>
          </div>

          <div className={styles.fieldGroup}>
            <label>
              Display style
              <Tooltip title="Controls how the option values you add in the next step are shown to shoppers.">
                <InfoCircleOutlined className={styles.labelInfo} />
              </Tooltip>
            </label>
            <select
              value={optionType}
              onChange={(e) => setOptionType(e.target.value as OptionType)}
            >
              {(Object.keys(OPTION_TYPE_INFO) as OptionType[]).map((key) => (
                <option key={key} value={key}>
                  {OPTION_TYPE_INFO[key].emoji} {OPTION_TYPE_INFO[key].label}
                </option>
              ))}
            </select>
            <span className={styles.fieldHint}>
              {activeOptionInfo.description} {activeOptionInfo.example}
            </span>
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
          <span className={styles.cardHint}>
            Pick every category this product should appear under
          </span>
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
                <div className={styles.catLoadingRow}>
                  No categories found
                </div>
              )}
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`${styles.catItem} ${
                    selectedCatIds.includes(cat.id)
                      ? styles.catItemSelected
                      : ""
                  }`}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <span
                    className={`${styles.catCheck} ${selectedCatIds.includes(cat.id) ? styles.catCheckOn : ""}`}
                  >
                    {selectedCatIds.includes(cat.id) && <CheckOutlined />}
                  </span>
                  <span>{cat.title}</span>
                </div>
              ))}
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
                  Pick from the list on the left
                </span>
              </div>
            ) : (
              <div className={styles.catBadgeList}>
                {selectedCategories.map((cat) => (
                  <div key={cat.id} className={styles.catBadge}>
                    <span>{cat.title}</span>
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
            Product images 
          </span>
          <span className={styles.cardHint}>
            Shown as the main listing images. Add variant-specific photos
            later in the Variants step.
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

  const renderStep1 = () => {
    const displayOptionName = optionName.trim() || "option";
    const isColorType = optionType === "color";
    const isSizeType = optionType === "size";
    const exampleValues = getExampleValues(optionName);

    return (
      <div className={styles.stepContent}>
        <div className={styles.stepHeader}>
          <div>
            <div className={styles.stepTitle}>
              {getOptionValuesStepTitle(optionName)}
            </div>
            <span className={styles.stepHint}>
              Add every value a shopper can choose for{" "}
              <strong>{displayOptionName}</strong>. {activeOptionInfo.example}
            </span>
          </div>
          <button className={styles.btnPrimary} onClick={addOptionValue}>
            <PlusOutlined /> Add value
          </button>
        </div>

        <div className={styles.instructionNote}>
          <InfoCircleOutlined className={styles.introIcon} />
          <span>
            {optionName.trim() ? (
              <>
                Add one value per row for <strong>{optionName}</strong>
                {exampleValues.length > 0 && (
                  <>
                    {" "}— for example{" "}
                    {exampleValues.map((ex, idx) => (
                      <React.Fragment key={ex}>
                        <strong>{ex}</strong>
                        {idx < exampleValues.length - 1 ? ", " : ""}
                      </React.Fragment>
                    ))}
                  </>
                )}
                . Each one becomes a choice on the product page.{" "}
              </>
            ) : (
              <>
                Add one value per row for this option. {activeOptionInfo.example}{" "}
              </>
            )}
            This whole step is optional; skip it for products with no
            choices, like a single plain candle.
          </span>
        </div>

        {optionValues.length === 0 ? (
          <div className={`${styles.card} ${styles.emptyCard}`}>
            <div className={styles.emptyCardIcon}>📐</div>
            <span className={styles.emptyCardText}>
              This product has no selectable options
            </span>
            <span className={styles.emptyCardHint}>
              That's fine for products like ✓ Candle, ✓ Mug, or ✓ Sticker —
              click Next to continue, or add a value below if this product
              does need one.
            </span>
            <button className={styles.btnOutline} onClick={addOptionValue}>
              <PlusOutlined /> Add {optionName || "value"}
            </button>
          </div>
        ) : (
          optionValues.map((value, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>
                  {optionName || "Value"} {i + 1}
                  {value.name && (
                    <span className={styles.sizeNamePreview}>
                      {value.name}
                    </span>
                  )}
                </span>
                <button
                  className={styles.btnDanger}
                  onClick={() => removeOptionValue(i)}
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
                      <label>
                        Color name 
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Royal Blue"
                        value={value.name}
                        onChange={(e) =>
                          updateOptionValueName(i, e.target.value)
                        }
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Color code</label>
                      <div className={styles.colorRow}>
                        <input
                          type="color"
                          value={value.color_code}
                          onChange={(e) =>
                            updateOptionValueColorCode(i, e.target.value)
                          }
                          className={styles.colorPicker}
                          title="Pick a color"
                        />
                        <input
                          type="text"
                          value={value.color_code}
                          placeholder="#1E3A8A"
                          onChange={(e) =>
                            updateOptionValueColorCode(i, e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.fieldGroup} style={{ maxWidth: 320 }}>
                  <label>
                    {optionName || "Value"} name{" "}
                    
                  </label>
                  <input
                    type="text"
                    placeholder={activeOptionInfo.valuePlaceholder}
                    value={value.name}
                    onChange={(e) =>
                      updateOptionValueName(i, e.target.value)
                    }
                  />
                  <span className={styles.fieldHint}>
                    Include the unit if it helps shoppers, e.g. "250 ml",
                    "500 Pages", "32 GB", "S".
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
                      ] as [
                        keyof typeof DEFAULT_MEASUREMENTS,
                        string,
                      ][]
                    ).map(([field, label]) => (
                      <div key={field} className={styles.measureField}>
                        <label>{label}</label>
                        <input
                          type="number"
                          placeholder="—"
                          value={value.measurements?.[field] ?? ""}
                          onChange={(e) =>
                            updateOptionValueMeasurement(
                              i,
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
      </div>
    );
  };

  const renderStep2 = () => {
    const isColorType = optionType === "color";
    const displayOptionName = optionName.trim() || "Option";

    return (
      <div className={styles.stepContent}>
        <div className={styles.stepHeader}>
          <div>
            <div className={styles.stepTitle}>Variants</div>
            <span className={styles.stepHint}>
              Each variant is one sellable combination — e.g. "Blue, Large,
              $19.99, 20 in stock". Add one row per combination you actually
              stock.
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
            // The value chosen for the product's own custom option (Size,
            // Pages, Capacity...), independent of the variant's color.
            const chosenOptionLabel = hasDefinedOptionValues
              ? optionValues[v.option_value_index ?? -1]?.name
              : v.option_value;
            // When the option type itself IS color (wristbands etc.) the
            // color swatch picked below is the whole identity. Otherwise
            // combine color + option value, e.g. "Blue • Large".
            const variantTitle = isColorType
              ? chosenOptionLabel || `Variant ${i + 1}`
              : [v.color || autoColorName, chosenOptionLabel]
                  .filter(Boolean)
                  .join(" • ") || `Variant ${i + 1}`;
            return (
              <div key={i} className={styles.card}>
                {/* Variant header with color preview */}
                <div className={styles.variantCardHeader}>
                  <div className={styles.variantTitleRow}>
                    <span
                      className={styles.colorBubble}
                      style={{
                        background: isColorType
                          ? optionValues[v.option_value_index ?? -1]
                              ?.color_code || "#e5e7eb"
                          : v.color_code,
                      }}
                    />
                    <span className={styles.cardTitle}>{variantTitle}</span>
                    {v.sku && <span className={styles.skuTag}>{v.sku}</span>}
                  </div>
                  <button
                    className={styles.btnDanger}
                    onClick={() => removeVariant(i)}
                  >
                    <DeleteOutlined /> Remove
                  </button>
                </div>

                {/* Color section — hidden when the product's own option IS
                    color, since that's selected below instead. */}
                {!isColorType && (
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
                        <input
                          type="text"
                          placeholder="e.g. Navy Blue (optional)"
                          value={v.color}
                          onChange={(e) =>
                            updateVariant(i, "color", e.target.value)
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
                      SKU
                      <Tooltip title="A unique code you use internally to track this exact variant, e.g. SHIRT-BLUE-M.">
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
                    <input
                      type="number"
                      min={0}
                      placeholder="20"
                      value={v.stock || ""}
                      onChange={(e) =>
                        updateVariant(i, "stock", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>{displayOptionName}</label>
                    {hasDefinedOptionValues ? (
                      isColorType ? (
                        <div className={styles.swatchPicker}>
                          {optionValues
                            .filter((ov) => ov.name.trim())
                            .map((ov, oi) => (
                              <button
                                type="button"
                                key={oi}
                                className={`${styles.swatchOption} ${
                                  v.option_value_index === oi
                                    ? styles.swatchOptionActive
                                    : ""
                                }`}
                                style={{ background: ov.color_code }}
                                title={ov.name}
                                onClick={() =>
                                  updateVariant(i, "option_value_index", oi)
                                }
                              >
                                {v.option_value_index === oi && (
                                  <CheckOutlined
                                    style={{
                                      color: isLightColor(
                                        ov.color_code || "#fff",
                                      )
                                        ? "#333"
                                        : "#fff",
                                    }}
                                  />
                                )}
                              </button>
                            ))}
                        </div>
                      ) : (
                        <select
                          value={v.option_value_index ?? ""}
                          onChange={(e) =>
                            updateVariant(
                              i,
                              "option_value_index",
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        >
                          <option value="">
                            Select {displayOptionName}
                          </option>
                          {optionValues.map((s, si) => (
                            <option key={si} value={si}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      )
                    ) : (
                      <input
                        type="text"
                        placeholder="OSFM, 24oz, XL… (optional)"
                        value={v.option_value}
                        onChange={(e) =>
                          updateVariant(i, "option_value", e.target.value)
                        }
                      />
                    )}
                  </div>
                </div>

                <div className={styles.dividerLabel}>Pricing</div>
                <div className={styles.pricingModeToggle}>
                  <button
                    type="button"
                    className={`${styles.pricingModeBtn} ${
                      v.pricing_mode === "fixed"
                        ? styles.pricingModeBtnActive
                        : ""
                    }`}
                    onClick={() => updateVariant(i, "pricing_mode", "fixed")}
                  >
                    Fixed price
                  </button>
                  <button
                    type="button"
                    className={`${styles.pricingModeBtn} ${
                      v.pricing_mode === "tiered"
                        ? styles.pricingModeBtnActive
                        : ""
                    }`}
                    onClick={() => updateVariant(i, "pricing_mode", "tiered")}
                  >
                    Quantity-based pricing
                  </button>
                </div>

                {v.pricing_mode === "fixed" ? (
                  <div className={styles.fieldGroup} style={{ maxWidth: 220 }}>
                    <label>Price ($)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="1299"
                      value={v.price || ""}
                      onChange={(e) =>
                        updateVariant(i, "price", Number(e.target.value))
                      }
                    />
                  </div>
                ) : (
                  <div className={styles.bulkPricing}>
                    <span className={styles.fieldHint}>
                      Set a lower price per item as quantity ordered goes up —
                      shown to customers as bulk discount pricing.
                    </span>
                    <div className={styles.bulkPricingHeader}>
                      <span>From</span>
                      <span>To</span>
                      <span>Price per item ($)</span>
                      <span />
                    </div>
                    {v.bulk_pricing.map((tier, index) => (
                      <div key={index} className={styles.bulkRow}>
                        <input
                          type="number"
                          placeholder="Min qty"
                          value={tier.min_qty}
                          onChange={(e) => {
                            const updated = [...v.bulk_pricing];
                            updated[index].min_qty = Number(e.target.value);
                            updateVariant(i, "bulk_pricing", updated);
                          }}
                        />
                        <input
                          type="number"
                          placeholder="Max qty (blank = and more)"
                          value={tier.max_qty ?? ""}
                          onChange={(e) => {
                            const updated = [...v.bulk_pricing];
                            updated[index].max_qty =
                              e.target.value === ""
                                ? null
                                : Number(e.target.value);
                            updateVariant(i, "bulk_pricing", updated);
                          }}
                        />
                        <input
                          type="number"
                          placeholder="Price"
                          value={tier.price}
                          onChange={(e) => {
                            const updated = [...v.bulk_pricing];
                            updated[index].price = Number(e.target.value);
                            updateVariant(i, "bulk_pricing", updated);
                          }}
                        />
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={() => {
                            const updated = v.bulk_pricing.filter(
                              (_, idx) => idx !== index,
                            );
                            updateVariant(i, "bulk_pricing", updated);
                          }}
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={() => {
                        updateVariant(i, "bulk_pricing", [
                          ...v.bulk_pricing,
                          { min_qty: 1, max_qty: null, price: 0 },
                        ]);
                      }}
                    >
                      <PlusOutlined /> Add quantity tier
                    </button>
                  </div>
                )}

                <div className={styles.dividerLabel}>
                  Variant images
                  <span className={styles.dividerHint}>
                    Optional — only needed if this variant looks different
                    from the main product images
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
        <div className={styles.reviewSection}>
          <div className={styles.summaryLabel}>
            {optionName || "Option"} ({OPTION_TYPE_INFO[optionType].label})
          </div>
          <div className={styles.summaryValue}>
            {optionValues
              .filter((s) => s.name.trim())
              .map((s) => s.name)
              .join(", ") || "None"}
          </div>
        </div>
        <div className={`${styles.reviewSection} ${styles.reviewSectionLast}`}>
          <div className={styles.summaryLabel}>
            Variants ({variants.length})
          </div>
          <div className={styles.variantReviewList}>
            {variants.map((v, i) => {
              const chosenOptionValue = hasDefinedOptionValues
                ? optionValues[v.option_value_index ?? -1]?.name
                : v.option_value;
              const priceLabel =
                v.pricing_mode === "fixed"
                  ? `$${v.price}`
                  : `from $${
                      v.bulk_pricing[v.bulk_pricing.length - 1]?.price ??
                      v.bulk_pricing[0]?.price ??
                      0
                    }`;
              const swatchColor =
                optionType === "color"
                  ? optionValues[v.option_value_index ?? -1]?.color_code
                  : v.color_code;
              return (
                <div key={i} className={styles.variantReviewItem}>
                  <span
                    className={styles.colorDotSm}
                    style={{ background: swatchColor }}
                  />
                  <span className={styles.variantReviewName}>
                    {optionType === "color"
                      ? chosenOptionValue || `Variant ${i + 1}`
                      : v.color || `Variant ${i + 1}`}
                  </span>
                  <span className={styles.variantReviewMeta}>
                    {v.sku || "—"} · {priceLabel} · {v.stock} in stock ·{" "}
                    {chosenOptionValue || "—"}
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
    // if (!productName.trim()) {
    //   message.error("Product name is required");
    //   return false;
    // }
    // if (!brandId) {
    //   message.error("Please select a brand");
    //   return false;
    // }
    // if (!selectedCatIds.length) {
    //   message.error("Please select at least one category");
    //   return false;
    // }
    // if (!description.trim()) {
    //   message.error("Description is required");
    //   return false;
    // }
    // if (!productImages.length) {
    //   message.error("Please upload at least one product image");
    //   return false;
    // }
    return true;
  };

  const validateStep1 = () => true;

  const validateStep2 = () => {
    const skuSet = new Set<string>();
    for (const variant of variants) {
      const sku = variant.sku.trim();
      if (sku && skuSet.has(sku)) {
        message.error(`Duplicate SKU: ${sku}`);
        return false;
      }
      skuSet.add(sku);
    }
    for (const variant of variants) {
      if (!variant.sku.trim()) {
        message.error("SKU is required");
        return false;
      }
      if (
        hasDefinedOptionValues &&
        (variant.option_value_index === null ||
          variant.option_value_index === undefined)
      ) {
        message.error(
          `Please select ${optionName || "an option"} for ${variant.sku}`,
        );
        return false;
      }
      if (variant.pricing_mode === "fixed") {
        if (!variant.price || variant.price <= 0) {
          message.error("Variant price is required");
          return false;
        }
      } else if (!variant.bulk_pricing.length) {
        message.error("Add at least one quantity tier or switch to fixed price");
        return false;
      }
      if (variant.stock < 0) {
        message.error("Stock cannot be negative");
        return false;
      }
      if (!variant.images.length) {
        message.error(
          `Please upload image(s) for variant "${variant.color || variant.sku}"`,
        );
        return false;
      }
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
      {/* Stepper */}
      <div className={styles.stepper}>
        {STEPS.map((label, i) => (
          <button
            key={i}
            className={`${styles.stepBtn} ${i === currentStep ? styles.stepActive : ""} ${
              i < currentStep ? styles.stepDone : ""
            }`}
            onClick={() => i < currentStep && setCurrentStep(i)}
          >
            <span className={styles.stepNum}>
              {i < currentStep ? <CheckOutlined /> : i + 1}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Step content */}
      {stepContent[currentStep]()}

      {/* Navigation */}
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