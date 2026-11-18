import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiCombobox } from "@/components/common/MultiCombobox";
import {
  DEFAULT_FEE_LABEL,
  MAX_FEE_AMOUNT,
  MAX_FEE_LABEL,
  loadHandlingFeeOptions,
  parseHandlingFeeRule,
  pickerOptions,
  round2,
  serializeHandlingFeeRule,
  summarizeHandlingFee,
  useHandlingFeeOptions,
} from "./handlingFee";

// The fields as typed: the amount stays text so "35." can be typed.
interface Draft {
  amount: string;
  label: string;
  category_ids: number[];
  suppliers: string[];
}

const draftOf = (text: string) => {
  const { rule, invalid } = parseHandlingFeeRule(text);
  const draft: Draft = {
    amount: rule?.amount != null ? rule.amount.toFixed(2) : "",
    label: rule?.label ?? DEFAULT_FEE_LABEL,
    category_ids: rule?.category_ids ?? [],
    suppliers: rule?.suppliers ?? [],
  };
  return { text, draft, unreadable: invalid };
};

const textOf = (draft: Draft) =>
  serializeHandlingFeeRule({
    amount: draft.amount.trim() === "" ? null : round2(Number(draft.amount)),
    label: draft.label,
    category_ids: draft.category_ids,
    suppliers: draft.suppliers,
  });

interface HandlingFeeControlProps {
  id: string;
  // The setting's JSON text; "" when it isn't set or is being reset.
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  // Says how the rule works. The page shows the setting's description below, so this is for
  // when there isn't one.
  explain?: boolean;
}

// Edit mode for the order handling fee: amount, the name customers see, and the categories and
// suppliers that trigger it. Calls onChange with the rule as JSON text.
export function HandlingFeeControl({ id, value, onChange, invalid, describedBy, explain }: HandlingFeeControlProps) {
  const options = useHandlingFeeOptions();
  const picker = useMemo(() => pickerOptions(options.data), [options.data]);

  // Once each time edit mode opens.
  useEffect(() => {
    loadHandlingFeeOptions();
  }, []);

  // Follows `value` when it changes from outside (Undo, Reset); keeps what's typed otherwise.
  const [fields, setFields] = useState(() => draftOf(value));
  let current = fields;
  if (value !== fields.text) {
    current = draftOf(value);
    setFields(current);
  }
  const { draft, unreadable } = current;

  const change = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    const text = textOf(next);
    setFields({ text, draft: next, unreadable: false });
    onChange(text);
  };

  // Hints only once there's a rule: an empty field means "not set", which is fine.
  const editing = value.trim() !== "";
  const amount = Number(draft.amount);
  const amountError = !editing
    ? null
    : draft.amount.trim() === ""
      ? "Enter an amount. 0 turns the fee off."
      : !Number.isFinite(amount) || amount < 0 || amount > MAX_FEE_AMOUNT
        ? "Enter an amount from $0 to $10,000."
        : null;
  const labelError = editing && !draft.label.trim() ? "Enter the name customers see, such as Handling fee." : null;
  const matchesNothing = editing && amount > 0 && !draft.category_ids.length && !draft.suppliers.length;

  const hintId = `${id}-hints`;
  const amountDescribedBy = [describedBy, amountError && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-3">
      {unreadable && (
        <p className="rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
          The saved value isn't a fee rule this page can read, so the fields start empty. Saving replaces it.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            Amount
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              $
            </span>
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              min={0}
              max={MAX_FEE_AMOUNT}
              step="0.01"
              placeholder="0.00"
              className="pl-7"
              value={draft.amount}
              aria-invalid={invalid || !!amountError || undefined}
              aria-describedby={amountDescribedBy}
              onChange={(e) => change({ amount: e.target.value })}
              onBlur={() => {
                // Dollars and cents: 35 → 35.00.
                const formatted = round2(amount).toFixed(2);
                if (draft.amount.trim() !== "" && Number.isFinite(amount) && formatted !== draft.amount) {
                  change({ amount: formatted });
                }
              }}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-label`} className="text-xs text-muted-foreground">
            Name customers see
          </Label>
          <Input
            id={`${id}-label`}
            value={draft.label}
            maxLength={MAX_FEE_LABEL}
            placeholder={DEFAULT_FEE_LABEL}
            aria-invalid={!!labelError || undefined}
            onChange={(e) => change({ label: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-categories`} className="text-xs text-muted-foreground">
          Supplier categories
        </Label>
        <MultiCombobox
          id={`${id}-categories`}
          options={picker.categories}
          value={draft.category_ids}
          onChange={(ids) => change({ category_ids: ids })}
          placeholder="Any supplier category"
          searchPlaceholder="Search supplier categories…"
          noun={["supplier category", "supplier categories"]}
          missingLabel={(categoryId) => (options.data ? `Supplier category ${categoryId} (not found)` : `Supplier category ${categoryId}`)}
          loading={options.loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-suppliers`} className="text-xs text-muted-foreground">
          Suppliers
        </Label>
        <MultiCombobox
          id={`${id}-suppliers`}
          options={picker.suppliers}
          value={draft.suppliers}
          onChange={(values) => change({ suppliers: values })}
          placeholder="Any supplier"
          searchPlaceholder="Search suppliers…"
          noun={["supplier", "suppliers"]}
          loading={options.loading}
        />
      </div>

      {options.failed && !options.data && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
          <span>Couldn't load the supplier categories and suppliers.</span>
          <Button type="button" variant="outline" size="xs" onClick={() => loadHandlingFeeOptions()}>
            <RefreshCw />
            Try again
          </Button>
        </div>
      )}

      {(amountError || labelError || matchesNothing) && (
        <div id={hintId} className="space-y-1 text-xs">
          {amountError && <p className="text-destructive">{amountError}</p>}
          {labelError && <p className="text-destructive">{labelError}</p>}
          {matchesNothing && (
            <p className="text-warning-soft-foreground">No supplier category or supplier is chosen, so no fee is charged.</p>
          )}
        </div>
      )}

      {explain && (
        <p className="text-xs text-muted-foreground">
          Charged once per order when the order has at least one product in a chosen supplier category and from a chosen
          supplier. Leave a list empty to match any. Amount 0, or both lists empty, turns it off.
        </p>
      )}
    </div>
  );
}

// Read mode: one line, with names once the options have been loaded in edit mode.
export function HandlingFeeSummary({ value }: { value: string }) {
  const { data } = useHandlingFeeOptions();
  return <span className="text-sm break-words">{summarizeHandlingFee(value, data)}</span>;
}
