/** @format */

import { useCallback, useEffect, useState } from "react";
import axios from "axios";

import {
  CreatePricingTemplateAPI,
  DeletePricingTemplateAPI,
  GetPricingTemplatesAPI,
  UpdatePricingTemplateAPI,
} from "@/services/Api/PricingTemplateApi";
import {
  DEFAULT_BULK_TIER,
  DEFAULT_QUANTITY_PRICE,
  buildPricingPayload,
  normalizeBulkTiers,
  normalizeQuantityPricing,
  type BulkTier,
  type QuantityPrice,
  type QuantityPricingMode,
  type VariantPricing,
} from "@/utils/variantPricing";

// Pricing templates: named quantity pricing, added on the Pricing Templates
// page or saved from a product, then loaded into other products. The backend
// keeps them (BACKEND_QUESTIONS.md F29), so every admin sees the same list.
// Until it has the routes it answers 404 ("unavailable"), and the panel says
// templates aren't available yet.

export interface PricingTemplate {
  id: number;
  name: string;
  pricing_mode: QuantityPricingMode;
  bulk_pricing: BulkTier[];
  quantity_pricing: QuantityPrice[];
  updated_at: string | null;
}

export type PricingTemplatesStatus =
  | "loading"
  | "ready"
  | "error"
  | "unavailable";

export interface PricingTemplatesState {
  status: PricingTemplatesStatus;
  // Newest first, so the first one is the last saved.
  templates: PricingTemplate[];
  reload: () => Promise<void>;
  // Saves the active quantity pricing under a name. replaceId overwrites
  // that template instead of adding one.
  save: (
    name: string,
    pricing: VariantPricing,
    replaceId?: number,
  ) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const PRICING_TEMPLATE_NAME_MAX = 100;

export const templateErrorMessage = (err: unknown, fallback: string): string =>
  (axios.isAxiosError(err) && err.response?.data?.message) || fallback;

export const formatSavedDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { dateStyle: "medium" });
};

// What the template form edits. Both lists are kept while editing, so
// switching style doesn't lose what was typed; only the active one is saved.
export interface QuantityPricingDraft {
  pricing_mode: QuantityPricingMode;
  bulk_pricing: BulkTier[];
  quantity_pricing: QuantityPrice[];
}

export const emptyQuantityPricingDraft = (): QuantityPricingDraft => ({
  pricing_mode: "tiered",
  bulk_pricing: [DEFAULT_BULK_TIER()],
  quantity_pricing: [DEFAULT_QUANTITY_PRICE()],
});

export const draftFromTemplate = (t: PricingTemplate): QuantityPricingDraft => ({
  pricing_mode: t.pricing_mode,
  bulk_pricing: t.bulk_pricing.length
    ? t.bulk_pricing.map((row) => ({ ...row }))
    : [DEFAULT_BULK_TIER()],
  quantity_pricing: t.quantity_pricing.length
    ? t.quantity_pricing.map((row) => ({ ...row }))
    : [DEFAULT_QUANTITY_PRICE()],
});

// The draft as variant pricing, for the shared checks and request body.
export const pricingFromDraft = (d: QuantityPricingDraft): VariantPricing => ({
  price: 0,
  case_price: 0,
  pricing_mode: d.pricing_mode,
  bulk_pricing: d.bulk_pricing,
  quantity_pricing: d.quantity_pricing,
});

const toTemplate = (raw: unknown): PricingTemplate | null => {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = Number(row.id);
  const mode = row.pricing_mode;
  if (!Number.isFinite(id) || (mode !== "tiered" && mode !== "quantity_fixed")) {
    return null;
  }

  const template: PricingTemplate = {
    id,
    name: String(row.name ?? "").trim() || `Template ${id}`,
    pricing_mode: mode,
    bulk_pricing: normalizeBulkTiers(row.bulk_pricing),
    quantity_pricing: normalizeQuantityPricing(row.quantity_pricing),
    updated_at:
      typeof row.updated_at === "string"
        ? row.updated_at
        : typeof row.created_at === "string"
          ? row.created_at
          : null,
  };

  const rows =
    mode === "tiered" ? template.bulk_pricing : template.quantity_pricing;
  return rows.length ? template : null;
};

const savedAt = (t: PricingTemplate) => Date.parse(t.updated_at ?? "") || 0;

interface FetchResult {
  status: Exclude<PricingTemplatesStatus, "loading">;
  templates: PricingTemplate[];
}

const fetchTemplates = async (): Promise<FetchResult> => {
  try {
    const res = await GetPricingTemplatesAPI();
    const body = res.data?.data;
    const rows: unknown[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.data)
        ? body.data
        : [];
    const templates = rows
      .map(toTemplate)
      .filter((t): t is PricingTemplate => t !== null)
      .sort((a, b) => savedAt(b) - savedAt(a) || b.id - a.id);
    return { status: "ready", templates };
  } catch (err) {
    const missing = axios.isAxiosError(err) && err.response?.status === 404;
    return { status: missing ? "unavailable" : "error", templates: [] };
  }
};

export function usePricingTemplates(): PricingTemplatesState {
  const [status, setStatus] = useState<PricingTemplatesStatus>("loading");
  const [templates, setTemplates] = useState<PricingTemplate[]>([]);

  const reload = useCallback(async () => {
    const result = await fetchTemplates();
    setTemplates(result.templates);
    setStatus(result.status);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchTemplates().then((result) => {
      if (cancelled) return;
      setTemplates(result.templates);
      setStatus(result.status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (name: string, pricing: VariantPricing, replaceId?: number) => {
      const payload = buildPricingPayload(pricing);
      if (payload.pricing_mode === "fixed") {
        throw new Error("Only quantity-based pricing can be saved as a template.");
      }
      const body = {
        name,
        pricing_mode: payload.pricing_mode,
        bulk_pricing: payload.bulk_pricing,
        quantity_pricing: payload.quantity_pricing,
      };
      if (replaceId) await UpdatePricingTemplateAPI(replaceId, body);
      else await CreatePricingTemplateAPI(body);
      await reload();
    },
    [reload],
  );

  const remove = useCallback(async (id: number) => {
    await DeletePricingTemplateAPI(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { status, templates, reload, save, remove };
}
