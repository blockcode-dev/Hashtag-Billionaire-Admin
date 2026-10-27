/** @format */

import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/Spinner";
import { VariantStatusTag } from "@/components/common/VariantStatusTag";
import { GetVariantByIdAdminAPI } from "@/services/Api/ProductApi";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  describeShippingWeight,
  formatShortDate,
  formatWeight,
  isStockUnreported,
  shippingWeight,
  stockLabel,
  supplierWeight,
} from "@/lib/variants";
import { WeightField } from "../ShippingWeight";
import "./ProductView.scss";

const ProductView = () => {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  // The Variants list passes its row so the page shows at once. It's reloaded by
  // id either way, so a refresh or a shared link works and the data is current.
  const passed = state?.variant && String(state.variant.id) === String(id) ? state.variant : null;
  const [variant, setVariant] = useState<any>(passed);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [prevId, setPrevId] = useState(id);

  if (id !== prevId) {
    setPrevId(id);
    setVariant(passed);
    setLoadError(null);
    setPickedImage(null);
  }

  useEffect(() => {
    let active = true;
    GetVariantByIdAdminAPI(id)
      .then((res) => {
        if (active) setVariant(res.data?.data ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(
          err?.response?.status === 404
            ? "There's no variant with this id."
            : "We couldn't load this variant. Try again in a moment.",
        );
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (!variant)
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        {loadError ? (
          <>
            <h1>Variant not found</h1>
            <p className="max-w-sm text-sm text-muted-foreground">{loadError}</p>
            <Button asChild variant="outline">
              <Link to="/variants">
                <ArrowLeft />
                Go to Variants
              </Link>
            </Button>
          </>
        ) : (
          <Spinner size="large" label="Loading variant" />
        )}
      </div>
    );

  const images: string[] = (variant.images || []).map((img: any) => img.file_uri).filter(Boolean);
  const activeImage = pickedImage && images.includes(pickedImage) ? pickedImage : images[0];

  // For supplier products `price` is the supplier's cost; the shop adds that supplier's
  // markup (Pricing Markup). sale_price and retail_price are the supplier's reference
  // prices and aren't used for pricing.
  const manual = (variant.supplier ?? variant.product?.supplier ?? "").toUpperCase() === "MANUAL";
  const removed = variant.status === "removed";
  const unreported = isStockUnreported(variant);
  const supplier = supplierWeight(variant);
  const ships = shippingWeight(variant);
  const adminWeight = ships.source === "admin" ? ships.lb : null;
  const discontinuedOn = formatShortDate(variant.discontinued_at);

  return (
    <div className="product-view">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back
        </button>
        {variant.product_id && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/products/${variant.product_id}`}>
              <ExternalLink />
              View product
            </Link>
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-start gap-3">
        <h1 className="title">{variant.product?.name}</h1>
        <VariantStatusTag variant={variant} className="pt-1" />
      </div>

      {/* TOP */}
      <div className="top-section">
        {/* IMAGE */}
        <div className="image-gallery">
          <img src={activeImage} className="main-image" alt={variant.product?.name || ""} />

          <div className="thumbs">
            {variant.images?.map((img: any) => (
              <img
                key={img.id}
                src={img.file_uri}
                alt=""
                className={activeImage === img.file_uri ? "active" : ""}
                onClick={() => setPickedImage(img.file_uri)}
              />
            ))}
          </div>
        </div>

        {/* DETAILS */}
        <div className="details-card">
          <div className="grid">
            <div>
              <span>SKU</span>
              <strong>{variant.sku}</strong>
            </div>

            <div>
              <span>Style</span>
              <strong>{variant.product?.external_style_name}</strong>
            </div>

            <div>
              <span>Color</span>
              <div className="color">
                <span
                  className="dot"
                  style={{ background: variant.color_code }}
                />
                {variant.color}
              </div>
            </div>

            <div>
              <span>Size</span>
              <strong>{variant.size}</strong>
            </div>

            <div>
              <span>{manual ? "Price" : "Supplier cost"}</span>
              <strong className="price">$ {variant.price}</strong>
            </div>

            {!manual && (
              <>
                <div>
                  <span>Supplier sale price</span>
                  <strong className="retail">$ {variant.sale_price ?? "—"}</strong>
                </div>

                <div>
                  <span>Supplier retail price</span>
                  <strong className="retail">$ {variant.retail_price ?? "—"}</strong>
                </div>
              </>
            )}

            <div>
              <span>Stock</span>
              <strong
                className={unreported ? "stock" : `stock ${variant.stock > 100 ? "high" : "low"}`}
              >
                {stockLabel(variant)}
              </strong>
            </div>

            <div>
              <span>Supplier weight</span>
              <strong>{supplier ? formatWeight(supplier) : "—"}</strong>
            </div>

            <div>
              <span>Ships at</span>
              <strong>{describeShippingWeight(variant)}</strong>
            </div>

            <div>
              <span>Case Qty</span>
              <strong>{variant.case_qty}</strong>
            </div>

            <div>
              <span>Supplier</span>
              <strong>{variant.supplier}</strong>
            </div>

            <div>
              <span>Country</span>
              <strong>{variant.country_of_origin}</strong>
            </div>

            {discontinuedOn && (
              <div>
                <span>Discontinued by supplier</span>
                <strong>{discontinuedOn}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SHIPPING WEIGHT: saved on its own, so supplier updates keep running. */}
      {!removed && (
        <div className="desc-card">
          <h3>Shipping weight</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Rates and labels use the weight set here, then the supplier's weight, then the store's default. It
            doesn't stop supplier updates for this product.
          </p>
          <WeightField
            id={`weight-variant-${variant.id}`}
            label="Weight for this variant"
            target={{ variant_ids: [Number(variant.id)] }}
            current={adminWeight}
            canClear={adminWeight != null}
            onSaved={(weight) => setVariant((v: any) => ({ ...v, admin_weight_lb: weight }))}
          />
        </div>
      )}

      {/* DESCRIPTION */}
      <div className="desc-card">
        <h3>Description</h3>
        <div
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(variant.product?.description),
          }}
        />
      </div>

      {/* WAREHOUSE: only suppliers that report stock per warehouse have rows (not SAGE). */}
      {variant.variant_warehouse?.length > 0 && (
        <div className="warehouse-card">
          <h3>Warehouse Stock</h3>

          <table>
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Stock</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {variant.variant_warehouse?.map((w: any) => (
                <tr key={w.id}>
                  <td>{w.warehouse_abbr}</td>
                  <td>{w.stock}</td>
                  <td>
                    <span className={`tag ${w.stock > 20 ? "good" : "low"}`}>
                      {w.stock > 20 ? "Available" : "Low"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* TOTAL */}
          <div className="total">
            Total Stock:{" "}
            <strong>
              {variant.variant_warehouse?.reduce(
                (sum: number, w: any) => sum + w.stock,
                0,
              )}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductView;
