/** @format */

import { useState } from "react";
import { toast } from "sonner";

import {
  getPricingError,
  hasEnteredQuantityPricing,
  type VariantPricing,
} from "@/utils/variantPricing";
import { usePricingTemplates, type PricingTemplate } from "./usePricingTemplates";
import {
  LoadPricingTemplateDialog,
  SavePricingTemplateDialog,
} from "./PricingTemplateDialogs";
import { PricingTemplateBar } from "./PricingTemplateBar";

interface Options {
  variants: VariantPricing[];
  // "Use the same price for all variants": a loaded template goes to every variant.
  samePriceForAll: boolean;
  // Sets pricing fields on variant i, or on every variant when samePriceForAll is on.
  applyPricing: (i: number, fields: Partial<VariantPricing>) => void;
}

// Load template and Save as template for each variant's quantity pricing, on
// Create, Edit and Duplicate Product. bar(i) goes above variant i's pricing
// rows, and dialogs once at the end of the page. Until the backend has the
// routes (BACKEND_QUESTIONS.md F29), the dialogs say templates aren't
// available yet.
export function useVariantPricingTemplates({
  variants,
  samePriceForAll,
  applyPricing,
}: Options) {
  const templates = usePricingTemplates();
  const [dialog, setDialog] = useState<{
    kind: "save" | "load";
    variant: number;
  } | null>(null);
  const variant = dialog ? variants[dialog.variant] : undefined;

  const openLoad = (i: number) => {
    setDialog({ kind: "load", variant: i });
    // Picks up templates added since the page opened.
    void templates.reload();
  };

  // Save as template opens only once the variant's pricing is valid.
  const openSave = (i: number) => {
    const error = getPricingError(variants[i], "Pricing");
    if (error) {
      toast.error("Fix the pricing before saving it as a template", {
        description: error,
      });
      return;
    }
    setDialog({ kind: "save", variant: i });
  };

  // Loads a template's rows into variant i, or into every variant when
  // "same price for all" is on. The other style's rows stay, as they do
  // when switching styles by hand.
  const loadTemplate = (i: number, template: PricingTemplate) => {
    applyPricing(
      i,
      template.pricing_mode === "tiered"
        ? {
            pricing_mode: "tiered",
            bulk_pricing: template.bulk_pricing.map((t) => ({ ...t })),
          }
        : {
            pricing_mode: "quantity_fixed",
            quantity_pricing: template.quantity_pricing.map((q) => ({ ...q })),
          },
    );
    toast.success(`Loaded "${template.name}"`);
  };

  const bar = (i: number) => (
    <PricingTemplateBar onLoad={() => openLoad(i)} onSave={() => openSave(i)} />
  );

  const dialogs = (
    <>
      <SavePricingTemplateDialog
        open={dialog?.kind === "save"}
        pricing={variant ?? null}
        state={templates}
        onClose={() => setDialog(null)}
      />
      <LoadPricingTemplateDialog
        open={dialog?.kind === "load"}
        state={templates}
        replacesEntered={variant ? hasEnteredQuantityPricing(variant) : false}
        appliesToAll={samePriceForAll && variants.length > 1}
        onUse={(template) => {
          if (dialog) loadTemplate(dialog.variant, template);
          setDialog(null);
        }}
        onClose={() => setDialog(null)}
      />
    </>
  );

  return { bar, dialogs };
}
