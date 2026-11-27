/** @format */

import { useEffect, useState, useRef, useMemo } from "react";
import {
  Search,
  Package,
  Layers,
  Tag,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Trash2,
  Database,
  Zap,
  Pencil,
  Copy,
  Lock,
  RefreshCw,
  FolderX,
  SlidersHorizontal,
  Check,
  X,
  FolderTree,
  Plus,
  FileUp,
} from "lucide-react";
import "./Product.scss";
import { Thumbnail } from "@/components/common/Thumbnail";
import { confirm } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { toastApiError } from "@/lib/api-errors";
import { Spinner } from "@/components/common/Spinner";
import { Tip } from "@/components/common/Tip";
import {
  GetAllProductsAdminAPI,
  GetProductStatsAPI,
  DeleteProductAPI,
} from "@/services/Api/ProductApi";
import {
  GetGrandCategoriesAPI,
  GetGrandCategoryByIdAPI,
} from "@/services/Api/GrandCategoryApi";
import { GetAllTiersAPI } from "@/services/Api/TierApi";
import { GetUseCasesAPI } from "@/services/Api/IndustryApi";
import { useNavigate } from "react-router";
import { PRODUCTS_LIST_STATE_KEY } from "@/lib/productsListState";

const TABS = [
  { label: "All Products", value: "" },
  { label: "Manual", value: "MANUAL" },
  { label: "S&S", value: "SS" },
  { label: "SAGE", value: "SAGE" },
  { label: "Sanmar", value: "SANMAR" },
  { label: "Otto Cap", value: "OTTOCAP" },
];

// ─── Tier tabs (Primary / Secondary / Budget — fixed, fetched from API) ──
interface Tier {
  id: number;
  key: string;
  title: string;
  sort_order: number;
}

// ─── Generic filter registry ────────────────────────────────────────────
type FilterValue = string; // "" = no filter applied

interface FilterOption {
  label: string;
  value: FilterValue;
}

interface FilterGroup {
  key: string; // query param name sent to the API
  label: string;
  options: FilterOption[];
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    key: "sync_locked",
    label: "Sync status",
    options: [
      { label: "All", value: "" },
      { label: "Locked (manually edited)", value: "true" },
      { label: "Auto-sync", value: "false" },
    ],
  },
];

type FilterState = Record<string, FilterValue>;

const EMPTY_FILTERS: FilterState = FILTER_GROUPS.reduce(
  (acc, g) => ({ ...acc, [g.key]: "" }),
  {},
);

// ─── Category filter types ──────────────────────────────────────────────
interface SimpleCategoryRef {
  id: number;
  title: string;
}

// ─── Use Case filter type ────────────────────────────────────────────────
// Multi-select — the backend accepts a comma-separated list of
// use_case_id values and unions the products across all of them, even
// with no tier selected (filters to products belonging to those use
// cases). Picking a Tier on top of that further narrows within them.
interface SimpleUseCaseRef {
  id: number;
  title: string;
  industryTitle?: string | null;
}

const TIER_DOT_COLORS: Record<string, string> = {
  primary: "var(--primary)",
  secondary: "var(--warning)",
  budget: "var(--success-soft-foreground)",
};

// ─── What the list was showing ──────────────────────────────────────────
// Kept for this browser tab, so coming back from a product (View, Edit,
// Duplicate, Add product, Import, Back) shows the same search, supplier,
// filters and page, with the product you opened in view. Going to any other
// page, or clicking the menu, forgets it (lib/productsListState.ts).
const LIST_STATE_KEY = PRODUCTS_LIST_STATE_KEY;

interface ListState {
  search: string;
  page: number;
  activeTab: string;
  activeTier: string;
  noParentOnly: boolean;
  filters: FilterState;
  priceRange: { min: string; max: string };
  selectedGrand: SimpleCategoryRef | null;
  grandParents: SimpleCategoryRef[];
  selectedParentIds: number[];
  selectedUseCases: SimpleUseCaseRef[];
  openedId: number | null;
}

const DEFAULT_LIST_STATE: ListState = {
  search: "",
  page: 1,
  activeTab: "",
  activeTier: "",
  noParentOnly: false,
  filters: EMPTY_FILTERS,
  priceRange: { min: "", max: "" },
  selectedGrand: null,
  grandParents: [],
  selectedParentIds: [],
  selectedUseCases: [],
  openedId: null,
};

