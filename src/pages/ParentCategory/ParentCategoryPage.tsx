/** @format */

import { useEffect, useState } from "react";
import {
  GetParentCategoriesAPI,
  DeleteParentCategoryAPI,
} from "@/services/Api/ParentCategoryApi";
import { Plus, Pencil, Trash2, Search, AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./ParentCategoryPage.scss";

const TAGS_PREVIEW = 6;

const MappedTags = ({ categories }: { categories: any[] }) => {
  const [expanded, setExpanded] = useState(false);

  if (!categories || categories.length === 0) {
    return <span className="pcp__none">No mappings</span>;
  }

  const visible = expanded ? categories : categories.slice(0, TAGS_PREVIEW);
  const remaining = categories.length - TAGS_PREVIEW;

  return (
    <div className="pcp__tags-wrap">
      <div className="pcp__tags">
        {visible.map((cat: any) => (
          <span key={cat.id} className="pcp__tag">
            {cat.title}
          </span>
        ))}

        {!expanded && remaining > 0 && (
          <button className="pcp__tag-more" onClick={() => setExpanded(true)}>
            +{remaining} more
            <ChevronDown size={12} />
          </button>
        )}
      </div>

      {expanded && remaining > 0 && (
        <button className="pcp__tag-collapse" onClick={() => setExpanded(false)}>
          <ChevronUp size={13} />
          Show less
        </button>
      )}
    </div>
  );
};

const ParentCategoryPage = () => {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await GetParentCategoriesAPI(1, 50, search);
      setCategories(res.data.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await DeleteParentCategoryAPI(deleteTarget.id);
      setCategories((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="pcp">
      {/* HEADER */}
      <div className="pcp__header">
        <div>
          <h1>Sub-Categories</h1>
          <p>Manage website category hierarchy</p>
        </div>

        <div className="pcp__header-right">
          <div className="pcp__search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="pcp__search-clear" onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            )}
          </div>

          <button
            className="pcp__btn-add"
            onClick={() => navigate("/parent-category/create")}
          >
            <Plus size={16} />
            Add Category
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="pcp__card">
        <table className="pcp__table">
          <thead>
            <tr>
              <th style={{ width: 56 }}>#</th>
              <th style={{ width: 200 }}>Category</th>
              <th>Mapped Categories</th>
              <th style={{ width: 96, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4}>
                  <div className="pcp__empty">Loading...</div>
                </td>
              </tr>
            )}

            {!loading && categories.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="pcp__empty">No categories found</div>
                </td>
              </tr>
            )}

            {!loading &&
              categories.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <span className="pcp__sr">{index + 1}</span>
                  </td>

                  <td>
                    <span className="pcp__title">{item.title}</span>
                    {item.categories?.length > 0 && (
                      <span className="pcp__count">{item.categories.length} mapped</span>
                    )}
                  </td>

                  <td>
                    <MappedTags categories={item.categories || []} />
                  </td>

                  <td>
                    <div className="pcp__actions">
                      <button
                        className="pcp__btn-edit"
                        onClick={() => navigate(`/parent-category/edit/${item.id}`)}
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="pcp__btn-delete"
                        onClick={() => setDeleteTarget(item)}
                        title="Delete"
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

      {/* DELETE MODAL */}
      {deleteTarget && (
        <div className="pcp__overlay" onClick={() => setDeleteTarget(null)}>
          <div className="pcp__modal" onClick={(e) => e.stopPropagation()}>
            <div className="pcp__modal-icon">
              <AlertTriangle size={28} />
            </div>

            <h2>Delete Parent Category?</h2>

            <p>
              You are about to delete <strong>"{deleteTarget.title}"</strong>.
            </p>

            <div className="pcp__modal-warning">
              <strong>Warning:</strong> This will also permanently remove all{" "}
              <strong>
                {deleteTarget.categories?.length || 0} sub-category mapping
                {deleteTarget.categories?.length !== 1 ? "s" : ""}
              </strong>{" "}
              linked to this parent. This action cannot be undone.
            </div>

            <div className="pcp__modal-actions">
              <button
                className="pcp__modal-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className="pcp__modal-confirm"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentCategoryPage;