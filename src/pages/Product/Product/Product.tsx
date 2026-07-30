/** @format */

import { useEffect, useState } from "react";
import {
  Search,
  Package,
  Layers,
  Tag,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Trash2,
  Database,
  Zap,
} from "lucide-react";
import "./Product.scss";
import { Modal, message } from "antd";
import {
  GetAllProductsAdminAPI,
  GetProductStatsAPI,
  DeleteProductAPI,
} from "@/services/Api/ProductApi";
import { useNavigate } from "react-router-dom";

const TABS = [
  { label: "All Products", value: "" },
  { label: "Manual", value: "MANUAL" },
  { label: "S&S", value: "SS" },
  { label: "SAGE", value: "SAGE" },
  { label: "Sanmar", value: "SANMAR" },
  { label: "Otto Cap", value: "OTTOCAP" },
];

const ProductsPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const load = async () => {
    try {
      const res = await GetAllProductsAdminAPI({
        page,
        limit: 100,
        search: debouncedSearch,
        source: activeTab || undefined,
      });
      const payload = res.data.data;
      setProducts(payload.data || []);
      setTotalPages(payload.totalPages || 1);
    } catch (err) {
      console.error("Failed to load products", err);
    }
  };

  useEffect(() => {
    load();
  }, [page, debouncedSearch, activeTab]);

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

  const handleDelete = (product: any) => {
    Modal.confirm({
      title: "Delete Product",
      content: (
        <div>
          <p>
            <strong>{product.name}</strong>
          </p>

          <p style={{ color: "#dc2626", marginTop: 8 }}>
            This will permanently delete everything associated with this
            product.
          </p>
        </div>
      ),
      okText: "Delete",
      okType: "danger",

      onOk: async () => {
        try {
          const payload =
            product.supplier === "MANUAL"
              ? {
                  product_id: product.id,
                }
              : {
                  styleId: product.external_style_id,
                  supplier: product.supplier,
                };

          await DeleteProductAPI(payload);

          message.success("Product deleted successfully ✅");

          load();
          loadStats();
        } catch (err) {
          console.error(err);

          message.error("Failed to delete product ❌");
        }
      },
    });
  };

  const getCategoryHierarchy = (product: any) => {
    if (!product.categories?.length)
      return { main: null, sub: null, supplier: null };
    const cat = product.categories[0];
    let main = null,
      sub = null;
    const supplier = cat.title;
    for (const parent of cat.parent_categories || []) {
      if (parent.grand_categories?.length) {
        main = parent.grand_categories[0].title;
        sub = parent.title;
        break;
      }
    }
    return { main, sub, supplier };
  };

  return (
    <div className="products-root">
      <div className="products-header">
        <div className="left">
          <h1>Product Catalog</h1>
          <p>Manage your inventory across multiple suppliers</p>
        </div>
        <button
          className="add-product-btn"
          onClick={() => navigate("/create-product")}
        >
          + Add Product
        </button>
      </div>

      {/* 📊 UPDATED STATS GRID */}
      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-icon purple">
            <Layers size={18} />
          </div>
          <div className="stat-body">
            <p>Total Variants</p>
            <h2>{stats?.totalVariants?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Package size={18} />
          </div>
          <div className="stat-body">
            <p>Total Products</p>
            <h2>{stats?.totalProducts?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Zap size={18} />
          </div>
          <div className="stat-body">
            <p>S&S Active</p>
            <h2>{stats?.ssProducts?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Archive size={18} />
          </div>
          <div className="stat-body">
            <p>Sage Active</p>
            <h2>{stats?.sageProducts?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pink">
            <Tag size={18} />
          </div>
          <div className="stat-body">
            <p>Sanmar</p>
            <h2>{stats?.sanmarProducts?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon indigo">
            <Database size={18} />
          </div>
          <div className="stat-body">
            <p>Otto Cap</p>
            <h2>{stats?.ottoCapProducts?.toLocaleString() ?? "0"}</h2>
          </div>
        </div>
      </div>

      <div className="filters-row">
        <div className="tabs-container">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              className={activeTab === tab.value ? "active" : ""}
              onClick={() => {
                setActiveTab(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="search-box">
          <Search size={16} />
          <input
            placeholder="Search by name or style ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product Details</th>
              <th>Style Name</th>
              <th>Supplier</th>
              <th>Categories</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const {
                main,
                sub,
                supplier: catSupplier,
              } = getCategoryHierarchy(p);
              return (
                <tr key={p.id}>
                  <td>
                    <div className="product-cell">
                      <img
                        src={p.attachments?.[0]?.file_uri}
                        alt={p.name}
                        // onError={(e) => (e.currentTarget.src = "/placeholder.png")}
                      />
                      <div className="info">
                        <p className="name">{p.name}</p>
                        <span className="sku">
                          {p.external_style_id || "-"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{p.external_style_name || p.name || "-"}</td>
                  <td>
                    <span className={`badge ${p.supplier?.toLowerCase()}`}>
                      {p.supplier}
                    </span>
                  </td>
                  <td>
                    <div className="cat-hierarchy">
                      {main && <span className="cat main">{main}</span>}
                      {sub && (
                        <>
                          <span className="cat-sep">›</span>
                          <span className="cat sub">{sub}</span>
                        </>
                      )}
                      {catSupplier && (
                        <>
                          <span className="cat-sep">›</span>
                          <span className="cat supplier">{catSupplier}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    {new Date(p.created_at).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn-view"
                        onClick={() =>
                          navigate(`/products/${p.id}`, {
                            state: { product: p },
                          })
                        }
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(p)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {products.length === 0 && (
          <div className="no-data">
            <Package size={32} style={{ marginBottom: 12, opacity: 0.2 }} />
            <p>No products found matching your criteria</p>
          </div>
        )}
      </div>

      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(1)}>
          <ChevronsLeft size={16} />
        </button>
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft size={16} />
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
          <ChevronRight size={16} />
        </button>
        <button
          disabled={page === totalPages}
          onClick={() => setPage(totalPages)}
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default ProductsPage;
