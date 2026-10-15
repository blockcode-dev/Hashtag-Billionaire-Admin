/** @format */

import { memo } from "react";
import { Check } from "lucide-react";

import "./Customization.scss";

/*
 * Shared by:
 *  - ProductCustomizationsStep (Edit Manual Product — autosaves)
 *  - DuplicateManualProduct (applied after the copy is created)
 */

// ============================================================
// TYPES
// ============================================================

export type CustomizationPricingType = "FIXED" | "TIERED" | "QUANTITY_BASED";

export interface CustomizationPricingTier {
  id: number;
  // TIERED rows use min/max; QUANTITY_BASED rows use quantity.
  min_quantity: number | string | null;
  max_quantity: number | string | null;
  quantity?: number | string | null;
  price: number | string;
}

export interface CustomizationOptionValue {
  id: number;
  name: string;
  pricing_type?: CustomizationPricingType | null;
  fixed_price?: number | string | null;
  pricing?: CustomizationPricingTier[];
}

export interface CustomizationOption {
  id: number;
  name: string;
  description: string | null;
  allow_text_input: boolean;
  allow_image_upload: boolean;
  values: CustomizationOptionValue[];
}

/** optionId -> selected value ids. An option present here is ticked. */
export type CustomizationSelection = Record<number, number[]>;

export interface CustomizationAssignment {
  customization_option_id: number;
  value_ids: number[];
}

interface ValuePriceInfo {
  priced: boolean;
  label: string;
}

// ============================================================
// HELPERS
// ============================================================

const formatMoney = (n: number): string => `$${n.toFixed(2)}`;

export const getValuePriceInfo = (value: CustomizationOptionValue): ValuePriceInfo => {
  const tiers = (value.pricing || [])
    .map((tier) => Number(tier.price))
    .filter((n) => Number.isFinite(n));

  const fixed =
    value.fixed_price === null || value.fixed_price === undefined || value.fixed_price === ""
      ? NaN
      : Number(value.fixed_price);

  const isFixed = value.pricing_type === "FIXED" || (!value.pricing_type && !tiers.length);

  if (isFixed) {
    return Number.isFinite(fixed)
      ? { priced: true, label: `${formatMoney(fixed)} each` }
      : { priced: false, label: "No price" };
  }

  if (!tiers.length) return { priced: false, label: "No price" };

  // Set quantities: show the exact amounts, e.g. "25 / 50 / 100 · from $0.80 each".
  if (value.pricing_type === "QUANTITY_BASED") {
    const quantities = (value.pricing || [])
      .map((tier) => Number(tier.quantity))
      .filter((q) => Number.isInteger(q) && q > 0)
      .sort((a, b) => a - b);

    const amounts =
      quantities.length > 3
        ? `${quantities.slice(0, 3).join(" / ")} +${quantities.length - 3}`
        : quantities.join(" / ");

    const price =
      tiers.length === 1
        ? `${formatMoney(tiers[0])} each`
        : `from ${formatMoney(Math.min(...tiers))} each`;

    return { priced: true, label: amounts ? `${amounts} · ${price}` : price };
  }

  if (tiers.length === 1) return { priced: true, label: `${formatMoney(tiers[0])} each` };

  return { priced: true, label: `from ${formatMoney(Math.min(...tiers))} each` };
};

export const isValuePriced = (value: CustomizationOptionValue): boolean =>
  getValuePriceInfo(value).priced;

/** Normalises the options list API rows (values can be missing). */
export const normalizeCustomizationOptions = (rows: unknown): CustomizationOption[] =>
  Array.isArray(rows)
    ? (rows as CustomizationOption[]).map((o) => ({
        ...o,
        values: Array.isArray(o.values) ? o.values : [],
      }))
    : [];

export const serializeSelection = (selection: CustomizationSelection): string =>
  JSON.stringify(
    Object.keys(selection)
      .map(Number)
      .sort((a, b) => a - b)
      .map((optionId) => [optionId, [...selection[optionId]].sort((a, b) => a - b)])
  );

export const selectionToPayload = (
  selection: CustomizationSelection
): CustomizationAssignment[] =>
  Object.keys(selection).map((optionId) => ({
    customization_option_id: Number(optionId),
    value_ids: selection[Number(optionId)],
  }));

/** Ticked customizations with no value picked (can't be saved). */
export const findEmptyOptions = (selection: CustomizationSelection): number[] =>
  Object.keys(selection)
    .map(Number)
    .filter((optionId) => selection[optionId].length === 0);

