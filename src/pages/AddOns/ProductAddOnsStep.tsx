/** @format */

import { useEffect, useMemo, useState } from "react";
import { message, Spin } from "antd";
import axios from "axios";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ImageOff,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  AssignProductAddOnsAPI,
  GetAddOnProductsAPI,
  GetProductAddOnsAPI,
} from "@/services/Api/AddOnApi";

import "./ProductAddOnsStep.scss";

const IMAGE_BASE_URL = "https://node.hashtagbillionaire.com";

/* ─── Types ─────────────────────────────────────────────── */

// Master add-on (from /add-on/addon-product)
interface LibraryAddOn {
  id: number;
  name: string;
  image: string | null;
  features: string[] | string | null;
  price: number | string;
}

// Add-on attached to this product (from /add-on/product/:id/addons)
interface ProductAddOnRow {
  addon_product_id: number;
  name: string;
  image: string | null;
  features: string[] | string | null;
  price: number | string;
  addon_price: number | string;
}

interface AttachedAddOn {
  addon_product_id: number;
  name: string;
  image: string | null;
  featureCount: number;
  price: number; // price for THIS product
  addonPrice: number; // default price from the add-on itself
}

/* ─── Helpers ───────────────────────────────────────────── */

const getImageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${IMAGE_BASE_URL}${path}`;
};

// MariaDB can return the JSON column as a string.
const countFeatures = (raw: string[] | string | null) => {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
};

const toAttached = (rows: ProductAddOnRow[]): AttachedAddOn[] =>
  rows.map((row) => ({
    addon_product_id: Number(row.addon_product_id),
    name: row.name,
    image: row.image,
    featureCount: countFeatures(row.features),
    price: Number(row.price) || 0,
    addonPrice: Number(row.addon_price) || 0,
  }));

const toDrafts = (list: AttachedAddOn[]) =>
  Object.fromEntries(list.map((a) => [a.addon_product_id, String(a.price)]));

const money = (value: number) => `$${value.toFixed(2)}`;

const getErrorMessage = (err: unknown, fallback: string) =>
  (axios.isAxiosError(err) && err.response?.data?.message) || fallback;

/* ─── Component ─────────────────────────────────────────── */

const ProductAddOnsStep = ({ productId }: { productId: number }) => {
  const navigate = useNavigate();

  const [attached, setAttached] = useState<AttachedAddOn[]>([]);
  const [library, setLibrary] = useState<LibraryAddOn[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  /* Load attached + all add-ons */
  const load = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const [productRes, libraryRes] = await Promise.all([
        GetProductAddOnsAPI(productId),
        GetAddOnProductsAPI(1, 100, ""),
      ]);

      const rows: ProductAddOnRow[] = Array.isArray(productRes.data?.data)
        ? productRes.data.data
        : [];
      const list = toAttached(rows);

      setAttached(list);
      setPriceDrafts(toDrafts(list));

      const libRows = libraryRes.data?.data?.data;
      setLibrary(Array.isArray(libRows) ? libRows : []);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load add-ons."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  /* Save the whole list (the API replaces all mappings) */
  const persist = async (next: AttachedAddOn[], successMsg?: string) => {
    const previous = attached;

    // Optimistic update — reverted if the request fails.
    setAttached(next);
    setPriceDrafts(toDrafts(next));
    setSaving(true);

    try {
      const res = await AssignProductAddOnsAPI(
        productId,
        next.map((a, index) => ({
          addon_product_id: a.addon_product_id,
          price: a.price,
          sort_order: index,
        })),
      );

      const rows = res.data?.data;
      if (Array.isArray(rows)) {
        const saved = toAttached(rows);
        setAttached(saved);
        setPriceDrafts(toDrafts(saved));
      }

      if (successMsg) message.success(successMsg);
    } catch (err) {
      setAttached(previous);
      setPriceDrafts(toDrafts(previous));
      message.error(
        getErrorMessage(err, "Couldn't save add-ons. Your last change was undone."),
      );
    } finally {
      setSaving(false);
    }
  };

  /* Actions */
  const addAddOn = (item: LibraryAddOn) => {
    if (saving) return;
    const defaultPrice = Number(item.price) || 0;

    persist(
      [
        ...attached,
        {
          addon_product_id: item.id,
          name: item.name,
          image: item.image,
          featureCount: countFeatures(item.features),
          price: defaultPrice,
          addonPrice: defaultPrice,
        },
      ],
      `"${item.name}" added`,
    );
  };

  const removeAddOn = (item: AttachedAddOn) => {
    if (saving) return;
    persist(
      attached.filter((a) => a.addon_product_id !== item.addon_product_id),
      `"${item.name}" removed`,
    );
  };

  const moveAddOn = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (saving || target < 0 || target >= attached.length) return;

    const next = [...attached];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  };

  const commitPrice = (item: AttachedAddOn) => {
    const draft = priceDrafts[item.addon_product_id] ?? "";
    const value = Number(draft);

    if (draft === "" || !Number.isFinite(value) || value < 0) {
      message.error(`Enter a price of 0 or more for "${item.name}".`);
      setPriceDrafts((p) => ({
        ...p,
        [item.addon_product_id]: String(item.price),
      }));
      return;
    }

    if (value === item.price) return;

    persist(
      attached.map((a) =>
        a.addon_product_id === item.addon_product_id
          ? { ...a, price: value }
          : a,
      ),
      "Price saved",
    );
  };

  const resetPrice = (item: AttachedAddOn) => {
    if (saving) return;
    persist(
      attached.map((a) =>
        a.addon_product_id === item.addon_product_id
          ? { ...a, price: a.addonPrice }
          : a,
      ),
      "Price reset to default",
    );
  };

  /* Add-ons not yet attached, filtered by search */
  const available = useMemo(() => {
    const attachedIds = new Set(attached.map((a) => a.addon_product_id));
    const term = search.trim().toLowerCase();

    return library.filter(
      (item) =>
        !attachedIds.has(item.id) &&
        (!term || item.name.toLowerCase().includes(term)),
    );
  }, [library, attached, search]);

  /* ─── Render ─── */

  if (loading) {
    return (
      <div className="pao">
        <div className="pao__center">
          <Spin />
          <span>Loading add-ons…</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="pao">
        <div className="pao__center">
          <span className="pao__center-icon pao__center-icon--error">
            <AlertTriangle size={22} />
          </span>
          <strong>{loadError}</strong>
          <button type="button" className="pao__btn-outline" onClick={load}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pao">
      {/* HEADER */}
      <div className="pao__header">
        <div>
          <h2 className="pao__title">
            Add-ons
            {attached.length > 0 && (
              <span className="pao__badge">{attached.length}</span>
            )}
          </h2>
          <p className="pao__hint">
            Extras customers can add to this product. Changes save as you make
            them.
          </p>
        </div>
        <span className={`pao__status ${saving ? "pao__status--saving" : ""}`}>
          {saving ? "Saving…" : "Saved"}
        </span>
      </div>

      {/* ATTACHED */}
      <div className="pao__section-label">On this product</div>

      {attached.length === 0 ? (
        <div className="pao__empty">
          No add-ons on this product yet. Pick from the list below.
        </div>
      ) : (
        <div className="pao__list">
          {attached.map((item, index) => {
            const image = getImageUrl(item.image);
            const isCustomPrice = item.price !== item.addonPrice;

            return (
              <div className="pao__row" key={item.addon_product_id}>
                <div className="pao__order">
                  <button
                    type="button"
                    onClick={() => moveAddOn(index, -1)}
                    disabled={saving || index === 0}
                    aria-label={`Move ${item.name} up`}
                    title="Move up"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveAddOn(index, 1)}
                    disabled={saving || index === attached.length - 1}
                    aria-label={`Move ${item.name} down`}
                    title="Move down"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>

                <span className="pao__thumb">
                  {image ? (
                    <img src={image} alt="" loading="lazy" />
                  ) : (
                    <ImageOff size={15} />
                  )}
                </span>

                <div className="pao__info">
                  <span className="pao__name">{item.name}</span>
                  <span className="pao__meta">
                    Default {money(item.addonPrice)}
                    {item.featureCount > 0 &&
                      ` · ${item.featureCount} feature${
                        item.featureCount > 1 ? "s" : ""
                      }`}
                  </span>
                </div>

                <div className="pao__price-wrap">
                  <label
                    className="pao__price-label"
                    htmlFor={`pao-price-${item.addon_product_id}`}
                  >
                    Price here
                  </label>
                  <div
                    className={`pao__price ${
                      isCustomPrice ? "pao__price--custom" : ""
                    }`}
                  >
                    <span>$</span>
                    <input
                      id={`pao-price-${item.addon_product_id}`}
                      type="text"
                      inputMode="decimal"
                      value={priceDrafts[item.addon_product_id] ?? ""}
                      disabled={saving}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d.]/g, "");
                        const [whole, ...rest] = v.split(".");
                        setPriceDrafts((p) => ({
                          ...p,
                          [item.addon_product_id]: rest.length
                            ? `${whole}.${rest.join("").slice(0, 2)}`
                            : whole,
                        }));
                      }}
                      onBlur={() => commitPrice(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                          setPriceDrafts((p) => ({
                            ...p,
                            [item.addon_product_id]: String(item.price),
                          }));
                        }
                      }}
                    />
                  </div>
                  {isCustomPrice && (
                    <button
                      type="button"
                      className="pao__reset"
                      onClick={() => resetPrice(item)}
                      disabled={saving}
                    >
                      <RotateCcw size={11} />
                      Use default
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="pao__remove"
                  onClick={() => removeAddOn(item)}
                  disabled={saving}
                  aria-label={`Remove ${item.name}`}
                  title="Remove from this product"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* AVAILABLE */}
      <div className="pao__section-label pao__section-label--spaced">
        Available add-ons
      </div>

      {library.length === 0 ? (
        <div className="pao__empty pao__empty--action">
          <Package size={22} />
          <span>You haven't created any add-ons yet.</span>
          <button
            type="button"
            className="pao__btn-outline"
            onClick={() => navigate("/add-ons/new")}
          >
            <Plus size={14} />
            Create an add-on
          </button>
        </div>
      ) : (
        <>
          <div className="pao__search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search add-ons"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search add-ons"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {available.length === 0 ? (
            <div className="pao__empty">
              {search
                ? `No add-ons match "${search}".`
                : "Every add-on is already on this product."}
            </div>
          ) : (
            <div className="pao__grid">
              {available.map((item) => {
                const image = getImageUrl(item.image);
                return (
                  <button
                    type="button"
                    key={item.id}
                    className="pao__card"
                    onClick={() => addAddOn(item)}
                    disabled={saving}
                    aria-label={`Add ${item.name}`}
                  >
                    <span className="pao__card-media">
                      {image ? (
                        <img src={image} alt="" loading="lazy" />
                      ) : (
                        <ImageOff size={18} />
                      )}
                    </span>
                    <span className="pao__card-body">
                      <span className="pao__card-name">{item.name}</span>
                      <span className="pao__card-price">
                        {money(Number(item.price) || 0)}
                      </span>
                    </span>
                    <span className="pao__card-add">
                      <Plus size={14} />
                      Add
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductAddOnsStep;