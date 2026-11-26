/** @format */

// The "Variant Data — Color & Stock" table on the SAGE product page (Sageproductview.tsx).
//
// SAGE describes a product's colours twice: `colors`, one comma-separated text capped at
// 1,000 characters, so long lists come abbreviated ("Hot P" for Hot Pink) and cut mid-word
// ("Wh"); and `skus`, the supplier's stock list, one entry per colour and size with its stock.
// Neither marks a colour as stopped: a stock-list colour missing from the text was shortened
// or cut off, not discontinued. The backend works out which colours the import keeps and sends
// them as `sageColors` on GET sage/product/:prodEId (hashtag-backend
// src/services/Common/sageColors.js), so the table shows that list as it is, then the text
// entries the import leaves out. An older backend sends no `sageColors`: the table then lists
// SAGE's stock list only, and names the text entries spelled differently in one note, so a
// colour is never listed twice ("Hot P" and "Hot Pink" are one colour). Telling which short
// name stands for which colour is left to the backend, so the panel never shows a different answer.
//
// No imports, so the checks can load this file without the app's path aliases.

// ─── What the backend sends (buildSageColorList) ─────────────────────────

// offered: in SAGE's stock list. text_only: only in the colour text, kept on sale with stock
// not tracked. text: the product has no stock list, so its colours come from the text.
// default: SAGE gives no colours at all, so the product has one "Default" variant.
export type SageColorStatus = "offered" | "text_only" | "text" | "default";

// Entries the import leaves out. From the colour text: the cut-off last one, a colour already
// listed under another spelling, and placeholders such as "Various". From the stock list: parts
// and shapes some suppliers keep in its colour field ("Mylar", "Pinned Backs (C)", "Gaming"), and
// colours only a list covering several sizes or models names (they may be another item's).
export type SageDroppedReason = "cut_off" | "duplicate" | "placeholder" | "part" | "other_item";

export interface SageColor {
  // The colour's name in the shop.
  name: string;
  // Its spelling in SAGE's stock list, or null when it isn't there.
  sageName: string | null;
  // The colour text entry it was paired with, or null.
  listedAs: string | null;
  status: SageColorStatus;
  match?: string | null;
  // null when stock isn't tracked: made to order, or no stock record.
  stock: number | null;
  trackInventory: boolean;
}

export interface SageDroppedColor {
  name: string;
  reason: SageDroppedReason;
}

export interface SageColorList {
  source: "skus" | "text" | "none";
  // The colour text reached SAGE's 1,000-character cap, so its end is missing.
  textCut: boolean;
  colors: SageColor[];
  dropped: SageDroppedColor[];
}

// ─── SAGE's own fields, for an older backend ─────────────────────────────

export interface SageSku {
  attributes?: { typeId?: number | string | null; value?: string | null }[] | null;
  onHand?: number | string | null;
  // Made to order: SAGE reports no stock limit.
  unlimited?: boolean | null;
}

export interface SagePic {
  url?: string | null;
  caption?: string | null;
}

// The parts of GET sage/product/:prodEId the table reads.
export interface SageColorSource {
  sageColors?: SageColorList | null;
  colors?: string | null;
  skus?: SageSku[] | null;
  pics?: SagePic[] | null;
}

// ─── Status badges ───────────────────────────────────────────────────────

export type SageColorRowStatus = SageColorStatus | SageDroppedReason;

export interface SageColorBadge {
  label: string;
  // The badge's style: spv-badge--active or spv-badge--neutral.
  tone: "active" | "neutral";
  // Shown as the badge's tooltip.
  hint?: string;
}

// Only colours in SAGE's stock list get the green badge: the others have no stock record.
export const SAGE_COLOR_STATUS: Record<SageColorRowStatus, SageColorBadge> = {
  offered: { label: "In SAGE's stock list", tone: "active" },
  text_only: {
    label: "Only in colour text",
    tone: "neutral",
    hint: "Kept on sale with the product's total stock, as before: SAGE's stock list has no record of this colour",
  },
  text: { label: "From colour text", tone: "neutral" },
  default: { label: "No colours from SAGE", tone: "neutral" },
  cut_off: { label: "Cut off — not imported", tone: "neutral" },
  duplicate: { label: "Duplicate — not imported", tone: "neutral" },
  placeholder: { label: "Not a colour — not imported", tone: "neutral" },
  part: {
    label: "Part or shape — not imported",
    tone: "neutral",
    hint: "In SAGE's stock list, but it names a part or shape (e.g. Mylar, Pinned Backs, Gaming), not a colour",
  },
  other_item: {
    label: "Other size or model — not imported",
    tone: "neutral",
    hint: "SAGE's stock list covers several sizes or models of this product line, so a colour only it names may be another item's",
  },
};

