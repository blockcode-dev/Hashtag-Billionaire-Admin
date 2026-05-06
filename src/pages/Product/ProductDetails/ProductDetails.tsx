import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { GetProductByIdAPI } from "@/services/Api/ProductApi";
import "./ProductDetail.scss";

const ProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);

  const load = async () => {
    try {
      const res = await GetProductByIdAPI(id);
      setProduct(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!product) return <div className="loading">Loading...</div>;

  const minPrice = Math.min(
    ...(product.variants?.map((v: any) => Number(v.price)) || [0])
  );

  return (
    <div className="product-details-page">
      {/* HEADER */}
      <div className="pd-header">
        <div>
          <h1>{product.name}</h1>
          <p>Style ID: {product.external_style_id}</p>
        </div>

        <div className="pd-meta">
          <span className="badge">{product.supplier || "N/A"}</span>
          <span>{product.variants?.length || 0} variants</span>
        </div>
      </div>

      {/* TOP SECTION */}
      <div className="pd-top">
        {/* IMAGE */}
        <div className="pd-main-image">
          <img
            src={
              product.attachments?.[0]?.file_uri ||
              product.variants?.[0]?.images?.[0]?.file_uri ||
              "/placeholder.png"
            }
            alt="product"
          />
        </div>

        {/* INFO */}
        <div className="pd-info">
          <h2>{product.name}</h2>

          <div className="pd-info-grid">
            <div>
              <label>Style ID</label>
              <p>{product.external_style_id}</p>
            </div>

            <div>
              <label>Supplier</label>
              <p>{product.supplier || "N/A"}</p>
            </div>

            <div>
              <label>Total Variants</label>
              <p>{product.variants?.length || 0}</p>
            </div>

            <div>
              <label>Base Price</label>
              <p className="price">${minPrice.toFixed(2)}</p>
            </div>

            <div>
              <label>Retail Price</label>
              <p>{product.variants?.[0]?.retail_price || "-"}</p>
            </div>

            <div>
              <label>Cost Price</label>
              <p>{product.variants?.[0]?.cost_price || "-"}</p>
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="pd-description">
            <h4>Description</h4>
            <div
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        </div>
      </div>

      {/* VARIANTS */}
      <div className="pd-variants">
        <h2>Variants ({product.variants?.length || 0})</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Color</th>
                <th>Size</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Image</th>
              </tr>
            </thead>

            <tbody>
              {product.variants?.map((v: any) => (
                <tr key={v.id}>
                  <td className="sku">{v.sku}</td>

                  <td>
                    <div className="color-cell">
                      <span
                        className="color-dot"
                        style={{ background: v.color_code || "#ccc" }}
                      />
                      {v.color}
                    </div>
                  </td>

                  <td>
                    <span className="size-badge">{v.size}</span>
                  </td>

                  <td>
                    <span className={`stock ${v.stock > 0 ? "in" : "out"}`}>
                      {v.stock}
                    </span>
                  </td>

                  <td className="price">
                    ${Number(v.price || 0).toFixed(2)}
                  </td>

                  <td>
                    <img
                      src={v.images?.[0]?.file_uri || "/placeholder.png"}
                      className="variant-img"
                      onError={(e) =>
                        (e.currentTarget.src = "/placeholder.png")
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!product.variants?.length && (
            <div className="no-data">No variants found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;