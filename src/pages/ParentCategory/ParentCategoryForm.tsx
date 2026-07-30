/** @format */

import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CreateParentCategoryAPI,
  UpdateParentCategoryAPI,
  GetParentCategoryByIdAPI,
  GetProductCategoriesAPI,
  MapParentCategoryAPI,
} from "@/services/Api/ParentCategoryApi";
import axios from "axios";
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
import "./ParentCategoryForm.scss";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

interface Category {
  id: number;
  title: string;
  [key: string]: any;
}

interface Props {
  mode: "create" | "edit";
}

const ParentCategoryForm = ({ mode }: Props) => {
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

  const [supplier, setSupplier] = useState("ALL");

  // Selected state
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedCategoriesData, setSelectedCategoriesData] = useState<
    Category[]
  >([]);
  const [selectedSearch, setSelectedSearch] = useState("");

  // LOAD PRODUCT CATEGORIES
  const loadCategories = useCallback(
    async (
      pageNum: number,
      searchTerm: string,
      size: number,
      supplierValue: string,
    ) => {
      try {
        setSearchLoading(true);
        const res = await GetProductCategoriesAPI(
          pageNum,
          size,
          searchTerm,
          supplierValue,
        );
        const responseData = res.data.data;
        setCategories(responseData.data || []);
        const pagination = responseData.pagination;
        const total = pagination?.total || 0;
        const apiTotalPages = pagination?.totalPages || Math.ceil(total / size);
        setTotalCount(total);
        setTotalPages(Math.max(1, apiTotalPages));
      } catch (err) {
        console.error(err);
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
      const res = await GetParentCategoryByIdAPI(Number(id));
      const data = res.data.data;
      setTitle(data.title || "");
      const cats: Category[] = data.categories || [];
      setSelectedCategories(cats.map((x) => x.id));
      setSelectedCategoriesData(cats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories(page, search, pageSize, supplier);
  }, [page, search, pageSize, supplier]);
  // Reset to page 1 when search or pageSize changes
  useEffect(() => {
    setPage(1);
  }, [search, pageSize, supplier]);

  useEffect(() => {
    if (isEdit) loadDetails();
  }, []);

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

  // SUBMIT
  const handleSubmit = async () => {
    try {
      setError("");

      setLoading(true);
      let parentCategoryId: any = id;

      if (!isEdit) {
        const res = await CreateParentCategoryAPI({ title });
        parentCategoryId = res.data.data.id;
      } else {
        await UpdateParentCategoryAPI(Number(id), { title });
      }

      await MapParentCategoryAPI({
        parent_category_id: parentCategoryId,
        product_category_ids: selectedCategories,
      });

      console.log("selectedCategories", selectedCategories);
console.log("selectedCategoriesData", selectedCategoriesData);

      navigate("/parent-category");
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
    <div className="pcf">
      {/* HEADER */}
      <div className="pcf__header">
        <div className="pcf__header-left">
          <button
            className="pcf__btn-back"
            onClick={() => navigate("/parent-category")}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1>{isEdit ? "Edit Parent Category" : "Add Parent Category"}</h1>
            <p>Manage website category hierarchy</p>
          </div>
        </div>

        <button
          className="pcf__btn-save"
          onClick={handleSubmit}
          disabled={loading}
        >
          <Save size={16} />
          {loading ? "Saving..." : "Save Category"}
        </button>
      </div>

      {/* TITLE FIELD */}
      {/* TITLE FIELD */}
      <div className="pcf__title-card">
        <label>Parent Category Title</label>

        <input
          type="text"
          placeholder="Enter parent category title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* ERROR */}

      {error && <div className="pcf__error">{error}</div>}

      {/* SPLIT PANEL */}
      <div className="pcf__panels">
        {/* ── LEFT: BROWSE PANEL ── */}
        <div className="pcf__panel pcf__panel--browse">
          <div className="pcf__panel-header">
            <div className="pcf__panel-title">
              <Layers size={16} />
              <span>All Categories</span>
              {totalCount > 0 && (
                <span className="pcf__badge">
                  {totalCount.toLocaleString()}
                </span>
              )}
            </div>

            {!allOnPageSelected && categories.length > 0 && (
              <button className="pcf__link-btn" onClick={handleSelectPage}>
                Select page
              </button>
            )}
          </div>

          {/* Search */}
          <div className="pcf__search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search all categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="pcf__search-clear"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="pcf__supplier-tabs">
            {[
              { value: "ALL", label: "All" },
              { value: "SANMAR", label: "Sanmar" },
              { value: "SS", label: "SS Activewear" },
              { value: "SAGE", label: "Sage" },
              { value: "OTTOCAP", label: "Otto Cap" },
            ].map((s) => (
              <button
                key={s.value}
                className={`pcf__supplier-tab ${supplier === s.value ? "pcf__supplier-tab--active" : ""}`}
                onClick={() => setSupplier(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="pcf__list">
            {searchLoading ? (
              <div className="pcf__list-empty">
                <div className="pcf__spinner" />
                <span>Loading categories...</span>
              </div>
            ) : categories.length === 0 ? (
              <div className="pcf__list-empty">
                <Search size={28} />
                <span>No categories found</span>
              </div>
            ) : (
              categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <div
                    key={cat.id}
                    className={`pcf__list-item ${isSelected ? "pcf__list-item--selected" : ""}`}
                    onClick={() => handleToggle(cat)}
                  >
                    <div
                      className={`pcf__checkbox ${isSelected ? "pcf__checkbox--checked" : ""}`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className="pcf__list-item-title">{cat.title}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div className="pcf__pagination">
            {/* Per-page selector — always visible */}
            <div className="pcf__per-page">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="pcf__per-page-select"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>per page</span>
            </div>

            <div className="pcf__page-controls">
              <button
                className="pcf__page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={15} />
              </button>

              <div className="pcf__page-numbers">
                {page > 3 && (
                  <>
                    <button
                      className="pcf__page-num"
                      onClick={() => setPage(1)}
                    >
                      1
                    </button>
                    {page > 4 && <span className="pcf__page-ellipsis">…</span>}
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
                      className={`pcf__page-num ${p === page ? "pcf__page-num--active" : ""}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}

                {totalPages > 1 && page < totalPages - 2 && (
                  <>
                    {page < totalPages - 3 && (
                      <span className="pcf__page-ellipsis">…</span>
                    )}
                    <button
                      className="pcf__page-num"
                      onClick={() => setPage(totalPages)}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <button
                className="pcf__page-btn"
                onClick={() => setPage((p) => p + 1)}
                disabled={totalPages > 1 && page === totalPages}
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {totalCount > 0 && (
              <span className="pcf__page-info">
                {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, totalCount)} of{" "}
                {totalCount.toLocaleString()}
              </span>
            )}

            <div className="pcf__goto">
              <span>Go to page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                className="pcf__goto-input"
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
        <div className="pcf__panel pcf__panel--selected">
          <div className="pcf__panel-header">
            <div className="pcf__panel-title">
              <Tag size={16} />
              <span>Selected</span>
              {selectedCategories.length > 0 && (
                <span className="pcf__badge pcf__badge--accent">
                  {selectedCategories.length}
                </span>
              )}
            </div>

            {selectedCategories.length > 0 && (
              <button
                className="pcf__link-btn pcf__link-btn--danger"
                onClick={handleClearAll}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Selected search */}
          {selectedCategoriesData.length > 5 && (
            <div className="pcf__search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Filter selected..."
                value={selectedSearch}
                onChange={(e) => setSelectedSearch(e.target.value)}
              />
              {selectedSearch && (
                <button
                  className="pcf__search-clear"
                  onClick={() => setSelectedSearch("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Selected list */}
          <div className="pcf__selected-list">
            {selectedCategoriesData.length === 0 ? (
              <div className="pcf__selected-empty">
                <Tag size={28} />
                <span>No categories selected yet</span>
                <p>Click categories on the left to add them here</p>
              </div>
            ) : filteredSelected.length === 0 ? (
              <div className="pcf__selected-empty">
                <Search size={28} />
                <span>No matches</span>
              </div>
            ) : (
              filteredSelected.map((cat) => (
                <div key={cat.id} className="pcf__selected-item">
                  <div className="pcf__selected-dot" />
                  <span className="pcf__selected-item-title">{cat.title}</span>
                  <button
                    className="pcf__remove-btn"
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
            <div className="pcf__selected-count">
              Showing {filteredSelected.length} of{" "}
              {selectedCategoriesData.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParentCategoryForm;
