/** @format */

import { useEffect, useState } from "react";
import {
  GetGrandCategoriesAPI,
  DeleteGrandCategoryAPI,
} from "@/services/Api/GrandCategoryApi";

import {
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./GrandCategoryPage.scss";

interface ParentCategory {
  id: number;
  title: string;
}

interface GrandCategory {
  id: number;
  title: string;
  slug: string;
  parent_categories: ParentCategory[];
}

const TAGS_PREVIEW = 6;

const MappedTags = ({
  categories,
}: {
  categories: ParentCategory[];
}) => {
  const [expanded, setExpanded] =
    useState(false);

  if (!categories?.length) {
    return (
      <span className="gcp__none">
        No mappings
      </span>
    );
  }

  const visible = expanded
    ? categories
    : categories.slice(
        0,
        TAGS_PREVIEW
      );

  const remaining =
    categories.length -
    TAGS_PREVIEW;

  return (
    <div className="gcp__tags-wrap">
      <div className="gcp__tags">
        {visible.map((cat) => (
          <span
            key={cat.id}
            className="gcp__tag"
          >
            {cat.title}
          </span>
        ))}

        {!expanded &&
          remaining > 0 && (
            <button
              className="gcp__tag-more"
              onClick={() =>
                setExpanded(true)
              }
            >
              +{remaining} more
              <ChevronDown size={12} />
            </button>
          )}
      </div>

      {expanded &&
        remaining > 0 && (
          <button
            className="gcp__tag-collapse"
            onClick={() =>
              setExpanded(false)
            }
          >
            <ChevronUp size={13} />
            Show less
          </button>
        )}
    </div>
  );
};

const GrandCategoryPage = () => {
  const navigate = useNavigate();

  const [
    categories,
    setCategories,
  ] = useState<GrandCategory[]>(
    []
  );

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    useState<GrandCategory | null>(
      null
    );

  const [
    deleteLoading,
    setDeleteLoading,
  ] = useState(false);

  const load = async () => {
    try {
      setLoading(true);

      const res =
        await GetGrandCategoriesAPI(
          1,
          50,
          search
        );

      setCategories(
        res.data.data.data || []
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search]);

  const handleDeleteConfirm =
    async () => {
      if (!deleteTarget) return;

      try {
        setDeleteLoading(true);

        await DeleteGrandCategoryAPI([
          deleteTarget.id,
        ]);

        setCategories((prev) =>
          prev.filter(
            (x) =>
              x.id !==
              deleteTarget.id
          )
        );

        setDeleteTarget(null);
      } catch (err) {
        console.error(err);
      } finally {
        setDeleteLoading(false);
      }
    };

  return (
    <div className="gcp">
      <div className="gcp__header">
        <div>
          <h1>
            Categories
          </h1>

          <p>
            Manage top level
            category hierarchy
          </p>
        </div>

        <div className="gcp__header-right">
          <div className="gcp__search">
            <Search size={15} />

            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />

            {search && (
              <button
                className="gcp__search-clear"
                onClick={() =>
                  setSearch("")
                }
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            className="gcp__btn-add"
            onClick={() =>
              navigate(
                "/grand-category/create"
              )
            }
          >
            <Plus size={16} />
            Add  Category
          </button>
        </div>
      </div>

      <div className="gcp__card">
        <table className="gcp__table">
          <thead>
            <tr>
              <th
                style={{
                  width: 56,
                }}
              >
                #
              </th>

              <th
                style={{
                  width: 240,
                }}
              >
                Grand Category
              </th>

              <th>
                Mapped Parent
                Categories
              </th>

              <th
                style={{
                  width: 96,
                  textAlign:
                    "right",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={4}>
                  <div className="gcp__empty">
                    Loading...
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              categories.length ===
                0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="gcp__empty">
                      No grand
                      categories found
                    </div>
                  </td>
                </tr>
              )}

            {!loading &&
              categories.map(
                (
                  item,
                  index
                ) => (
                  <tr
                    key={item.id}
                  >
                    <td>
                      <span className="gcp__sr">
                        {index + 1}
                      </span>
                    </td>

                    <td>
                      <span className="gcp__title">
                        {
                          item.title
                        }
                      </span>

                      {item
                        .parent_categories
                        ?.length >
                        0 && (
                        <span className="gcp__count">
                          {
                            item
                              .parent_categories
                              .length
                          }{" "}
                          mapped
                        </span>
                      )}
                    </td>

                    <td>
                      <MappedTags
                        categories={
                          item.parent_categories ||
                          []
                        }
                      />
                    </td>

                    <td>
                      <div className="gcp__actions">
                        <button
                          className="gcp__btn-edit"
                          onClick={() =>
                            navigate(
                              `/grand-category/edit/${item.id}`
                            )
                          }
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          className="gcp__btn-delete"
                          onClick={() =>
                            setDeleteTarget(
                              item
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <div
          className="gcp__overlay"
          onClick={() =>
            setDeleteTarget(null)
          }
        >
          <div
            className="gcp__modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="gcp__modal-icon">
              <AlertTriangle size={28} />
            </div>

            <h2>
              Delete Grand
              Category?
            </h2>

            <p>
              You are about to
              delete{" "}
              <strong>
                "
                {
                  deleteTarget.title
                }
                "
              </strong>
              .
            </p>

            <div className="gcp__modal-warning">
              <strong>
                Warning:
              </strong>{" "}
              This will also
              remove all{" "}
              <strong>
                {
                  deleteTarget
                    .parent_categories
                    ?.length
                }{" "}
                parent category
                mappings
              </strong>
              .
            </div>

            <div className="gcp__modal-actions">
              <button
                className="gcp__modal-cancel"
                onClick={() =>
                  setDeleteTarget(
                    null
                  )
                }
              >
                Cancel
              </button>

              <button
                className="gcp__modal-confirm"
                onClick={
                  handleDeleteConfirm
                }
                disabled={
                  deleteLoading
                }
              >
                {deleteLoading
                  ? "Deleting..."
                  : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GrandCategoryPage;