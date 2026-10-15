/** @format */

import { useEffect, useState, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  DownloadCloud,
  CheckCircle2,
  Loader2,
  Eye,
  Database,
  Globe,
  Info,
} from "lucide-react";
import { message, Spin, Select, Modal, Tooltip } from "antd";
import { useNavigate } from "react-router-dom";
import {
  SearchSageCatalogProductsAPI,
  GetAllCategoriesAPI,
  ImportSelectedSageProductsAPI,
} from "@/services/Api/SageApi";
import { GetAllProductsAdminAPI } from "@/services/Api/ProductApi";
import "./SageCatalog.scss";

type Scope = "stored" | "live";

// Unified shape the table renders, regardless of which source it came
// from — our own stored SAGE products, or SAGE's live search results.
interface CatalogRow {
  key: string;
  prodEId: string;
  name: string;
  sageId: string;
  category: string;
  imported: boolean;
  importedProductId: number | null;
}

interface SageCategoryOption {
  id: number;
  title: string;
}

const LIMIT = 50;

const mapStoredToRow = (p: any): CatalogRow => ({
  key: `stored-${p.id}`,
  prodEId: p.external_style_id || "",
  name: p.name || p.external_style_name || "Untitled",
  sageId: p.external_style_id || "-",
  category: p.categories?.[0]?.title || "-",
  imported: true,
  importedProductId: p.id,
});

const mapLiveToRow = (p: any): CatalogRow => ({
  key: `live-${p.prodEId}`,
  prodEId: String(p.prodEId),
  name: p.prName || p.name || p.prodName || p.itemName || "Untitled",
  sageId: String(p.prodEId),
  category: p.category || "-",
  imported: !!p.imported,
  importedProductId: p.importedProductId ?? null,
});

