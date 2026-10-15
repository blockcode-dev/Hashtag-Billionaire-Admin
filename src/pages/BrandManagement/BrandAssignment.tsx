/** @format */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Tags, ChevronLeft, ChevronRight, Filter as FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/common/Combobox";
import { DataTable } from "@/components/common/DataTable";
import { ImagePreview } from "@/components/common/ImagePreview";
import { SearchInput } from "@/components/common/SearchInput";
import { Spinner } from "@/components/common/Spinner";
import { StatusTag } from "@/components/common/StatusTag";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Tip } from "@/components/common/Tip";

import {
  GetPublishedBrandsAPI,
  GetBrandAssignmentAPI,
  AssignBrandToProductsAPI,
} from "@/services/Api/BrandsApi";

/* ─── types (matches real API shape) ─────────────────────────── */
interface Attachment {
  id: number;
  file_name: string;
  file_uri: string;
  is_primary: boolean;
}

interface GrandCategory {
  id: number;
  title: string;
}

interface ParentCategory {
  id: number;
  title: string;
  grand_categories: GrandCategory[];
}

interface ProductCategory {
  id: number;
  title: string;
  supplier: string;
  parent_categories: ParentCategory[];
}

interface Product {
  id: number;
  name: string;
  external_style_id?: string;
  supplier: string;
  supplier_id?: string;
  supplier_name?: string;
  is_brand_manually_assigned: boolean;
  brand: { id: number; name: string; slug?: string; logo_url?: string } | null;
  attachments: Attachment[];
  categories: ProductCategory[];
}

interface BrandOption {
  id: number;
  name: string;
}

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 450;

// ⚠️ ASSUMPTION — value used for "all" (no filter applied) is undefined/omitted from params.
// Filter values map directly to booleans sent as is_brand_manually_assigned=true/false.
type AssignedFilter = "all" | "true" | "false";

/* ─── helpers ──────────────────────────────────────────────────── */
const getParentCategories = (categories: ProductCategory[] = []) => {
  const map = new Map<number, string>();
  categories.forEach((c) =>
    c.parent_categories?.forEach((p) => map.set(p.id, p.title)),
  );
  return Array.from(map, ([id, title]) => ({ id, title }));
};

const getGrandCategories = (categories: ProductCategory[] = []) => {
  const map = new Map<number, string>();
  categories.forEach((c) =>
    c.parent_categories?.forEach((p) =>
      p.grand_categories?.forEach((g) => map.set(g.id, g.title)),
    ),
  );
  return Array.from(map, ([id, title]) => ({ id, title }));
};

// Join tag titles into one compact string, with a tooltip showing the full list
const TagListCell: React.FC<{ items: { id: number; title: string }[]; color?: string }> = ({
  items,
  color,
}) => {
  if (!items.length) return <span style={{ color: "var(--placeholder)" }}>—</span>;
  const label = items.map((i) => i.title).join(", ");
  return (
    <Tip content={items.length > 1 ? label : undefined}>
      <StatusTag color={color} className="block max-w-[150px] truncate">
        {items[0].title}
        {items.length > 1 ? ` +${items.length - 1}` : ""}
      </StatusTag>
    </Tip>
  );
};

/* ─── product image cell (clean hover-nav, no layout shift) ──── */
const ProductImageCell: React.FC<{ attachments: Attachment[] }> = ({
  attachments,
}) => {
  const uris = (attachments || []).map((a) => a.file_uri).filter(Boolean);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  if (uris.length === 0) {
    return (
      <div
        style={{
          width: 48,
          height: 48,
          border: "1px solid var(--border)",
          background: "var(--muted)",
          borderRadius: "var(--radius-md)",
          flexShrink: 0,
        }}
      />
    );
  }

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i === 0 ? uris.length - 1 : i - 1));
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i === uris.length - 1 ? 0 : i + 1));
  };

  return (
    <div
      style={{
        position: "relative",
        width: 48,
        height: 48,
        flexShrink: 0,
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--muted)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ImagePreview
        src={uris[index]}
        gallery={uris}
        width={48}
        height={48}
        style={{ objectFit: "contain", width: 48, height: 48 }}
        fallback="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y1ZjVmNSIvPjwvc3ZnPg=="
      />

      {uris.length > 1 && hovered && (
        <>
          <div
            onClick={goPrev}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(to right, color-mix(in srgb, var(--foreground) 35%, transparent), transparent)",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size="1em" style={{ fontSize: 8, color: "#fff" }} />
          </div>
          <div
            onClick={goNext}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(to left, color-mix(in srgb, var(--foreground) 35%, transparent), transparent)",
              cursor: "pointer",
            }}
          >
            <ChevronRight size="1em" style={{ fontSize: 8, color: "#fff" }} />
          </div>
        </>
      )}
    </div>
  );
};

