/** @format */

import { useEffect, useState } from "react";
import { message, Pagination } from "antd";
import axios from "axios";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  X,
  ImageOff,
  Package,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  GetAddOnProductsAPI,
  DeleteAddOnProductAPI,
} from "@/services/Api/AddOnApi";

import "./AddOn.scss";

const IMAGE_BASE_URL = "https://node.hashtagbillionaire.com";
const PAGE_SIZE = 20;
const MAX_FEATURES_SHOWN = 3;

interface AddOnProduct {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
  features: string[] | string | null;
  price: number | string;
  is_active: boolean;
}

const getImageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${IMAGE_BASE_URL}${path}`;
};

// MariaDB can return the JSON column as a string — normalise it.
const getFeatures = (raw: AddOnProduct["features"]): string[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const getErrorMessage = (err: unknown, fallback: string) =>
  (axios.isAxiosError(err) && err.response?.data?.message) || fallback;

const AddOnList = () => {
  const navigate = useNavigate();

  const [addOns, setAddOns] = useState<AddOnProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<AddOnProduct | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Wait until typing stops before searching.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const res = await GetAddOnProductsAPI(page, PAGE_SIZE, debouncedSearch);
      const result = res.data?.data || {};

      setAddOns(Array.isArray(result.data) ? result.data : []);
      setTotal(result.pagination?.total || 0);
    } catch (err) {
      setAddOns([]);
      setLoadError(getErrorMessage(err, "Couldn't load add-ons."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  // Escape closes the lightbox or the delete modal.
  useEffect(() => {
    if (!lightboxSrc && !deleteTarget) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightboxSrc) setLightboxSrc(null);
      else if (!deleteLoading) setDeleteTarget(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxSrc, deleteTarget, deleteLoading]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);
      await DeleteAddOnProductAPI(deleteTarget.id);

      message.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);

      // If that was the last row on this page, go back one page.
      if (addOns.length === 1 && page > 1) setPage((p) => p - 1);
      else load();
    } catch (err) {
      message.error(getErrorMessage(err, "Couldn't delete this add-on."));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="addon">
      {/* HEADER */}
      <div className="addon__header">
        <div>
          <h1>Add-ons</h1>
          <p>
            Extras customers can add to a product, like bagging, gift wrap or
            rush handling.
          </p>
        </div>

        <button
          className="addon__btn-primary"
          onClick={() => navigate("/add-ons/new")}
        >
          <Plus size={16} />
          New add-on
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="addon__toolbar">
        <div className="addon__search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by name or description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search add-ons"
          />
          {search && (
            <button
              className="addon__search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <span className="addon__count">
          {total} {total === 1 ? "add-on" : "add-ons"}
        </span>
      </div>

      {/* TABLE */}
      <div className="addon__card">
        {loadError ? (
          <div className="addon__state">
            <span className="addon__state-icon addon__state-icon--error">
              <AlertTriangle size={24} />
            </span>
            <strong>{loadError}</strong>
            <button className="addon__btn-outline" onClick={load}>
              Try again
            </button>
          </div>
        ) : !loading && addOns.length === 0 ? (
          <div className="addon__state">
            <span className="addon__state-icon">
              <Package size={24} />
            </span>
            <strong>
              {debouncedSearch
                ? `No add-ons match "${debouncedSearch}"`
                : "No add-ons yet"}
            </strong>
            <span>
              {debouncedSearch
                ? "Try another word or clear the search."
                : "Create one, then attach it to products."}
            </span>
            {debouncedSearch ? (
              <button
                className="addon__btn-outline"
                onClick={() => setSearch("")}
              >
                Clear search
              </button>
            ) : (
              <button
                className="addon__btn-primary"
                onClick={() => navigate("/add-ons/new")}
              >
                <Plus size={16} />
                New add-on
              </button>
            )}
          </div>
        ) : (
          <div className="addon__table-scroll">
            <table className="addon__table">
              <thead>
                <tr>
                  <th style={{ width: "30%" }}>Add-on</th>
                  <th>Description</th>
                  <th style={{ width: "26%" }}>Features</th>
                  <th style={{ width: 110 }}>Base price</th>
                  <th style={{ width: 100, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="addon__loading">
                        <span className="addon__spinner" />
                        Loading add-ons…
                      </div>
                    </td>
                  </tr>
                ) : (
                  addOns.map((item) => {
                    const image = getImageUrl(item.image);
                    const features = getFeatures(item.features);
                    const extra = features.length - MAX_FEATURES_SHOWN;

                    return (
                      <tr key={item.id}>
                        {/* NAME + IMAGE */}
                        <td>
                          <div className="addon__name-cell">
                            {image ? (
                              <button
                                className="addon__thumb"
                                onClick={() => setLightboxSrc(image)}
                                aria-label={`View image of ${item.name}`}
                              >
                                <img src={image} alt="" loading="lazy" />
                              </button>
                            ) : (
                              <span className="addon__thumb addon__thumb--empty">
                                <ImageOff size={16} />
                              </span>
                            )}

                            <div className="addon__name-text">
                              <button
                                className="addon__name"
                                onClick={() =>
                                  navigate(`/add-ons/${item.id}/edit`)
                                }
                              >
                                {item.name}
                              </button>
                              <span className="addon__slug">{item.slug}</span>
                            </div>
                          </div>
                        </td>

                        {/* DESCRIPTION */}
                        <td>
                          {item.description ? (
                            <span
                              className="addon__desc"
                              title={item.description}
                            >
                              {item.description}
                            </span>
                          ) : (
                            <span className="addon__none">No description</span>
                          )}
                        </td>

                        {/* FEATURES */}
                        <td>
                          {features.length ? (
                            <div className="addon__chips">
                              {features
                                .slice(0, MAX_FEATURES_SHOWN)
                                .map((feature, i) => (
                                  <span key={i} className="addon__chip">
                                    {feature}
                                  </span>
                                ))}
                              {extra > 0 && (
                                <span
                                  className="addon__chip addon__chip--more"
                                  title={features
                                    .slice(MAX_FEATURES_SHOWN)
                                    .join(", ")}
                                >
                                  +{extra} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="addon__none">No features</span>
                          )}
                        </td>

                        {/* PRICE */}
                        <td>
                          <span className="addon__price">
                            ${Number(item.price || 0).toFixed(2)}
                          </span>
                        </td>

                        {/* ACTIONS */}
                        <td>
                          <div className="addon__actions">
                            <button
                              className="addon__icon-btn"
                              title="Edit"
                              aria-label={`Edit ${item.name}`}
                              onClick={() =>
                                navigate(`/add-ons/${item.id}/edit`)
                              }
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="addon__icon-btn addon__icon-btn--danger"
                              title="Delete"
                              aria-label={`Delete ${item.name}`}
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && !loadError && (
          <div className="addon__pagination">
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

      {/* DELETE MODAL */}
      {deleteTarget && (
        <div
          className="addon__overlay"
          onClick={() => !deleteLoading && setDeleteTarget(null)}
        >
          <div
            className="addon__modal"
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="addon__modal-icon">
              <AlertTriangle size={26} />
            </div>

            <h2>Delete this add-on?</h2>

            <p>
              <strong>{deleteTarget.name}</strong> will be removed from every
              product it's attached to. This can't be undone.
            </p>

            <div className="addon__modal-actions">
              <button
                className="addon__btn-outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className="addon__btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting…" : "Delete add-on"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxSrc && (
        <div className="addon__lightbox" onClick={() => setLightboxSrc(null)}>
          <button
            className="addon__lightbox-close"
            onClick={() => setLightboxSrc(null)}
            aria-label="Close preview"
          >
            <X size={20} />
          </button>
          <img
            src={lightboxSrc}
            alt="Add-on"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default AddOnList;