const SageCatalogPage = () => {
  const navigate = useNavigate();

  // ── Explicit scope toggle. This used to switch silently based on
  // whether the search box had text in it, which is exactly what made
  // "672 stored" and "1,000 live results" feel like a bug — they're two
  // different universes (your catalog vs. SAGE's entire feed) and the
  // person needs to choose which one they're looking at up front. ─────
  const [scope, setScope] = useState<Scope>("stored");

  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [keywords, setKeywords] = useState("");
  const [debouncedKeywords, setDebouncedKeywords] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<SageCategoryOption[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkImporting, setBulkImporting] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);

  const requestIdRef = useRef(0);

  // Live scope needs a keyword or category — SAGE's own search API can't
  // list "everything," it errors without at least one of those.
  const liveHasCriteria = !!(debouncedKeywords.trim() || category);

  const switchScope = (next: Scope) => {
    setScope(next);
    setPage(1);
    setSelectedIds(new Set());
    if (next === "stored") setCategory(undefined); // category filtering
    // isn't wired against stored data — clear it so it can't silently
    // do nothing.
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeywords(keywords);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [keywords]);

  const loadCategories = async () => {
    try {
      const res = await GetAllCategoriesAPI();
      const list = res?.data?.data?.rows || res?.data?.data || [];
      setCategories(list.map((c: any) => ({ id: c.id, title: c.title })));
    } catch {
      // Non-critical — the category filter just won't populate.
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const load = async () => {
    const thisRequestId = ++requestIdRef.current;
    setLoading(true);
    try {
      if (scope === "stored") {
        // Searches your own catalog only — GetAllProductsAdminAPI's
        // `search` param already matches name/description/style id, so
        // this stays a true subset of your 672 (or whatever the current
        // total is), never SAGE's full feed.
        const res = await GetAllProductsAdminAPI({
          page,
          limit: LIMIT,
          source: "SAGE",
          search: debouncedKeywords || undefined,
        } as any);
        if (thisRequestId !== requestIdRef.current) return;

        const payload = res.data.data;
        setRows((payload.data || []).map(mapStoredToRow));
        setTotalPages(payload.totalPages || 1);
        setTotalItems(payload.total ?? payload.data?.length ?? 0);
      } else {
        if (!liveHasCriteria) {
          // Don't call SAGE with nothing to search — show guidance instead.
          setRows([]);
          setTotalPages(1);
          setTotalItems(0);
          return;
        }
        const res = await SearchSageCatalogProductsAPI({
          page,
          maxItems: LIMIT,
          keywords: debouncedKeywords || undefined,
          category,
        });
        if (thisRequestId !== requestIdRef.current) return;

        const payload = res?.data?.data;
        setRows((payload?.products || []).map(mapLiveToRow));
        setTotalPages(payload?.pagination?.totalPages || 1);
        setTotalItems(payload?.pagination?.total || 0);
      }
      setSelectedIds(new Set());
    } catch (err) {
      if (thisRequestId !== requestIdRef.current) return;
      console.error("Failed to load SAGE catalog", err);
      message.error("Failed to load SAGE catalog");
    } finally {
      if (thisRequestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedKeywords, category, scope]);

  // ── Bulk selection + bulk import (only meaningful in Live scope —
  // everything in Stored scope is already imported). ─────────────────
  const selectableRows = rows.filter((r) => !r.imported);
  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectableRows.every((r) => selectedIds.has(r.prodEId));

  const toggleRowSelected = (prodEId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(prodEId)) next.delete(prodEId);
      else next.add(prodEId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      allSelectableSelected
        ? new Set()
        : new Set(selectableRows.map((r) => r.prodEId)),
    );
  };

  const handleBulkImport = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    Modal.confirm({
      title: `Import ${ids.length} product${ids.length === 1 ? "" : "s"}?`,
      content:
        "This pulls each product's full data from SAGE and saves it to your catalog. It may take a moment for larger selections.",
      okText: "Import",
      onOk: async () => {
        setBulkImporting(true);
        try {
          const res = await ImportSelectedSageProductsAPI(
            ids.map(Number),
            `Bulk import from Live Catalog (${ids.length} items)`,
          );
          const data = res?.data?.data;
          if (data?.failed > 0) {
            message.warning(
              `Imported ${data.success} of ${data.total} — ${data.failed} failed`,
            );
          } else {
            message.success(`Imported ${data?.success ?? ids.length} products`);
          }
          setSelectedIds(new Set());
          load();
        } catch (err) {
          console.error(err);
          message.error("Bulk import failed");
        } finally {
          setBulkImporting(false);
        }
      },
    });
  };

  return (
    <div className="sage-catalog-root">
      <div className="sage-catalog-header">
        <div className="left">
          <h1>SAGE Live Catalog</h1>
          <p>
            Browse and import products from SAGE's supplier feed, and see
            what's already in your catalog.
          </p>
        </div>
      </div>

      {/* SCOPE TOGGLE — the fix for "672 vs 1,000 is confusing." Picking
          a scope is now an explicit action, not something that silently
          happens because you typed in the search box. */}
      <div className="sage-catalog-scope-row">
        <div className="sage-catalog-scope-toggle">
          <button
            className={`sage-scope-btn ${scope === "stored" ? "active" : ""}`}
            onClick={() => switchScope("stored")}
          >
            <Database size={14} />
            <span>My Stored Products</span>
          </button>
          <button
            className={`sage-scope-btn ${scope === "live" ? "active" : ""}`}
            onClick={() => switchScope("live")}
          >
            <Globe size={14} />
            <span>SAGE Live Catalog</span>
          </button>
        </div>

        <button
          className="sage-catalog-howto-trigger"
          onClick={() => setHowToOpen((v) => !v)}
        >
          <Info size={13} />
          What's the difference?
        </button>
      </div>

      {howToOpen && (
        <div className="sage-catalog-howto">
          <div className="sage-catalog-howto-row">
            <Database size={15} className="sage-catalog-howto-icon" />
            <div>
              <strong>My Stored Products</strong>
              <p>
                Only products you've already imported into your catalog —
                the exact same count you'd see filtering the main Products
                page to SAGE. Searching here searches your own data, so the
                result count is always a subset of what you actually have.
              </p>
            </div>
          </div>
          <div className="sage-catalog-howto-row">
            <Globe size={15} className="sage-catalog-howto-icon" />
            <div>
              <strong>SAGE Live Catalog</strong>
              <p>
                SAGE's entire supplier feed — tens of thousands of products,
                most of which you haven't imported yet. Use this to find and
                bring in new products. Because it's a completely different,
                much larger data set, its result counts have no relationship
                to your stored total.
              </p>
            </div>
          </div>
          <p className="sage-catalog-howto-why">
            We split these into two explicit modes instead of one search box
            that silently switched between them — that's what caused "672"
            and "1,000" to show up for what looked like the same search.
          </p>
        </div>
      )}

      <div className="sage-catalog-filters">
        <div className="search-box">
          <Search size={16} />
          <input
            placeholder={
              scope === "stored"
                ? "Search your stored SAGE products..."
                : "Search SAGE's live feed by keyword..."
            }
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </div>

        {scope === "live" ? (
          <Select
            showSearch
            placeholder="All categories"
            allowClear
            style={{ width: 260 }}
            value={category}
            onChange={(v) => {
              setCategory(v ?? undefined);
              setPage(1);
            }}
            filterOption={(input, option) =>
              (option?.label ?? "")
                .toString()
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            options={categories.map((c) => ({
              label: c.title,
              value: c.title,
            }))}
          />
        ) : (
          <Tooltip title="Category filtering searches SAGE's live taxonomy — switch to SAGE Live Catalog to use it.">
            <Select
              disabled
              placeholder="Category filter (Live only)"
              style={{ width: 260 }}
            />
          </Tooltip>
        )}
      </div>

      <div className="sage-catalog-mode-note">
        {scope === "stored" ? (
          <span className="sage-catalog-mode-note--stored">
            Searching only your stored SAGE products
          </span>
        ) : (
          <span className="sage-catalog-mode-note--live">
            Searching SAGE's entire live feed — includes products you
            haven't imported yet
          </span>
        )}
      </div>

      <div className="sage-catalog-toolbar">
        <div className="sage-catalog-count">
          {loading ? (
            <span className="loading">Loading…</span>
          ) : (
            <span>
              <strong>{totalItems.toLocaleString()}</strong> product
              {totalItems === 1 ? "" : "s"} found
            </span>
          )}
        </div>

        {selectedIds.size > 0 && (
          <button
            className="sage-catalog-bulk-import-btn"
            onClick={handleBulkImport}
            disabled={bulkImporting}
          >
            {bulkImporting ? (
              <Loader2 size={14} className="spin" />
            ) : (
              <DownloadCloud size={14} />
            )}
            {bulkImporting
              ? "Importing…"
              : `Import ${selectedIds.size} selected`}
          </button>
        )}
      </div>

      <div className="sage-catalog-table-wrap">
        {(loading || bulkImporting) && (
          <div className="sage-catalog-loading-overlay">
            <Spin size="large" />
            {bulkImporting && (
              <span className="sage-catalog-loading-text">
                Importing {selectedIds.size} product
                {selectedIds.size === 1 ? "" : "s"} — please wait, this can
                take a moment…
              </span>
            )}
          </div>
        )}

        {scope === "live" && !liveHasCriteria && !loading ? (
          <div className="sage-catalog-empty">
            Type a keyword or pick a category above to search SAGE's live
            feed
          </div>
        ) : (
          <>
            <table className={loading || bulkImporting ? "dimmed" : ""}>
              <thead>
                <tr>
                  <th className="sage-catalog-checkbox-col">
                    {scope === "live" && (
                      <input
                        type="checkbox"
                        checked={allSelectableSelected}
                        disabled={!selectableRows.length}
                        onChange={toggleSelectAll}
                        title="Select all importable rows"
                      />
                    )}
                  </th>
                  <th>Product</th>
                  <th>SAGE ID</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="sage-catalog-checkbox-col">
                      {scope === "live" && !r.imported && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.prodEId)}
                          onChange={() => toggleRowSelected(r.prodEId)}
                        />
                      )}
                    </td>
                    <td>
                      <span className="sage-catalog-name">{r.name}</span>
                    </td>
                    <td className="sage-catalog-mono">{r.sageId}</td>
                    <td>{r.category}</td>
                    <td>
                      {r.imported ? (
                        <span className="sage-catalog-badge sage-catalog-badge--imported">
                          <CheckCircle2 size={12} />
                          Imported
                        </span>
                      ) : (
                        <span className="sage-catalog-badge sage-catalog-badge--not-imported">
                          Not imported
                        </span>
                      )}
                    </td>
                    <td>
                      {/* Single action — the detail page itself has the
                          Import / Open Stored Product button, so there's
                          no need for two competing buttons in the table. */}
                      <button
                        className="sage-catalog-view-btn"
                        onClick={() =>
                          navigate(`/sage-live-catalog/${r.prodEId}`)
                        }
                      >
                        <Eye size={13} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && rows.length === 0 && (
              <div className="sage-catalog-empty">
                {scope === "stored"
                  ? "No stored SAGE products match your search"
                  : "No SAGE products match your search"}
              </div>
            )}
          </>
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

export default SageCatalogPage;