// A status a newer backend adds still gets a badge, under its own name.
export const sageColorBadge = (status: string): SageColorBadge =>
  Object.hasOwn(SAGE_COLOR_STATUS, status)
    ? SAGE_COLOR_STATUS[status as SageColorRowStatus]
    : { label: String(status), tone: "neutral" };

// ─── Table rows ──────────────────────────────────────────────────────────

export interface SageColorRow {
  // React key. A dropped entry can share its name with a colour ("Amethyst, Amethyst").
  key: string;
  name: string;
  // The colour text's spelling when it differs from the name, shown as `In colour text as "Hot P"`.
  listedAs: string | null;
  // The stock list's spelling when it differs from the name by more than letter case, shown as
  // `In stock list as "Blue/Grey Seg"` (the shop keeps "Blue/Gray Seg").
  stockListAs: string | null;
  status: SageColorRowStatus;
  badge: SageColorBadge;
  stock: string;
  image: string | null;
}

export interface SageColorTable {
  rows: SageColorRow[];
  // The colours the import makes variants for: every row but the "not imported" ones.
  count: number;
  // Shown above the table when SAGE's colour text was cut at its cap.
  note: string | null;
}

const COLOR_TYPE_ID = 10;

const CUT_NOTE = "SAGE's colour text is cut at 1,000 characters; colours come from SAGE's stock list.";
// A product without a stock list has only the text, so its cut-off last entry is simply lost.
const CUT_NOTE_NO_STOCK_LIST = "SAGE's colour text is cut at 1,000 characters, so its last, cut-off colour isn't imported.";

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

// A number SAGE (or the backend) actually reported: not missing, not empty, not junk.
const reported = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// The stock cell. A colour whose stock isn't tracked (made to order, or no stock record) can
// be ordered in any quantity; one tracked at 0 can't be ordered.
export const sageColorStock = (stock: number | null | undefined, trackInventory?: boolean | null) => {
  const n = reported(stock);
  if (trackInventory === false || n === null) return "Not tracked";
  return n > 0 ? n.toLocaleString() : "Out of stock";
};

type PictureFinder = (...names: (string | null | undefined)[]) => string | null;

// SAGE captions a colour's picture with the colour's name, in the stock list's spelling or the
// text's. Compared like the backend does when it gives variants their pictures: trimmed, any case.
const captionKey = (value: unknown) => String(value ?? "").trim().toLowerCase();

const pictureFinder = (pics: SagePic[] | null | undefined): PictureFinder => {
  const byCaption = new Map<string, string>();
  for (const pic of Array.isArray(pics) ? pics : []) {
    const caption = captionKey(pic?.caption);
    if (caption && pic.url && !byCaption.has(caption)) byCaption.set(caption, pic.url);
  }
  return (...names) => {
    for (const name of names) {
      const url = byCaption.get(captionKey(name));
      if (url) return url;
    }
    return null;
  };
};

// The backend's list: its colours in its order, then the text entries it leaves out.
const fromBackend = (list: SageColorList, pictureOf: PictureFinder): SageColorTable => {
  const rows: SageColorRow[] = list.colors.map((color, i) => {
    const name = clean(color.name);
    const listedAs = clean(color.listedAs);
    const sageName = clean(color.sageName);
    return {
      key: `color-${i}`,
      name,
      listedAs: listedAs && listedAs !== name ? listedAs : null,
      stockListAs: sageName && sageName.toLowerCase() !== name.toLowerCase() ? sageName : null,
      status: color.status,
      badge: sageColorBadge(color.status),
      stock: sageColorStock(color.stock, color.trackInventory),
      image: pictureOf(color.name, color.sageName, color.listedAs),
    };
  });
  (Array.isArray(list.dropped) ? list.dropped : []).forEach((entry, i) => {
    rows.push({
      key: `dropped-${i}`,
      name: clean(entry.name),
      listedAs: null,
      stockListAs: null,
      status: entry.reason,
      badge: sageColorBadge(entry.reason),
      stock: "—",
      image: pictureOf(entry.name),
    });
  });
  const note = list.textCut ? (list.source === "skus" ? CUT_NOTE : CUT_NOTE_NO_STOCK_LIST) : null;
  return { rows, count: list.colors.length, note };
};

