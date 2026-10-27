import { useEffect, useState } from "react";
import { ChevronDown, Scale } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/common/Spinner";
import { GetProductByIdAPI, SetAdminWeightAPI } from "@/services/Api/ProductApi";
import {
  MAX_WEIGHT_LB,
  MIN_WEIGHT_LB,
  describeShippingWeight,
  formatWeight,
  shippingWeight,
  supplierWeight,
  type WeightFields,
  type WeightSource,
} from "@/lib/variants";

// Shipping weights an admin sets (client decision Q31). They're saved with
// PUT product/admin/weight, never with the product update, which would stop
// supplier updates for the product. Supplier syncs never change them.

type WeightTarget = { product_id: number } | { variant_ids: number[] };

export type WeightVariant = WeightFields & {
  id: number;
  sku?: string | null;
  color?: string | null;
  size?: string | null;
};

const adminWeightOf = (v: WeightFields) => {
  const n = Number(v.admin_weight_lb);
  return v.admin_weight_lb != null && v.admin_weight_lb !== "" && n > 0 ? n : null;
};

interface WeightFieldProps {
  target: WeightTarget;
  // The admin weight to show in the field, if there is one.
  current: number | null;
  // Shows Clear, which goes back to the supplier's weight or the default.
  canClear: boolean;
  onSaved: (weight: number | null) => void;
  id: string;
  label: string;
  hideLabel?: boolean;
}

