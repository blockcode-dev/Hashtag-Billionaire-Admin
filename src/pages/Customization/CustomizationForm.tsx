/** @format */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { message, Switch, Tooltip } from "antd";
import axios from "axios";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleDollarSign,
  Layers,
  Package,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import {
  GetCustomizationOptionByIdAPI,
  UpdateCustomizationOptionAPI,
  CreateCustomizationOptionValueAPI,
  UpdateCustomizationOptionValueAPI,
  DeleteCustomizationOptionValueAPI,
  CreateCustomizationPricingAPI,
  DeleteCustomizationPricingAPI,
} from "@/services/Api/CustomizationApi";

import "./Customization.scss";

// ============================================================
// TYPES
// ============================================================

type PricingType = "FIXED" | "TIERED" | "QUANTITY_BASED";

interface RawPricing {
  id: number | string;
  // TIERED rows use min/max; QUANTITY_BASED rows use quantity.
  min_quantity: number | string | null;
  max_quantity: number | string | null;
  quantity?: number | string | null;
  price: number | string;
}

interface RawValue {
  id: number | string;
  name: string;
  pricing_type?: PricingType | null;
  fixed_price?: number | string | null;
  pricing?: RawPricing[];
}

interface CustomizationData {
  id: number;
  name: string;
  description: string | null;
  allow_text_input: boolean;
  allow_image_upload: boolean;
  values?: RawValue[];
}

interface BasicInfo {
  name: string;
  description: string;
  allowTextInput: boolean;
  allowImageUpload: boolean;
}

/** One row of the quantity table. "From" is worked out from the row above. */
interface TierDraft {
  key: string;
  max: string;
  price: string;
}

/** One exact quantity (QUANTITY_BASED), e.g. 25 items at $1.20 each. */
interface QuantityDraft {
  key: string;
  quantity: string;
  price: string;
}

interface ValueDraft {
  key: string;
  id?: number;
  name: string;
  pricingType: PricingType;
  fixedPrice: string;
  tiers: TierDraft[];
  quantities: QuantityDraft[];
  /** Pricing row ids currently stored for this value (replaced on save). */
  savedPricingIds: number[];
}

/** Body sent to the value create/update endpoints. */
interface ValueBody {
  name: string;
  pricing_type: PricingType;
  fixed_price?: number | null;
}

interface TierBody {
  min_quantity: number;
  max_quantity: number | null;
  price: number;
}

interface QuantityBody {
  quantity: number;
  price: number;
}

interface ValidationResult {
  titleError: string;
  valueErrors: Record<string, string>;
}

// ============================================================
// HELPERS
// ============================================================

const GUIDE_STORAGE_KEY = "hb_customization_form_guide_open";

let keySeq = 0;
const newKey = (): string => `k${++keySeq}`;

const EMPTY_BASIC: BasicInfo = {
  name: "",
  description: "",
  allowTextInput: false,
  allowImageUpload: false,
};

const PRICING_TYPES: PricingType[] = ["FIXED", "TIERED", "QUANTITY_BASED"];

const getErrorMessage = (err: unknown, fallback: string): string =>
  (axios.isAxiosError(err) && err.response?.data?.message) || fallback;

const formatMoney = (n: number): string => `$${n.toFixed(2)}`;

const toPriceString = (raw: unknown): string => {
  if (raw === null || raw === undefined || raw === "") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(2) : "";
};

const sanitizePrice = (raw: string): string => {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
};

const sanitizeInteger = (raw: string): string => raw.replace(/\D/g, "");

const isValidPrice = (raw: string): boolean => {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n >= 0;
};

const emptyTier = (): TierDraft => ({ key: newKey(), max: "", price: "" });

const emptyQuantity = (): QuantityDraft => ({ key: newKey(), quantity: "", price: "" });

const newValueDraft = (): ValueDraft => ({
  key: newKey(),
  name: "",
  pricingType: "FIXED",
  fixedPrice: "",
  tiers: [emptyTier(), emptyTier()],
  quantities: [emptyQuantity(), emptyQuantity()],
  savedPricingIds: [],
});

const toDrafts = (raw: RawValue[] = []): ValueDraft[] =>
  raw.map((value) => {
    const rows = value.pricing || [];

    const pricingType: PricingType =
      value.pricing_type && PRICING_TYPES.includes(value.pricing_type)
        ? value.pricing_type
        : rows.length
        ? "TIERED"
        : "FIXED";

    const tierRows =
      pricingType === "TIERED"
        ? [...rows].sort(
            (a, b) =>
              Number(a.min_quantity) - Number(b.min_quantity) ||
              Number(a.id) - Number(b.id)
          )
        : [];

    const quantityRows =
      pricingType === "QUANTITY_BASED"
        ? [...rows].sort(
            (a, b) =>
              Number(a.quantity) - Number(b.quantity) || Number(a.id) - Number(b.id)
          )
        : [];

    return {
      key: newKey(),
      id: Number(value.id),
      name: value.name || "",
      pricingType,
      fixedPrice: toPriceString(value.fixed_price),
      tiers: tierRows.length
        ? tierRows.map((tier) => ({
            key: newKey(),
            max:
              tier.max_quantity === null || tier.max_quantity === ""
                ? ""
                : String(tier.max_quantity),
            price: toPriceString(tier.price),
          }))
        : [emptyTier(), emptyTier()],
      quantities: quantityRows.length
        ? quantityRows.map((row) => ({
            key: newKey(),
            quantity:
              row.quantity === null || row.quantity === undefined || row.quantity === ""
                ? ""
                : String(row.quantity),
            price: toPriceString(row.price),
          }))
        : [emptyQuantity(), emptyQuantity()],
      savedPricingIds: rows.map((row) => Number(row.id)),
    };
  });