// How many differently spelled text names the fallback note quotes before "and N more".
const NOTE_EXAMPLES = 6;

const quoteList = (names: string[]) => {
  const shown = names.slice(0, NOTE_EXAMPLES).map((n) => `"${n}"`).join(", ");
  return names.length > NOTE_EXAMPLES ? `${shown} and ${names.length - NOTE_EXAMPLES} more` : shown;
};

// An older backend: SAGE's stock list, one row per colour (a colour has one sku per size,
// sometimes spelled in another case). Text names the stock list doesn't spell the same way
// ("Hot P" for Hot Pink, "Blue/Gray Seg" for Blue/Grey Seg, the cut-off "Wh") aren't rows of
// their own, which would list one colour twice: a note names them. Without a stock list the
// text is all there is, so its names are the rows.
const fromSageLists = (product: SageColorSource, pictureOf: PictureFinder): SageColorTable => {
  const offered: { name: string; onHand: number; reported: boolean; unlimited: boolean }[] = [];
  const byName = new Map<string, (typeof offered)[number]>();
  for (const sku of Array.isArray(product.skus) ? product.skus : []) {
    const attributes = Array.isArray(sku?.attributes) ? sku.attributes : [];
    const name = clean(attributes.find((a) => Number(a?.typeId) === COLOR_TYPE_ID)?.value);
    if (!name) continue;
    let entry = byName.get(name.toLowerCase());
    if (!entry) {
      entry = { name, onHand: 0, reported: false, unlimited: false };
      byName.set(name.toLowerCase(), entry);
      offered.push(entry);
    }
    if (sku.unlimited) entry.unlimited = true;
    const onHand = reported(sku.onHand);
    if (onHand !== null) {
      entry.onHand += onHand;
      entry.reported = true;
    }
  }

  const rows: SageColorRow[] = offered.map((entry, i) => ({
    key: `color-${i}`,
    name: entry.name,
    listedAs: null,
    stockListAs: null,
    status: "offered",
    badge: SAGE_COLOR_STATUS.offered,
    stock: sageColorStock(entry.reported ? entry.onHand : null, entry.reported && !entry.unlimited),
    image: pictureOf(entry.name),
  }));

  // The text's names in order, once each (ignoring case), minus those the stock list has.
  const text = String(product.colors ?? "");
  const textNames: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(",")) {
    const name = clean(part);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    textNames.push(name);
  }
  const textCut = text.length >= 1000;

  if (!offered.length) {
    const textRows: SageColorRow[] = textNames.map((name, i) => ({
      key: `text-${i}`,
      name,
      listedAs: null,
      stockListAs: null,
      status: "text",
      badge: SAGE_COLOR_STATUS.text,
      stock: "—",
      image: pictureOf(name),
    }));
    return { rows: textRows, count: textRows.length, note: textCut ? CUT_NOTE_NO_STOCK_LIST : null };
  }

  const spelledDifferently = textNames.filter((name) => !byName.has(name.toLowerCase()));
  const notes = [
    // An older backend imports from the colour text, so this only says the text is incomplete.
    textCut ? "SAGE's colour text is cut at 1,000 characters." : null,
    spelledDifferently.length
      ? `SAGE's colour text also has ${spelledDifferently.length} ${spelledDifferently.length === 1 ? "name" : "names"} its stock list doesn't spell the same way: ${quoteList(spelledDifferently)}. Some are shortened or cut-off spellings of the colours above; others have no stock record.`
      : null,
  ].filter(Boolean);
  return { rows, count: rows.length, note: notes.length ? notes.join(" ") : null };
};

export const buildSageColorTable = (product: SageColorSource | null | undefined): SageColorTable => {
  const pictureOf = pictureFinder(product?.pics);
  const list = product?.sageColors;
  return list && Array.isArray(list.colors)
    ? fromBackend(list, pictureOf)
    : fromSageLists(product ?? {}, pictureOf);
};
