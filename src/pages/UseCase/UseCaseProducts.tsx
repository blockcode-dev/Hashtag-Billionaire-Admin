/** @format */

import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Plus,
  X,
  Trash2,
  RotateCcw,
  ImageOff,
  Layers,
  Hand,
  Move,
  CheckSquare,
} from "lucide-react";
import {
  GetUseCaseProductsAPI,
  AddProductsToUseCaseAPI,
  ExcludeProductsFromUseCaseAPI,
  ClearUseCaseProductOverrideAPI,
  GetUseCaseByIdAPI,
  GetUseCasesAPI,
  MoveProductsBetweenUseCasesAPI,
} from "@/services/Api/IndustryApi";
import { GetAllProductsAdminAPI } from "@/services/Api/ProductApi";
import {
  GetAllTiersAPI,
  GetCurrentTiersForProductsAPI,
  SetProductTierAPI,
  AddProductsToTierAPI,
  ClearProductTierOverrideAPI,
  BulkClearProductTierOverrideAPI,
} from "@/services/Api/TierApi";
import "./UseCaseProducts.scss";

const SUPPLIER_COLORS: Record<string, { bg: string; text: string }> = {
  SANMAR: { bg: "var(--primary-soft)", text: "var(--primary)" },
  SS: { bg: "var(--success-soft)", text: "var(--success-soft-foreground)" },
  SAGE: { bg: "var(--violet-soft)", text: "var(--violet)" },
  OTTOCAP: { bg: "var(--warning-soft)", text: "var(--warning)" },
};

// Fixed tier palette — matches the tier `key` values from the backend
// (primary / secondary / budget). "no tier" falls back to neutral gray.
const TIER_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  primary: { bg: "var(--primary-soft)", text: "var(--primary)", border: "var(--primary-border)" },
  secondary: { bg: "var(--warning-soft)", text: "var(--warning)", border: "var(--warning-border)" },
  budget: { bg: "var(--success-soft)", text: "var(--success-soft-foreground)", border: "var(--success-border)" },
};

const NEUTRAL_TIER_COLOR = {
  bg: "var(--muted)",
  text: "var(--muted-foreground)",
  border: "var(--border)",
};

const SupplierBadge = ({ supplier }: { supplier?: string | null }) => {
  if (!supplier) return <span className="ucp__none">—</span>;

  const colors = SUPPLIER_COLORS[supplier] || {
    bg: "var(--muted)",
    text: "var(--foreground)",
  };

  return (
    <span
      className="ucp__supplier-badge"
      style={{ background: colors.bg, color: colors.text }}
    >
      {supplier}
    </span>
  );
};

const SourceBadge = ({ source }: { source?: "category" | "manual" }) => {
  const isManual = source === "manual";

  return (
    <span
      className={`ucp__source ucp__source--${isManual ? "manual" : "category"}`}
    >
      {isManual ? <Hand size={12} /> : <Layers size={12} />}
      {isManual ? "Manually added" : "From category"}
    </span>
  );
};

interface ParentCategoryRef {
  id: number;
  title: string;
}

interface Attachment {
  file_uri: string;
}

interface CurrentTierInfo {
  id: number;
  key: string;
  title: string;
  source: "category" | "manual";
}

interface Product {
  id: number;
  name: string;
  image?: string | null;
  supplier?: string | null;
  attachments?: Attachment[];
  parent_categories?: ParentCategoryRef[];
  source?: "category" | "manual";
  tier?: CurrentTierInfo | null; // embedded directly by GetUseCaseProductsAPI
}

interface UseCaseOption {
  id: number;
  title: string;
  industry?: string | null;
}

interface Tier {
  id: number;
  key: string;
  title: string;
  sort_order: number;
}

type SourceFilter = "all" | "manual" | "category";

const CATEGORIES_PREVIEW = 2;

