/** @format */

import { Plus, Trash2 } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import NumberField from "@/components/common/Numberfield";
import {
  DEFAULT_BULK_TIER,
  DEFAULT_QUANTITY_PRICE,
  QUANTITY_MODE_INFO,
  nextTierMin,
  type BulkTier,
  type QuantityPrice,
  type QuantityPricingMode,
} from "@/utils/variantPricing";
import type { QuantityPricingDraft } from "./usePricingTemplates";

// The same look as the shadcn Input, for NumberField's bare input.
const FIELD =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

const HEAD = "text-xs font-medium uppercase tracking-wide text-muted-foreground";

interface Props {
  value: QuantityPricingDraft;
  onChange: (next: QuantityPricingDraft) => void;
}

export function QuantityPricingEditor({ value, onChange }: Props) {
  const setMode = (mode: QuantityPricingMode) =>
    onChange({
      ...value,
      pricing_mode: mode,
      bulk_pricing: value.bulk_pricing.length ? value.bulk_pricing : [DEFAULT_BULK_TIER()],
      quantity_pricing: value.quantity_pricing.length
        ? value.quantity_pricing
        : [DEFAULT_QUANTITY_PRICE()],
    });

  const setTier = (index: number, patch: Partial<BulkTier>) =>
    onChange({
      ...value,
      bulk_pricing: value.bulk_pricing.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    });

  const setQuantity = (index: number, patch: Partial<QuantityPrice>) =>
    onChange({
      ...value,
      quantity_pricing: value.quantity_pricing.map((q, i) =>
        i === index ? { ...q, ...patch } : q,
      ),
    });

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Quantity pricing style"
        className="grid gap-2 sm:grid-cols-2"
      >
        {(Object.keys(QUANTITY_MODE_INFO) as QuantityPricingMode[]).map((mode) => {
          const active = value.pricing_mode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(mode)}
              className={cn(
                "flex flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active ? "border-primary bg-primary-soft" : "hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden
                  className={cn(
                    "size-3.5 shrink-0 rounded-full border",
                    active ? "border-[4px] border-primary" : "border-input",
                  )}
                />
                {QUANTITY_MODE_INFO[mode].label}
              </span>
              <span className="text-xs leading-snug text-muted-foreground">
                {QUANTITY_MODE_INFO[mode].description}
              </span>
            </button>
          );
        })}
      </div>

      {value.pricing_mode === "tiered" ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            A lower price per item as the quantity goes up. Leave the last "To"
            empty for no limit.
          </p>
          <div className="grid grid-cols-[1fr_1fr_1fr_2rem] items-center gap-2">
            <span className={HEAD}>From</span>
            <span className={HEAD}>To</span>
            <span className={HEAD}>Price per item ($)</span>
            <span />
            {value.bulk_pricing.map((tier, i) => (
              <TierRow
                key={i}
                index={i}
                tier={tier}
                removable={value.bulk_pricing.length > 1}
                onChange={(patch) => setTier(i, patch)}
                onRemove={() =>
                  onChange({
                    ...value,
                    bulk_pricing: value.bulk_pricing.filter((_, idx) => idx !== i),
                  })
                }
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                bulk_pricing: [
                  ...value.bulk_pricing,
                  { min_qty: nextTierMin(value.bulk_pricing), max_qty: null, price: 0 },
                ],
              })
            }
          >
            <Plus />
            Add quantity tier
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Each exact quantity a shopper can order, with the total price for
            it, like 25 for $100.
          </p>
          <div className="grid grid-cols-[1fr_1fr_5.5rem_2rem] items-center gap-2">
            <span className={HEAD}>Quantity</span>
            <span className={HEAD}>Total price ($)</span>
            <span className={HEAD}>Per item</span>
            <span />
            {value.quantity_pricing.map((row, i) => {
              const perItem =
                row.quantity > 0 && row.price > 0 ? row.price / row.quantity : null;
              return (
                <div key={i} className="contents">
                  <NumberField
                    className={FIELD}
                    ariaLabel={`Quantity ${i + 1}`}
                    placeholder="e.g. 25"
                    value={row.quantity}
                    onChange={(val) => setQuantity(i, { quantity: val ?? 0 })}
                  />
                  <NumberField
                    className={FIELD}
                    allowDecimal
                    ariaLabel={`Total price for quantity ${i + 1}`}
                    placeholder="e.g. 100"
                    value={row.price}
                    onChange={(val) => setQuantity(i, { price: val ?? 0 })}
                  />
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {perItem !== null ? `$${perItem.toFixed(2)} each` : "—"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove quantity ${i + 1}`}
                    title="Remove"
                    disabled={value.quantity_pricing.length <= 1}
                    onClick={() =>
                      onChange({
                        ...value,
                        quantity_pricing: value.quantity_pricing.filter((_, idx) => idx !== i),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                quantity_pricing: [...value.quantity_pricing, DEFAULT_QUANTITY_PRICE()],
              })
            }
          >
            <Plus />
            Add quantity
          </Button>
        </div>
      )}
    </div>
  );
}

interface TierRowProps {
  index: number;
  tier: BulkTier;
  removable: boolean;
  onChange: (patch: Partial<BulkTier>) => void;
  onRemove: () => void;
}

function TierRow({ index, tier, removable, onChange, onRemove }: TierRowProps) {
  const n = index + 1;
  return (
    <div className="contents">
      <NumberField
        className={FIELD}
        ariaLabel={`Tier ${n} from quantity`}
        placeholder="Min qty"
        value={tier.min_qty}
        onChange={(val) => onChange({ min_qty: val ?? 0 })}
      />
      <NumberField
        className={FIELD}
        ariaLabel={`Tier ${n} to quantity`}
        placeholder="No limit"
        emptyValue={null}
        value={tier.max_qty}
        onChange={(val) => onChange({ max_qty: val })}
      />
      <NumberField
        className={FIELD}
        allowDecimal
        ariaLabel={`Tier ${n} price per item`}
        placeholder="0.00"
        value={tier.price}
        onChange={(val) => onChange({ price: val ?? 0 })}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove tier ${n}`}
        title="Remove"
        disabled={!removable}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
