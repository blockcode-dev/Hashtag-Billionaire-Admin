// Print methods and locations come from the API as codes. They are saved in capitals since 24 Nov
// 2026; an order line saved earlier may not be. So the label doesn't depend on the case:
// EMBROIDERY or embroidery → Embroidery, SCREEN_PRINT → Screen Print, LEFT_CHEST → Left Chest.
// Short codes are acronyms and stay in capitals: DTF, DTG.
export const printCodeLabel = (code?: string | null): string => {
  const text = String(code ?? "").trim();
  if (!text) return "--";
  if (!/[\s_-]/.test(text) && text.length <= 3) return text.toUpperCase();
  return text
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

interface DecorationRow {
  type?: string;
  print_method?: string;
  locations?: unknown;
}

// Whether a row without its own `location` stands for the line's locations: a DTF, screen print or
// DTG row (priced per location), or a drinkware row (`locations` holds the codes). The "SAGE" row
// on SAGE lines priced before 25 Nov 2026 is the product's price for the whole line, not a print.
export const rowCoversLineLocations = (row: DecorationRow): boolean => {
  const type = String(row.type ?? row.print_method ?? "").trim().toUpperCase();
  return ["DTF", "SCREEN_PRINT", "DTG"].includes(type) || Array.isArray(row.locations);
};

// How many print locations a decoration row's price_per_item is charged for. A DTF, screen print or
// DTG row covers every location on its line: the API sends that count as `locations` (DTF always,
// screen print and DTG since 26 Nov 2026), and for an older row it's the line's own locations. An
// embroidery row is one location, and a drinkware row's price is already for the whole piece.
export const rowLocationCount = (row: DecorationRow, lineLocationCount: number): number => {
  const type = String(row.type ?? row.print_method ?? "").trim().toUpperCase();
  if (!["DTF", "SCREEN_PRINT", "DTG"].includes(type)) return 1;
  if (typeof row.locations === "number" && row.locations > 0) return row.locations;
  return lineLocationCount > 0 ? lineLocationCount : 1;
};
