/** @format */

import { memo, useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { toast } from "sonner";
import { Pagination } from "@/components/common/Pagination";
import { Switch } from "@/components/ui/switch";
import { Tip } from "@/components/common/Tip";
import axios from "axios";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Pencil,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";

import {
  GetCustomizationOptionsAPI,
  DeleteCustomizationOptionAPI,
  CreateCustomizationOptionAPI,
  UpdateCustomizationOptionAPI,
} from "@/services/Api/CustomizationApi";

import { isValuePriced } from "./CustomizationPicker";

import "./Customization.scss";

// ============================================================
// CONSTANTS
// ============================================================

const PAGE_SIZE = 20;

const NAME_SUGGESTIONS = [
  "Engraving",
  "Printing type",
  "Print location",
  "Material",
  "Thread color",
];

// ============================================================
// TYPES
// ============================================================

interface PricingTier {
  id: number;
  min_quantity: number | string;
  max_quantity: number | string | null;
  price: number | string;
}

interface CustomizationValue {
  id: number;
  customization_option_id: number;
  name: string;
  // FIXED values store their price in fixed_price (pricing is empty);
  // TIERED values store their prices in pricing.
  pricing_type?: "FIXED" | "TIERED" | null;
  fixed_price?: number | string | null;
  pricing?: PricingTier[];
}

interface CustomizationOption {
  id: number;
  name: string;
  slug?: string | null;
  description: string | null;
  allow_text_input: boolean;
  allow_image_upload: boolean;
  is_active: boolean;
  values: CustomizationValue[];
}

type PricingTone = "ready" | "warning" | "empty";

interface PricingStatus {
  tone: PricingTone;
  label: string;
  detail: string;
}

// ============================================================
// HELPERS
// ============================================================

const getErrorMessage = (err: unknown, fallback: string): string =>
  (axios.isAxiosError(err) && err.response?.data?.message) || fallback;

const getPricingStatus = (
  values: CustomizationValue[] = []
): PricingStatus => {
  if (!values.length) {
    return {
      tone: "empty",
      label: "No values",
      detail: "Add values before attaching this to a product.",
    };
  }

  // Works for both One price (FIXED) and Price by quantity (TIERED).
  const priced = values.filter(isValuePriced).length;

  if (priced === values.length) {
    return {
      tone: "ready",
      label: "Ready",
      detail:
        values.length === 1
          ? "The value has a price."
          : `All ${values.length} values have prices.`,
    };
  }

  const missing = values.length - priced;

  return {
    tone: "warning",
    label: "Needs pricing",
    detail: `${missing} of ${values.length} ${
      values.length === 1 ? "value has" : "values have"
    } no price yet.`,
  };
};

const useEscapeKey = (active: boolean, onEscape: () => void) => {
  useEffect(() => {
    if (!active) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [active, onEscape]);
};

// ============================================================
// TABLE ROW
// ============================================================

interface OptionRowProps {
  item: CustomizationOption;
  onOpen: (item: CustomizationOption) => void;
  onQuickEdit: (item: CustomizationOption) => void;
  onDelete: (item: CustomizationOption) => void;
}

const STATUS_ICON: Record<PricingTone, ReactElement> = {
  ready: <CheckCircle2 size={14} />,
  warning: <AlertTriangle size={14} />,
  empty: <CircleDashed size={14} />,
};

const OptionRow = memo(
  ({ item, onOpen, onQuickEdit, onDelete }: OptionRowProps) => {
    const values = item.values || [];
    const status = getPricingStatus(values);

    return (
      <tr>
        <td>
          <div className="customization__name-cell">
            <span className="customization__icon">
              <SlidersHorizontal size={16} />
            </span>

            <div className="customization__name-text">
              <button
                type="button"
                className="customization__name"
                onClick={() => onOpen(item)}
              >
                {item.name}
              </button>

              {item.description ? (
                <span
                  className="customization__desc"
                  title={item.description}
                >
                  {item.description}
                </span>
              ) : (
                <span className="customization__none">No description</span>
              )}
            </div>
          </div>
        </td>

        <td>
          {values.length ? (
            <div className="customization__chips">
              {values.slice(0, 4).map((value) => {
                const priced = isValuePriced(value);

                return (
                  <span
                    key={value.id}
                    className={`customization__chip ${
                      priced ? "" : "customization__chip--unpriced"
                    }`}
                    title={priced ? undefined : "No price set for this value"}
                  >
                    {value.name}
                  </span>
                );
              })}

              {values.length > 4 && (
                <span className="customization__chip customization__chip--more">
                  +{values.length - 4} more
                </span>
              )}
            </div>
          ) : (
            <span className="customization__none">No values yet</span>
          )}
        </td>

        <td>
          <div className="customization__status-cell">
            <span
              className={`customization__status customization__status--${status.tone}`}
            >
              {STATUS_ICON[status.tone]}
              {status.label}
            </span>

            <span className="customization__status-detail">
              {status.detail}
            </span>
          </div>
        </td>

        <td>
          <div className="customization__input-tags">
            {item.allow_text_input && (
              <span className="customization__input-tag">Text</span>
            )}

            {item.allow_image_upload && (
              <span className="customization__input-tag">Image</span>
            )}

            {!item.allow_text_input && !item.allow_image_upload && (
              <span className="customization__none">None</span>
            )}
          </div>
        </td>

        <td>
          <div className="customization__actions">
            <button
              type="button"
              className="customization__manage-btn"
              onClick={() => onOpen(item)}
              aria-label={`Manage values and pricing for ${item.name}`}
            >
              <Settings2 size={14} />
              Values &amp; pricing
            </button>

            <Tip content="Rename or edit description">
              <button
                type="button"
                className="customization__icon-btn"
                aria-label={`Edit ${item.name}`}
                onClick={() => onQuickEdit(item)}
              >
                <Pencil size={15} />
              </button>
            </Tip>

            <Tip content="Delete customization">
              <button
                type="button"
                className="customization__icon-btn customization__icon-btn--danger"
                aria-label={`Delete ${item.name}`}
                onClick={() => onDelete(item)}
              >
                <Trash2 size={15} />
              </button>
            </Tip>
          </div>
        </td>
      </tr>
    );
  }
);

OptionRow.displayName = "OptionRow";

// ============================================================
// CREATE MODAL
// ============================================================

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}

const CreateCustomizationModal = memo(
  ({ open, onClose, onCreated }: CreateModalProps) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [allowText, setAllowText] = useState(false);
    const [allowImage, setAllowImage] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
      if (!open) return;

      setName("");
      setDescription("");
      setAllowText(false);
      setAllowImage(false);
      setError("");
    }, [open]);

    const close = useCallback(() => {
      if (!loading) onClose();
    }, [loading, onClose]);

    useEscapeKey(open, close);

    const submit = async () => {
      const trimmed = name.trim();

      if (!trimmed) {
        setError("Give the customization a title, like “Engraving”.");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const res = await CreateCustomizationOptionAPI({
          name: trimmed,
          description: description.trim(),
          allow_text_input: allowText,
          allow_image_upload: allowImage,
        });

        const created = res.data?.data;

        if (!created?.id) {
          throw new Error("Customization was created but no ID was returned.");
        }

        toast.success("Customization created. Now add its values.");
        onCreated(Number(created.id));
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            err instanceof Error ? err.message : "Couldn't create customization."
          )
        );
      } finally {
        setLoading(false);
      }
    };

    if (!open) return null;

    return (
      <div className="customization__overlay" onClick={close}>
        <div
          className="customization__modal customization__modal--form"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-customization-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="customization__modal-header">
            <div>
              <h2 id="create-customization-title">New customization</h2>
              <p>
                Start with the title. You'll add values and prices on the
                next screen.
              </p>
            </div>

            <button
              type="button"
              className="customization__modal-close"
              onClick={close}
              disabled={loading}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="customization__modal-body">
            <div className="customization__field">
              <label htmlFor="create-customization-name">
                Title <span className="customization__req">*</span>
              </label>

              <input
                id="create-customization-name"
                type="text"
                autoFocus
                maxLength={120}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="e.g. Engraving"
                className={error ? "customization__input--error" : ""}
                aria-invalid={!!error}
                aria-describedby="create-customization-name-hint"
              />

              <span
                id="create-customization-name-hint"
                className="customization__hint"
              >
                Customers see this as the question on the product page, so
                write it the way they'd say it.
              </span>

              <div className="customization__suggestions">
                {NAME_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="customization__suggestion"
                    onClick={() => {
                      setName(suggestion);
                      setError("");
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {error && (
                <span className="customization__error" role="alert">
                  {error}
                </span>
              )}
            </div>

            <div className="customization__field">
              <label htmlFor="create-customization-description">
                Description{" "}
                <span className="customization__optional">(optional)</span>
              </label>

              <textarea
                id="create-customization-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Choose how your design is added to the product. Laser engraving is permanent and works best on metal and glass."
                rows={3}
              />
            </div>

            <div className="customization__switch-group">
              <div className="customization__switch-row">
                <div>
                  <strong>Customer types text</strong>
                  <span>For a name, initials or a short message.</span>
                </div>

                <Switch
                  checked={allowText}
                  onCheckedChange={setAllowText}
                  aria-label="Allow text input"
                />
              </div>

              <div className="customization__switch-row">
                <div>
                  <strong>Customer uploads an image</strong>
                  <span>For a logo or artwork file.</span>
                </div>

                <Switch
                  checked={allowImage}
                  onCheckedChange={setAllowImage}
                  aria-label="Allow image upload"
                />
              </div>
            </div>
          </div>

          <div className="customization__modal-actions">
            <button
              type="button"
              className="customization__btn-outline"
              onClick={close}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="button"
              className="customization__btn-primary"
              onClick={submit}
              disabled={loading}
            >
              {loading ? "Creating…" : "Create and add values"}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

CreateCustomizationModal.displayName = "CreateCustomizationModal";

// ============================================================
// QUICK EDIT MODAL
// ============================================================

interface EditModalProps {
  target: CustomizationOption | null;
  onClose: () => void;
  onSaved: () => void;
}

const EditCustomizationModal = memo(
  ({ target, onClose, onSaved }: EditModalProps) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
      if (!target) return;

      setName(target.name);
      setDescription(target.description || "");
      setError("");
    }, [target]);

    const close = useCallback(() => {
      if (!loading) onClose();
    }, [loading, onClose]);

    useEscapeKey(!!target, close);

    const submit = async () => {
      if (!target) return;

      const trimmed = name.trim();

      if (!trimmed) {
        setError("Title can't be empty.");
        return;
      }

      try {
        setLoading(true);
        setError("");

        await UpdateCustomizationOptionAPI(target.id, {
          name: trimmed,
          description: description.trim(),
        });

        toast.success("Customization saved");
        onSaved();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save customization."));
      } finally {
        setLoading(false);
      }
    };

    if (!target) return null;

    return (
      <div className="customization__overlay" onClick={close}>
        <div
          className="customization__modal customization__modal--form"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-customization-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="customization__modal-header">
            <div>
              <h2 id="edit-customization-title">Edit customization</h2>
              <p>Change the title or description customers see.</p>
            </div>

            <button
              type="button"
              className="customization__modal-close"
              onClick={close}
              disabled={loading}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="customization__modal-body">
            <div className="customization__field">
              <label htmlFor="edit-customization-name">
                Title <span className="customization__req">*</span>
              </label>

              <input
                id="edit-customization-name"
                type="text"
                autoFocus
                maxLength={120}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="e.g. Engraving"
                className={error ? "customization__input--error" : ""}
                aria-invalid={!!error}
              />

              {error && (
                <span className="customization__error" role="alert">
                  {error}
                </span>
              )}
            </div>

            <div className="customization__field">
              <label htmlFor="edit-customization-description">
                Description{" "}
                <span className="customization__optional">(optional)</span>
              </label>

              <textarea
                id="edit-customization-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Choose how your design is added to the product."
                rows={3}
              />
            </div>
          </div>

          <div className="customization__modal-actions">
            <button
              type="button"
              className="customization__btn-outline"
              onClick={close}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="button"
              className="customization__btn-primary"
              onClick={submit}
              disabled={loading}
            >
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

EditCustomizationModal.displayName = "EditCustomizationModal";

// ============================================================
// DELETE MODAL
// ============================================================

interface DeleteModalProps {
  target: CustomizationOption | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteCustomizationModal = memo(
  ({ target, loading, onCancel, onConfirm }: DeleteModalProps) => {
    const close = useCallback(() => {
      if (!loading) onCancel();
    }, [loading, onCancel]);

    useEscapeKey(!!target, close);

    if (!target) return null;

    const valueCount = target.values?.length || 0;

    return (
      <div className="customization__overlay" onClick={close}>
        <div
          className="customization__modal customization__modal--confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-customization-title"
          aria-describedby="delete-customization-desc"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="customization__modal-icon">
            <AlertTriangle size={24} />
          </div>

          <h2 id="delete-customization-title">Delete “{target.name}”?</h2>

          <p id="delete-customization-desc">
            {valueCount > 0
              ? `Its ${valueCount} ${
                  valueCount === 1 ? "value" : "values"
                } and their prices go with it. `
              : ""}
            Products using it will stop offering this choice to customers.
          </p>

          <div className="customization__modal-actions">
            <button
              type="button"
              className="customization__btn-outline"
              onClick={close}
              disabled={loading}
            >
              Keep it
            </button>

            <button
              type="button"
              className="customization__btn-danger"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Deleting…" : "Delete customization"}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

DeleteCustomizationModal.displayName = "DeleteCustomizationModal";

// ============================================================
// PAGE
// ============================================================

const CustomizationList = () => {
  const navigate = useNavigate();

  const [customizations, setCustomizations] = useState<CustomizationOption[]>(
    []
  );
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomizationOption | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] =
    useState<CustomizationOption | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ------------------------------------------------------------
  // SEARCH (debounced)
  // ------------------------------------------------------------

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  // ------------------------------------------------------------
  // LOAD
  // ------------------------------------------------------------

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");

      const res = await GetCustomizationOptionsAPI(
        page,
        PAGE_SIZE,
        debouncedSearch
      );

      const result = res.data?.data || {};

      setCustomizations(Array.isArray(result.data) ? result.data : []);
      setTotal(result.pagination?.total || 0);
    } catch (err) {
      setCustomizations([]);
      setLoadError(getErrorMessage(err, "Couldn't load customizations."));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  // ------------------------------------------------------------
  // HANDLERS
  // ------------------------------------------------------------

  const openManage = useCallback(
    (item: CustomizationOption) => navigate(`/customizations/${item.id}/edit`),
    [navigate]
  );

  const closeCreate = useCallback(() => setCreateOpen(false), []);

  const handleCreated = useCallback(
    (id: number) => {
      setCreateOpen(false);
      navigate(`/customizations/${id}/edit`);
    },
    [navigate]
  );

  const closeEdit = useCallback(() => setEditTarget(null), []);

  const handleEdited = useCallback(() => {
    setEditTarget(null);
    load();
  }, [load]);

  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);

      await DeleteCustomizationOptionAPI(deleteTarget.id);

      toast.success(`“${deleteTarget.name}” deleted`);
      setDeleteTarget(null);

      if (customizations.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        await load();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete this customization."));
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, customizations.length, page, load]);

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------

  const isEmpty = !loading && !loadError && customizations.length === 0;

  return (
    <div className="customization">
      <header className="customization__header">
        <div className="customization__header-text">
          <h1>Customizations</h1>
          <p>
            Choices customers make on your manual products, like engraving
            or print type, with a price for each choice.
          </p>
        </div>

        <button
          type="button"
          className="customization__btn-primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={16} />
          New customization
        </button>
      </header>

      <div className="customization__toolbar">
        <div className="customization__search">
          <Search size={16} />

          <input
            type="text"
            placeholder="Search by title or description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

        <span className="customization__count" aria-live="polite">
          {total} {total === 1 ? "customization" : "customizations"}
        </span>
      </div>

      <div className="customization__card">
        {loadError ? (
          <div className="customization__state">
            <span className="customization__state-icon customization__state-icon--error">
              <AlertTriangle size={24} />
            </span>

            <strong>{loadError}</strong>
            <span>Check your connection, then try again.</span>

            <button
              type="button"
              className="customization__btn-outline"
              onClick={load}
            >
              Try again
            </button>
          </div>
        ) : isEmpty ? (
          <div className="customization__state">
            <span className="customization__state-icon">
              <SlidersHorizontal size={24} />
            </span>

            <strong>
              {debouncedSearch
                ? `Nothing matches “${debouncedSearch}”`
                : "No customizations yet"}
            </strong>

            <span>
              {debouncedSearch
                ? "Try a different word, or clear the search."
                : "Create your first one, for example “Engraving” with Laser and Color print as values."}
            </span>

            {debouncedSearch ? (
              <button
                type="button"
                className="customization__btn-outline"
                onClick={() => setSearch("")}
              >
                Clear search
              </button>
            ) : (
              <button
                type="button"
                className="customization__btn-primary"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} />
                New customization
              </button>
            )}
          </div>
        ) : (
          <div className="customization__table-scroll">
            <table className="customization__table">
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>Customization</th>
                  <th style={{ width: "24%" }}>Values</th>
                  <th style={{ width: "18%" }}>Pricing</th>
                  <th style={{ width: "10%" }}>Customer input</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="customization__loading">
                        <span className="customization__spinner" />
                        Loading customizations…
                      </div>
                    </td>
                  </tr>
                ) : (
                  customizations.map((item) => (
                    <OptionRow
                      key={item.id}
                      item={item}
                      onOpen={openManage}
                      onQuickEdit={setEditTarget}
                      onDelete={setDeleteTarget}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && !loadError && (
          <div className="customization__pagination">
            <Pagination
              current={page}
              total={total}
              pageSize={PAGE_SIZE}
              showSizeChanger={false}
              size="small"
              onChange={setPage}
            />
          </div>
        )}
      </div>

      <CreateCustomizationModal
        open={createOpen}
        onClose={closeCreate}
        onCreated={handleCreated}
      />

      <EditCustomizationModal
        target={editTarget}
        onClose={closeEdit}
        onSaved={handleEdited}
      />

      <DeleteCustomizationModal
        target={deleteTarget}
        loading={deleteLoading}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default CustomizationList;