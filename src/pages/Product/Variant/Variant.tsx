/** @format */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Archive,
  Database,
  Eye,
  Factory,
  Layers,
  Package,
  RefreshCw,
  Tag,
  TriangleAlert,
} from "lucide-react";
import { GetAllVariantAPI, GetProductStatsAPI } from "@/services/Api/ProductApi";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { SearchInput } from "@/components/common/SearchInput";
import { Spinner } from "@/components/common/Spinner";
import { Thumbnail } from "@/components/common/Thumbnail";
import "./Variant.scss";

const PAGE_SIZE = 100;

const STATS = [
  { key: "totalVariants", label: "Total Variants", icon: Layers, tone: "purple" },
  { key: "totalProducts", label: "Total Products", icon: Package, tone: "blue" },
  { key: "ssVariants", label: "S&S", icon: Tag, tone: "green" },
  { key: "sageVariants", label: "Sage", icon: Archive, tone: "orange" },
  { key: "sanmarVariants", label: "Sanmar", icon: Factory, tone: "cyan" },
  { key: "ottoCapVariants", label: "Ottocap", icon: Database, tone: "rose" },
] as const;

const count = (value: unknown) =>
  value == null || value === "" ? "—" : Number(value).toLocaleString();

const money = (value: unknown) => {
  const n = Number(value);
  return value == null || value === "" || !Number.isFinite(n) ? "—" : `$${n.toFixed(2)}`;
};

// For supplier products `price` is the supplier's cost (the shop adds the supplier's
// markup); for manual products it is the selling price.
const isManual = (v: any) => (v.supplier ?? v.product?.supplier ?? "").toUpperCase() === "MANUAL";

const VariantPage = () => {
  const [variants, setVariants] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The request the table last finished, so loading and error follow from it.
  const [settled, setSettled] = useState<{ key: string; failed: boolean } | null>(null);
  const navigate = useNavigate();

  const requestKey = `${page}|${debouncedSearch}|${reloadKey}`;
  const loading = settled?.key !== requestKey;
  const error = settled?.key === requestKey && settled.failed;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const key = `${page}|${debouncedSearch}|${reloadKey}`;

    GetAllVariantAPI({ page, limit: PAGE_SIZE, search: debouncedSearch })
      .then((res) => {
        if (cancelled) return;
        const payload = res.data?.data ?? {};
        const reported = Number(payload.total);
        setVariants(payload.data || []);
        setTotalPages(payload.totalPages || 1);
        setTotal(payload.total != null && Number.isFinite(reported) ? reported : null);
        setSettled({ key, failed: false });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load variants", err);
        setVariants([]);
        setSettled({ key, failed: true });
      });

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, reloadKey]);

  useEffect(() => {
    GetProductStatsAPI()
      .then((res) => setStats(res.data.data))
      .catch((err) => console.error("Failed to load stats", err));
  }, []);

  const changePage = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="variants-page">
      <PageHeader
        title="Product Variants"
        description="Every size and colour of every product, across all suppliers."
        actions={
          <SearchInput
            aria-label="Search variants"
            placeholder="Search name, SKU, style…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            wrapperClassName="w-full sm:w-72"
          />
        }
      />

      <div className="stats-grid">
        {STATS.map(({ key, label, icon: Icon, tone }) => (
          <div className="stat-card" key={key}>
            <div className={`stat-icon ${tone}`}>
              <Icon size={18} />
            </div>
            <div className="stat-body">
              <p>{label}</p>
              <h2>{count(stats?.[key])}</h2>
            </div>
          </div>
        ))}
      </div>

      <div className="table-wrap" aria-busy={loading}>
        <table className={loading && variants.length > 0 ? "opacity-60" : undefined}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Style Name</th>
              <th>Color</th>
              <th>Size</th>
              <th>Cost / price</th>
              <th>Stock</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {variants.map((v) => (
              <tr key={v.id}>
                <td>
                  <div className="product-cell">
                    <Thumbnail
                      src={v.images?.[0]?.file_uri || v.product?.attachments?.[0]?.file_uri}
                      size={44}
                      className="border"
                    />
                    <div className="info">
                      <p className="name">{v.product?.name || "Untitled product"}</p>
                      <span className="sku">{v.sku}</span>
                    </div>
                  </div>
                </td>
                <td>{v.product?.external_style_name || "—"}</td>
                <td>{v.color || "—"}</td>
                <td>{v.size || "—"}</td>
                <td>
                  {money(v.price)}
                  <div className="text-xs text-muted-foreground">
                    {isManual(v) ? "Price" : "Supplier cost"}
                  </div>
                </td>
                <td>{count(v.stock)}</td>
                <td className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`View ${v.product?.name || "variant"} ${v.color || ""} ${v.size || ""}`.trim()}
                    onClick={() => navigate(`/variant/${v.id}`, { state: { variant: v } })}
                  >
                    <Eye />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && variants.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <TriangleAlert className="size-8 text-destructive" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Couldn't load variants</p>
              <p className="text-sm text-muted-foreground">
                The server returned an error. Try again in a moment.
              </p>
            </div>
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        ) : !loading && variants.length === 0 ? (
          <EmptyState
            description={
              debouncedSearch ? `No variants match “${debouncedSearch}”.` : "No variants yet."
            }
          />
        ) : null}
      </div>

      {variants.length > 0 && (
        <Pagination
          className="mt-4"
          current={page}
          total={total ?? totalPages * PAGE_SIZE}
          pageSize={PAGE_SIZE}
          onChange={changePage}
          showTotal={total != null ? (t) => `${t.toLocaleString()} variants` : undefined}
        />
      )}
    </div>
  );
};

export default VariantPage;