// Anything missing or malformed falls back to the default.
const readListState = (): ListState => {
  try {
    const v = JSON.parse(sessionStorage.getItem(LIST_STATE_KEY) || "null");
    if (!v || typeof v !== "object") return DEFAULT_LIST_STATE;
    const text = (x: unknown) => (typeof x === "string" ? x : "");
    const refs = <T extends SimpleCategoryRef>(x: unknown): T[] =>
      Array.isArray(x)
        ? x.filter((r) => r && typeof r.id === "number" && typeof r.title === "string")
        : [];
    return {
      search: text(v.search),
      page: Number.isInteger(v.page) && v.page > 0 ? v.page : 1,
      activeTab: text(v.activeTab),
      activeTier: text(v.activeTier),
      noParentOnly: v.noParentOnly === true,
      filters: Object.fromEntries(
        Object.keys(EMPTY_FILTERS).map((k) => [k, text(v.filters?.[k])]),
      ),
      priceRange: { min: text(v.priceRange?.min), max: text(v.priceRange?.max) },
      selectedGrand: refs<SimpleCategoryRef>([v.selectedGrand])[0] ?? null,
      grandParents: refs<SimpleCategoryRef>(v.grandParents),
      selectedParentIds: Array.isArray(v.selectedParentIds)
        ? v.selectedParentIds.filter((n: unknown) => typeof n === "number")
        : [],
      selectedUseCases: refs<SimpleUseCaseRef>(v.selectedUseCases),
      openedId: typeof v.openedId === "number" ? v.openedId : null,
    };
  } catch {
    return DEFAULT_LIST_STATE;
  }
};

const writeListState = (state: ListState) => {
  try {
    sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage is off: the list starts over next time, as before.
  }
};

