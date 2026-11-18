import { useSyncExternalStore } from "react";
import { GetHandlingFeeOptionsAPI, type HandlingFeeOptions } from "@/services/Api/SettingsApi";

// The order handling fee (setting HANDLING_FEE_RULE, type handling_fee). Its value is JSON text:
//   { "amount": 35, "label": "Handling fee", "category_ids": [1396], "suppliers": ["SAGE:51093"] }
// An order pays `amount` once when one of its products is in a chosen category (or none are
// chosen) and from a chosen supplier (or none are chosen). Both lists empty, or amount 0: no fee.

export interface HandlingFeeRule {
  amount: number | null;
  label: string;
  category_ids: number[];
  suppliers: string[];
}

export const DEFAULT_FEE_LABEL = "Handling fee";
// The backend's limits (handlingFeeRule.js).
export const MAX_FEE_AMOUNT = 10000;
export const MAX_FEE_LABEL = 60;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const formatUSD = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// "" (not set, or reset) is no rule. Text that isn't a rule comes back as invalid.
export const parseHandlingFeeRule = (text: string | null | undefined): { rule: HandlingFeeRule | null; invalid: boolean } => {
  if (!text?.trim()) return { rule: null, invalid: false };
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { rule: null, invalid: true };
    const amount = raw.amount === null || raw.amount === undefined || raw.amount === "" ? NaN : Number(raw.amount);
    return {
      rule: {
        amount: Number.isFinite(amount) ? amount : null,
        label: typeof raw.label === "string" ? raw.label : DEFAULT_FEE_LABEL,
        category_ids: Array.isArray(raw.category_ids)
          ? raw.category_ids.map(Number).filter((id: number) => Number.isInteger(id) && id > 0)
          : [],
        suppliers: Array.isArray(raw.suppliers)
          ? raw.suppliers.map((entry: unknown) => String(entry).trim().toUpperCase()).filter(Boolean)
          : [],
      },
      invalid: false,
    };
  } catch {
    return { rule: null, invalid: true };
  }
};

// The text the page saves. Keys and lists are in the backend's order, so going back to the saved
// rule by hand shows as unchanged.
export const serializeHandlingFeeRule = (rule: HandlingFeeRule) =>
  JSON.stringify({
    amount: rule.amount,
    label: rule.label,
    category_ids: [...new Set(rule.category_ids)].sort((a, b) => a - b),
    suppliers: [...new Set(rule.suppliers)].sort(),
  });

// Category titles and supplier names can hold HTML entities ("T-Shirts &amp; Tops").
const decode = (text: string) => {
  if (!text.includes("&") || typeof document === "undefined") return text;
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
};

export interface FeeOption<V> {
  value: V;
  label: string;
}

// Picker rows: "Tumblers · SAGE", and each supplier's label.
export const pickerOptions = (options: HandlingFeeOptions | null) => ({
  categories: (options?.categories ?? []).map<FeeOption<number>>((category) => ({
    value: category.id,
    label: category.supplier ? `${decode(category.title)} · ${category.supplier}` : decode(category.title),
  })),
  suppliers: (options?.suppliers ?? []).map<FeeOption<string>>((supplier) => ({
    value: supplier.value,
    label: decode(supplier.label),
  })),
});

const listNames = (names: string[]) =>
  names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;

// Read mode's line, e.g. "$35.00 · Tumblers (SAGE) · SAGE · Diamondback Branding (51093)". Names
// come from the options when they're loaded; otherwise the ids show.
export const summarizeHandlingFee = (text: string, options: HandlingFeeOptions | null): string => {
  const { rule, invalid } = parseHandlingFeeRule(text);
  if (invalid || !rule) return text;
  const amount = Number(rule.amount);
  if (!(amount > 0)) return "Off: the amount is $0.00";
  if (!rule.category_ids.length && !rule.suppliers.length) {
    return `Off: no supplier category or supplier is chosen (${formatUSD(amount)})`;
  }

  const categories = new Map((options?.categories ?? []).map((category) => [category.id, category]));
  const suppliers = new Map((options?.suppliers ?? []).map((supplier) => [supplier.value, supplier.label]));

  const categoryNames = rule.category_ids.map((id) => {
    const category = categories.get(id);
    if (!category) return options ? `Supplier category ${id} (not found)` : `Supplier category ${id}`;
    return category.supplier ? `${decode(category.title)} (${category.supplier})` : decode(category.title);
  });
  const supplierNames = rule.suppliers.map((value) => {
    const label = suppliers.get(value);
    return label ? decode(label) : value;
  });

  const parts = [
    formatUSD(amount),
    categoryNames.length ? listNames(categoryNames) : "Any supplier category",
    supplierNames.length ? listNames(supplierNames) : "Any supplier",
  ];
  if (rule.label.trim() && rule.label.trim() !== DEFAULT_FEE_LABEL) parts.push(`shown as "${rule.label.trim()}"`);
  return parts.join(" · ");
};

// ── The picker options, shared by edit mode (which loads them) and read mode (which uses them) ──

interface OptionsState {
  data: HandlingFeeOptions | null;
  loading: boolean;
  failed: boolean;
}

let optionsState: OptionsState = { data: null, loading: false, failed: false };
const listeners = new Set<() => void>();

const setOptionsState = (patch: Partial<OptionsState>) => {
  optionsState = { ...optionsState, ...patch };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Called once each time edit mode opens. A list loaded earlier stays in use while it reloads.
export const loadHandlingFeeOptions = async () => {
  if (optionsState.loading) return;
  setOptionsState({ loading: true, failed: false });
  try {
    const res = await GetHandlingFeeOptionsAPI();
    setOptionsState({ data: res.data.data, loading: false });
  } catch {
    setOptionsState({ loading: false, failed: true });
  }
};

export const useHandlingFeeOptions = () => useSyncExternalStore(subscribe, () => optionsState);