/** Row 1 starts at 1; every other row starts right after the row above ends. */
const computeStarts = (tiers: TierDraft[]): (number | null)[] => {
  const starts: (number | null)[] = [];

  tiers.forEach((_, index) => {
    if (index === 0) {
      starts.push(1);
      return;
    }

    const prev = tiers[index - 1];
    const prevStart = starts[index - 1];
    const prevMax = Number(prev.max);

    starts.push(
      prev.max.trim() !== "" &&
        Number.isInteger(prevMax) &&
        prevStart !== null &&
        prevMax >= prevStart
        ? prevMax + 1
        : null
    );
  });

  return starts;
};

const tierSignature = (tiers: TierDraft[]): string =>
  JSON.stringify(
    tiers.map((tier) => [tier.max.trim(), tier.price === "" ? "" : Number(tier.price)])
  );

const quantitySignature = (rows: QuantityDraft[]): string =>
  JSON.stringify(
    rows.map((row) => [row.quantity.trim(), row.price === "" ? "" : Number(row.price)])
  );

const valueSignature = (value: ValueDraft): string =>
  JSON.stringify({
    id: value.id ?? null,
    n: value.name.trim(),
    t: value.pricingType,
    f: value.pricingType === "FIXED" && value.fixedPrice !== "" ? Number(value.fixedPrice) : null,
    r: value.pricingType === "TIERED" ? tierSignature(value.tiers) : null,
    q: value.pricingType === "QUANTITY_BASED" ? quantitySignature(value.quantities) : null,
  });

const basicSignature = (basic: BasicInfo): string =>
  JSON.stringify([
    basic.name.trim(),
    basic.description.trim(),
    basic.allowTextInput,
    basic.allowImageUpload,
  ]);

const pageSignature = (basic: BasicInfo, values: ValueDraft[]): string =>
  JSON.stringify([basicSignature(basic), values.map(valueSignature)]);

const validate = (basic: BasicInfo, values: ValueDraft[]): ValidationResult => {
  const valueErrors: Record<string, string> = {};
  const seen = new Set<string>();

  values.forEach((value) => {
    const fail = (msg: string) => {
      if (!valueErrors[value.key]) valueErrors[value.key] = msg;
    };

    const name = value.name.trim();

    if (!name) fail("Give this value a name.");
    else if (seen.has(name.toLowerCase())) fail(`“${name}” is already in the list.`);
    seen.add(name.toLowerCase());

    if (value.pricingType === "FIXED") {
      if (!isValidPrice(value.fixedPrice)) {
        fail("Enter the price per item. Use 0 if it's free.");
      }
      return;
    }

    if (value.pricingType === "QUANTITY_BASED") {
      if (!value.quantities.length) {
        fail("Add at least one quantity.");
        return;
      }

      const seenQuantities = new Set<number>();

      value.quantities.forEach((row, index) => {
        const quantity = Number(row.quantity);

        if (row.quantity.trim() === "" || !Number.isInteger(quantity) || quantity < 1) {
          fail(`Row ${index + 1}: enter a quantity of 1 or more.`);
        } else if (seenQuantities.has(quantity)) {
          fail(`Row ${index + 1}: quantity ${quantity} is already listed.`);
        } else {
          seenQuantities.add(quantity);
        }

        if (!isValidPrice(row.price)) {
          fail(`Row ${index + 1}: enter a price per item. Use 0 if it's free.`);
        }
      });

      return;
    }

    if (!value.tiers.length) {
      fail("Add at least one quantity row.");
      return;
    }

    const starts = computeStarts(value.tiers);

    value.tiers.forEach((tier, index) => {
      const isLast = index === value.tiers.length - 1;
      const start = starts[index];

      if (!isLast || tier.max.trim() !== "") {
        const max = Number(tier.max);

        if (tier.max.trim() === "") {
          fail(`Row ${index + 1}: enter the quantity where this row ends.`);
        } else if (!Number.isInteger(max) || start === null || max < start) {
          fail(
            `Row ${index + 1}: the end quantity must be ${
              start !== null ? `${start} or more` : "a whole number"
            }.`
          );
        }
      }

      if (!isValidPrice(tier.price)) {
        fail(`Row ${index + 1}: enter a price per item. Use 0 if it's free.`);
      }
    });
  });

  return {
    titleError: basic.name.trim() ? "" : "Give this customization a title.",
    valueErrors,
  };
};

const buildValueBody = (value: ValueDraft): ValueBody =>
  value.pricingType === "FIXED"
    ? {
        name: value.name.trim(),
        pricing_type: "FIXED",
        fixed_price: Number(Number(value.fixedPrice).toFixed(2)),
      }
    : { name: value.name.trim(), pricing_type: value.pricingType, fixed_price: null };

const buildTierBodies = (tiers: TierDraft[]): TierBody[] => {
  const starts = computeStarts(tiers);

  return tiers.map((tier, index) => ({
    min_quantity: starts[index] ?? 1,
    max_quantity: tier.max.trim() === "" ? null : Number(tier.max),
    price: Number(Number(tier.price).toFixed(2)),
  }));
};