const ProductsPage = () => {
  const navigate = useNavigate();
  // The search, filters and page from the last visit (see readListState).
  const [saved] = useState(readListState);
  const [products, setProducts] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [search, setSearch] = useState(saved.search);
  const [debouncedSearch, setDebouncedSearch] = useState(saved.search);
  const [page, setPage] = useState(saved.page);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  // How many of totalItems the website lists: it hides products with nothing in stock (Q49).
  // null when the backend doesn't send it.
  const [websiteTotal, setWebsiteTotal] = useState<number | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(saved.activeTab);

  // ── Tier filter (Primary / Secondary / Budget / All) ───────────────
  // Only meaningful once at least one Use Case is selected — the tabs
  // themselves are only rendered in that state.
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [activeTier, setActiveTier] = useState(saved.activeTier); // "" = no tier filter, "all" = union, or a tier key

  // Sent to the API as no_parent_category=true. Until the backend filters
  // on it (BACKEND_QUESTIONS.md F28), the API ignores it, so rows are also
  // checked here and the page says when only this page was checked.
  const [noParentOnly, setNoParentOnly] = useState(saved.noParentOnly);

  // Server-side radio filters (sync status)
  const [filters, setFilters] = useState<FilterState>(saved.filters);

  // ── Price range filter ────────────────────────────────────────────
  const [priceRange, setPriceRange] = useState(saved.priceRange);
  const [debouncedPriceRange, setDebouncedPriceRange] = useState(
    saved.priceRange,
  );

  // Goes back to page 1 only when the range really changed, so opening the
  // page keeps the page it was on.
  const pricedRef = useRef(saved.priceRange);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        priceRange.min === pricedRef.current.min &&
        priceRange.max === pricedRef.current.max
      )
        return;
      pricedRef.current = priceRange;
      setDebouncedPriceRange(priceRange);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [priceRange]);

  // ── Category filter (Grand -> Parent) ─────────────────────────────
  const [grandCategories, setGrandCategories] = useState<SimpleCategoryRef[]>(
    [],
  );
  const [selectedGrand, setSelectedGrand] = useState<SimpleCategoryRef | null>(
    saved.selectedGrand,
  );
  const [grandParents, setGrandParents] = useState<SimpleCategoryRef[]>(
    saved.grandParents,
  );
  const [grandParentsLoading, setGrandParentsLoading] = useState(false);
  const [selectedParentIds, setSelectedParentIds] = useState<number[]>(
    saved.selectedParentIds,
  );
  const categoryFilterActive = !!selectedGrand;

  // ── Use Case filter (multi-select, searchable) — drives Tier
  // eligibility ─────────────────────────────────────────────────────
  const [useCases, setUseCases] = useState<SimpleUseCaseRef[]>([]);
  const [useCasesLoading, setUseCasesLoading] = useState(false);
  const [useCaseSearch, setUseCaseSearch] = useState("");
  const [selectedUseCases, setSelectedUseCases] = useState<SimpleUseCaseRef[]>(
    saved.selectedUseCases,
  );
  const useCaseFilterActive = selectedUseCases.length > 0;
  const selectedUseCaseIds = useMemo(
    () => selectedUseCases.map((u) => u.id),
    [selectedUseCases],
  );

  // Client-side filter of the picker list only — doesn't touch the
  // product query, purely narrows what's shown while choosing.
  const filteredUseCases = useMemo(() => {
    const term = useCaseSearch.trim().toLowerCase();
    if (!term) return useCases;
    return useCases.filter(
      (uc) =>
        uc.title.toLowerCase().includes(term) ||
        (uc.industryTitle || "").toLowerCase().includes(term),
    );
  }, [useCases, useCaseSearch]);

  // ── Single consolidated Filters panel ─────────────────────────────
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const activeFilterCount =
    Object.values(filters).filter(Boolean).length +
    (categoryFilterActive ? 1 : 0) +
    (useCaseFilterActive ? 1 : 0) +
    (noParentOnly ? 1 : 0) +
    (debouncedPriceRange.min || debouncedPriceRange.max ? 1 : 0);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        filterPanelRef.current &&
        !filterPanelRef.current.contains(e.target as Node)
      ) {
        setFilterPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Load the Grand Category list once, the first time the panel opens.
  const loadGrandCategories = async () => {
    if (grandCategories.length) return;
    try {
      const res = await GetGrandCategoriesAPI(1, 100, "");
      const list = res?.data?.data?.data || [];
      setGrandCategories(list.map((g: any) => ({ id: g.id, title: g.title })));
    } catch {
      toast.error("Failed to load grand categories");
    }
  };

  // Load the Use Case list once, the first time the panel opens.
  const loadUseCases = async () => {
    if (useCases.length) return;
    setUseCasesLoading(true);
    try {
      const res = await GetUseCasesAPI(1, 100, "");
      const list = res?.data?.data?.data || [];
      setUseCases(
        list.map((u: any) => ({
          id: u.id,
          title: u.title,
          industryTitle: u.industry?.title ?? null,
        })),
      );
    } catch {
      toast.error("Failed to load use cases");
    } finally {
      setUseCasesLoading(false);
    }
  };

  // Load the 3 fixed tiers once on mount.
  const loadTiers = async () => {
    try {
      const res = await GetAllTiersAPI();
      const list: Tier[] = res.data?.data || [];
      list.sort((a, b) => a.sort_order - b.sort_order);
      setTiers(list);
    } catch (err) {
      console.error("Failed to load tiers", err);
    }
  };

  const handleSelectGrand = async (grand: SimpleCategoryRef) => {
    if (selectedGrand?.id === grand.id) return;
    setSelectedGrand(grand);
    setSelectedParentIds([]); // reset sub-selection for the new grand
    setGrandParents([]);
    setGrandParentsLoading(true);
    setPage(1);
    try {
      const res = await GetGrandCategoryByIdAPI(grand.id);
      const parents = res?.data?.data?.parent_categories || [];
      setGrandParents(parents.map((p: any) => ({ id: p.id, title: p.title })));
    } catch {
      toast.error("Failed to load parent categories for this grand category");
    } finally {
      setGrandParentsLoading(false);
    }
  };

  const toggleParentId = (id: number) => {
    setSelectedParentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setPage(1);
  };

  const clearCategoryFilter = () => {
    setSelectedGrand(null);
    setGrandParents([]);
    setSelectedParentIds([]);
    setPage(1);
  };

  // Toggling any Use Case in/out resets the active Tier.
  const toggleUseCase = (uc: SimpleUseCaseRef) => {
    setSelectedUseCases((prev) =>
      prev.some((x) => x.id === uc.id)
        ? prev.filter((x) => x.id !== uc.id)
        : [...prev, uc],
    );
    setActiveTier("");
    setPage(1);
  };

  const clearUseCaseFilter = () => {
    setSelectedUseCases([]);
    setUseCaseSearch("");
    setActiveTier("");
    setPage(1);
  };

  const setFilter = (key: string, value: FilterValue) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilter = (key: string) => setFilter(key, "");

  const clearPriceRange = () => {
    pricedRef.current = { min: "", max: "" };
    setPriceRange({ min: "", max: "" });
    setDebouncedPriceRange({ min: "", max: "" });
    setPage(1);
  };

  const toggleNoParentOnly = () => {
    setNoParentOnly((v) => !v);
    setPage(1);
  };

  const clearNoParentOnly = () => {
    setNoParentOnly(false);
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilters(EMPTY_FILTERS);
    clearCategoryFilter();
    clearUseCaseFilter();
    clearPriceRange();
    setNoParentOnly(false);
    setPage(1);
  };

  const requestIdRef = useRef(0);

  // Like the price range: page 1 only for a new search.
  const searchedRef = useRef(saved.search);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search === searchedRef.current) return;
      searchedRef.current = search;
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const MIN_LOADER_MS = 400;

  const load = async () => {
    const thisRequestId = ++requestIdRef.current;
    setTableLoading(true);
    const startedAt = Date.now();

    try {
      const filterParams = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== ""),
      );

      const categoryParams: Record<string, string> = {};
      if (selectedGrand)
        categoryParams.grand_category_id = String(selectedGrand.id);
      if (selectedParentIds.length)
        categoryParams.parent_category_id = selectedParentIds.join(",");

      const priceParams: Record<string, string> = {};
      if (debouncedPriceRange.min)
        priceParams.min_price = debouncedPriceRange.min;
      if (debouncedPriceRange.max)
        priceParams.max_price = debouncedPriceRange.max;

      const useCaseParams: Record<string, string> = {};
      if (selectedUseCaseIds.length) {
        useCaseParams.use_case_id = selectedUseCaseIds.join(",");
        if (activeTier) {
          useCaseParams.tier = activeTier;
        }
      }

      const res = await GetAllProductsAdminAPI({
        page,
        limit: 100,
        search: debouncedSearch,
        source: activeTab || undefined,
        ...filterParams,
        ...categoryParams,
        ...priceParams,
        ...useCaseParams,
        no_parent_category: noParentOnly ? "true" : undefined,
      });
      if (thisRequestId !== requestIdRef.current) return;
      const payload = res.data.data;
      const lastPage = payload.totalPages || 1;
      if (page > lastPage && !(payload.data || []).length) {
        setPage(lastPage);
        return;
      }
      setProducts(payload.data || []);
      setTotalPages(payload.totalPages || 1);
      setTotalItems(payload.total ?? payload.data?.length ?? 0);
      setWebsiteTotal(typeof payload.website_total === "number" ? payload.website_total : null);
    } catch (err) {
      if (thisRequestId !== requestIdRef.current) return;
      console.error("Failed to load products", err);
    } finally {
      if (thisRequestId === requestIdRef.current) {
        const elapsed = Date.now() - startedAt;
        const remaining = MIN_LOADER_MS - elapsed;
        if (remaining > 0) {
          setTimeout(() => {
            if (thisRequestId === requestIdRef.current) setTableLoading(false);
          }, remaining);
        } else {
          setTableLoading(false);
        }
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    debouncedSearch,
    activeTab,
    activeTier,
    selectedUseCaseIds.join(","),
    filters,
    selectedGrand,
    selectedParentIds,
    debouncedPriceRange.min,
    debouncedPriceRange.max,
    noParentOnly,
  ]);

  // Save what the list shows, for the next visit (see readListState).
  const openedIdRef = useRef(saved.openedId);
  useEffect(() => {
    writeListState({
      search: debouncedSearch,
      page,
      activeTab,
      activeTier,
      noParentOnly,
      filters,
      priceRange: debouncedPriceRange,
      selectedGrand,
      grandParents,
      selectedParentIds,
      selectedUseCases,
      openedId: openedIdRef.current,
    });
  }, [
    debouncedSearch,
    page,
    activeTab,
    activeTier,
    noParentOnly,
    filters,
    debouncedPriceRange,
    selectedGrand,
    grandParents,
    selectedParentIds,
    selectedUseCases,
  ]);

  // Opens a product and remembers it, so the list can show it again.
  const openProduct = (id: number, path: string, state?: unknown) => {
    openedIdRef.current = id;
    writeListState({ ...readListState(), openedId: id });
    navigate(path, state === undefined ? undefined : { state });
  };

  // Back on the list: once it has loaded, bring the product you opened into
  // view and mark its row for a moment.
  const returnToRef = useRef(saved.openedId);
  useEffect(() => {
    const id = returnToRef.current;
    if (id === null || tableLoading || !products.length) return;
    returnToRef.current = null;
    const row = document.querySelector(`tr[data-product-id="${id}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "center" });
    row.classList.add("just-opened");
    const timer = setTimeout(() => row.classList.remove("just-opened"), 2600);
    return () => clearTimeout(timer);
  }, [tableLoading, products]);

  const loadStats = async () => {
    try {
      const res = await GetProductStatsAPI();
      setStats(res.data.data);
    } catch (err) {
      console.error("Failed to load stats", err);
    }
  };

  useEffect(() => {
    loadStats();
    loadTiers();
  }, []);

  const getTierLabel = (key: string) => {
    if (key === "all") return "All Tiers";
    return tiers.find((t) => t.key === key)?.title || key;
  };

  const handleDelete = (product: any) => {
    confirm({
      title: "Delete Product",
      content: (
        <div>
          <p>
            <strong>{product.name}</strong>
          </p>

          <p style={{ color: "var(--destructive)", marginTop: 8 }}>
            This will permanently delete everything associated with this
            product.
          </p>
        </div>
      ),
      okText: "Delete",
      okType: "danger",

      onOk: async () => {
        try {
          const payload =
            product.supplier === "MANUAL"
              ? {
                  product_id: product.id,
                }
              : {
                  styleId: product.external_style_id,
                  supplier: product.supplier,
                };

          await DeleteProductAPI(payload);

          toast.success("Product deleted");

          load();
          loadStats();
        } catch (err) {
          console.error(err);

          toastApiError("Couldn't delete the product", err);
        }
      },
    });
  };

  // The chain in the Categories column: one category, its parent and the
  // parent's grand category. Prefers a full chain, and still shows a parent
  // that has no grand category.
  const getCategoryHierarchy = (
    product: any,
  ): { main: string | null; sub: string | null; supplier: string | null } => {
    const categories = product.categories || [];
    let partial: { main: null; sub: string; supplier: string } | null = null;

    for (const cat of categories) {
      for (const parent of cat.parent_categories || []) {
        if (parent.grand_categories?.length) {
          return {
            main: parent.grand_categories[0].title,
            sub: parent.title,
            supplier: cat.title,
          };
        }
        if (!partial) partial = { main: null, sub: parent.title, supplier: cat.title };
      }
    }

    return partial ?? { main: null, sub: null, supplier: categories[0]?.title ?? null };
  };

  // No parent category: no categories at all, or none of them has a parent.
  // The backend is asked to use the same rule (F28).
  const hasNoParentCategory = (product: any) => {
    if (!product.categories?.length) return true;
    return product.categories.every(
      (c: any) => !c.parent_categories || c.parent_categories.length === 0,
    );
  };

  const visibleProducts = useMemo(() => {
    if (!noParentOnly) return products;
    return products.filter(hasNoParentCategory);
  }, [products, noParentOnly]);

  // A backend that filters sends only matching rows. Rows dropped here mean
  // it ignored no_parent_category, so only this page was checked.
  const noParentCheckedHereOnly =
    noParentOnly && visibleProducts.length < products.length;

  return (
    <div className="products-root">
      <div className="products-header">
        <div className="left">
          <h1>Product Catalog</h1>
          <p>Manage your inventory across multiple suppliers</p>
        </div>
        <div className="header-actions">
          <button
            className="add-product-btn secondary"
            onClick={() => navigate("/import-products")}
          >
            <FileUp size={16} aria-hidden />
            Import CSV
          </button>
          <button
            className="add-product-btn"
            onClick={() => navigate("/create-product")}
          >
            <Plus size={16} aria-hidden />
            Add Product
          </button>
        </div>
      </div>

      {/* 📊 STATS GRID */}
      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-icon purple">
            <Layers size={18} />
          </div>
          <div className="stat-body">
            <p>Total Variants</p>
            <h2>{stats?.totalVariants?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Package size={18} />
          </div>
          <div className="stat-body">
            <p>Total Products</p>
            <h2>{stats?.totalProducts?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Zap size={18} />
          </div>
          <div className="stat-body">
            <p>S&S Active</p>
            <h2>{stats?.ssProducts?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Archive size={18} />
          </div>
          <div className="stat-body">
            <p>Sage Active</p>
            <h2>{stats?.sageProducts?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pink">
            <Tag size={18} />
          </div>
          <div className="stat-body">
            <p>Sanmar</p>
            <h2>{stats?.sanmarProducts?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon indigo">
            <Database size={18} />
          </div>
          <div className="stat-body">
            <p>Otto Cap</p>
            <h2>{stats?.ottoCapProducts?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>
      </div>

      <div className="filters-row">
        <div className="tabs-stack">
          <div className="tabs-container">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                className={activeTab === tab.value ? "active" : ""}
                onClick={() => {
                  setActiveTab(tab.value);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tier tabs — only shown once at least one Use Case is
              selected ─────────────────────────────────────────────── */}
          {useCaseFilterActive ? (
            <div className="tier-tabs-container">
              <span className="tier-tabs-label">
                Tier{" "}
                <span className="tier-tabs-usecase">
                  ·{" "}
                  {selectedUseCases.length === 1
                    ? selectedUseCases[0].title
                    : `${selectedUseCases.length} use cases`}
                </span>
              </span>

              <div className="tier-tabs-group">
                <button
                  className={activeTier === "" ? "active" : ""}
                  onClick={() => {
                    setActiveTier("");
                    setPage(1);
                  }}
                >
                  All Products
                </button>

                {tiers.map((t) => {
                  const dotColor = TIER_DOT_COLORS[t.key] || "var(--muted-foreground)";
                  const isActive = activeTier === t.key;

                  return (
                    <button
                      key={t.id}
                      className={isActive ? "active" : ""}
                      onClick={() => {
                        setActiveTier(t.key);
                        setPage(1);
                      }}
                    >
                      <span
                        className="tier-dot"
                        style={{ background: dotColor }}
                      />
                      {t.title}
                    </button>
                  );
                })}

                <button
                  className={activeTier === "all" ? "active" : ""}
                  onClick={() => {
                    setActiveTier("all");
                    setPage(1);
                  }}
                >
                  <Layers size={12} />
                  All Tiers
                </button>
              </div>
            </div>
          ) : (
            <div className="tier-tabs-hint">
              Select one or more <strong>Use Cases</strong> in Filters to
              filter by tier
            </div>
          )}
        </div>

        <div className="filters-right">
          <div className="filter-dropdown-wrap" ref={filterPanelRef}>
            <button
              className={`filter-btn ${activeFilterCount > 0 ? "active" : ""}`}
              onClick={() => {
                setFilterPanelOpen((v) => !v);
                loadGrandCategories();
                loadUseCases();
              }}
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="filter-count-badge">{activeFilterCount}</span>
              )}
            </button>

            {filterPanelOpen && (
              <div className="filter-panel filter-panel--wide">
                <div className="filter-panel-header">
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <button
                      className="filter-clear-all"
                      onClick={clearAllFilters}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Sync status */}
                {FILTER_GROUPS.map((group) => (
                  <div className="filter-group" key={group.key}>
                    <div className="filter-group-label">{group.label}</div>
                    <div className="filter-option-row">
                      {group.options.map((opt) => (
                        <button
                          key={opt.value}
                          className={`filter-pill ${
                            filters[group.key] === opt.value ? "selected" : ""
                          }`}
                          onClick={() => setFilter(group.key, opt.value)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Use Case — searchable, multi-select */}
                <div className="filter-group">
                  <div className="filter-group-label">
                    Use Case
                    <span className="category-filter-col-hint">
                      select multiple
                    </span>
                    {useCaseFilterActive && (
                      <button
                        className="filter-group-clear"
                        onClick={clearUseCaseFilter}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="usecase-search-box">
                    <Search size={13} />
                    <input
                      type="text"
                      placeholder="Search use cases..."
                      value={useCaseSearch}
                      onChange={(e) => setUseCaseSearch(e.target.value)}
                    />
                    {useCaseSearch && (
                      <button
                        className="usecase-search-clear"
                        onClick={() => setUseCaseSearch("")}
                        type="button"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="category-filter-col usecase-filter-col">
                    <div className="category-filter-col-list">
                      {useCasesLoading && useCases.length === 0 && (
                        <div className="category-filter-empty">Loading…</div>
                      )}
                      {!useCasesLoading &&
                        useCases.length > 0 &&
                        filteredUseCases.length === 0 && (
                          <div className="category-filter-empty">
                            No use cases match "{useCaseSearch}"
                          </div>
                        )}
                      {!useCasesLoading && useCases.length === 0 && (
                        <div className="category-filter-empty">
                          No use cases found
                        </div>
                      )}
                      {filteredUseCases.map((uc) => {
                        const checked = selectedUseCaseIds.includes(uc.id);
                        return (
                          <button
                            key={uc.id}
                            className={`category-filter-item ${
                              checked ? "selected" : ""
                            }`}
                            onClick={() => toggleUseCase(uc)}
                          >
                            <span
                              className={`category-filter-check ${
                                checked ? "on" : ""
                              }`}
                            >
                              {checked && <Check size={10} />}
                            </span>
                            <span className="usecase-filter-item-text">
                              {uc.title}
                              {uc.industryTitle && (
                                <span className="usecase-filter-industry">
                                  {" "}
                                  ({uc.industryTitle})
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {useCaseFilterActive && (
                    <div className="usecase-filter-hint">
                      Showing products for the selected use case
                      {selectedUseCases.length > 1 ? "s" : ""}. Tier filter is
                      now available above the table.
                    </div>
                  )}
                </div>

                {/* Price range */}
                <div className="filter-group">
                  <div className="filter-group-label">
                    Price range
                    {(priceRange.min || priceRange.max) && (
                      <button
                        className="filter-group-clear"
                        onClick={clearPriceRange}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="price-range-row">
                    <div className="price-range-input">
                      <span>$</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="Min"
                        value={priceRange.min}
                        onChange={(e) =>
                          setPriceRange((prev) => ({
                            ...prev,
                            min: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <span className="price-range-sep">–</span>
                    <div className="price-range-input">
                      <span>$</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="Max"
                        value={priceRange.max}
                        onChange={(e) =>
                          setPriceRange((prev) => ({
                            ...prev,
                            max: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Category: Grand -> Parent */}
                <div className="filter-group">
                  <div className="filter-group-label">
                    Category
                    {categoryFilterActive && (
                      <button
                        className="filter-group-clear"
                        onClick={clearCategoryFilter}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="category-filter-body">
                    <div className="category-filter-col">
                      <div className="category-filter-col-label">Grand Category</div>
                      <div className="category-filter-col-list">
                        {grandCategories.length === 0 && (
                          <div className="category-filter-empty">Loading…</div>
                        )}
                        {grandCategories.map((g) => (
                          <button
                            key={g.id}
                            className={`category-filter-item ${
                              selectedGrand?.id === g.id ? "selected" : ""
                            }`}
                            onClick={() => handleSelectGrand(g)}
                          >
                            {g.title}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="category-filter-col">
                      <div className="category-filter-col-label">
                        Parent Category
                        <span className="category-filter-col-hint">
                          optional
                        </span>
                      </div>
                      <div className="category-filter-col-list">
                        {!selectedGrand && (
                          <div className="category-filter-empty">
                            Pick a grand category first
                          </div>
                        )}
                        {selectedGrand && grandParentsLoading && (
                          <div className="category-filter-empty">Loading…</div>
                        )}
                        {selectedGrand &&
                          !grandParentsLoading &&
                          grandParents.length === 0 && (
                            <div className="category-filter-empty">
                              No parent categories
                            </div>
                          )}
                        {selectedGrand &&
                          !grandParentsLoading &&
                          grandParents.map((p) => {
                            const checked = selectedParentIds.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                className={`category-filter-item ${
                                  checked ? "selected" : ""
                                }`}
                                onClick={() => toggleParentId(p.id)}
                              >
                                <span
                                  className={`category-filter-check ${
                                    checked ? "on" : ""
                                  }`}
                                >
                                  {checked && <Check size={10} />}
                                </span>
                                {p.title}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Other — client-side toggle */}
                <div className="filter-group filter-group--last">
                  <button
                    className="filter-checkbox-row"
                    onClick={toggleNoParentOnly}
                  >
                    <span
                      className={`filter-option-check ${
                        noParentOnly ? "on" : ""
                      }`}
                    >
                      {noParentOnly && <Check size={11} />}
                    </span>
                    <FolderX size={13} />
                    No Parent Category only
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search by name or style ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="active-filter-chips">
          {useCaseFilterActive && (
            <span className="filter-chip filter-chip--usecase">
              <Tag size={11} />
              {selectedUseCases.length === 1
                ? selectedUseCases[0].title
                : `${selectedUseCases.length} use cases`}
              {activeTier && (
                <span className="filter-chip-sub">
                  › {getTierLabel(activeTier)}
                </span>
              )}
              <button onClick={clearUseCaseFilter}>
                <X size={12} />
              </button>
            </span>
          )}

          {categoryFilterActive && (
            <span className="filter-chip filter-chip--category">
              <FolderTree size={11} />
              {selectedGrand!.title}
              {selectedParentIds.length > 0 && (
                <span className="filter-chip-sub">
                  › {selectedParentIds.length} parent categor
                  {selectedParentIds.length === 1 ? "y" : "ies"}
                </span>
              )}
              <button onClick={clearCategoryFilter}>
                <X size={12} />
              </button>
            </span>
          )}

          {(debouncedPriceRange.min || debouncedPriceRange.max) && (
            <span className="filter-chip">
              ${debouncedPriceRange.min || "0"} – $
              {debouncedPriceRange.max || "∞"}
              <button onClick={clearPriceRange}>
                <X size={12} />
              </button>
            </span>
          )}

          {FILTER_GROUPS.map((group) => {
            const value = filters[group.key];
            if (!value) return null;
            const opt = group.options.find((o) => o.value === value);
            return (
              <span className="filter-chip" key={group.key}>
                {opt?.label}
                <button onClick={() => clearFilter(group.key)}>
                  <X size={12} />
                </button>
              </span>
            );
          })}

          {noParentOnly && (
            <span className="filter-chip">
              No Parent Category
              <button onClick={clearNoParentOnly}>
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Result count */}
      <div className="result-count-row">
        {tableLoading ? (
          <span className="result-count-loading">Loading products…</span>
        ) : noParentCheckedHereOnly ? (
          <span>
            <strong>{visibleProducts.length.toLocaleString()}</strong> without a
            parent category on this page. The server can't filter by this yet,
            so other pages may have more.
          </span>
        ) : (
          <span>
            <strong>{totalItems.toLocaleString()}</strong>{" "}
            {totalItems === 1 ? "product" : "products"} found
            {websiteTotal !== null && (
              <span
                className="website-total"
                title="The website lists only products with at least one colour or size in stock."
              >
                {" · "}
                <strong>{websiteTotal.toLocaleString()}</strong> shown on the website
                {totalItems > websiteTotal &&
                  ` (${(totalItems - websiteTotal).toLocaleString()} with nothing in stock)`}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="table-wrap">
        {tableLoading && (
          <div className="table-loading-overlay">
            <Spinner size="large" />
          </div>
        )}
        <table className={tableLoading ? "dimmed" : ""}>
          <thead>
            <tr>
              <th>Product Details</th>
              <th>Style Name</th>
              <th>Supplier</th>
              <th>Sync Status</th>
              <th>Categories</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((p) => {
              const {
                main,
                sub,
                supplier: catSupplier,
              } = getCategoryHierarchy(p);
              const isManual = p.supplier === "MANUAL";
              return (
                <tr key={p.id} data-product-id={p.id}>
                  <td>
                    <div className="product-cell">
                      <Thumbnail src={p.attachments?.[0]?.file_uri} alt={p.name} size={44} />
                      <div className="info">
                        <p className="name">{p.name}</p>
                        <span className="sku">
                          {p.external_style_id || "-"}
                        </span>
                        {p.shown_on_website === false && (
                          <span
                            className="badge hidden-on-website"
                            title="No colour or size in stock, so the website doesn't list it. It comes back when the supplier has stock again."
                          >
                            Not on website: out of stock
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{p.external_style_name || p.name || "-"}</td>
                  <td>
                    <span className={`badge ${p.supplier?.toLowerCase()}`}>
                      {p.supplier}
                    </span>
                  </td>
                  <td>
                    {isManual ? (
                      <span className="cat-no-parent-tag">—</span>
                    ) : p.sync_locked ? (
                      <span
                        className="badge sync-locked"
                        title={`Locked ${p.sync_locked_at ? new Date(p.sync_locked_at).toLocaleDateString() : ""}`}
                      >
                        <Lock size={11} />
                        Locked
                      </span>
                    ) : (
                      <span className="badge sync-auto">
                        <RefreshCw size={11} />
                        Auto-sync
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="cat-hierarchy">
                      {main && <span className="cat main">{main}</span>}
                      {sub && (
                        <>
                          {main && <span className="cat-sep">›</span>}
                          <span className="cat sub">{sub}</span>
                        </>
                      )}
                      {catSupplier && (
                        <>
                          {(main || sub) && <span className="cat-sep">›</span>}
                          <span className="cat supplier">{catSupplier}</span>
                        </>
                      )}
                      {p.categories?.length > 0 && hasNoParentCategory(p) && (
                        <span className="cat-no-parent-tag">No parent</span>
                      )}
                      {!p.categories?.length && (
                        <span className="cat-no-parent-tag">No supplier category</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    {new Date(p.created_at).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </td>
                  <td>
                    <div className="actions">
                      <Tip content="View">
                        <button
                          className="btn-view"
                          aria-label={`View ${p.name}`}
                          onClick={() =>
                            openProduct(p.id, `/products/${p.id}`, {
                              product: p,
                            })
                          }
                        >
                          <Eye size={14} />
                        </button>
                      </Tip>

                      <Tip content="Edit">
                        <button
                          className="btn-edit"
                          aria-label={`Edit ${p.name}`}
                          onClick={() =>
                            openProduct(
                              p.id,
                              isManual
                                ? `/products/${p.id}/edit-manual`
                                : `/products/${p.id}/edit`,
                            )
                          }
                        >
                          <Pencil size={14} />
                        </button>
                      </Tip>

                      {/* Duplicate — manual products only */}
                      {isManual && (
                        <Tip content="Duplicate">
                          <button
                            className="btn-duplicate"
                            aria-label={`Duplicate ${p.name}`}
                            onClick={() =>
                              openProduct(p.id, `/products/${p.id}/duplicate`)
                            }
                          >
                            <Copy size={14} />
                          </button>
                        </Tip>
                      )}

                      <Tip content="Delete">
                        <button
                          className="btn-delete"
                          aria-label={`Delete ${p.name}`}
                          onClick={() => handleDelete(p)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </Tip>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!tableLoading && visibleProducts.length === 0 && (
          <div className="no-data">
            <Package size={32} style={{ marginBottom: 12, opacity: 0.2 }} />
            <p>
              {noParentCheckedHereOnly
                ? "No products without a parent category on this page"
                : activeFilterCount > 0
                  ? "No products match the selected filters"
                  : "No products found matching your criteria"}
            </p>
          </div>
        )}
      </div>

      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(1)}>
          <ChevronsLeft size={16} />
        </button>
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft size={16} />
        </button>
        {[...Array(totalPages)]
          .map((_, i) => i + 1)
          .filter((p) => p >= page - 2 && p <= page + 2)
          .map((p) => (
            <button
              key={p}
              className={p === page ? "active" : ""}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight size={16} />
        </button>
        <button
          disabled={page === totalPages}
          onClick={() => setPage(totalPages)}
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default ProductsPage;