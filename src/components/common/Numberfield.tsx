/** @format */

import React, { useEffect, useState } from "react";

// Text-based numeric input shared by Create Product and Edit Manual Product.
//
// Why not <input type="number">:
// 1. Leading zero — React won't rewrite the DOM when "0100" and 100 are
//    numerically equal, so the stray 0 stayed on screen. Here the field
//    owns its text, so "0100" becomes "100" as it's typed, and a 0 value
//    shows as blank (with a placeholder) instead of a pre-filled 0.
// 2. Decimals — in-between states like "0", "0.", "0.1", "0.10" survive
//    while typing, so prices like 0.10 work. No limit on decimal places.
//
// When the value changes from outside (e.g. "same price for all
// variants", a row removed), the text re-syncs.

const DECIMAL_PATTERN = /^\d*\.?\d*$/;
const INTEGER_PATTERN = /^\d*$/;

const formatNumberText = (value: number | null | undefined): string =>
  value === null || value === undefined || value === 0 ? "" : String(value);

export interface NumberFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  allowDecimal?: boolean;
  // What an empty field means: 0 for price/stock, null for an open-ended
  // "To" on the last tier.
  emptyValue?: number | null;
  placeholder?: string;
  ariaLabel?: string;
}

const NumberField: React.FC<NumberFieldProps> = ({
  value,
  onChange,
  allowDecimal = false,
  emptyValue = 0,
  placeholder,
  ariaLabel,
}) => {
  const [text, setText] = useState(() => formatNumberText(value));

  const parse = (raw: string): number | null =>
    raw === "" || raw === "." ? emptyValue : Number(raw);

  useEffect(() => {
    if (parse(text) !== (value ?? emptyValue)) {
      setText(formatNumberText(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim();
    const pattern = allowDecimal ? DECIMAL_PATTERN : INTEGER_PATTERN;
    if (!pattern.test(raw)) return;

    // "0100" → "100", but "0.10" and a lone "0" are left alone.
    const cleaned = raw.replace(/^0+(?=\d)/, "");
    setText(cleaned);
    onChange(parse(cleaned));
  };

  return (
    <input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      autoComplete="off"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onChange={handleChange}
    />
  );
};

export default NumberField;