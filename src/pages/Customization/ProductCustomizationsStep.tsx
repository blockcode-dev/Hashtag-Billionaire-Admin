/** @format */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Link } from "react-router";

import {
  GetCustomizationOptionsAPI,
  GetProductCustomizationsAPI,
  AssignProductCustomizationsAPI,
} from "@/services/Api/CustomizationApi";

import {
  CustomizationOption,
  CustomizationOptionCard,
  CustomizationSelection,
  findEmptyOptions,
  normalizeCustomizationOptions,
  selectionToPayload,
  serializeSelection,
  setValuesInSelection,
  toggleOptionInSelection,
  toggleValueInSelection,
} from "./CustomizationPicker";

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

    if (findEmptyOptions(selection).length) {
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
  }, [selection, persist]);

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
            <Link to="/customizations">Customizations page</Link>.
          </p>
        </div>

        <StatusPill status={status} onRetry={retry} />
      </div>

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