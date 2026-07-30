/** @format */

import { Fragment, useEffect, useMemo, useState } from "react";
import { Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";

import {
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  X,
  Tags,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Eye,
} from "lucide-react";
import {
  CreateUseCaseAPI,
  DeleteUseCaseAPI,
  GetUseCasesAPI,
  UpdateUseCaseAPI,
  UpdateUseCaseParentCategoriesAPI,
  GetIndustriesAPI,
} from "@/services/Api/IndustryApi";
import { GetParentCategoriesAPI } from "@/services/Api/ParentCategoryApi";
import "./UseCaseList.scss";

const IMAGE_BASE_URL = "https://node.hashtagbillionaire.com";

const getImageUrl = (path: string | null | undefined) => {
  if (!path) return null;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${IMAGE_BASE_URL}${path}`;
};

interface IndustryRef {
  id: number;
  title: string;
}

interface ParentCategory {
  id: number;
  title: string;
  slug?: string;
}

interface UseCase {
  id: number;
  industry_id: number;
  title: string;
  slug: string;
  description: string;
  image: string | null;
  industry: IndustryRef | null;
  parent_categories: ParentCategory[];
}

interface IndustryOption {
  id: number;
  title: string;
  sort_order: number;
}

const CATEGORIES_PREVIEW = 4;

const CategoryTags = ({ categories }: { categories: ParentCategory[] }) => {
  const [expanded, setExpanded] = useState(false);

  if (!categories?.length) {
    return <span className="uc__none">No categories</span>;
  }

  const visible = expanded ? categories : categories.slice(0, CATEGORIES_PREVIEW);

  const remaining = categories.length - CATEGORIES_PREVIEW;

  return (
    <div className="uc__tags-wrap">
      <div className="uc__tags">
        {visible.map((cat) => (
          <span key={cat.id} className="uc__tag">
            {cat.title}
          </span>
        ))}

        {!expanded && remaining > 0 && (
          <button className="uc__tag-more" onClick={() => setExpanded(true)}>
            +{remaining} more
            <ChevronDown size={12} />
          </button>
        )}
      </div>

      {expanded && remaining > 0 && (
        <button className="uc__tag-collapse" onClick={() => setExpanded(false)}>
          <ChevronUp size={13} />
          Show less
        </button>
      )}
    </div>
  );
};

const UseCaseList = () => {
  const [useCases, setUseCases] = useState<UseCase[]>([]);

  const [industries, setIndustries] = useState<IndustryOption[]>([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UseCase | null>(null);

  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Add / Edit modal state ────────────────────────────
  const [formOpen, setFormOpen] = useState(false);

  const [editTarget, setEditTarget] = useState<UseCase | null>(null);

  const [formTitle, setFormTitle] = useState("");

  const [formDescription, setFormDescription] = useState("");

  const [formIndustryId, setFormIndustryId] = useState<string>("");

  const [formError, setFormError] = useState("");

  const [formLoading, setFormLoading] = useState(false);

  const [fileList, setFileList] = useState<any[]>([]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = ({ fileList }: any) => {
    setFileList(fileList);

    if (fileList.length && fileList[0].originFileObj) {
      setPreviewUrl(URL.createObjectURL(fileList[0].originFileObj));
    } else if (!fileList.length) {
      setPreviewUrl(null);
    }
  };

  // ── Manage Categories modal state ──────────────────────
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const [categoryTarget, setCategoryTarget] = useState<UseCase | null>(null);

  const [allCategories, setAllCategories] = useState<ParentCategory[]>([]);

  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(
    new Set()
  );

  const [categorySearch, setCategorySearch] = useState("");

  const [categoryModalLoading, setCategoryModalLoading] = useState(false);

  const [categorySaving, setCategorySaving] = useState(false);

  // ── Image lightbox state ──────────────────────────────
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const openLightbox = (src: string | null | undefined) => {
    if (!src) return;
    setLightboxSrc(src);
  };

  const closeLightbox = () => setLightboxSrc(null);

  useEffect(() => {
    if (!lightboxSrc) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxSrc]);

  const load = async () => {
    try {
      setLoading(true);

      const res = await GetUseCasesAPI(1, 100, search);

      setUseCases(res.data.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadIndustries = async () => {
    try {
      const res = await GetIndustriesAPI(1, 100, "");

      const list = res.data.data.data || [];

      setIndustries(
        list.map((i: any) => ({
          id: i.id,
          title: i.title,
          sort_order: i.sort_order ?? 0,
        }))
      );
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadIndustries();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);

      await DeleteUseCaseAPI(deleteTarget.id);

      setUseCases((prev) => prev.filter((x) => x.id !== deleteTarget.id));

      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Add / Edit handlers ────────────────────────────────
  const openAddModal = () => {
    setEditTarget(null);
    setFormTitle("");
    setFormDescription("");
    setFormIndustryId("");
    setFileList([]);
    setPreviewUrl(null);
    setFormError("");
    setFormOpen(true);
  };

  const openEditModal = (item: UseCase) => {
    setEditTarget(item);
    setFormTitle(item.title);
    setFormDescription(item.description || "");
    setFormIndustryId(String(item.industry_id ?? item.industry?.id ?? ""));
    setFileList([]);
    setPreviewUrl(getImageUrl(item.image));
    setFormError("");
    setFormOpen(true);
  };

  const closeFormModal = () => {
    if (formLoading) return;

    setFormOpen(false);
    setEditTarget(null);
    setFormTitle("");
    setFormDescription("");
    setFormIndustryId("");
    setFileList([]);
    setPreviewUrl(null);
    setFormError("");
  };

  const handleFormSubmit = async () => {
    if (!formTitle.trim()) {
      setFormError("Title is required");
      return;
    }

    if (!formIndustryId) {
      setFormError("Please select an industry");
      return;
    }

    const title = formTitle.trim();
    const description = formDescription.trim();
    const industryId = Number(formIndustryId);

    const formData = new FormData();

    formData.append("industry_id", String(industryId));
    formData.append("title", title);
    formData.append("description", description);

    if (fileList.length && fileList[0].originFileObj) {
      formData.append("images", fileList[0].originFileObj);
    }

    try {
      setFormLoading(true);

      if (editTarget) {
        const res = await UpdateUseCaseAPI(editTarget.id, formData);

        const updated = res.data?.data;

        const industryMeta = industries.find((i) => i.id === industryId);

        setUseCases((prev) =>
          prev.map((x) =>
            x.id === editTarget.id
              ? {
                  ...x,
                  title: updated?.title ?? title,
                  description: updated?.description ?? description,
                  industry_id: industryId,
                  industry: updated?.industry ?? industryMeta ?? x.industry,
                  image: updated?.image ?? x.image,
                }
              : x
          )
        );
      } else {
        const res = await CreateUseCaseAPI(formData);

        const created = res.data?.data;

        const industryMeta = industries.find((i) => i.id === industryId);

        setUseCases((prev) => [
          {
            id: created?.id,
            industry_id: industryId,
            title: created?.title ?? title,
            slug: created?.slug ?? "",
            description: created?.description ?? description,
            image: created?.image ?? null,
            industry: created?.industry ?? industryMeta ?? null,
            parent_categories: created?.parent_categories ?? [],
          },
          ...prev,
        ]);
      }

      closeFormModal();
    } catch (err) {
      console.error(err);
      setFormError("Something went wrong. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  // ── Manage Categories handlers ──────────────────────────
  // The use case row already carries its parent_categories (from
  // GetUseCasesAPI), so no per-use-case fetch is needed here — only
  // the master category list is fetched, and only once, ever.
  const openCategoryModal = async (item: UseCase) => {
    setCategoryTarget(item);
    setCategorySearch("");
    setCategoryModalOpen(true);

    setSelectedCategoryIds(
      new Set((item.parent_categories || []).map((c) => c.id))
    );

    if (categoriesLoaded) return;

    setCategoryModalLoading(true);

    try {
      const res = await GetParentCategoriesAPI(1, 100, "");

      const catList = res.data?.data?.data || res.data?.data || [];

      setAllCategories(
        catList.map((c: any) => ({ id: c.id, title: c.title }))
      );

      setCategoriesLoaded(true);
    } catch (err) {
      console.error(err);
    } finally {
      setCategoryModalLoading(false);
    }
  };

  const closeCategoryModal = () => {
    if (categorySaving) return;

    setCategoryModalOpen(false);
    setCategoryTarget(null);
    setSelectedCategoryIds(new Set());
    setCategorySearch("");
  };

  const toggleCategory = (id: number) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const handleCategorySave = async () => {
    if (!categoryTarget) return;

    try {
      setCategorySaving(true);

      const body = {
        parent_category_ids: Array.from(selectedCategoryIds),
      };

      await UpdateUseCaseParentCategoriesAPI(categoryTarget.id, body);

      const selectedCategoryObjs = allCategories.filter((c) =>
        selectedCategoryIds.has(c.id)
      );

      setUseCases((prev) =>
        prev.map((x) =>
          x.id === categoryTarget.id
            ? { ...x, parent_categories: selectedCategoryObjs }
            : x
        )
      );

      closeCategoryModal();
    } catch (err) {
      console.error(err);
    } finally {
      setCategorySaving(false);
    }
  };

  const filteredCategories = allCategories.filter((c) =>
    c.title.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Group the flat use-case list by industry, ordered by each industry's
  // own sort_order (ascending — same order as the Industries page), not
  // alphabetically. The backend doesn't group this way (it orders use
  // cases by their own sort_order/created_at), so grouping happens here.
  const groupedUseCases = useMemo(() => {
    const industrySortOrder = new Map<number, number>(
      industries.map((i) => [i.id, i.sort_order])
    );

    const groups = new Map<
      string,
      { industryTitle: string; industrySortOrder: number; items: UseCase[] }
    >();

    useCases.forEach((item) => {
      const industryId = item.industry?.id;

      const key = industryId != null ? String(industryId) : "unassigned";

      if (!groups.has(key)) {
        groups.set(key, {
          industryTitle: item.industry?.title || "Unassigned",
          industrySortOrder:
            industryId != null
              ? industrySortOrder.get(industryId) ?? Number.MAX_SAFE_INTEGER
              : Number.MAX_SAFE_INTEGER,
          items: [],
        });
      }

      groups.get(key)!.items.push(item);
    });

    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      // Keep "Unassigned" pinned to the end regardless of sort_order.
      if (a.industryTitle === "Unassigned") return 1;
      if (b.industryTitle === "Unassigned") return -1;

      if (a.industrySortOrder !== b.industrySortOrder) {
        return a.industrySortOrder - b.industrySortOrder;
      }

      // Tie-break alphabetically if sort_order matches (e.g. both 0).
      return a.industryTitle.localeCompare(b.industryTitle);
    });

    return sortedGroups;
  }, [useCases, industries]);

  return (
    <div className="uc">
      <div className="uc__header">
        <div>
          <h1>Use Cases</h1>

          <p>Manage use cases, their industry, and categories</p>
        </div>

        <div className="uc__header-right">
          <div className="uc__search">
            <Search size={15} />

            <input
              type="text"
              placeholder="Search use cases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {search && (
              <button
                className="uc__search-clear"
                onClick={() => setSearch("")}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button className="uc__btn-add" onClick={openAddModal}>
            <Plus size={16} />
            Add Use Case
          </button>
        </div>
      </div>

      <div className="uc__card">
        <table className="uc__table">
          <thead>
            <tr>
              <th style={{ width: 56 }}>#</th>

              <th style={{ width: 64 }}>Image</th>

              <th style={{ width: 220 }}>Use Case</th>

              <th style={{ width: 260 }}>Description</th>

              <th>Categories</th>

              <th style={{ width: 110, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>
                  <div className="uc__empty">Loading...</div>
                </td>
              </tr>
            )}

            {!loading && useCases.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="uc__empty">No use cases found</div>
                </td>
              </tr>
            )}

            {!loading &&
              (() => {
                let runningIndex = 0;

                return groupedUseCases.map((group) => (
                  <Fragment key={`group-${group.industryTitle}`}>
                    <tr className="uc__group-row">
                      <td colSpan={6}>
                        <div className="uc__group-header">
                          <span className="uc__group-title">
                            {group.industryTitle}
                          </span>

                          <span className="uc__group-count">
                            {group.items.length} use case
                            {group.items.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {group.items.map((item) => {
                      runningIndex += 1;

                      return (
                        <tr key={item.id}>
                          <td>
                            <span className="uc__sr">{runningIndex}</span>
                          </td>

                          <td>
                            {item.image ? (
                              <img
                                src={getImageUrl(item.image) || undefined}
                                alt={item.title}
                                className="uc__thumb uc__thumb--clickable"
                                onClick={() =>
                                  openLightbox(getImageUrl(item.image))
                                }
                              />
                            ) : (
                              <div className="uc__thumb uc__thumb--empty">
                                <ImageOff size={16} />
                              </div>
                            )}
                          </td>

                          <td>
                            <span className="uc__title">{item.title}</span>
                          </td>

                          <td>
                            {item.description ? (
                              <span className="uc__desc">
                                {item.description}
                              </span>
                            ) : (
                              <span className="uc__none">
                                No description available
                              </span>
                            )}
                          </td>

                          <td>
                            <CategoryTags
                              categories={item.parent_categories || []}
                            />
                          </td>

                          <td>
                            <div className="uc__actions">
                              <button
                                className="uc__btn-categories"
                                onClick={() => openCategoryModal(item)}
                                title="Manage categories"
                              >
                                <Tags size={14} />
                              </button>

                              <button
                                className="uc__btn-edit"
                                onClick={() => openEditModal(item)}
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                className="uc__btn-delete"
                                onClick={() => setDeleteTarget(item)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ));
              })()}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit Modal ───────────────────────────── */}
      {formOpen && (
        <div className="uc__overlay" onClick={closeFormModal}>
          <div
            className="uc__modal uc__modal--form"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="uc__modal-close"
              onClick={closeFormModal}
              disabled={formLoading}
            >
              <X size={16} />
            </button>

            <h2>{editTarget ? "Edit Use Case" : "Add Use Case"}</h2>

            <p className="uc__modal-subtitle">
              {editTarget
                ? "Update the use case details below."
                : "Fill in the details to create a new use case."}
            </p>

            <div className="uc__form-field">
              <label>
                Title <span className="uc__required">*</span>
              </label>

              <input
                type="text"
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                  if (formError) setFormError("");
                }}
                placeholder="e.g. Employee Onboarding Kits"
                autoFocus
              />
            </div>

            <div className="uc__form-field">
              <label>
                Industry <span className="uc__required">*</span>
              </label>

              <select
                value={formIndustryId}
                onChange={(e) => {
                  setFormIndustryId(e.target.value);
                  if (formError) setFormError("");
                }}
              >
                <option value="">Select an industry</option>

                {industries.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="uc__form-field">
              <label>
                Description <span className="uc__optional">(optional)</span>
              </label>

              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Briefly describe this use case..."
                rows={3}
              />
            </div>

            <div className="uc__form-field">
              <label>
                Use Case Image <span className="uc__optional">(optional)</span>
              </label>

              <div className="uc__upload">
                <Upload
                  beforeUpload={() => false}
                  maxCount={1}
                  fileList={fileList}
                  onChange={handleFileChange}
                  showUploadList={false}
                  accept=".png,.jpg,.jpeg,.svg"
                >
                  {previewUrl ? (
                    <div className="uc__upload-preview">
                      <img src={previewUrl} alt="Use case" />

                      <button
                        type="button"
                        className="uc__upload-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openLightbox(previewUrl);
                        }}
                        title="View full size"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="uc__upload-placeholder">
                      <UploadOutlined style={{ fontSize: 18 }} />
                      <span>Upload Image</span>
                    </div>
                  )}
                </Upload>

                <div className="uc__upload-meta">
                  <div className="uc__upload-name">
                    {previewUrl
                      ? fileList[0]?.name || "Image selected"
                      : "Upload use case image"}
                  </div>

                  <div className="uc__upload-hint">
                    PNG, JPG, JPEG or SVG
                    <br />
                    Max 5 MB
                  </div>

                  {previewUrl && (
                    <button
                      type="button"
                      className="uc__remove-image"
                      onClick={() => {
                        setFileList([]);
                        setPreviewUrl(null);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {formError && <div className="uc__form-error">{formError}</div>}

            <div className="uc__modal-actions">
              <button
                className="uc__modal-cancel"
                onClick={closeFormModal}
                disabled={formLoading}
              >
                Cancel
              </button>

              <button
                className="uc__modal-confirm uc__modal-confirm--primary"
                onClick={handleFormSubmit}
                disabled={formLoading}
              >
                {formLoading
                  ? "Saving..."
                  : editTarget
                  ? "Save Changes"
                  : "Create Use Case"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Categories Modal ─────────────────────── */}
      {categoryModalOpen && (
        <div className="uc__overlay" onClick={closeCategoryModal}>
          <div
            className="uc__modal uc__modal--categories"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="uc__modal-close"
              onClick={closeCategoryModal}
              disabled={categorySaving}
            >
              <X size={16} />
            </button>

            <h2>Manage Categories</h2>

            <p className="uc__modal-subtitle">
              Assign parent categories to{" "}
              <strong>"{categoryTarget?.title}"</strong>.
            </p>

            <div className="uc__cat-search">
              <Search size={14} />

              <input
                type="text"
                placeholder="Search categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
              />
            </div>

            <div className="uc__cat-list">
              {categoryModalLoading && (
                <div className="uc__cat-loading">Loading categories...</div>
              )}

              {!categoryModalLoading && filteredCategories.length === 0 && (
                <div className="uc__cat-loading">No categories found</div>
              )}

              {!categoryModalLoading &&
                filteredCategories.map((cat) => {
                  const checked = selectedCategoryIds.has(cat.id);

                  return (
                    <label key={cat.id} className="uc__cat-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(cat.id)}
                      />

                      <span>{cat.title}</span>
                    </label>
                  );
                })}
            </div>

            <div className="uc__cat-footer">
              <span className="uc__cat-selected-count">
                {selectedCategoryIds.size} selected
              </span>
            </div>

            <div className="uc__modal-actions">
              <button
                className="uc__modal-cancel"
                onClick={closeCategoryModal}
                disabled={categorySaving}
              >
                Cancel
              </button>

              <button
                className="uc__modal-confirm uc__modal-confirm--primary"
                onClick={handleCategorySave}
                disabled={categorySaving || categoryModalLoading}
              >
                {categorySaving ? "Saving..." : "Save Categories"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ───────────────────────────────── */}
      {deleteTarget && (
        <div className="uc__overlay" onClick={() => setDeleteTarget(null)}>
          <div className="uc__modal" onClick={(e) => e.stopPropagation()}>
            <div className="uc__modal-icon">
              <AlertTriangle size={28} />
            </div>

            <h2>Delete Use Case?</h2>

            <p>
              You are about to delete <strong>"{deleteTarget.title}"</strong>.
            </p>

            <div className="uc__modal-actions">
              <button
                className="uc__modal-cancel"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>

              <button
                className="uc__modal-confirm"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Image Lightbox ─────────────────────────────── */}
      {lightboxSrc && (
        <div className="uc__lightbox" onClick={closeLightbox}>
          <button
            className="uc__lightbox-close"
            onClick={closeLightbox}
            title="Close"
          >
            <X size={20} />
          </button>

          <img
            src={lightboxSrc}
            alt="Preview"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default UseCaseList;