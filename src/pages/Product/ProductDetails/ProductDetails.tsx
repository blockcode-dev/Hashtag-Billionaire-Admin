import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { GetProductByIdAPI } from "@/services/Api/ProductApi";
import "./ProductDetail.scss";

const ProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState<any>(null);

  const load = async () => {
    try {
      const res = await GetProductByIdAPI(id);
      const data = res.data.data;
      setProduct(data);
      const firstImage =
        data.attachments?.[0]?.file_uri ||
        data.variants?.[0]?.images?.[0]?.file_uri ||
        "/placeholder.png";
      setActiveImage(firstImage);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!product) return (
    <div className="pd-loading">
      <div className="pd-loading-spinner" />
      <span>Loading product…</span>
    </div>
  );

  const minPrice = Math.min(
    ...(product.variants?.map((v: any) => Number(v.price)) || [0])
  );
  const totalStock = product.variants?.reduce(
    (acc: number, v: any) => acc + (Number(v.stock) || 0),
    0
  ) || 0;
  const inStockCount = product.variants?.filter((v: any) => v.stock > 0).length || 0;

  const allImages = [
    ...(product.attachments?.map((a: any) => a.file_uri) || []),
    ...(product.variants?.flatMap((v: any) => v.images?.map((i: any) => i.file_uri) || []) || []),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="product-details-page">

      {/* BREADCRUMB */}
      <div className="pd-breadcrumb">
        <span>Products</span>
        <span className="pd-breadcrumb-sep">/</span>
        <span className="pd-breadcrumb-active">{product.name}</span>
      </div>

      {/* HEADER */}
      <div className="pd-header">
        <div className="pd-header-left">
          <h1>{product.name}</h1>
          {product.external_style_id && (
            <span className="pd-style-id">Style ID: {product.external_style_id}</span>
          )}
        </div>
        <div className="pd-header-right">
          {product.supplier && (
            <span className="pd-badge-supplier">{product.supplier}</span>
          )}
          {/* <div className="pd-stat-pill">
            <span className="pd-stat-dot in" />
            {inStockCount} / {product.variants?.length || 0} in stock
          </div> */}
        </div>
      </div>

      {/* TOP GRID */}
      <div className="pd-top">

        {/* IMAGE COLUMN */}
        <div className="pd-image-col">
          <div className="pd-main-image">
            <img src={activeImage || "/placeholder.png"} alt={product.name} />
          </div>

          {allImages.length > 1 && (
            <div className="pd-thumbnails">
              {allImages.slice(0, 6).map((src: string, i: number) => (
                <button
                  key={i}
                  className={`pd-thumb ${activeImage === src ? "active" : ""}`}
                  onClick={() => setActiveImage(src)}
                >
                  <img src={src} alt={`View ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INFO COLUMN */}
        <div className="pd-info-col">

          {/* STATS ROW */}
          <div className="pd-stats-row">
            <div className="pd-stat-card">
              <span className="pd-stat-label">Base Price</span>
              <span className="pd-stat-value price">${minPrice.toFixed(2)}</span>
            </div>
            <div className="pd-stat-card">
              <span className="pd-stat-label">Cost Price</span>
              <span className="pd-stat-value">
                {product.variants?.[0]?.cost_price
                  ? `$${Number(product.variants[0].cost_price).toFixed(2)}`
                  : "—"}
              </span>
            </div>
            <div className="pd-stat-card">
              <span className="pd-stat-label">Retail Price</span>
              <span className="pd-stat-value">
                {product.variants?.[0]?.retail_price
                  ? `$${Number(product.variants[0].retail_price).toFixed(2)}`
                  : "—"}
              </span>
            </div>
            <div className="pd-stat-card">
              <span className="pd-stat-label">Total Stock</span>
              <span className="pd-stat-value">{totalStock}</span>
            </div>
          </div>

          {/* DETAILS */}
          <div className="pd-details-card">
            <div className="pd-details-row">
              <div>
                <label>Supplier</label>
                <p>{product.supplier || "N/A"}</p>
              </div>
              <div>
                <label>Style ID</label>
                <p>{product.external_style_id || "—"}</p>
              </div>
              <div>
                <label>Variants</label>
                <p>{product.variants?.length || 0}</p>
              </div>
            </div>

            {/* COLORS PREVIEW */}
            {product.variants?.some((v: any) => v.color) && (
              <div className="pd-colors">
                <label>Available Colors</label>
                <div className="pd-color-swatches">
                  {[...new Map(product.variants?.map((v: any) => [v.color, v])).values()].map(
                    (v: any) => (
                      <div
                        key={v.color}
                        className="pd-swatch"
                        style={{ background: v.color_code || "#ccc" }}
                        title={v.color}
                      />
                    )
                  )}
                </div>
              </div>
            )}

            {/* DESCRIPTION */}
            {product.description && (
              <div className="pd-description">
                <label>Description</label>
                <div dangerouslySetInnerHTML={{ __html: product.description }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VARIANTS TABLE */}
      <div className="pd-variants-section">
        <div className="pd-section-header">
          <h2>Variants <span className="pd-count">{product.variants?.length || 0}</span></h2>
        </div>

        <div className="pd-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>SKU</th>
                <th>Color</th>
                <th>Size</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Retail</th>
              </tr>
            </thead>
            <tbody>
              {product.variants?.map((v: any) => (
                <tr
                  key={v.id}
                  className={activeVariant?.id === v.id ? "active-row" : ""}
                  onClick={() => setActiveVariant(v)}
                >
                  <td>
                    <div className="pd-variant-img">
                      {v.images?.[0]?.file_uri ? (
                        <img
                          src={v.images[0].file_uri}
                          alt={v.sku}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImage(v.images[0].file_uri);
                          }}
                        />
                      ) : (
                        <div className="pd-variant-img-placeholder">—</div>
                      )}
                    </div>
                  </td>
                  <td className="pd-sku">{v.sku}</td>
                  <td>
                    <div className="pd-color-cell">
                      <span
                        className="pd-color-dot"
                        style={{ background: v.color_code || "#ccc" }}
                      />
                      <span>{v.color || "—"}</span>
                    </div>
                  </td>
                  <td>
                    <span className="pd-size-badge">{v.size || "—"}</span>
                  </td>
                  <td>
                    <span className={`pd-stock-badge ${v.stock > 0 ? "in" : "out"}`}>
                      {v.stock > 0 ? v.stock : "Out"}
                    </span>
                  </td>
                  <td className="pd-price">${Number(v.price || 0).toFixed(2)}</td>
                  <td className="pd-muted">
                    {v.cost_price ? `$${Number(v.cost_price).toFixed(2)}` : "—"}
                  </td>
                  <td className="pd-muted">
                    {v.retail_price ? `$${Number(v.retail_price).toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!product.variants?.length && (
            <div className="pd-no-data">No variants found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;