// One weight in pounds with Save and Clear. Not a <form>: Enter saves only this
// field, even on a page whose own form saves the product.
export function WeightField({ target, current, canClear, onSaved, id, label, hideLabel }: WeightFieldProps) {
  const [value, setValue] = useState(current != null ? String(current) : "");
  const [prevCurrent, setPrevCurrent] = useState(current);
  const [saving, setSaving] = useState<"save" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (current !== prevCurrent) {
    setPrevCurrent(current);
    setValue(current != null ? String(current) : "");
  }

  const send = async (weight: number | null) => {
    try {
      setSaving(weight === null ? "clear" : "save");
      setError(null);
      const res = await SetAdminWeightAPI({ ...target, weight_lb: weight });
      const saved = res.data?.data?.weight_lb ?? weight;
      const count = Number(res.data?.data?.variants);
      onSaved(saved);
      toast.success(weight === null ? "Weight cleared" : "Weight saved", {
        description:
          count > 1 ? `${count} variants updated.` : weight === null ? "Shipping uses the supplier's weight or the default again." : undefined,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || "We couldn't save the weight. Try again.");
    } finally {
      setSaving(null);
    }
  };

  const save = () => {
    const weight = Number(value);
    if (!value.trim() || !Number.isFinite(weight) || weight < MIN_WEIGHT_LB || weight > MAX_WEIGHT_LB) {
      setError(`Enter a weight from ${MIN_WEIGHT_LB} to ${MAX_WEIGHT_LB} lb.`);
      return;
    }
    send(weight);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-28">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={MIN_WEIGHT_LB}
            max={MAX_WEIGHT_LB}
            step="any"
            placeholder="0.00"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            className="pr-8"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            lb
          </span>
        </div>
        <Button type="button" size="sm" onClick={save} disabled={!!saving}>
          {saving === "save" && <Spinner size="small" className="text-current" />}
          Save
        </Button>
        {canClear && (
          <Button type="button" variant="ghost" size="sm" onClick={() => send(null)} disabled={!!saving}>
            {saving === "clear" && <Spinner size="small" />}
            Clear
          </Button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const variantName = (v: WeightVariant) =>
  [v.color, v.size].filter(Boolean).join(" · ") || v.sku || `Variant #${v.id}`;

const lbRange = (lbs: number[]) => {
  const min = Math.min(...lbs);
  const max = Math.max(...lbs);
  return min === max ? formatWeight(min) : `${Number(min.toFixed(3))}–${formatWeight(max)}`;
};

// What shipping uses for these variants today, in one line, e.g.
// "6 variants: 4 set by an admin at 0.75 lb, 2 at the store's default weight."
function weightSummary(variants: WeightVariant[]) {
  if (variants.length === 1) return `Ships at ${describeShippingWeight(variants[0])}.`;

  const weights = variants.map(shippingWeight);
  const lbsFrom = (source: WeightSource) =>
    weights.filter((w) => w.source === source).map((w) => w.lb as number);
  const admin = lbsFrom("admin");
  const supplier = lbsFrom("supplier");
  const defaults = weights.length - admin.length - supplier.length;
  const parts = [
    admin.length > 0 && `${admin.length} set by an admin at ${lbRange(admin)}`,
    supplier.length > 0 && `${supplier.length} from the supplier at ${lbRange(supplier)}`,
    defaults > 0 && `${defaults} at the store's default weight`,
  ].filter(Boolean);
  return `${variants.length} variants: ${parts.join(", ")}.`;
}

interface ShippingWeightCardProps {
  productId: number;
  // The product's variants. Leave out and the card loads them.
  variants?: WeightVariant[];
  // With `variants`: called after a save with the change to apply to them.
  onChange?: (update: (variants: WeightVariant[]) => WeightVariant[]) => void;
  className?: string;
}

// Shipping weight for a whole product, and per variant on request.
export function ShippingWeightCard({ productId, variants: given, onChange, className }: ShippingWeightCardProps) {
  const [loaded, setLoaded] = useState<WeightVariant[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (given) return;
    let active = true;
    GetProductByIdAPI(productId)
      .then((res) => {
        if (active) setLoaded(res.data?.data?.variants ?? []);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [given, productId]);

  const variants = given ?? loaded;

  // A change rather than a new list: saves can overlap, and each one must apply
  // to the variants as they are when its answer arrives.
  const applyWeight = (ids: number[] | "all", weight: number | null) => {
    const update = (list: WeightVariant[]) =>
      list.map((v) => (ids === "all" || ids.includes(v.id) ? { ...v, admin_weight_lb: weight } : v));
    if (given) onChange?.(update);
    else setLoaded((list) => (list ? update(list) : list));
  };

  const adminWeights = new Set((variants ?? []).map(adminWeightOf));
  const sharedAdminWeight = adminWeights.size === 1 ? [...adminWeights][0] : null;
  const anyAdminWeight = (variants ?? []).some((v) => adminWeightOf(v) != null);

  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-xs", className)} aria-labelledby={`weight-${productId}`}>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Scale className="size-4" aria-hidden />
        </span>
        <div className="space-y-1">
          <h2 id={`weight-${productId}`} className="text-base font-semibold text-foreground">
            Shipping weight
          </h2>
          <p className="text-sm text-muted-foreground">
            Rates and labels use the weight set here, then the supplier's weight, then the store's default.
            It's saved on its own, so it doesn't stop supplier updates for this product.
          </p>
        </div>
      </div>

      {!variants ? (
        loadFailed ? (
          <p className="text-sm text-destructive">Couldn't load this product's weights. Reload the page to try again.</p>
        ) : (
          <Spinner size="small" label="Loading weights" />
        )
      ) : variants.length === 0 ? (
        <p className="text-sm text-muted-foreground">This product has no variants on sale.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-foreground">{weightSummary(variants)}</p>

          <WeightField
            id={`weight-all-${productId}`}
            label={variants.length === 1 ? "Weight" : "Weight for every variant"}
            target={{ product_id: productId }}
            current={sharedAdminWeight}
            canClear={anyAdminWeight}
            onSaved={(weight) => applyWeight("all", weight)}
          />

          {variants.length > 1 && (
            <div className="border-t pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2"
                aria-expanded={expanded}
                onClick={() => setExpanded((e) => !e)}
              >
                <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
                Set per variant ({variants.length})
              </Button>

              {expanded && (
                <ul className="mt-2 divide-y rounded-lg border">
                  {variants.map((v) => {
                    const supplier = supplierWeight(v);
                    const admin = adminWeightOf(v);
                    return (
                      <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{variantName(v)}</p>
                          <p className="text-xs text-muted-foreground">
                            Supplier: {supplier ? formatWeight(supplier) : "none"} · Ships at{" "}
                            {describeShippingWeight(v)}
                          </p>
                        </div>
                        <WeightField
                          id={`weight-variant-${v.id}`}
                          label={`Weight for ${variantName(v)}`}
                          hideLabel
                          target={{ variant_ids: [v.id] }}
                          current={admin}
                          canClear={admin != null}
                          onSaved={(weight) => applyWeight([v.id], weight)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