const buildQuantityBodies = (rows: QuantityDraft[]): QuantityBody[] =>
  rows
    .map((row) => ({
      quantity: Number(row.quantity),
      price: Number(Number(row.price).toFixed(2)),
    }))
    .sort((a, b) => a.quantity - b.quantity);

/** Pricing rows to send for a value (none for FIXED). */
const buildPricingBodies = (value: ValueDraft): (TierBody | QuantityBody)[] =>
  value.pricingType === "TIERED"
    ? buildTierBodies(value.tiers)
    : value.pricingType === "QUANTITY_BASED"
    ? buildQuantityBodies(value.quantities)
    : [];

/** The first price the admin typed for a value, in whatever mode it's in. */
const firstPrice = (value: ValueDraft): string =>
  value.pricingType === "FIXED"
    ? value.fixedPrice
    : value.pricingType === "TIERED"
    ? value.tiers[0]?.price || ""
    : value.quantities[0]?.price || "";

const readGuidePref = (): boolean => {
  try {
    return localStorage.getItem(GUIDE_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
};

const writeGuidePref = (open: boolean) => {
  try {
    localStorage.setItem(GUIDE_STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Storage blocked: the guide just won't remember its state.
  }
};

// ============================================================
// SETUP GUIDE
// ============================================================

const GUIDE_STEPS = [
  {
    title: "Name it",
    text: "The title is what customers see on the product, like Material or Engraving.",
  },
  {
    title: "Add values",
    text: "Each value is one choice customers can pick, like Cotton or Synthetic.",
  },
  {
    title: "Price each value",
    text: "One price for any quantity, Price by quantity for ranges (1–50, 51+), or Set quantities for exact amounts like 25, 50, 100.",
  },
  {
    title: "Save",
    text: "Nothing is saved until you press Save changes at the bottom.",
  },
];

const SetupGuide = memo(({ open, onToggle }: { open: boolean; onToggle: () => void }) => (
  <section className={`customization__setup ${open ? "customization__setup--open" : ""}`}>
    <button
      type="button"
      className="customization__setup-toggle"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="customization-setup-steps"
    >
      <strong>How to set this up</strong>
      <span>{open ? "Hide" : "Show"}</span>
      <ChevronDown size={16} className="customization__setup-chevron" />
    </button>

    {open && (
      <>
        <ol id="customization-setup-steps" className="customization__setup-steps">
          {GUIDE_STEPS.map((step, index) => (
            <li key={step.title} className="customization__setup-step">
              <span className="customization__setup-num">{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="customization__setup-note">
          The value's price is added to every item in the order. For example,
          Synthetic at $2.00 on 50 shirts adds $100.00.
        </p>
      </>
    )}
  </section>
));

SetupGuide.displayName = "SetupGuide";

// ============================================================
// MONEY INPUT
// ============================================================

interface MoneyInputProps {
  id?: string;
  value: string;
  label: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}

const MoneyInput = memo(({ id, value, label, invalid, onChange }: MoneyInputProps) => (
  <div
    className={`customization__money-input ${
      invalid ? "customization__money-input--error" : ""
    }`}
  >
    <span aria-hidden="true">$</span>
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(sanitizePrice(e.target.value))}
      onBlur={() => {
        const n = Number(value);
        if (value !== "" && Number.isFinite(n)) onChange(n.toFixed(2));
      }}
      placeholder="0.00"
      aria-label={label}
    />
  </div>
));

MoneyInput.displayName = "MoneyInput";

// ============================================================
// PRICING TYPE PICKER
// ============================================================

interface PricingTypePickerProps {
  valueKey: string;
  selected: PricingType;
  onSelect: (valueKey: string, type: PricingType) => void;
}

const PRICING_CHOICES: {
  type: PricingType;
  title: string;
  text: string;
  icon: ReactElement;
}[] = [
  {
    type: "FIXED",
    title: "One price",
    text: "Same price per item for any quantity",
    icon: <CircleDollarSign size={18} />,
  },
  {
    type: "TIERED",
    title: "Price by quantity",
    text: "Bigger orders pay less per item",
    icon: <Layers size={18} />,
  },
  {
    type: "QUANTITY_BASED",
    title: "Set quantities",
    text: "A price for exact amounts, like 25, 50, 100",
    icon: <Package size={18} />,
  },
];

const PricingTypePicker = memo(({ valueKey, selected, onSelect }: PricingTypePickerProps) => (
  <div className="customization__ptype" role="radiogroup" aria-label="How is this value priced?">
    {PRICING_CHOICES.map((choice) => {
      const active = selected === choice.type;

      return (
        <button
          key={choice.type}
          type="button"
          role="radio"
          aria-checked={active}
          className={`customization__ptype-option ${
            active ? "customization__ptype-option--active" : ""
          }`}
          onClick={() => onSelect(valueKey, choice.type)}
        >
          <span className="customization__ptype-icon">{choice.icon}</span>
          <span className="customization__ptype-text">
            <strong>{choice.title}</strong>
            <span>{choice.text}</span>
          </span>
          <span className="customization__ptype-radio" aria-hidden="true" />
        </button>
      );
    })}
  </div>
));

PricingTypePicker.displayName = "PricingTypePicker";

// ============================================================
// QUANTITY PRICING TABLE (TIERED)
// ============================================================

interface TierTableProps {
  value: ValueDraft;
  onTier: (valueKey: string, tierKey: string, field: "max" | "price", input: string) => void;
  onAddTier: (valueKey: string) => void;
  onRemoveTier: (valueKey: string, tierKey: string) => void;
}

const TierTable = memo(({ value, onTier, onAddTier, onRemoveTier }: TierTableProps) => {
  const starts = useMemo(() => computeStarts(value.tiers), [value.tiers]);

  const prices = value.tiers.map((tier) => (isValidPrice(tier.price) ? Number(tier.price) : null));
  const basePrice = prices[0];
  const highest = Math.max(0, ...prices.filter((p): p is number => p !== null));

  const lastTier = value.tiers[value.tiers.length - 1];
  const lastMax = lastTier && lastTier.max.trim() !== "" ? Number(lastTier.max) : null;
  const label = value.name.trim() || "this value";

  return (
    <div className="customization__tier-block">
      <div className="customization__tiers-scroll">
        <table className="customization__tiers">
          <caption className="customization__sr-only">
            Price per item for {label} by order quantity
          </caption>

          <thead>
            <tr>
              <th scope="col">Order quantity</th>
              <th scope="col">Price per item</th>
              <th scope="col">Compared to row 1</th>
              <th scope="col">
                <span className="customization__sr-only">Remove row</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {value.tiers.map((tier, index) => {
              const start = starts[index];
              const isLast = index === value.tiers.length - 1;
              const price = prices[index];

              const saving =
                index > 0 && price !== null && basePrice !== null && basePrice > 0
                  ? Math.round((1 - price / basePrice) * 100)
                  : null;

              return (
                <tr key={tier.key}>
                  <td>
                    <div className="customization__qty-range">
                      <span className="customization__qty-start">{start ?? "…"}</span>
                      <span className="customization__qty-text">to</span>
                      <input
                        className="customization__tier-input"
                        type="text"
                        inputMode="numeric"
                        value={tier.max}
                        onChange={(e) =>
                          onTier(value.key, tier.key, "max", sanitizeInteger(e.target.value))
                        }
                        placeholder={
                          isLast ? "No limit" : start !== null ? String(start + 49) : "e.g. 50"
                        }
                        aria-label={`Row ${index + 1} ends at quantity${
                          isLast ? " (leave empty for no limit)" : ""
                        }`}
                      />
                    </div>
                  </td>

                  <td>
                    <MoneyInput
                      value={tier.price}
                      onChange={(v) => onTier(value.key, tier.key, "price", v)}
                      label={`Row ${index + 1} price per item`}
                    />
                  </td>

                  <td>
                    <div className="customization__compare">
                      <div className="customization__price-bar" aria-hidden="true">
                        <span
                          style={{
                            width:
                              price !== null && highest > 0
                                ? `${Math.max(6, (price / highest) * 100)}%`
                                : "0%",
                          }}
                        />
                      </div>

                      {index === 0 ? (
                        <span className="customization__compare-tag">Starting price</span>
                      ) : saving === null ? (
                        <span className="customization__compare-tag">–</span>
                      ) : saving > 0 ? (
                        <span className="customization__compare-tag customization__compare-tag--save">
                          {saving}% less
                        </span>
                      ) : saving < 0 ? (
                        <span className="customization__compare-tag customization__compare-tag--more">
                          {Math.abs(saving)}% more
                        </span>
                      ) : (
                        <span className="customization__compare-tag">Same</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <Tooltip title={value.tiers.length > 1 ? "Remove row" : "Keep at least one row"}>
                      <button
                        type="button"
                        className="customization__icon-btn"
                        onClick={() => onRemoveTier(value.key, tier.key)}
                        disabled={value.tiers.length <= 1}
                        aria-label={`Remove row ${index + 1}`}
                      >
                        <X size={14} />
                      </button>
                    </Tooltip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="customization__value-foot">
        <button type="button" className="customization__tier-add" onClick={() => onAddTier(value.key)}>
          <Plus size={14} />
          Add quantity row
        </button>

        <span className="customization__hint">
          Each row starts right after the one above. Leave the last row's end empty
          to cover every bigger order.
        </span>
      </div>

      {lastMax !== null && Number.isInteger(lastMax) && (
        <p className="customization__coverage-note">
          <AlertTriangle size={14} />
          Orders over {lastMax} won't have a price for {label}. Clear the last row's
          end quantity to cover them.
        </p>
      )}
    </div>
  );
});

TierTable.displayName = "TierTable";

// ============================================================
// SET QUANTITIES TABLE (QUANTITY_BASED)
// ============================================================

interface QuantityTableProps {
  value: ValueDraft;
  onQuantity: (
    valueKey: string,
    rowKey: string,
    field: "quantity" | "price",
    input: string
  ) => void;
  onAddQuantity: (valueKey: string) => void;
  onRemoveQuantity: (valueKey: string, rowKey: string) => void;
}

const QuantityTable = memo(
  ({ value, onQuantity, onAddQuantity, onRemoveQuantity }: QuantityTableProps) => {
    const label = value.name.trim() || "this value";

    const counts = value.quantities.reduce<Record<string, number>>((acc, row) => {
      const q = row.quantity.trim();
      if (q) acc[q] = (acc[q] || 0) + 1;
      return acc;
    }, {});

    return (
      <div className="customization__tier-block">
        <div className="customization__tiers-scroll">
          <table className="customization__tiers">
            <caption className="customization__sr-only">
              Price per item for {label} at set order quantities
            </caption>

            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Price per item</th>
                <th scope="col">Adds to the order</th>
                <th scope="col">
                  <span className="customization__sr-only">Remove row</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {value.quantities.map((row, index) => {
                const quantity = Number(row.quantity);
                const hasQuantity = row.quantity.trim() !== "" && quantity > 0;
                const duplicate = hasQuantity && counts[row.quantity.trim()] > 1;

                return (
                  <tr key={row.key}>
                    <td>
                      <input
                        className={`customization__tier-input ${
                          duplicate ? "customization__input--error" : ""
                        }`}
                        type="text"
                        inputMode="numeric"
                        value={row.quantity}
                        onChange={(e) =>
                          onQuantity(
                            value.key,
                            row.key,
                            "quantity",
                            sanitizeInteger(e.target.value)
                          )
                        }
                        placeholder={index === 0 ? "e.g. 25" : "e.g. 50"}
                        aria-label={`Row ${index + 1} quantity`}
                        aria-invalid={duplicate}
                      />
                    </td>

                    <td>
                      <MoneyInput
                        value={row.price}
                        onChange={(v) => onQuantity(value.key, row.key, "price", v)}
                        label={`Row ${index + 1} price per item`}
                      />
                    </td>

                    <td>
                      <span className="customization__no-limit">
                        {duplicate
                          ? "Listed twice"
                          : hasQuantity && isValidPrice(row.price)
                          ? formatMoney(quantity * Number(row.price))
                          : "–"}
                      </span>
                    </td>

                    <td>
                      <Tooltip
                        title={value.quantities.length > 1 ? "Remove row" : "Keep at least one row"}
                      >
                        <button
                          type="button"
                          className="customization__icon-btn"
                          onClick={() => onRemoveQuantity(value.key, row.key)}
                          disabled={value.quantities.length <= 1}
                          aria-label={`Remove row ${index + 1}`}
                        >
                          <X size={14} />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="customization__value-foot">
          <button
            type="button"
            className="customization__tier-add"
            onClick={() => onAddQuantity(value.key)}
          >
            <Plus size={14} />
            Add quantity
          </button>

          <span className="customization__hint">
            Only these exact quantities get a price for {label}. Each quantity can be
            listed once.
          </span>
        </div>
      </div>
    );
  }
);

QuantityTable.displayName = "QuantityTable";

// ============================================================
// VALUE CARD
// ============================================================

interface ValueCardProps {
  value: ValueDraft;
  error?: string;
  onName: (valueKey: string, name: string) => void;
  onRemove: (valueKey: string) => void;
  onPricingType: (valueKey: string, type: PricingType) => void;
  onFixedPrice: (valueKey: string, price: string) => void;
  onTier: (valueKey: string, tierKey: string, field: "max" | "price", input: string) => void;
  onAddTier: (valueKey: string) => void;
  onRemoveTier: (valueKey: string, tierKey: string) => void;
  onQuantity: (
    valueKey: string,
    rowKey: string,
    field: "quantity" | "price",
    input: string
  ) => void;
  onAddQuantity: (valueKey: string) => void;
  onRemoveQuantity: (valueKey: string, rowKey: string) => void;
}

const ValueCard = memo(
  ({
    value,
    error,
    onName,
    onRemove,
    onPricingType,
    onFixedPrice,
    onTier,
    onAddTier,
    onRemoveTier,
    onQuantity,
    onAddQuantity,
    onRemoveQuantity,
  }: ValueCardProps) => {
    const label = value.name.trim() || "this value";

    return (
      <article
        className={`customization__value-card ${error ? "customization__value-card--error" : ""}`}
        data-value-key={value.key}
      >
        <div className="customization__value-top">
          <span className="customization__value-icon" aria-hidden="true">
            <Tag size={15} />
          </span>

          <input
            className="customization__value-name-input"
            type="text"
            maxLength={120}
            value={value.name}
            onChange={(e) => onName(value.key, e.target.value)}
            placeholder="Value name, e.g. Cotton"
            aria-label="Value name"
            autoFocus={!value.id && value.name === ""}
          />

          {!value.id && <span className="customization__new-tag">New</span>}

          <Tooltip title="Remove value">
            <button
              type="button"
              className="customization__icon-btn customization__icon-btn--danger"
              onClick={() => onRemove(value.key)}
              aria-label={`Remove ${label}`}
            >
              <Trash2 size={15} />
            </button>
          </Tooltip>
        </div>

        <div className="customization__value-pricing">
          <span className="customization__value-label">How is it priced?</span>

          <PricingTypePicker
            valueKey={value.key}
            selected={value.pricingType}
            onSelect={onPricingType}
          />

          {value.pricingType === "FIXED" ? (
            <div className="customization__flat-price">
              <label htmlFor={`price-${value.key}`}>Price per item</label>

              <div className="customization__flat-price-row">
                <MoneyInput
                  id={`price-${value.key}`}
                  value={value.fixedPrice}
                  onChange={(v) => onFixedPrice(value.key, v)}
                  label={`Price per item for ${label}`}
                />

                <span className="customization__hint">
                  {isValidPrice(value.fixedPrice)
                    ? `10 items add ${formatMoney(Number(value.fixedPrice) * 10)} to the order.`
                    : "Charged on every item, whatever the quantity."}
                </span>
              </div>
            </div>
          ) : value.pricingType === "TIERED" ? (
            <TierTable
              value={value}
              onTier={onTier}
              onAddTier={onAddTier}
              onRemoveTier={onRemoveTier}
            />
          ) : (
            <QuantityTable
              value={value}
              onQuantity={onQuantity}
              onAddQuantity={onAddQuantity}
              onRemoveQuantity={onRemoveQuantity}
            />
          )}
        </div>

        {error && (
          <span className="customization__error" role="alert">
            {error}
          </span>
        )}
      </article>
    );
  }
);

ValueCard.displayName = "ValueCard";

// ============================================================
// PAGE
// ============================================================

const CustomizationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const optionId = Number(id);

  const [loaded, setLoaded] = useState<CustomizationData | null>(null);
  const [savedBasic, setSavedBasic] = useState<BasicInfo>(EMPTY_BASIC);
  const [savedValues, setSavedValues] = useState<ValueDraft[]>([]);

  const [basic, setBasic] = useState<BasicInfo>(EMPTY_BASIC);
  const [values, setValues] = useState<ValueDraft[]>([]);

  const [titleError, setTitleError] = useState("");
  const [valueErrors, setValueErrors] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guideOpen, setGuideOpen] = useState<boolean>(readGuidePref);

  const savedSignature = useMemo(
    () => pageSignature(savedBasic, savedValues),
    [savedBasic, savedValues]
  );

  const isDirty = !loading && pageSignature(basic, values) !== savedSignature;

  // ------------------------------------------------------------
  // LOAD
  // ------------------------------------------------------------

  const applyData = useCallback((data: CustomizationData) => {
    const nextBasic: BasicInfo = {
      name: data.name || "",
      description: data.description || "",
      allowTextInput: !!data.allow_text_input,
      allowImageUpload: !!data.allow_image_upload,
    };

    const drafts = toDrafts(data.values);

    setLoaded(data);
    setSavedBasic(nextBasic);
    setSavedValues(drafts);
    setBasic(nextBasic);
    setValues(drafts);
    setTitleError("");
    setValueErrors({});
  }, []);

  const fetchOption = useCallback(async (): Promise<CustomizationData> => {
    const res = await GetCustomizationOptionByIdAPI(optionId);
    const data = res.data?.data as CustomizationData | undefined;

    if (!data) throw new Error("Customization not found");

    return data;
  }, [optionId]);

  useEffect(() => {
    if (!id || !Number.isInteger(optionId) || optionId <= 0) {
      navigate("/customizations");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const data = await fetchOption();
        if (!cancelled) applyData(data);
      } catch (err) {
        if (cancelled) return;
        message.error(getErrorMessage(err, "Couldn't load this customization."));
        navigate("/customizations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, optionId, fetchOption, applyData, navigate]);

  useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ------------------------------------------------------------
  // EDIT HANDLERS (local until Save)
  // ------------------------------------------------------------

  const clearValueError = useCallback((valueKey: string) => {
    setValueErrors((prev) => {
      if (!prev[valueKey]) return prev;
      const next = { ...prev };
      delete next[valueKey];
      return next;
    });
  }, []);

  const updateValue = useCallback(
    (valueKey: string, updater: (value: ValueDraft) => ValueDraft) => {
      setValues((prev) => prev.map((v) => (v.key === valueKey ? updater(v) : v)));
      clearValueError(valueKey);
    },
    [clearValueError]
  );

  const addValue = () => setValues((prev) => [...prev, newValueDraft()]);

  const setValueName = useCallback(
    (valueKey: string, name: string) => updateValue(valueKey, (v) => ({ ...v, name })),
    [updateValue]
  );

  const removeValue = useCallback(
    (valueKey: string) => {
      setValues((prev) => prev.filter((v) => v.key !== valueKey));
      clearValueError(valueKey);
    },
    [clearValueError]
  );

  const setPricingType = useCallback(
    (valueKey: string, type: PricingType) =>
      updateValue(valueKey, (v) => {
        if (v.pricingType === type) return v;

        // Carry the price already typed into the new mode's first row,
        // but only when that mode is still empty.
        const carry = firstPrice(v);

        if (type === "FIXED") {
          return {
            ...v,
            pricingType: type,
            fixedPrice: v.fixedPrice === "" && carry ? carry : v.fixedPrice,
          };
        }

        if (type === "TIERED") {
          const tiersEmpty = v.tiers.every((t) => t.price === "" && t.max === "");

          return {
            ...v,
            pricingType: type,
            tiers:
              tiersEmpty && carry
                ? v.tiers.map((t, i) => (i === 0 ? { ...t, price: carry } : t))
                : v.tiers,
          };
        }

        const quantitiesEmpty = v.quantities.every((q) => q.price === "" && q.quantity === "");

        return {
          ...v,
          pricingType: type,
          quantities:
            quantitiesEmpty && carry
              ? v.quantities.map((q, i) => (i === 0 ? { ...q, price: carry } : q))
              : v.quantities,
        };
      }),
    [updateValue]
  );

  const setFixedPrice = useCallback(
    (valueKey: string, price: string) =>
      updateValue(valueKey, (v) => ({ ...v, fixedPrice: price })),
    [updateValue]
  );

  const setTierField = useCallback(
    (valueKey: string, tierKey: string, field: "max" | "price", input: string) =>
      updateValue(valueKey, (v) => ({
        ...v,
        tiers: v.tiers.map((t) => (t.key === tierKey ? { ...t, [field]: input } : t)),
      })),
    [updateValue]
  );

  const addTier = useCallback(
    (valueKey: string) =>
      updateValue(valueKey, (v) => ({ ...v, tiers: [...v.tiers, emptyTier()] })),
    [updateValue]
  );

  const removeTier = useCallback(
    (valueKey: string, tierKey: string) =>
      updateValue(valueKey, (v) =>
        v.tiers.length <= 1 ? v : { ...v, tiers: v.tiers.filter((t) => t.key !== tierKey) }
      ),
    [updateValue]
  );

  const setQuantityField = useCallback(
    (valueKey: string, rowKey: string, field: "quantity" | "price", input: string) =>
      updateValue(valueKey, (v) => ({
        ...v,
        quantities: v.quantities.map((q) => (q.key === rowKey ? { ...q, [field]: input } : q)),
      })),
    [updateValue]
  );

  const addQuantity = useCallback(
    (valueKey: string) =>
      updateValue(valueKey, (v) => ({ ...v, quantities: [...v.quantities, emptyQuantity()] })),
    [updateValue]
  );

  const removeQuantity = useCallback(
    (valueKey: string, rowKey: string) =>
      updateValue(valueKey, (v) =>
        v.quantities.length <= 1
          ? v
          : { ...v, quantities: v.quantities.filter((q) => q.key !== rowKey) }
      ),
    [updateValue]
  );

  const toggleGuide = useCallback(() => {
    setGuideOpen((prev) => {
      writeGuidePref(!prev);
      return !prev;
    });
  }, []);

  // ------------------------------------------------------------
  // SAVE (runs the existing endpoints in order)
  // ------------------------------------------------------------

  const save = async () => {
    if (!isDirty) {
      message.info("No changes to save.");
      return;
    }

    const result = validate(basic, values);
    setTitleError(result.titleError);
    setValueErrors(result.valueErrors);

    if (result.titleError || Object.keys(result.valueErrors).length) {
      message.error("Fix the highlighted fields, then save again.");

      const firstKey = Object.keys(result.valueErrors)[0];
      const target = result.titleError
        ? document.getElementById("customization-name")
        : document.querySelector(`[data-value-key="${firstKey}"]`);

      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSaving(true);
    let wroteSomething = false;

    try {
      // 1. Details
      if (basicSignature(basic) !== basicSignature(savedBasic)) {
        await UpdateCustomizationOptionAPI(optionId, {
          name: basic.name.trim(),
          description: basic.description.trim(),
          allow_text_input: basic.allowTextInput,
          allow_image_upload: basic.allowImageUpload,
        });
        wroteSomething = true;
      }

      // 2. Values removed on the page
      const keptIds = new Set(values.filter((v) => v.id).map((v) => v.id));

      for (const saved of savedValues) {
        if (saved.id && !keptIds.has(saved.id)) {
          await DeleteCustomizationOptionValueAPI(saved.id);
          wroteSomething = true;
        }
      }

      // 3. Values added or changed
      const savedById = new Map(savedValues.map((v) => [v.id, v]));

      for (const value of values) {
        const body = buildValueBody(value);

        if (!value.id) {
          const res = await CreateCustomizationOptionValueAPI(optionId, body);
          const newId = Number(res.data?.data?.id);
          wroteSomething = true;

          if (newId) {
            for (const row of buildPricingBodies(value)) {
              await CreateCustomizationPricingAPI(newId, row);
            }
          }

          continue;
        }

        const saved = savedById.get(value.id);
        if (!saved) continue;

        const typeChanged = saved.pricingType !== value.pricingType;

        const detailsChanged =
          saved.name.trim() !== body.name ||
          typeChanged ||
          (value.pricingType === "FIXED" &&
            Number(saved.fixedPrice || NaN) !== Number(value.fixedPrice));

        // Set the type first: pricing rows can only be added once the value
        // has the matching type. When the type changes, the backend also
        // switches off the value's old pricing rows itself.
        if (detailsChanged) {
          await UpdateCustomizationOptionValueAPI(value.id, body);
          wroteSomething = true;
        }

        const rowsChanged =
          value.pricingType === "TIERED"
            ? typeChanged || tierSignature(saved.tiers) !== tierSignature(value.tiers)
            : value.pricingType === "QUANTITY_BASED"
            ? typeChanged ||
              quantitySignature(saved.quantities) !== quantitySignature(value.quantities)
            : false;

        // Same type, different rows: remove the old rows first so ranges /
        // quantities never clash mid-save. (A type change already cleared them.)
        if (rowsChanged && !typeChanged && saved.savedPricingIds.length > 0) {
          for (const rowId of saved.savedPricingIds) {
            await DeleteCustomizationPricingAPI(rowId);
          }
          wroteSomething = true;
        }

        if (rowsChanged) {
          for (const row of buildPricingBodies(value)) {
            await CreateCustomizationPricingAPI(value.id, row);
          }
          wroteSomething = true;
        }
      }

      applyData(await fetchOption());
      message.success("Customization saved");
    } catch (err) {
      const reason = getErrorMessage(err, "Something went wrong while saving.");

      if (wroteSomething) {
        // Show what actually got stored so the page matches the database.
        try {
          applyData(await fetchOption());
        } catch {
          // Keep the drafts on screen if the reload fails too.
        }
        message.error(`${reason} Some changes were saved; the page now shows what's stored.`);
      } else {
        message.error(`${reason} Nothing was saved, your changes are still here.`);
      }
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (loaded) applyData(loaded);
  };

  const goBack = () => {
    if (isDirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    navigate("/customizations");
  };

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------

  if (loading) {
    return (
      <div className="customization customization--form">
        <div className="customization__card customization__loading customization__loading--page">
          <span className="customization__spinner" />
          Loading customization…
        </div>
      </div>
    );
  }

  const errorCount = Object.keys(valueErrors).length + (titleError ? 1 : 0);

  return (
    <div className="customization customization--form">
      <header className="customization__form-header">
        <button type="button" className="customization__back" onClick={goBack}>
          <ArrowLeft size={15} />
          All customizations
        </button>

        <div className="customization__title-row">
          <div>
            <h1>{savedBasic.name || "Customization"}</h1>
            <p>Name it, add the choices customers can pick, and set a price for each.</p>
          </div>
        </div>
      </header>

      <SetupGuide open={guideOpen} onToggle={toggleGuide} />

      {/* DETAILS */}
      <section className="customization__section">
        <div className="customization__section-head">
          <div>
            <h2 className="customization__section-title">Details</h2>
            <p className="customization__section-intro">What customers see on the product page.</p>
          </div>
        </div>

        <div className="customization__field">
          <label htmlFor="customization-name">
            Title <span className="customization__req">*</span>
          </label>

          <input
            id="customization-name"
            type="text"
            maxLength={120}
            value={basic.name}
            onChange={(e) => {
              setBasic((prev) => ({ ...prev, name: e.target.value }));
              if (titleError) setTitleError("");
            }}
            className={titleError ? "customization__input--error" : ""}
            placeholder="e.g. Material"
            aria-invalid={!!titleError}
          />

          {titleError && (
            <span className="customization__error" role="alert">
              {titleError}
            </span>
          )}
        </div>

        <div className="customization__field">
          <label htmlFor="customization-description">
            Description <span className="customization__optional">(optional)</span>
          </label>

          <textarea
            id="customization-description"
            value={basic.description}
            onChange={(e) => setBasic((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="e.g. Pick the fabric for your order."
            rows={3}
          />
        </div>

        <div className="customization__switch-group">
          <div className="customization__switch-row">
            <div>
              <strong>Customer types text</strong>
              <span>Shows a text box, for a name or short message.</span>
            </div>

            <Switch
              checked={basic.allowTextInput}
              onChange={(checked) => setBasic((prev) => ({ ...prev, allowTextInput: checked }))}
              aria-label="Customer types text"
            />
          </div>

          <div className="customization__switch-row">
            <div>
              <strong>Customer uploads an image</strong>
              <span>Shows an upload button, for a logo or artwork.</span>
            </div>

            <Switch
              checked={basic.allowImageUpload}
              onChange={(checked) => setBasic((prev) => ({ ...prev, allowImageUpload: checked }))}
              aria-label="Customer uploads an image"
            />
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="customization__section">
        <div className="customization__section-head">
          <div>
            <h2 className="customization__section-title">Values and prices</h2>
            <p className="customization__section-intro">
              Each value is a choice customers can pick. Set how each one is priced.
            </p>
          </div>

          {values.length > 0 && (
            <span className="customization__summary-pill">
              {values.length} {values.length === 1 ? "value" : "values"}
            </span>
          )}
        </div>

        {values.length === 0 ? (
          <div className="customization__empty-values">
            <Tag size={22} />
            <strong>No values yet</strong>
            <span>For “Material” you might add Cotton and Synthetic.</span>

            <button type="button" className="customization__btn-primary" onClick={addValue}>
              <Plus size={16} />
              Add value
            </button>
          </div>
        ) : (
          <>
            <div className="customization__values">
              {values.map((value) => (
                <ValueCard
                  key={value.key}
                  value={value}
                  error={valueErrors[value.key]}
                  onName={setValueName}
                  onRemove={removeValue}
                  onPricingType={setPricingType}
                  onFixedPrice={setFixedPrice}
                  onTier={setTierField}
                  onAddTier={addTier}
                  onRemoveTier={removeTier}
                  onQuantity={setQuantityField}
                  onAddQuantity={addQuantity}
                  onRemoveQuantity={removeQuantity}
                />
              ))}
            </div>

            <button type="button" className="customization__add-value-btn" onClick={addValue}>
              <Plus size={16} />
              Add another value
            </button>
          </>
        )}
      </section>

      {/* SAVE BAR */}
      <div
        className={`customization__form-actions ${
          isDirty ? "customization__form-actions--dirty" : ""
        }`}
      >
        <span className="customization__form-actions-note" aria-live="polite">
          {errorCount > 0 ? (
            <>
              <AlertTriangle size={14} className="customization__form-actions-warn" />
              {errorCount} {errorCount === 1 ? "thing needs" : "things need"} fixing before saving
            </>
          ) : isDirty ? (
            <>
              <span className="customization__dirty-dot" aria-hidden="true" />
              You have unsaved changes
            </>
          ) : (
            "Everything is saved"
          )}
        </span>

        <div className="customization__form-actions-buttons">
          {isDirty && (
            <button
              type="button"
              className="customization__btn-outline"
              onClick={discard}
              disabled={saving}
            >
              Discard
            </button>
          )}

          <button
            type="button"
            className="customization__btn-primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? (
              <span className="customization__mini-spinner customization__mini-spinner--light" />
            ) : (
              <Check size={16} />
            )}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomizationForm;