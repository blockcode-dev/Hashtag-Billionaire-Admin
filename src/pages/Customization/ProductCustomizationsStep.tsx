/** @format */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Link } from "react-router";
import { Switch } from "@/components/ui/switch";

import {
  GetCustomizationOptionsAPI,
  GetProductCustomizationsAPI,
  AssignProductCustomizationsAPI,
  CreateCustomizationOptionAPI,
  CreateCustomizationOptionValueAPI,
} from "@/services/Api/CustomizationApi";

import {
  CustomizationOption,
  CustomizationOptionCard,
  CustomizationOptionValue,
  CustomizationSelection,
  findEmptyOptions,
  getValuePriceInfo,
  normalizeCustomizationOptions,
  selectionToPayload,
  serializeSelection,
  setValuesInSelection,
  toggleOptionInSelection,
  toggleValueInSelection,
} from "./CustomizationPicker";
import { MoneyInput } from "./CustomizationForm";

import "./Customization.scss";

// ============================================================
// TYPES
// ============================================================

/** Row from GET /product/:id/customizations */
interface ProductCustomizationRow {
  customization_option_id: number;
  values?: {
    customization_option_value_id?: number;
    value?: { id: number } | null;
  }[];
}

type SaveStatus = "idle" | "saving" | "saved" | "error" | "invalid";

interface ProductCustomizationsStepProps {
  productId: number;
}

// ============================================================
// HELPERS
// ============================================================

const AUTOSAVE_DELAY = 600;
const SEARCH_THRESHOLD = 6;

// "Add a text or upload field": a customization the customer fills in, made and ticked from
// here. Free, it has no values; with a price (27 Nov) it gets one value, PRICED_CHOICE.
type QuickCharge = "FIXED" | "FIXED_QUANTITY";

interface QuickField {
  open: boolean;
  name: string;
  text: boolean;
  upload: boolean;
  /** Empty: free. */
  price: string;
  charge: QuickCharge;
  saving: boolean;
  error: string;
}

const NEW_QUICK_FIELD: QuickField = {
  open: false,
  name: "",
  text: true,
  upload: true,
  price: "",
  charge: "FIXED",
  saving: false,
  error: "",
};

// The value a priced field gets: on the website customers pick it to add the field and pay,
// then type or upload. It can be renamed on the Customizations page.
const PRICED_CHOICE = "Yes";

const QUICK_CHARGES: { type: QuickCharge; title: string; text: string }[] = [
  { type: "FIXED", title: "Per piece", text: "Charged on every piece (One price)" },
  {
    type: "FIXED_QUANTITY",
    title: "One total",
    text: "Charged once, whatever the quantity (Fixed quantity)",
  },
];

const getErrorMessage = (err: unknown, fallback: string): string =>
  (axios.isAxiosError(err) && err.response?.data?.message) || fallback;

// ============================================================
// SAVE STATUS
// ============================================================

const StatusPill = memo(
  ({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) => {
    if (status === "saving") {
      return (
        <span className="customization__pc-status">
          <span className="customization__mini-spinner" />
          Saving…
        </span>
      );
    }

    if (status === "saved") {
      return (
        <span className="customization__pc-status customization__pc-status--ok">
          <CheckCircle2 size={14} />
          Saved
        </span>
      );
    }

    if (status === "invalid") {
      return (
        <span className="customization__pc-status customization__pc-status--warn">
          <AlertTriangle size={14} />
          Waiting for a value
        </span>
      );
    }

    if (status === "error") {
      return (
        <button
          type="button"
          className="customization__pc-status customization__pc-status--error"
          onClick={onRetry}
        >
          <RotateCcw size={14} />
          Couldn't save. Retry
        </button>
      );
    }

    return <span className="customization__pc-status">Changes save automatically</span>;
  }
);

StatusPill.displayName = "StatusPill";

// ============================================================
// STEP
// ============================================================

const ProductCustomizationsStep = ({ productId }: ProductCustomizationsStepProps) => {
  const [options, setOptions] = useState<CustomizationOption[]>([]);
  const [selection, setSelection] = useState<CustomizationSelection>({});
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");

  const hydratedRef = useRef(false);
  const savedKeyRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<CustomizationSelection | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const requestRef = useRef(0);

  // ------------------------------------------------------------
  // LOAD
  // ------------------------------------------------------------

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      hydratedRef.current = false;

      const [optionsRes, productRes] = await Promise.all([
        GetCustomizationOptionsAPI(1, 100, ""),
        GetProductCustomizationsAPI(productId),
      ]);

      const allOptions = normalizeCustomizationOptions(optionsRes.data?.data?.data);

      const rows: ProductCustomizationRow[] = Array.isArray(productRes.data?.data)
        ? productRes.data.data
        : [];

      const next: CustomizationSelection = {};

      rows.forEach((row) => {
        next[Number(row.customization_option_id)] = (row.values || [])
          .map((v) => Number(v.customization_option_value_id ?? v.value?.id))
          .filter((valueId) => Number.isInteger(valueId) && valueId > 0);
      });

      // Customizations already on the product show first.
      allOptions.sort(
        (a, b) => Number(next[b.id] !== undefined) - Number(next[a.id] !== undefined)
      );

      savedKeyRef.current = serializeSelection(next);
      setOptions(allOptions);
      setSelection(next);
      setStatus("idle");
      hydratedRef.current = true;
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load customizations."));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  // ------------------------------------------------------------
  // AUTOSAVE (queued so requests never overlap)
  // ------------------------------------------------------------

  const persist = useCallback(
    (next: CustomizationSelection) => {
      const key = serializeSelection(next);
      const requestId = ++requestRef.current;

      queueRef.current = queueRef.current.then(async () => {
        if (key === savedKeyRef.current) {
          if (requestId === requestRef.current) setStatus("saved");
          return;
        }

        if (requestId === requestRef.current) setStatus("saving");

        try {
          await AssignProductCustomizationsAPI(productId, selectionToPayload(next));
          savedKeyRef.current = key;
          if (requestId === requestRef.current) setStatus("saved");
        } catch (err) {
          if (requestId === requestRef.current) {
            setStatus("error");
            toast.error(getErrorMessage(err, "Couldn't save customizations."));
          }
        }
      });
    },
    [productId]
  );

  useEffect(() => {
    if (!hydratedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;

    if (findEmptyOptions(selection, options).length) {
      setStatus("invalid");
      return;
    }

    if (serializeSelection(selection) === savedKeyRef.current) {
      setStatus((prev) => (prev === "saving" ? prev : prev === "idle" ? "idle" : "saved"));
      return;
    }

    pendingRef.current = selection;
    setStatus("saving");

    timerRef.current = setTimeout(() => {
      pendingRef.current = null;
      persist(selection);
    }, AUTOSAVE_DELAY);
  }, [selection, options, persist]);

  // Flush a waiting save if the admin switches steps before it fires.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current) persist(pendingRef.current);
    },
    [persist]
  );

  const retry = useCallback(() => persist(selection), [persist, selection]);

  // ------------------------------------------------------------
  // SELECTION HANDLERS
  // ------------------------------------------------------------

  const toggleOption = useCallback(
    (option: CustomizationOption) => setSelection((prev) => toggleOptionInSelection(prev, option)),
    []
  );

  const toggleValue = useCallback(
    (optionId: number, valueId: number) =>
      setSelection((prev) => toggleValueInSelection(prev, optionId, valueId)),
    []
  );

  const setValues = useCallback(
    (optionId: number, valueIds: number[]) =>
      setSelection((prev) => setValuesInSelection(prev, optionId, valueIds)),
    []
  );

  // ------------------------------------------------------------
  // ADD A TEXT OR UPLOAD FIELD
  // ------------------------------------------------------------
  // Makes a customization the customer fills in (types text and/or uploads a file, e.g.
  // "Business card information") and ticks it for this product, without leaving the
  // product. It's also in the Customizations library afterwards, for other products.
  // Without a price it has no values and is free. With one, it gets one value, "Yes", at
  // that price: customers pick it to add the field. A name that already exists is ticked
  // instead of made twice.

  const [quick, setQuick] = useState<QuickField>(NEW_QUICK_FIELD);

  const addQuickField = useCallback(async () => {
    const name = quick.name.trim().replace(/\s+/g, " ");
    const priceText = quick.price.trim();
    const price = priceText === "" ? null : Number(priceText);

    if (!name) {
      setQuick((prev) => ({ ...prev, error: "Give the field a name, e.g. Business card information." }));
      return;
    }

    if (!quick.text && !quick.upload) {
      setQuick((prev) => ({ ...prev, error: "Turn on text, file upload, or both." }));
      return;
    }

    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setQuick((prev) => ({ ...prev, error: "Enter the price as a number, e.g. 2.50, or leave it empty." }));
      return;
    }

    const existing = options.find((o) => o.name.trim().toLowerCase() === name.toLowerCase());

    // Its prices are shared with every product that uses it, so they're changed on the
    // Customizations page, not from one product.
    if (existing && price !== null) {
      setQuick((prev) => ({
        ...prev,
        error: `"${existing.name}" already exists with its own prices. Tick it in the list below, or use another name.`,
      }));
      return;
    }

    if (existing) {
      setSelection((prev) =>
        prev[existing.id] !== undefined ? prev : toggleOptionInSelection(prev, existing)
      );
      setQuick(NEW_QUICK_FIELD);
      toast.success(`"${existing.name}" already exists, so it's now ticked for this product.`);
      return;
    }

    setQuick((prev) => ({ ...prev, saving: true, error: "" }));

    let created: CustomizationOption;

    try {
      const res = await CreateCustomizationOptionAPI({
        name,
        allow_text_input: quick.text,
        allow_image_upload: quick.upload,
      });

      const [made] = normalizeCustomizationOptions([res.data?.data]);
      if (!made?.id) throw new Error("The new field came back without an id.");
      created = made;
    } catch (err) {
      setQuick((prev) => ({
        ...prev,
        saving: false,
        error: getErrorMessage(err, "Couldn't add the field. Please try again."),
      }));
      return;
    }

    if (price === null) {
      setOptions((prev) => [created, ...prev]);
      setSelection((prev) => ({ ...prev, [created.id]: [] }));
      setQuick(NEW_QUICK_FIELD);
      toast.success(`Added "${created.name}" to this product.`);
      return;
    }

    try {
      const res = await CreateCustomizationOptionValueAPI(created.id, {
        name: PRICED_CHOICE,
        pricing_type: quick.charge,
        fixed_price: Number(price.toFixed(2)),
      });

      const value = res.data?.data as CustomizationOptionValue | undefined;
      if (!value?.id) throw new Error("The price came back without an id.");

      setOptions((prev) => [{ ...created, values: [value] }, ...prev]);
      setSelection((prev) => ({ ...prev, [created.id]: [value.id] }));
      setQuick(NEW_QUICK_FIELD);
      toast.success(`Added "${created.name}" to this product at ${getValuePriceInfo(value).label}.`);
    } catch (err) {
      // The field exists now, without its price: list it unticked and say where to finish.
      setOptions((prev) => [created, ...prev]);
      setQuick((prev) => ({
        ...prev,
        saving: false,
        error: `"${created.name}" was added, but its price wasn't saved (${getErrorMessage(
          err,
          "no reason given"
        )}). Add the price on the Customizations page, then tick it here.`,
      }));
    }
  }, [quick, options]);

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------

  const visibleOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;

    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(term) ||
        o.values.some((v) => v.name.toLowerCase().includes(term))
    );
  }, [options, search]);

  const selectedCount = Object.keys(selection).length;

  if (loading) {
    return (
      <div className="customization__section">
        <div className="customization__loading">
          <span className="customization__spinner" />
          Loading customizations…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="customization__section">
        <div className="customization__state">
          <span className="customization__state-icon customization__state-icon--error">
            <AlertTriangle size={24} />
          </span>
          <strong>{loadError}</strong>
          <button type="button" className="customization__btn-outline" onClick={load}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="customization__section customization__pc">
      <div className="customization__pc-top">
        <div>
          <h2 className="customization__section-title">
            Customizations
            {selectedCount > 0 && (
              <span className="customization__summary-pill customization__pc-count">
                {selectedCount} on this product
              </span>
            )}
          </h2>
          <p className="customization__section-intro">
            Tick a customization to offer it on this product, then pick which of its
            values customers can choose. Prices come from the{" "}
            <Link to="/customizations">Customizations page</Link>. Need a box for the
            customer's own text or file? Add it right here.
          </p>
        </div>

        <StatusPill status={status} onRetry={retry} />
      </div>

      {quick.open ? (
        <div className="customization__pc-quick">
          <div className="customization__field">
            <label htmlFor="pc-quick-name">Field name</label>
            <input
              id="pc-quick-name"
              type="text"
              value={quick.name}
              maxLength={100}
              autoFocus
              placeholder="e.g. Business card information"
              className={quick.error ? "customization__input--error" : ""}
              aria-invalid={!!quick.error}
              onChange={(e) => setQuick((prev) => ({ ...prev, name: e.target.value, error: "" }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!quick.saving) addQuickField();
                }
              }}
            />
            <span className="customization__hint">
              Customers see this on the product and fill it in.
            </span>
          </div>

          <div className="customization__switch-group">
            <div className="customization__switch-row">
              <div>
                <strong>Customer types text</strong>
                <span>A text box, e.g. name, title, phone and email for a business card.</span>
              </div>
              <Switch
                checked={quick.text}
                onCheckedChange={(checked) => setQuick((prev) => ({ ...prev, text: checked, error: "" }))}
                aria-label="Customer types text"
              />
            </div>

            <div className="customization__switch-row">
              <div>
                <strong>Customer uploads a file</strong>
                <span>An upload button, for a logo or artwork.</span>
              </div>
              <Switch
                checked={quick.upload}
                onCheckedChange={(checked) => setQuick((prev) => ({ ...prev, upload: checked, error: "" }))}
                aria-label="Customer uploads a file"
              />
            </div>
          </div>

          <div className="customization__pc-quick-price">
            <div className="customization__field">
              <label htmlFor="pc-quick-price">
                Price <span className="customization__optional">(optional)</span>
              </label>
              <MoneyInput
                id="pc-quick-price"
                value={quick.price}
                label="Price"
                onChange={(price) => setQuick((prev) => ({ ...prev, price, error: "" }))}
              />
            </div>

            {quick.price.trim() !== "" && (
              <div
                className="customization__pc-quick-charges"
                role="radiogroup"
                aria-label="How the price is charged"
              >
                {QUICK_CHARGES.map((charge) => {
                  const on = quick.charge === charge.type;

                  return (
                    <button
                      key={charge.type}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`customization__pc-quick-charge ${
                        on ? "customization__pc-quick-charge--on" : ""
                      }`}
                      onClick={() =>
                        setQuick((prev) => ({ ...prev, charge: charge.type, error: "" }))
                      }
                    >
                      <strong>{charge.title}</strong>
                      <span>{charge.text}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <span className="customization__hint">
              {quick.price.trim() === ""
                ? "Leave it empty and the field is free."
                : `Customers pick "${PRICED_CHOICE}" to add it and pay, then fill it in. Every product with this field charges the same; change the price on the Customizations page.`}
            </span>
          </div>

          {quick.error && (
            <span className="customization__error" role="alert">
              {quick.error}
            </span>
          )}

          <div className="customization__pc-quick-actions">
            <button
              type="button"
              className="customization__btn-outline"
              onClick={() => setQuick(NEW_QUICK_FIELD)}
              disabled={quick.saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="customization__btn-primary"
              onClick={addQuickField}
              disabled={quick.saving}
            >
              {quick.saving ? "Adding…" : "Add to this product"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="customization__btn-outline customization__pc-quick-open"
          onClick={() => setQuick({ ...NEW_QUICK_FIELD, open: true })}
        >
          <Plus size={15} />
          Add a text or upload field
        </button>
      )}

      {options.length === 0 ? (
        <div className="customization__empty-values">
          <SlidersHorizontal size={22} />
          <strong>No customizations yet</strong>
          <span>Create one first, like Engraving or Material, then come back here.</span>
          <Link to="/customizations" className="customization__btn-outline">
            Go to Customizations
          </Link>
        </div>
      ) : (
        <>
          {options.length > SEARCH_THRESHOLD && (
            <div className="customization__search customization__pc-search">
              <Search size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customizations or values"
                aria-label="Search customizations"
              />
              {search && (
                <button
                  type="button"
                  className="customization__search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {visibleOptions.length === 0 ? (
            <p className="customization__pc-hint">Nothing matches “{search}”.</p>
          ) : (
            <div className="customization__pc-list">
              {visibleOptions.map((option) => (
                <CustomizationOptionCard
                  key={option.id}
                  option={option}
                  selectedValueIds={selection[option.id]}
                  onToggleOption={toggleOption}
                  onToggleValue={toggleValue}
                  onSetValues={setValues}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ProductCustomizationsStep;