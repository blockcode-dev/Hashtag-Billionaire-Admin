/** @format */

import { Link, useLocation, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/lib/sanitize";
import "./ProductView.scss";

const ProductView = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [variant, setVariant] = useState(state?.variant);
  const [all] = useState(state?.all || []);
  const [activeImage, setActiveImage] = useState(
    state?.variant?.images?.[0]?.file_uri,
  );

  useEffect(() => {
    if (variant) {
      setActiveImage(variant.images?.[0]?.file_uri);
    }
  }, [variant]);

  useEffect(() => {
    if (state?.variant) {
      setVariant(state.variant);
    }
  }, [state]);

  // The variant arrives in router state from the Variants list, so a direct
  // visit or a refresh has nothing to show.
  if (!variant)
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <h1>Variant not loaded</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Open a variant from the Variants list to see its details.
        </p>
        <Button asChild variant="outline">
          <Link to="/variants">
            <ArrowLeft />
            Go to Variants
          </Link>
        </Button>
      </div>
    );

  const related = all.filter(
    (v: any) => v.product_id === variant.product_id && v.id !== variant.id,
  );

  // For supplier products `price` is the supplier's cost; the shop adds that supplier's
  // markup (Pricing Markup). sale_price and retail_price are the supplier's reference
  // prices and aren't used for pricing.
  const manual = (variant.supplier ?? variant.product?.supplier ?? "").toUpperCase() === "MANUAL";

  return (
    <div className="product-view">
      {/* 🔙 BACK BUTTON */}
      <button className="btn-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} />
        Back
      </button>

      <h1 className="title">{variant.product?.name}</h1>

      {/* TOP */}
      <div className="top-section">
        {/* IMAGE */}
        <div className="image-gallery">
          <img src={activeImage} className="main-image" />

          <div className="thumbs">
            {variant.images?.map((img: any) => (
              <img
                key={img.id}
                src={img.file_uri}
                className={activeImage === img.file_uri ? "active" : ""}
                onClick={() => setActiveImage(img.file_uri)}
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
                className={`stock ${variant.stock > 100 ? "high" : "low"}`}
              >
                {variant.stock}
              </strong>
            </div>

            <div>
              <span>Weight</span>
              <strong>{variant.unit_weight} kg</strong>
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
          </div>
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="desc-card">
        <h3>Description</h3>
        <div
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(variant.product?.description),
          }}
        />
      </div>

      {/* WAREHOUSE */}
      
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

      {/* RELATED */}
      {/* <h2 className="section-title">Other Variants</h2>

      <div className="variant-grid">
        {related.map((v: any) => (
          <div
            key={v.id}
            className="variant-card clickable"
            onClick={() =>
              navigate(`/variant/${v.id}`, {
                state: { variant: v, all },
              })
            }
          >
            <img src={v.images?.[0]?.file_uri} />

            <div className="info">
              <p className="color">{v.color}</p>
              <p className="size">{v.size}</p>
              <p className="price">$ {v.sale_price}</p>
            </div>
          </div>
        ))}
      </div> */}
    </div>
  );
};

export default ProductView;