/* ─── component ────────────────────────────────────────────────── */
const BrandAssignment: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter by whether a brand has already been manually assigned
  const [assignedFilter, setAssignedFilter] = useState<AssignedFilter>("all");

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [brandSearchLoading, setBrandSearchLoading] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);

  const brandSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    searchDebounceTimer.current = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    };
  }, [searchInput]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await GetBrandAssignmentAPI({
        page,
        limit: PAGE_SIZE,
        search,
        ...(assignedFilter !== "all"
          ? { is_brand_manually_assigned: assignedFilter }
          : {}),
      });
      const data = res?.data?.data;
      setProducts(data?.products || []);
      setTotal(data?.pagination?.total || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [page, search, assignedFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const searchBrands = useCallback((value: string) => {
    if (brandSearchTimer.current) clearTimeout(brandSearchTimer.current);
    brandSearchTimer.current = setTimeout(async () => {
      try {
        setBrandSearchLoading(true);
        const res = await GetPublishedBrandsAPI({
          page: 1,
          limit: 50,
          search: value,
        });
        setBrandOptions(res?.data?.data?.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setBrandSearchLoading(false);
      }
    }, 400);
  }, []);

  const openAssignModal = (ids?: React.Key[]) => {
    if (ids) setSelectedRowKeys(ids);
    setSelectedBrandId(null);
    setBrandOptions([]);
    setBrandModalOpen(true);
    searchBrands("");
  };

  const handleAssign = async () => {
    if (!selectedBrandId || selectedRowKeys.length === 0) return;
    try {
      setAssigning(true);
      await AssignBrandToProductsAPI({
        product_ids: selectedRowKeys as number[],
        brand_id: selectedBrandId,
      });
      toast.success(
        `Brand assigned to ${selectedRowKeys.length} product${
          selectedRowKeys.length > 1 ? "s" : ""
        }`,
      );
      setBrandModalOpen(false);
      setSelectedRowKeys([]);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign brand");
    } finally {
      setAssigning(false);
    }
  };

  const handleFilterChange = (value: AssignedFilter) => {
    if (value === assignedFilter) return;
    setAssignedFilter(value);
    setPage(1);
    setSelectedRowKeys([]);
  };

  /* ─── columns (tightened widths, table.layout=fixed) ─────────── */
  const columns = [
    {
      title: "Product",
      key: "product",
      width: 240,
      render: (_: any, record: Product) => (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <ProductImageCell attachments={record.attachments} />
          <div style={{ minWidth: 0 }}>
            <Tip content={record.name}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: "var(--foreground)",
                  lineHeight: 1.35,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const,
                }}
              >
                {record.name}
              </div>
            </Tip>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
              ID: {record.id}
              {record.supplier_id ? ` · SID: ${record.supplier_id}` : ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Supplier",
      key: "supplier",
      width: 90,
      render: (_: any, record: Product) => (
        <Tip content={record.supplier_name}>
          <StatusTag color="blue">{record.supplier}</StatusTag>
        </Tip>
      ),
    },
    {
      title: "Current Brand",
      key: "brand",
      width: 150,
      render: (_: any, record: Product) =>
        record.brand ? (
          <div className="flex flex-col items-start gap-0.5">
            <StatusTag color="green">{record.brand.name}</StatusTag>
            {record.is_brand_manually_assigned && (
              <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Manually set</span>
            )}
          </div>
        ) : (
          <StatusTag>Unassigned</StatusTag>
        ),
    },
    {
      title: "Category",
      key: "categories",
      width: 130,
      render: (_: any, record: Product) => (
        <TagListCell items={record.categories?.map((c) => ({ id: c.id, title: c.title })) || []} />
      ),
    },
    {
      title: "Parent Category",
      key: "parentCategories",
      width: 140,
      render: (_: any, record: Product) => (
        <TagListCell items={getParentCategories(record.categories)} color="purple" />
      ),
    },
    {
      title: "Grand Category",
      key: "grandCategories",
      width: 140,
      render: (_: any, record: Product) => (
        <TagListCell items={getGrandCategories(record.categories)} color="geekblue" />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      fixed: "right" as const,
      render: (_: any, record: Product) => (
        <Button size="sm" variant="outline" onClick={() => openAssignModal([record.id])}>
          <Tags size={13} />
          Assign
        </Button>
      ),
    },
  ];

  return (
    <div style={{ paddingBottom: 4, overflowX: "hidden" }}>
      <PageHeader
        title="Brand Assignment"
        description="Review unbranded products pulled from suppliers and assign the correct brand."
      />

      {/* Search + filter + assign bar */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, flex: "1 1 400px", flexWrap: "wrap" }}>
          <SearchInput
            size="large"
            placeholder="Search products by name…"
            allowClear
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ maxWidth: 360, flex: "1 1 240px" }}
          />

          <Combobox<AssignedFilter>
            size="large"
            searchable={false}
            value={assignedFilter}
            onChange={(v) => v && handleFilterChange(v)}
            style={{ width: 200 }}
            triggerIcon={<FilterIcon size={14} className="text-muted-foreground" />}
            options={[
              { label: "All Products", value: "all" },
              { label: "Brand Assigned", value: "true" },
              { label: "Not Assigned", value: "false" },
            ]}
          />
        </div>

        <Button
          disabled={selectedRowKeys.length === 0}
          onClick={() => openAssignModal()}
          style={{ flexShrink: 0 }}
        >
          Assign Brand ({selectedRowKeys.length})
        </Button>
      </div>

      <DataTable
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={products}
        tableLayout="fixed"
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        pagination={{
          current: page,
          total,
          pageSize: PAGE_SIZE,
          onChange: setPage,
          showTotal: (t) => `${t} products total`,
        }}
        emptyText={<EmptyState description="No products found matching filters" />}
      />

      <Dialog open={brandModalOpen} onOpenChange={setBrandModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {`Assign Brand to ${selectedRowKeys.length} product${
                selectedRowKeys.length > 1 ? "s" : ""
              }`}
            </DialogTitle>
            <DialogDescription>Search for the brand to assign.</DialogDescription>
          </DialogHeader>
          <Combobox
            placeholder="Search brand…"
            searchPlaceholder="Type a brand name…"
            loading={brandSearchLoading}
            onSearch={searchBrands}
            value={selectedBrandId ?? undefined}
            onChange={(val) => setSelectedBrandId(val ?? null)}
            options={brandOptions.map((b) => ({ label: b.name, value: b.id }))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrandModalOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!selectedBrandId || assigning} onClick={handleAssign}>
              {assigning && <Spinner size="small" className="text-current" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BrandAssignment;