const CategoryChips = ({ categories }: { categories: ParentCategoryRef[] }) => {
  if (!categories?.length) {
    return <span className="ucp__none">Uncategorized</span>;
  }

  const visible = categories.slice(0, CATEGORIES_PREVIEW);
  const remaining = categories.length - CATEGORIES_PREVIEW;

  return (
    <div className="ucp__cat-chips">
      {visible.map((c) => (
        <span key={c.id} className="ucp__cat-chip">
          {c.title}
        </span>
      ))}

      {remaining > 0 && (
        <span className="ucp__cat-chip ucp__cat-chip--more">+{remaining}</span>
      )}
    </div>
  );
};

// Pretty inline tier control — a <select> styled like a colored pill,
// paired with a small "x" button to clear the tier entirely. "No tier"
// is a real selectable option, not a hidden/disabled placeholder.
const TierPill = ({
  tierInfo,
  tiers,
  saving,
  onChange,
  onRemove,
}: {
  tierInfo?: CurrentTierInfo | null;
  tiers: Tier[];
  saving: boolean;
  onChange: (tierId: number) => void;
  onRemove: () => void;
}) => {
  const colors = tierInfo
    ? TIER_COLORS[tierInfo.key] || NEUTRAL_TIER_COLOR
    : NEUTRAL_TIER_COLOR;

  return (
    <div className="ucp__tier-cell">
      <select
        className="ucp__tier-pill"
        style={{
          background: colors.bg,
          color: colors.text,
          borderColor: colors.border,
        }}
        value={tierInfo?.id ?? "none"}
        onChange={(e) => {
          if (e.target.value === "none") {
            onRemove();
          } else {
            onChange(Number(e.target.value));
          }
        }}
        disabled={saving || !tiers.length}
        title={
          tierInfo
            ? `${tierInfo.title} (${tierInfo.source})`
            : "No tier assigned"
        }
      >
        <option value="none">{tiers.length ? "No tier" : "Loading..."}</option>
        {tiers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>

      {tierInfo && (
        <button
          className="ucp__tier-remove-btn"
          onClick={onRemove}
          disabled={saving}
          title="Remove tier"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

// Attachments already carry a full, ready-to-use file_uri — always use
// the 0th (front) image. No base-URL prepending needed here.
const getThumb = (p: Product) => {
  return p.attachments?.[0]?.file_uri || p.image || null;
};

const UseCaseProducts = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const useCaseId = Number(id);

  const [useCaseTitle, setUseCaseTitle] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const [removeTarget, setRemoveTarget] = useState<Product | null>(null);
  const [removing, setRemoving] = useState(false);

  // ── Bulk selection (for bulk tier assignment/removal) ─────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // Which tier is currently being bulk-assigned; -1 is the sentinel for
  // "bulk remove tier" in progress (distinct from any real tier id).
  const [bulkAssigning, setBulkAssigning] = useState<number | null>(null);

  // ── Per-row tier change ───────────────────────────────
  const [tierSavingId, setTierSavingId] = useState<number | null>(null);

  // ── Add Products modal ──────────────────────────────
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [pickerResults, setPickerResults] = useState<Product[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Set<number>>(
    new Set(),
  );
  const [adding, setAdding] = useState(false);
  const [pickerCurrentTiers, setPickerCurrentTiers] = useState<
    Record<number, CurrentTierInfo | null>
  >({});

  // ── Move Product modal ──────────────────────────────
  const [moveTarget, setMoveTarget] = useState<Product | null>(null);
  const [allUseCases, setAllUseCases] = useState<UseCaseOption[]>([]);
  const [useCasesLoaded, setUseCasesLoaded] = useState(false);
  const [useCasesLoading, setUseCasesLoading] = useState(false);
  const [moveSaving, setMoveSaving] = useState(false);
  const [moveSearch, setMoveSearch] = useState("");

  // ── Tiers (fixed: Primary / Secondary / Budget) ───────
  const [tiers, setTiers] = useState<Tier[]>([]);

  const loadUseCase = async () => {
    try {
      const res = await GetUseCaseByIdAPI(useCaseId);
      setUseCaseTitle(res.data?.data?.title || "");
    } catch (err) {
      console.error(err);
    }
  };

  const loadTiers = async () => {
    try {
      const res = await GetAllTiersAPI();
      const list: Tier[] = res.data?.data || [];
      list.sort((a, b) => a.sort_order - b.sort_order);
      setTiers(list);
    } catch (err) {
      console.error(err);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await GetUseCaseProductsAPI(useCaseId, page, limit, "");
      const payload = res.data?.data;
      setProducts(payload?.data || []);
      setTotal(payload?.pagination?.total || 0);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUseCase();
    loadTiers();
  }, [useCaseId]);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCaseId, page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const visibleProducts = useMemo(() => {
    let list = products;

    if (sourceFilter !== "all") {
      list = list.filter((p) => (p.source || "category") === sourceFilter);
    }

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((p) => {
        const nameMatch = p.name?.toLowerCase().includes(term);
        const categoryMatch = (p.parent_categories || []).some((c) =>
          c.title.toLowerCase().includes(term),
        );
        return nameMatch || categoryMatch;
      });
    }

    return list;
  }, [products, sourceFilter, search]);

  const manualCount = useMemo(
    () => products.filter((p) => p.source === "manual").length,
    [products],
  );
  const categoryCount = useMemo(
    () =>
      products.filter((p) => (p.source || "category") === "category").length,
    [products],
  );

  // ── Selection helpers ─────────────────────────────────
  const allVisibleSelected =
    visibleProducts.length > 0 &&
    visibleProducts.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        visibleProducts.forEach((p) => next.delete(p.id));
        return next;
      }
      const next = new Set(prev);
      visibleProducts.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const toggleSelectOne = (productId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── Bulk assign selected products to a tier ───────────
  // Reuses the bulk "add" endpoint — since a product belongs to exactly
  // one tier, assigning it here also moves it out of wherever it was.
  const handleBulkAssignTier = async (tierId: number, tierTitle: string) => {
    if (!selectedIds.size) return;

    const ids = Array.from(selectedIds);

    try {
      setBulkAssigning(tierId);
      await AddProductsToTierAPI(tierId, ids, useCaseId);

      const tier = tiers.find((t) => t.id === tierId);
      setProducts((prev) =>
        prev.map((p) =>
          ids.includes(p.id)
            ? {
                ...p,
                tier: tier
                  ? {
                      id: tier.id,
                      key: tier.key,
                      title: tier.title,
                      source: "manual",
                    }
                  : p.tier,
              }
            : p,
        ),
      );

      toast.success(
        `${ids.length} product${ids.length === 1 ? "" : "s"} assigned to ${tierTitle}`,
      );
      clearSelection();
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign tier. Please try again.");
    } finally {
      setBulkAssigning(null);
    }
  };

  // ── Bulk remove tier from selected products ───────────
  const handleBulkRemoveTier = async () => {
    if (!selectedIds.size) return;

    const ids = Array.from(selectedIds);

    try {
      setBulkAssigning(-1); // sentinel: bulk removal in progress
      await BulkClearProductTierOverrideAPI(ids, useCaseId);
      setProducts((prev) =>
        prev.map((p) => (ids.includes(p.id) ? { ...p, tier: null } : p)),
      );
      toast.success(
        `Tier removed from ${ids.length} product${ids.length === 1 ? "" : "s"}`,
      );
      clearSelection();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove tier. Please try again.");
    } finally {
      setBulkAssigning(null);
    }
  };

  // ── Per-row tier change ────────────────────────────────
  const handleTierChange = async (product: Product, newTierId: number) => {
    if (product.tier?.id === newTierId) return;

    const newTier = tiers.find((t) => t.id === newTierId);

    try {
      setTierSavingId(product.id);
      await SetProductTierAPI(product.id, newTierId, useCaseId);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                tier: newTier
                  ? {
                      id: newTier.id,
                      key: newTier.key,
                      title: newTier.title,
                      source: "manual",
                    }
                  : p.tier,
              }
            : p,
        ),
      );
      toast.success(`"${product.name}" tier set to ${newTier?.title}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update tier. Please try again.");
    } finally {
      setTierSavingId(null);
    }
  };

  // ── Per-row tier removal (via the small x on the pill) ─
  const handleRemoveTierSingle = async (product: Product) => {
    if (!product.tier) return;

    try {
      setTierSavingId(product.id);
      await ClearProductTierOverrideAPI(product.id,  useCaseId,);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, tier: null } : p)),
      );
      toast.success(`Tier removed from "${product.name}"`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove tier. Please try again.");
    } finally {
      setTierSavingId(null);
    }
  };

  // ── Remove (exclude or clear override) ──────────────
  const handleRemoveConfirm = async () => {
    if (!removeTarget) return;

    try {
      setRemoving(true);

      if (removeTarget.source === "manual") {
        await ClearUseCaseProductOverrideAPI(useCaseId, removeTarget.id);
      } else {
        await ExcludeProductsFromUseCaseAPI(useCaseId, [removeTarget.id]);
      }

      setProducts((prev) => prev.filter((p) => p.id !== removeTarget.id));
      setTotal((prev) => Math.max(0, prev - 1));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(removeTarget.id);
        return next;
      });
      toast.success(`"${removeTarget.name}" removed from this use case`);
      setRemoveTarget(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove product. Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  // ── Add Products picker ──────────────────────────────
  const openAddModal = () => {
    setPickerSelectedIds(new Set());
    setPickerSearch("");
    setPickerResults([]);
    setPickerCurrentTiers({});
    setAddModalOpen(true);
  };

  const closeAddModal = () => {
    if (adding) return;
    setAddModalOpen(false);
  };

  const runPickerSearch = async (term: string) => {
    if (!term.trim()) {
      setPickerResults([]);
      setPickerCurrentTiers({});
      return;
    }

    try {
      setPickerLoading(true);
      const res = await GetAllProductsAdminAPI({
        page: 1,
        limit: 30,
        search: term,
      });
      const list = res.data?.data?.data || res.data?.data || res.data || [];
      setPickerResults(list);

      if (list.length) {
        const tiersRes = await GetCurrentTiersForProductsAPI(
          list.map((p: Product) => p.id),
            useCaseId,
        );
        setPickerCurrentTiers(tiersRes.data?.data || {});
      } else {
        setPickerCurrentTiers({});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPickerLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => runPickerSearch(pickerSearch), 350);
    return () => clearTimeout(timer);
  }, [pickerSearch]);

  const togglePicked = (productId: number) => {
    setPickerSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleAddConfirm = async () => {
    if (!pickerSelectedIds.size) return;

    const count = pickerSelectedIds.size;

    try {
      setAdding(true);
      await AddProductsToUseCaseAPI(useCaseId, Array.from(pickerSelectedIds));
      setAddModalOpen(false);
      setPage(1);
      await loadProducts();
      toast.success(
        `${count} product${count === 1 ? "" : "s"} added to this use case`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to add products. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  // ── Move Product handlers ─────────────────────────────
  const loadUseCasesForMove = async () => {
    if (useCasesLoaded) return;

    try {
      setUseCasesLoading(true);
      const res = await GetUseCasesAPI(1, 200, "");
      const list = res.data?.data?.data || [];
      setAllUseCases(
        list.map((u: any) => ({
          id: u.id,
          title: u.title,
          industry: u.industry?.title || null,
        })),
      );
      setUseCasesLoaded(true);
    } catch (err) {
      console.error(err);
    } finally {
      setUseCasesLoading(false);
    }
  };

  const openMoveModal = (p: Product) => {
    setMoveTarget(p);
    setMoveSearch("");
    loadUseCasesForMove();
  };

  const closeMoveModal = () => {
    if (moveSaving) return;
    setMoveTarget(null);
    setMoveSearch("");
  };

  const moveDestinationOptions = useMemo(() => {
    const term = moveSearch.trim().toLowerCase();
    return allUseCases
      .filter((u) => u.id !== useCaseId)
      .filter((u) => {
        if (!term) return true;
        return (
          u.title.toLowerCase().includes(term) ||
          (u.industry || "").toLowerCase().includes(term)
        );
      });
  }, [allUseCases, useCaseId, moveSearch]);

  const handleMoveConfirm = async (
    destinationId: number,
    destinationTitle: string,
  ) => {
    if (!moveTarget) return;

    try {
      setMoveSaving(true);

      await MoveProductsBetweenUseCasesAPI(
        [moveTarget.id],
        useCaseId,
        destinationId,
      );

      setProducts((prev) => prev.filter((p) => p.id !== moveTarget.id));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success(`"${moveTarget.name}" moved to "${destinationTitle}"`);
      setMoveTarget(null);
      setMoveSearch("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to move product. Please try again.");
    } finally {
      setMoveSaving(false);
    }
  };

  return (
    <div className="ucp">
      <div className="ucp__header">
        <button
          className="ucp__back"
          onClick={() => navigate("/use-cases")}
          title="Back to Use Cases"
        >
          <ArrowLeft size={16} />
          Back to Use Cases
        </button>

        <div className="ucp__header-row">
          <div>
            <h1>Products in "{useCaseTitle || "..."}"</h1>
            <p>
             Products shown here come from linked categories, or were added
  directly.
  Tier assignments are specific to this use case, so the same product
  can have a different tier in another use case.
            </p>
          </div>

          <button
            className="ucp__btn-add"
            onClick={openAddModal}
            title="Add products directly to this use case"
          >
            <Plus size={16} />
            Add Products
          </button>
        </div>
      </div>

      <div className="ucp__toolbar">
        <div className="ucp__search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search by name or category..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              className="ucp__search-clear"
              onClick={() => setSearch("")}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div
          className="ucp__filter-group"
          role="tablist"
          aria-label="Filter by source"
        >
          <button
            className={`ucp__filter-btn ${sourceFilter === "all" ? "ucp__filter-btn--active" : ""}`}
            onClick={() => setSourceFilter("all")}
          >
            All
            <span className="ucp__filter-count">{products.length}</span>
          </button>

          <button
            className={`ucp__filter-btn ${sourceFilter === "manual" ? "ucp__filter-btn--active" : ""}`}
            onClick={() => setSourceFilter("manual")}
            title="Products added directly, not via category"
          >
            <Hand size={12} />
            Manual
            <span className="ucp__filter-count">{manualCount}</span>
          </button>

          <button
            className={`ucp__filter-btn ${sourceFilter === "category" ? "ucp__filter-btn--active" : ""}`}
            onClick={() => setSourceFilter("category")}
            title="Products that belong here via category"
          >
            <Layers size={12} />
            Category
            <span className="ucp__filter-count">{categoryCount}</span>
          </button>
        </div>

        <span className="ucp__count">{total} products</span>
      </div>

      {/* ── Tier toolbar — always visible, not conditional on selection ── */}
      <div className="ucp__tier-toolbar">
        <div className="ucp__tier-toolbar-left">
          <CheckSquare size={16} />
          {selectedIds.size > 0 ? (
            <>
              <span>{selectedIds.size} selected</span>
              <button className="ucp__bulk-clear" onClick={clearSelection}>
                Clear
              </button>
            </>
          ) : (
            <span className="ucp__tier-toolbar-hint">
              Select products below to assign a tier
            </span>
          )}
        </div>

        <div className="ucp__tier-toolbar-right">
          <span className="ucp__bulk-label">Tier:</span>

          {tiers.map((t) => {
            const colors = TIER_COLORS[t.key] || NEUTRAL_TIER_COLOR;
            const isSaving = bulkAssigning === t.id;

            return (
              <button
                key={t.id}
                className="ucp__bulk-tier-btn"
                style={{
                  background: colors.bg,
                  color: colors.text,
                  borderColor: colors.border,
                }}
                onClick={() => handleBulkAssignTier(t.id, t.title)}
                disabled={!selectedIds.size || bulkAssigning !== null}
              >
                {isSaving ? "Saving..." : t.title}
              </button>
            );
          })}

          <button
            className="ucp__bulk-tier-btn ucp__bulk-tier-btn--remove"
            onClick={handleBulkRemoveTier}
            disabled={!selectedIds.size || bulkAssigning !== null}
          >
            {bulkAssigning === -1 ? "Removing..." : "Remove Tier"}
          </button>
        </div>
      </div>

      <div className="ucp__card">
        <table className="ucp__table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <div className="ucp__checkbox-cell" onClick={toggleSelectAll}>
                  <input
                    type="checkbox"
                    className="ucp__checkbox"
                    checked={allVisibleSelected}
                    onChange={() => {}}
                    readOnly
                    title="Select all on this page"
                  />
                </div>
              </th>
              <th style={{ width: 60 }}>Image</th>
              <th>Product</th>
              <th style={{ width: 100 }}>Supplier</th>
              <th style={{ width: 160 }}>Category</th>
              <th style={{ width: 140 }}>Source</th>
              <th style={{ width: 150 }}>Tier</th>
              <th style={{ width: 110, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={8}>
                  <div className="ucp__empty">Loading...</div>
                </td>
              </tr>
            )}

            {!loading && visibleProducts.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="ucp__empty">
                    {products.length === 0
                      ? "No products in this use case yet"
                      : sourceFilter === "manual"
                        ? "No manually added products on this page"
                        : "No category-derived products on this page"}
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              visibleProducts.map((p) => {
                const thumb = getThumb(p);
                const isChecked = selectedIds.has(p.id);
                const savingTier = tierSavingId === p.id;

                return (
                  <tr
                    key={p.id}
                    className={isChecked ? "ucp__row--selected" : ""}
                    onClick={() => toggleSelectOne(p.id)}
                  >
                    <td>
                      <div className="ucp__checkbox-cell">
                        <input
                          type="checkbox"
                          className="ucp__checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          readOnly
                        />
                      </div>
                    </td>

                    <td>
                      {thumb ? (
                        <img src={thumb} alt={p.name} className="ucp__thumb" />
                      ) : (
                        <div className="ucp__thumb ucp__thumb--empty">
                          <ImageOff size={16} />
                        </div>
                      )}
                    </td>

                    <td>
                      <span className="ucp__name">{p.name}</span>
                    </td>

                    <td>
                      <SupplierBadge supplier={p.supplier} />
                    </td>

                    <td>
                      <CategoryChips categories={p.parent_categories || []} />
                    </td>

                    <td>
                      <SourceBadge source={p.source} />
                    </td>

                    <td onClick={(e) => e.stopPropagation()}>
                      <TierPill
                        tierInfo={p.tier}
                        tiers={tiers}
                        saving={savingTier}
                        onChange={(tierId) => handleTierChange(p, tierId)}
                        onRemove={() => handleRemoveTierSingle(p)}
                      />
                    </td>

                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="ucp__actions">
                        <button
                          className="ucp__btn-move"
                          onClick={() => openMoveModal(p)}
                          title="Move to another use case"
                        >
                          <Move size={14} />
                        </button>

                        <button
                          className="ucp__btn-remove"
                          onClick={() => setRemoveTarget(p)}
                          title="Remove from this use case"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {!loading && totalPages > 1 && (
          <div className="ucp__pagination">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Previous page"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              title="Next page"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── Add Products Modal ──────────────────────── */}
      {addModalOpen && (
        <div className="ucp__overlay" onClick={closeAddModal}>
          <div className="ucp__modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="ucp__modal-close"
              onClick={closeAddModal}
              disabled={adding}
              title="Close"
            >
              <X size={16} />
            </button>

            <h2>Add Products</h2>
            <p className="ucp__modal-subtitle">
              Search and select products to add directly to this use case.
            </p>

            <div className="ucp__picker-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="ucp__picker-list">
              {pickerLoading && (
                <div className="ucp__picker-empty">Searching...</div>
              )}

              {!pickerLoading && pickerSearch && pickerResults.length === 0 && (
                <div className="ucp__picker-empty">No products found</div>
              )}

              {!pickerLoading && !pickerSearch && (
                <div className="ucp__picker-empty">
                  Start typing to search products
                </div>
              )}

              {!pickerLoading &&
                pickerResults.map((p) => {
                  const checked = pickerSelectedIds.has(p.id);
                  const thumb = getThumb(p);
                  const tierInfo = pickerCurrentTiers[p.id];

                  return (
                    <label key={p.id} className="ucp__picker-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePicked(p.id)}
                      />

                      {thumb ? (
                        <img src={thumb} alt={p.name} />
                      ) : (
                        <div className="ucp__picker-thumb-empty">
                          <ImageOff size={14} />
                        </div>
                      )}

                      <span className="ucp__picker-item-name">{p.name}</span>

                      <SupplierBadge supplier={p.supplier} />

                      {tierInfo && (
                        <span
                          className="ucp__picker-tier-tag"
                          style={{
                            background: (
                              TIER_COLORS[tierInfo.key] || NEUTRAL_TIER_COLOR
                            ).bg,
                            color: (
                              TIER_COLORS[tierInfo.key] || NEUTRAL_TIER_COLOR
                            ).text,
                          }}
                        >
                          {tierInfo.title}
                        </span>
                      )}
                    </label>
                  );
                })}
            </div>

            <div className="ucp__picker-footer">
              <span>{pickerSelectedIds.size} selected</span>
            </div>

            <div className="ucp__modal-actions">
              <button
                className="ucp__modal-cancel"
                onClick={closeAddModal}
                disabled={adding}
              >
                Cancel
              </button>

              <button
                className="ucp__modal-confirm ucp__modal-confirm--primary"
                onClick={handleAddConfirm}
                disabled={adding || !pickerSelectedIds.size}
              >
                {adding
                  ? "Adding..."
                  : `Add ${pickerSelectedIds.size || ""} Product${pickerSelectedIds.size === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Move Product Modal ──────────────────────── */}
      {moveTarget && (
        <div className="ucp__overlay" onClick={closeMoveModal}>
          <div className="ucp__modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="ucp__modal-close"
              onClick={closeMoveModal}
              disabled={moveSaving}
              title="Close"
            >
              <X size={16} />
            </button>

            <h2>Move Product</h2>

            <p className="ucp__modal-subtitle">
              Move <strong>"{moveTarget.name}"</strong> to another use case. It
              will be removed from "{useCaseTitle}".
            </p>

            <div className="ucp__picker-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search use cases by name or industry..."
                value={moveSearch}
                onChange={(e) => setMoveSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="ucp__picker-list ucp__picker-list--move">
              {useCasesLoading && (
                <div className="ucp__picker-empty">Loading use cases...</div>
              )}

              {!useCasesLoading && moveDestinationOptions.length === 0 && (
                <div className="ucp__picker-empty">No use cases found</div>
              )}

              {!useCasesLoading &&
                moveDestinationOptions.map((u) => (
                  <button
                    key={u.id}
                    className="ucp__move-option"
                    onClick={() => handleMoveConfirm(u.id, u.title)}
                    disabled={moveSaving}
                  >
                    <span className="ucp__move-option-title">{u.title}</span>
                    {u.industry && (
                      <span className="ucp__move-option-industry">
                        ({u.industry})
                      </span>
                    )}
                  </button>
                ))}
            </div>

            <div className="ucp__modal-actions">
              <button
                className="ucp__modal-cancel"
                onClick={closeMoveModal}
                disabled={moveSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove Confirm Modal ────────────────────── */}
      {removeTarget && (
        <div className="ucp__overlay" onClick={() => setRemoveTarget(null)}>
          <div
            className="ucp__modal ucp__modal--confirm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ucp__modal-icon">
              <RotateCcw size={26} />
            </div>

            <h2>Remove Product?</h2>

            <p>
              Remove <strong>"{removeTarget.name}"</strong> from this use case?
              {removeTarget.source === "manual" ? (
                <>
                  {" "}
                  This clears its manual assignment — it'll be gone from here
                  unless it belongs by category too.
                </>
              ) : (
                <>
                  {" "}
                  It belongs here via category — this will exclude it just from
                  this use case, it stays visible everywhere else it belongs.
                </>
              )}
            </p>

            <div className="ucp__modal-actions">
              <button
                className="ucp__modal-cancel"
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
              >
                Cancel
              </button>

              <button
                className="ucp__modal-confirm"
                onClick={handleRemoveConfirm}
                disabled={removing}
              >
                {removing ? "Removing..." : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UseCaseProducts;
