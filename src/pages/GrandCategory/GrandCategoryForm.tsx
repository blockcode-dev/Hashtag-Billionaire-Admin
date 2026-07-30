/** @format */

import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CreateGrandCategoryAPI,
  UpdateGrandCategoryAPI,
  GetGrandCategoryByIdAPI,
  MapGrandCategoryAPI,
} from "@/services/Api/GrandCategoryApi";

import { GetParentCategoriesAPI } from "@/services/Api/ParentCategoryApi";

import "./GrandCategoryForm.scss";
import {
  Save,
  Search,
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Tag,
  Layers,
} from "lucide-react";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

interface Category {
  id: number;
  title: string;
  [key: string]: any;
}

interface Props {
  mode: "create" | "edit";
}

const GrandCategoryForm = ({ mode }: Props) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  // Browse panel state
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected state
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedCategoriesData, setSelectedCategoriesData] = useState<
    Category[]
  >([]);
  const [selectedSearch, setSelectedSearch] = useState("");

  // LOAD PRODUCT CATEGORIES
  const loadParentCategories = useCallback(
    async (pageNum: number, searchTerm: string, size: number) => {
      try {
        setSearchLoading(true);

        const res = await GetParentCategoriesAPI(pageNum, size, searchTerm);

        const responseData = res.data.data;

        setCategories(responseData.data || []);

        const pagination = responseData.pagination;

        setTotalCount(pagination?.total || 0);

        setTotalPages(pagination?.totalPages || 1);
      } finally {
        setSearchLoading(false);
      }
    },
    [],
  );

  // LOAD DETAILS (edit mode)
  const loadDetails = async () => {
    try {
      if (!id) return;
      setLoading(true);
      const res = await GetGrandCategoryByIdAPI(Number(id));
      const data = res.data.data;
      setTitle(data.title || "");
      const parents: Category[] = data.parent_categories || [];
      setSelectedCategories(parents.map((x) => x.id));

      setSelectedCategoriesData(parents);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParentCategories(page, search, pageSize);
  }, [page, search, pageSize, loadParentCategories]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    if (isEdit) {
      loadDetails();
    }
  }, [id]);

  // SELECT / DESELECT CATEGORY
  const handleToggle = (category: Category) => {
    if (selectedCategories.includes(category.id)) {
      removeCategory(category.id);
    } else {
      setSelectedCategories((prev) => [...prev, category.id]);
      setSelectedCategoriesData((prev) => [...prev, category]);
    }
  };

  const removeCategory = (categoryId: number) => {
    setSelectedCategories((prev) => prev.filter((x) => x !== categoryId));
    setSelectedCategoriesData((prev) =>
      prev.filter((x) => x.id !== categoryId),
    );
  };

  // SELECT ALL ON CURRENT PAGE
  const handleSelectPage = () => {
    const newIds = categories
      .filter((c) => !selectedCategories.includes(c.id))
      .map((c) => c.id);
    const newData = categories.filter(
      (c) => !selectedCategories.includes(c.id),
    );
    setSelectedCategories((prev) => [...prev, ...newIds]);
    setSelectedCategoriesData((prev) => [...prev, ...newData]);
  };

  // CLEAR ALL SELECTED
  const handleClearAll = () => {
    setSelectedCategories([]);
    setSelectedCategoriesData([]);
  };

  const handleSubmit = async () => {
    try {
      setError("");
      setLoading(true);
      if (!title.trim()) {
        setError("Grand Category title is required");
        return;
      }

      let grandCategoryId: number = Number(id);

      if (!isEdit) {
        const res = await CreateGrandCategoryAPI({
          title,
        });

        grandCategoryId = res.data.data.id;
      } else {
        await UpdateGrandCategoryAPI(Number(id), { title });
      }

      await MapGrandCategoryAPI({
        grand_category_id: grandCategoryId,
        parent_category_ids: selectedCategories,
      });

      navigate("/grand-category");
    } catch (err: any) {
      console.error(err);

      setError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Filtered selected list for the right panel search
  const filteredSelected = selectedSearch.trim()
    ? selectedCategoriesData.filter((c) =>
        c.title.toLowerCase().includes(selectedSearch.toLowerCase()),
      )
    : selectedCategoriesData;

  const allOnPageSelected =
    categories.length > 0 &&
    categories.every((c) => selectedCategories.includes(c.id));

  return (
    <div className="gcf">
      {/* HEADER */}
      <div className="gcf__header">
        <div className="gcf__header-left">
          <button
            className="gcf__btn-back"
            onClick={() => navigate("/grand-category")}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1>{isEdit ? "Edit Grand Category" : "Add Grand Category"}</h1>
            <p>Manage website category hierarchy</p>
          </div>
        </div>

        <button
          className="gcf__btn-save"
          onClick={handleSubmit}
          disabled={loading}
        >
          <Save size={16} />
          {loading ? "Saving..." : "Save Category"}
        </button>
      </div>

      {/* TITLE FIELD */}
      {/* TITLE FIELD */}
      <div className="gcf__title-card">
        <label>Grand Category Title</label>

        <input
          type="text"
          placeholder="Enter grand category title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* ERROR */}

      {error && <div className="gcf__error">{error}</div>}

      {/* SPLIT PANEL */}
      <div className="gcf__panels">
        {/* ── LEFT: BROWSE PANEL ── */}
        <div className="gcf__panel gcf__panel--browse">
          <div className="gcf__panel-header">
            <div className="gcf__panel-title">
              <Layers size={16} />
              <span>All  Categories</span>
              {totalCount > 0 && (
                <span className="gcf__badge">
                  {totalCount.toLocaleString()}
                </span>
              )}
            </div>

            {!allOnPageSelected && categories.length > 0 && (
              <button className="gcf__link-btn" onClick={handleSelectPage}>
                Select page
              </button>
            )}
          </div>

          {/* Search */}
          <div className="gcf__search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search all categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="gcf__search-clear"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* List */}
          <div className="gcf__list">
            {searchLoading ? (
              <div className="gcf__list-empty">
                <div className="gcf__spinner" />
                <span>Loading categories...</span>
              </div>
            ) : categories.length === 0 ? (
              <div className="gcf__list-empty">
                <Search size={28} />
                <span>No categories found</span>
              </div>
            ) : (
              categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <div
                    key={cat.id}
                    className={`gcf__list-item ${isSelected ? "gcf__list-item--selected" : ""}`}
                    onClick={() => handleToggle(cat)}
                  >
                    <div
                      className={`gcf__checkbox ${isSelected ? "gcf__checkbox--checked" : ""}`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className="gcf__list-item-title">{cat.title}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div className="gcf__pagination">
            {/* Per-page selector — always visible */}
            <div className="gcf__per-page">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="gcf__per-page-select"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>per page</span>
            </div>

            <div className="gcf__page-controls">
              <button
                className="gcf__page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={15} />
              </button>

              <div className="gcf__page-numbers">
                {page > 3 && (
                  <>
                    <button
                      className="gcf__page-num"
                      onClick={() => setPage(1)}
                    >
                      1
                    </button>
                    {page > 4 && <span className="gcf__page-ellipsis">…</span>}
                  </>
                )}

                {Array.from(
                  { length: Math.max(totalPages, page) },
                  (_, i) => i + 1,
                )
                  .filter((p) => p >= page - 1 && p <= page + 1)
                  .map((p) => (
                    <button
                      key={p}
                      className={`gcf__page-num ${p === page ? "gcf__page-num--active" : ""}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}

                {totalPages > 1 && page < totalPages - 2 && (
                  <>
                    {page < totalPages - 3 && (
                      <span className="gcf__page-ellipsis">…</span>
                    )}
                    <button
                      className="gcf__page-num"
                      onClick={() => setPage(totalPages)}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <button
                className="gcf__page-btn"
                onClick={() => setPage((p) => p + 1)}
                disabled={totalPages > 1 && page === totalPages}
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {totalCount > 0 && (
              <span className="gcf__page-info">
                {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, totalCount)} of{" "}
                {totalCount.toLocaleString()}
              </span>
            )}

            <div className="gcf__goto">
              <span>Go to page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                className="gcf__goto-input"
                placeholder="—"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = Number((e.target as HTMLInputElement).value);
                    if (val >= 1 && val <= totalPages) {
                      setPage(val);
                      (e.target as HTMLInputElement).value = "";
                      (e.target as HTMLInputElement).blur();
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* ── RIGHT: SELECTED PANEL ── */}
        <div className="gcf__panel gcf__panel--selected">
          <div className="gcf__panel-header">
            <div className="gcf__panel-title">
              <Tag size={16} />
              <span>Selected</span>
              {selectedCategories.length > 0 && (
                <span className="gcf__badge gcf__badge--accent">
                  {selectedCategories.length}
                </span>
              )}
            </div>

            {selectedCategories.length > 0 && (
              <button
                className="gcf__link-btn gcf__link-btn--danger"
                onClick={handleClearAll}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Selected search */}
          {selectedCategoriesData.length > 5 && (
            <div className="gcf__search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Filter selected..."
                value={selectedSearch}
                onChange={(e) => setSelectedSearch(e.target.value)}
              />
              {selectedSearch && (
                <button
                  className="gcf__search-clear"
                  onClick={() => setSelectedSearch("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Selected list */}
          <div className="gcf__selected-list">
            {selectedCategoriesData.length === 0 ? (
              <div className="gcf__selected-empty">
                <Tag size={28} />
                <span>No categories selected yet</span>
                <p>Click categories on the left to add them here</p>
              </div>
            ) : filteredSelected.length === 0 ? (
              <div className="gcf__selected-empty">
                <Search size={28} />
                <span>No matches</span>
              </div>
            ) : (
              filteredSelected.map((cat) => (
                <div key={cat.id} className="gcf__selected-item">
                  <div className="gcf__selected-dot" />
                  <span className="gcf__selected-item-title">{cat.title}</span>
                  <button
                    className="gcf__remove-btn"
                    onClick={() => removeCategory(cat.id)}
                    title="Remove"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {selectedSearch && filteredSelected.length > 0 && (
            <div className="gcf__selected-count">
              Showing {filteredSelected.length} of{" "}
              {selectedCategoriesData.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GrandCategoryForm;