// Pure state updaters — use with setState(prev => ...).

/** Tick selects all priced values; untick removes the customization. */
export const toggleOptionInSelection = (
  prev: CustomizationSelection,
  option: CustomizationOption
): CustomizationSelection => {
  const next = { ...prev };

  if (next[option.id] !== undefined) {
    delete next[option.id];
  } else {
    next[option.id] = option.values.filter(isValuePriced).map((v) => v.id);
  }

  return next;
};

export const toggleValueInSelection = (
  prev: CustomizationSelection,
  optionId: number,
  valueId: number
): CustomizationSelection => {
  const current = prev[optionId] || [];

  return {
    ...prev,
    [optionId]: current.includes(valueId)
      ? current.filter((id) => id !== valueId)
      : [...current, valueId],
  };
};

export const setValuesInSelection = (
  prev: CustomizationSelection,
  optionId: number,
  valueIds: number[]
): CustomizationSelection => ({ ...prev, [optionId]: valueIds });

// ============================================================
// OPTION CARD
// ============================================================

interface CustomizationOptionCardProps {
  option: CustomizationOption;
  selectedValueIds: number[] | undefined;
  onToggleOption: (option: CustomizationOption) => void;
  onToggleValue: (optionId: number, valueId: number) => void;
  onSetValues: (optionId: number, valueIds: number[]) => void;
}

export const CustomizationOptionCard = memo(
  ({
    option,
    selectedValueIds,
    onToggleOption,
    onToggleValue,
    onSetValues,
  }: CustomizationOptionCardProps) => {
    const enabled = selectedValueIds !== undefined;
    const pricedIds = option.values.filter(isValuePriced).map((v) => v.id);
    const canEnable = pricedIds.length > 0;
    const noneSelected = enabled && selectedValueIds.length === 0;
    const checkboxId = `pc-option-${option.id}`;

    return (
      <article className={`customization__pc-card ${enabled ? "customization__pc-card--on" : ""}`}>
        <label className="customization__pc-head" htmlFor={checkboxId}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={enabled}
            disabled={!canEnable && !enabled}
            onChange={() => onToggleOption(option)}
          />

          <span className="customization__pc-title">
            <strong>{option.name}</strong>
            <span>
              {!option.values.length
                ? "No values yet. Add them on the Customizations page."
                : !canEnable
                ? "None of its values have a price yet. Set prices on the Customizations page."
                : option.description ||
                  `${option.values.length} ${option.values.length === 1 ? "value" : "values"}`}
            </span>
          </span>

          <span className="customization__input-tags">
            {option.allow_text_input && <span className="customization__input-tag">Text</span>}
            {option.allow_image_upload && <span className="customization__input-tag">Image</span>}
          </span>
        </label>

        {enabled && (
          <div className="customization__pc-body">
            <div className="customization__pc-body-head">
              <p className="customization__pc-hint">
                Which {option.name.toLowerCase()} values can customers pick on this product?
              </p>

              <div className="customization__pc-links">
                <button
                  type="button"
                  onClick={() => onSetValues(option.id, pricedIds)}
                  disabled={selectedValueIds.length === pricedIds.length}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => onSetValues(option.id, [])}
                  disabled={selectedValueIds.length === 0}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="customization__pc-values">
              {option.values.map((value) => {
                const info = getValuePriceInfo(value);
                const selected = selectedValueIds.includes(value.id);

                return (
                  <button
                    key={value.id}
                    type="button"
                    className={`customization__pc-value ${
                      selected ? "customization__pc-value--on" : ""
                    }`}
                    aria-pressed={selected}
                    disabled={!info.priced && !selected}
                    title={info.priced ? undefined : "Set a price for this value first"}
                    onClick={() => onToggleValue(option.id, value.id)}
                  >
                    <span className="customization__pc-check" aria-hidden="true">
                      {selected && <Check size={12} />}
                    </span>
                    <span className="customization__pc-value-name">{value.name}</span>
                    <span className="customization__pc-value-price">{info.label}</span>
                  </button>
                );
              })}
            </div>

            {noneSelected && (
              <span className="customization__error" role="alert">
                Pick at least one value, or untick {option.name}. It won't save until you do.
              </span>
            )}
          </div>
        )}
      </article>
    );
  }
);

CustomizationOptionCard.displayName = "CustomizationOptionCard";