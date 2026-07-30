/** @format */

import { useEffect, useState } from "react";
import { Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";

import {
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  ImageOff,
  GripVertical,
  Eye,
} from "lucide-react";
import {
  CreateIndustryAPI,
  DeleteIndustryAPI,
  GetIndustriesAPI,
  UpdateIndustryAPI,
} from "@/services/Api/IndustryApi";
import "./IndustryList.scss";

const IMAGE_BASE_URL = "https://node.hashtagbillionaire.com";

const getImageUrl = (path: string | null | undefined) => {
  if (!path) return null;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${IMAGE_BASE_URL}${path}`;
};

interface UseCase {
  id: number;
  title: string;
  slug: string;
}

interface Industry {
  id: number;
  title: string;
  slug: string;
  description: string;
  image: string | null;
  sort_order: number;
  use_cases: UseCase[];
}

const USE_CASES_PREVIEW = 6;

const UseCasesList = ({ useCases }: { useCases: UseCase[] }) => {
  const [expanded, setExpanded] = useState(false);

  if (!useCases?.length) {
    return <span className="ind__none">No use cases</span>;
  }

  const visible = expanded ? useCases : useCases.slice(0, USE_CASES_PREVIEW);

  const remaining = useCases.length - USE_CASES_PREVIEW;

  return (
    <div className="ind__tags-wrap">
      <div className="ind__tags">
        {visible.map((uc) => (
          <span key={uc.id} className="ind__tag">
            {uc.title}
          </span>
        ))}

        {!expanded && remaining > 0 && (
          <button className="ind__tag-more" onClick={() => setExpanded(true)}>
            +{remaining} more
            <ChevronDown size={12} />
          </button>
        )}
      </div>

      {expanded && remaining > 0 && (
        <button
          className="ind__tag-collapse"
          onClick={() => setExpanded(false)}
        >
          <ChevronUp size={13} />
          Show less
        </button>
      )}
    </div>
  );
};

const IndustryList = () => {
  const [industries, setIndustries] = useState<Industry[]>([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Industry | null>(null);

  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Add / Edit modal state ────────────────────────────
  const [formOpen, setFormOpen] = useState(false);

  const [editTarget, setEditTarget] = useState<Industry | null>(null);

  const [formTitle, setFormTitle] = useState("");

  const [formDescription, setFormDescription] = useState("");

  const [formError, setFormError] = useState("");

  const [formLoading, setFormLoading] = useState(false);

  const [fileList, setFileList] = useState<any[]>([]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Drag-and-drop reorder state ───────────────────────
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const [reordering, setReordering] = useState(false);

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

  const handleFileChange = ({ fileList }: any) => {
    setFileList(fileList);

    if (fileList.length && fileList[0].originFileObj) {
      setPreviewUrl(URL.createObjectURL(fileList[0].originFileObj));
    } else if (!fileList.length) {
      setPreviewUrl(null);
    }
  };

  const load = async () => {
    try {
      setLoading(true);

      const res = await GetIndustriesAPI(1, 100, search);

      setIndustries(res.data.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

      await DeleteIndustryAPI(deleteTarget.id);

      setIndustries((prev) => prev.filter((x) => x.id !== deleteTarget.id));

      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Drag-and-drop reorder handlers ───────────────────────
  // Dragging a row to a new position reassigns sort_order 1..n for the
  // whole list based on the new positions, then only persists the rows
  // whose sort_order actually changed (usually everything between the
  // old and new spot, not the whole table).
  const handleDragStart = (id: number) => {
    if (reordering || !!search) return;

    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();

    if (draggedId === null || draggedId === id) return;

    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (targetId: number) => {
    setDragOverId(null);

    if (draggedId === null || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const sourceIndex = industries.findIndex((x) => x.id === draggedId);
    const targetIndex = industries.findIndex((x) => x.id === targetId);

    setDraggedId(null);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const prevList = industries;

    const reordered = [...industries];

    const [movedItem] = reordered.splice(sourceIndex, 1);

    reordered.splice(targetIndex, 0, movedItem);

    const withNewOrder = reordered.map((item, idx) => ({
      ...item,
      sort_order: idx + 1,
    }));

    // Only the rows whose sort_order actually changed need a save.
    const changed = withNewOrder.filter((item, idx) => {
      const original = prevList.find((x) => x.id === item.id);
      return original && original.sort_order !== item.sort_order;
    });

    setIndustries(withNewOrder);
    setReordering(true);

    try {
      await Promise.all(
        changed.map((item) => {
          const fd = new FormData();

          fd.append("title", item.title);
          fd.append("description", item.description || "");
          fd.append("sort_order", String(item.sort_order));

          return UpdateIndustryAPI(item.id, fd);
        })
      );
    } catch (err) {
      console.error(err);
      setIndustries(prevList);
    } finally {
      setReordering(false);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // ── Add / Edit handlers ────────────────────────────────
  const openAddModal = () => {
    setEditTarget(null);
    setFormTitle("");
    setFormDescription("");
    setFileList([]);
    setPreviewUrl(null);
    setFormError("");
    setFormOpen(true);
  };

  const openEditModal = (item: Industry) => {
    setEditTarget(item);
    setFormTitle(item.title);
    setFormDescription(item.description || "");
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
    setFileList([]);
    setPreviewUrl(null);
    setFormError("");
  };

  const handleFormSubmit = async () => {
    if (!formTitle.trim()) {
      setFormError("Title is required");
      return;
    }

    const title = formTitle.trim();
    const description = formDescription.trim();

    const formData = new FormData();

    formData.append("title", title);
    formData.append("description", description);

    if (fileList.length && fileList[0].originFileObj) {
      formData.append("images", fileList[0].originFileObj);
    }

    try {
      setFormLoading(true);

      if (editTarget) {
        const res = await UpdateIndustryAPI(editTarget.id, formData);

        const updated = res.data?.data;

        setIndustries((prev) =>
          prev.map((x) =>
            x.id === editTarget.id
              ? {
                  ...x,
                  title: updated?.title ?? title,
                  description: updated?.description ?? description,
                  image: updated?.image ?? x.image,
                  sort_order: updated?.sort_order ?? x.sort_order,
                }
              : x
          )
        );
      } else {
        const res = await CreateIndustryAPI(formData);

        const created = res.data?.data;

        setIndustries((prev) => [
          {
            id: created?.id,
            title: created?.title ?? title,
            slug: created?.slug ?? "",
            description: created?.description ?? description,
            image: created?.image ?? null,
            sort_order: created?.sort_order ?? 0,
            use_cases: created?.use_cases ?? [],
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

  return (
    <div className="ind">
      <div className="ind__header">
        <div>
          <h1>Industries</h1>

          <p>Manage industries and their use cases</p>
        </div>

        <div className="ind__header-right">
          <div className="ind__search">
            <Search size={15} />

            <input
              type="text"
              placeholder="Search industries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {search && (
              <button
                className="ind__search-clear"
                onClick={() => setSearch("")}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button className="ind__btn-add" onClick={openAddModal}>
            <Plus size={16} />
            Add Industry
          </button>
        </div>
      </div>

      {search && (
        <div className="ind__reorder-hint">
          Clear the search to drag and reorder industries.
        </div>
      )}

      <div className="ind__card">
        <table className="ind__table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>

              <th style={{ width: 56 }}>#</th>

              <th style={{ width: 64 }}>Image</th>

              <th style={{ width: 200 }}>Industry</th>

              <th style={{ width: 260 }}>Description</th>

              <th>Use Cases</th>

              <th style={{ width: 96, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={7}>
                  <div className="ind__empty">Loading...</div>
                </td>
              </tr>
            )}

            {!loading && industries.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="ind__empty">No industries found</div>
                </td>
              </tr>
            )}

            {!loading &&
              industries.map((item, index) => (
                <tr
                  key={item.id}
                  draggable={!search && !reordering}
                  onDragStart={() => handleDragStart(item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(item.id)}
                  onDragEnd={handleDragEnd}
                  className={
                    (draggedId === item.id ? "ind__row--dragging " : "") +
                    (dragOverId === item.id ? "ind__row--drag-over" : "")
                  }
                >
                  <td>
                    <span
                      className={
                        "ind__drag-handle" +
                        (search ? " ind__drag-handle--disabled" : "")
                      }
                      title={
                        search
                          ? "Clear search to reorder"
                          : "Drag to reorder"
                      }
                    >
                      <GripVertical size={15} />
                    </span>
                  </td>

                  <td>
                    <span className="ind__sr">{index + 1}</span>
                  </td>

                  <td>
                    {item.image ? (
                      <img
                        src={getImageUrl(item.image) || undefined}
                        alt={item.title}
                        className="ind__thumb ind__thumb--clickable"
                        onClick={() => openLightbox(getImageUrl(item.image))}
                      />
                    ) : (
                      <div className="ind__thumb ind__thumb--empty">
                        <ImageOff size={16} />
                      </div>
                    )}
                  </td>

                  <td>
                    <span className="ind__title">{item.title}</span>

                    {item.use_cases?.length > 0 && (
                      <span className="ind__count">
                        {item.use_cases.length} use case
                        {item.use_cases.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </td>

                  <td>
                    {item.description ? (
                      <span className="ind__desc">{item.description}</span>
                    ) : (
                      <span className="ind__none">
                        No description available
                      </span>
                    )}
                  </td>

                  <td>
                    <UseCasesList useCases={item.use_cases || []} />
                  </td>

                  <td>
                    <div className="ind__actions">
                      <button
                        className="ind__btn-edit"
                        onClick={() => openEditModal(item)}
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        className="ind__btn-delete"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit Modal ───────────────────────────── */}
      {formOpen && (
        <div className="ind__overlay" onClick={closeFormModal}>
          <div
            className="ind__modal ind__modal--form"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="ind__modal-close"
              onClick={closeFormModal}
              disabled={formLoading}
            >
              <X size={16} />
            </button>

            <h2>{editTarget ? "Edit Industry" : "Add Industry"}</h2>

            <p className="ind__modal-subtitle">
              {editTarget
                ? "Update the industry details below."
                : "Fill in the details to create a new industry."}
            </p>

            <div className="ind__form-field">
              <label>
                Title <span className="ind__required">*</span>
              </label>

              <input
                type="text"
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                  if (formError) setFormError("");
                }}
                placeholder="e.g. Tech & Startups"
                autoFocus
              />
            </div>

            <div className="ind__form-field">
              <label>
                Description <span className="ind__optional">(optional)</span>
              </label>

              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Briefly describe this industry..."
                rows={3}
              />
            </div>

            <div className="ind__form-field">
              <label>
                Industry Image <span className="ind__optional">(optional)</span>
              </label>

              <div className="ind__upload">
                <Upload
                  beforeUpload={() => false}
                  maxCount={1}
                  fileList={fileList}
                  onChange={handleFileChange}
                  showUploadList={false}
                  accept=".png,.jpg,.jpeg,.svg"
                >
                  {previewUrl ? (
                    <div className="ind__upload-preview">
                      <img src={previewUrl} alt="Industry" />

                      <button
                        type="button"
                        className="ind__upload-view-btn"
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
                    <div className="ind__upload-placeholder">
                      <UploadOutlined style={{ fontSize: 18 }} />
                      <span>Upload Image</span>
                    </div>
                  )}
                </Upload>

                <div className="ind__upload-meta">
                  <div className="ind__upload-name">
                    {previewUrl
                      ? fileList[0]?.name || "Image selected"
                      : "Upload industry image"}
                  </div>

                  <div className="ind__upload-hint">
                    PNG, JPG, JPEG or SVG
                    <br />
                    Max 5 MB
                  </div>

                  {previewUrl && (
                    <button
                      type="button"
                      className="ind__remove-image"
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

            {formError && <div className="ind__form-error">{formError}</div>}

            <div className="ind__modal-actions">
              <button
                className="ind__modal-cancel"
                onClick={closeFormModal}
                disabled={formLoading}
              >
                Cancel
              </button>

              <button
                className="ind__modal-confirm ind__modal-confirm--primary"
                onClick={handleFormSubmit}
                disabled={formLoading}
              >
                {formLoading
                  ? "Saving..."
                  : editTarget
                  ? "Save Changes"
                  : "Create Industry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ───────────────────────────────── */}
      {deleteTarget && (
        <div className="ind__overlay" onClick={() => setDeleteTarget(null)}>
          <div className="ind__modal" onClick={(e) => e.stopPropagation()}>
            <div className="ind__modal-icon">
              <AlertTriangle size={28} />
            </div>

            <h2>Delete Industry?</h2>

            <p>
              You are about to delete <strong>"{deleteTarget.title}"</strong>.
            </p>

            {deleteTarget.use_cases?.length > 0 && (
              <div className="ind__modal-warning">
                <strong>Warning:</strong> This will also remove{" "}
                <strong>
                  {deleteTarget.use_cases.length} use case
                  {deleteTarget.use_cases.length > 1 ? "s" : ""}
                </strong>{" "}
                under this industry.
              </div>
            )}

            <div className="ind__modal-actions">
              <button
                className="ind__modal-cancel"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>

              <button
                className="ind__modal-confirm"
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
        <div className="ind__lightbox" onClick={closeLightbox}>
          <button
            className="ind__lightbox-close"
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

export default IndustryList;