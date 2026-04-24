/** @format */

import { useEffect, useState } from "react";
import {
  GetAllProductsAPI,
  GetProductStatsAPI,
} from "@/services/Api/ProductApi";
import { Search, Eye, Package, Layers, Tag, Archive } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./Products.scss";

const ProductsPage = () => {
  const [variants, setVariants] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<any>(null);
  const navigate = useNavigate();

  // 🔁 debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  // 📦 fetch data
  const load = async () => {
    try {
      const res = await GetAllProductsAPI({
        page,
        limit: 50,
        search: debouncedSearch,
      });

      const payload = res.data.data;

      setVariants(payload.data || []);
      setTotalPages(payload.totalPages || 1);
    } catch (err) {
      console.error("Failed to load variants", err);
    }
  };

  useEffect(() => {
    load();
  }, [page, debouncedSearch]);

  const loadStats = async () => {
    try {
      const res = await GetProductStatsAPI();
      setStats(res.data.data);
    } catch (err) {
      console.error("Failed to load stats", err);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="products-root">
      {/* HEADER */}
      <div className="products-header">
        <div className="left">
          <h1>Products</h1>
          <p>
            {variants.length} variants &mdash; page {page} of {totalPages}
          </p>
        </div>

        <div className="right">
          <div className="action-bar">
            <div className="search-box">
              <Search size={14} />
              <input
                placeholder="Search name, SKU, style..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple">
            <Layers size={18} />
          </div>
          <div className="stat-body">
            <p>Total Variants</p>
            <h2>{stats?.totalVariants ?? "—"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Package size={18} />
          </div>
          <div className="stat-body">
            <p>Total Products</p>
            <h2>{stats?.totalProducts ?? "—"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Tag size={18} />
          </div>
          <div className="stat-body">
            <p>S&amp;S Variants</p>
            <h2>{stats?.ssVariants ?? "—"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Archive size={18} />
          </div>
          <div className="stat-body">
            <p>Sage Variants</p>
            <h2>{stats?.sageVariants ?? "—"}</h2>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Style Name</th>
              <th>Color</th>
              <th>Size</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {variants.map((v) => (
              <tr key={v.id}>
                <td>
                  <div className="product-cell">
                    <img
                      src={
                        v.images?.[0]?.file_uri ||
                        v.product?.attachments?.[0]?.file_uri ||
                        "/placeholder.png"
                      }
                      alt="product"
                    />

                    <div className="info">
                      <p className="name">{v.product?.name}</p>
                      <span className="sku">{v.sku}</span>
                    </div>
                  </div>
                </td>

                <td>{v.product?.external_style_name}</td>
                <td>{v.color}</td>
                <td>{v.size}</td>
                <td>$ {v.price}</td>
                <td>{v.stock}</td>

                <td>
                  <button
                    onClick={() =>
                      navigate(`/products/${v.id}`, {
                        state: { variant: v },
                      })
                    }
                    className="btn-view"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {variants.length === 0 && <p className="no-data">No data found</p>}
      </div>

      {/* PAGINATION */}
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(1)}>
          ⏮ First
        </button>

        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          ← Prev
        </button>

        {[...Array(totalPages)]
          .map((_, i) => i + 1)
          .filter((p) => p >= page - 2 && p <= page + 2)
          .map((p) => (
            <button
              key={p}
              className={p === page ? "active" : ""}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}

        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next →
        </button>

        <button
          disabled={page === totalPages}
          onClick={() => setPage(totalPages)}
        >
          Last ⏭
        </button>
      </div>
    </div>
  );
};

export default ProductsPage;