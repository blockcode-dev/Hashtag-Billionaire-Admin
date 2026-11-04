/** @format */

import { isInStock, stockLabel } from "@/lib/variants";

interface SageVariant {
  stock?: number | string | null;
}

// sage/product/:id lists imported variants without track_inventory, so a null stock is the
// only sign that SAGE doesn't report one.
const withUnreportedStock = (v: SageVariant) => (v.stock == null ? { ...v, track_inventory: false } : v);

export const sageStockLabel = (v: SageVariant) => stockLabel(withUnreportedStock(v));

export const sageInStock = (v: SageVariant) => isInStock(withUnreportedStock(v));

export interface SageImportOutcome {
  level: "success" | "warning" | "error";
  message: string;
}

// SAGE imports answer 2xx however they went, so their counts are the only result. A SAGE
// setting that's missing fails every product, with no other sign of why.
export const sageImportOutcome = (imported = 0, total = 0): SageImportOutcome => {
  if (imported >= total) {
    return {
      level: "success",
      message: `${imported.toLocaleString()} ${imported === 1 ? "product" : "products"} imported.`,
    };
  }
  if (imported > 0) {
    return {
      level: "warning",
      message: `Imported ${imported.toLocaleString()} of ${total.toLocaleString()}. ${(total - imported).toLocaleString()} failed.`,
    };
  }
  return {
    level: "error",
    message: `None of the ${total.toLocaleString()} products were imported. Check the SAGE account in Settings, under Suppliers, then try again.`,
  };
};
