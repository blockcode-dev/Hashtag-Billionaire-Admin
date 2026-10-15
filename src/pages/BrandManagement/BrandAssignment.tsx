/** @format */

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Table,
  Input,
  Button,
  Modal,
  Select,
  message,
  Tag,
  Image,
  Space,
  Empty,
  Tooltip,
} from "antd";
import {
  SearchOutlined,
  TagsOutlined,
  LeftOutlined,
  RightOutlined,
  FilterOutlined,
} from "@ant-design/icons";

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
  if (!items.length) return <span style={{ color: "#d1d5db" }}>—</span>;
  const label = items.map((i) => i.title).join(", ");
  return (
    <Tooltip title={items.length > 1 ? label : undefined}>
      <Tag color={color} style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {items[0].title}
        {items.length > 1 ? ` +${items.length - 1}` : ""}
      </Tag>
    </Tooltip>
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
          border: "1px solid #eee",
          background: "#fafafa",
          borderRadius: 6,
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
        borderRadius: 6,
        overflow: "hidden",
        border: "1px solid #eee",
        background: "#fafafa",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Image.PreviewGroup items={uris}>
        <Image
          src={uris[index]}
          width={48}
          height={48}
          style={{ objectFit: "contain" }}
          fallback="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y1ZjVmNSIvPjwvc3ZnPg=="
        />
      </Image.PreviewGroup>

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
                "linear-gradient(to right, rgba(0,0,0,0.35), rgba(0,0,0,0))",
              cursor: "pointer",
            }}
          >
            <LeftOutlined style={{ fontSize: 8, color: "#fff" }} />
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
                "linear-gradient(to left, rgba(0,0,0,0.35), rgba(0,0,0,0))",
              cursor: "pointer",
            }}
          >
            <RightOutlined style={{ fontSize: 8, color: "#fff" }} />
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
      message.error("Failed to load products");
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
      message.success(
        `Brand assigned to ${selectedRowKeys.length} product${
          selectedRowKeys.length > 1 ? "s" : ""
        }`,
      );
      setBrandModalOpen(false);
      setSelectedRowKeys([]);
      fetchProducts();
    } catch (err) {
      console.error(err);
      message.error("Failed to assign brand");
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
            <Tooltip title={record.name}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#111827",
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
            </Tooltip>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
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
        <Tooltip title={record.supplier_name}>
          <Tag color="blue">{record.supplier}</Tag>
        </Tooltip>
      ),
    },
    {
      title: "Current Brand",
      key: "brand",
      width: 150,
      render: (_: any, record: Product) =>
        record.brand ? (
          <Space direction="vertical" size={2}>
            <Tag color="green">{record.brand.name}</Tag>
            {record.is_brand_manually_assigned && (
              <span style={{ fontSize: 10, color: "#9ca3af" }}>Manually set</span>
            )}
          </Space>
        ) : (
          <Tag color="default">Unassigned</Tag>
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
        <Button
          size="small"
          icon={<TagsOutlined />}
          onClick={() => openAssignModal([record.id])}
        >
          Assign
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: "20px 0 4px", overflowX: "hidden" }}>
      {/* Heading */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#111827",
            margin: 0,
          }}
        >
          Brand Assignment
        </h1>
        <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
          Review unbranded products pulled from suppliers and assign the
          correct brand.
        </p>
      </div>

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
          <Input
            size="large"
            placeholder="Search products by name…"
            prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
            allowClear
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ maxWidth: 360, flex: "1 1 240px" }}
          />

          <Select<AssignedFilter>
            size="large"
            value={assignedFilter}
            onChange={handleFilterChange}
            style={{ width: 200 }}
            suffixIcon={<FilterOutlined style={{ color: "#9ca3af" }} />}
            options={[
              { label: "All Products", value: "all" },
              { label: "Brand Assigned", value: "true" },
              { label: "Not Assigned", value: "false" },
            ]}
          />
        </div>

        <Button
          type="primary"
          disabled={selectedRowKeys.length === 0}
          onClick={() => openAssignModal()}
          style={{ flexShrink: 0 }}
        >
          Assign Brand ({selectedRowKeys.length})
        </Button>
      </div>

      <Table
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
          showSizeChanger: false,
          onChange: setPage,
          showTotal: (t) => (
            <span style={{ color: "#9ca3af", fontSize: 13 }}>
              {t} products total
            </span>
          ),
        }}
        locale={{
          emptyText: <Empty description="No products found matching filters" />,
        }}
      />

      <Modal
        open={brandModalOpen}
        title={`Assign Brand to ${selectedRowKeys.length} product${
          selectedRowKeys.length > 1 ? "s" : ""
        }`}
        onCancel={() => setBrandModalOpen(false)}
        onOk={handleAssign}
        okButtonProps={{ disabled: !selectedBrandId, loading: assigning }}
        okText="Assign"
      >
        <Select
          showSearch
          style={{ width: "100%" }}
          placeholder="Search brand…"
          filterOption={false}
          loading={brandSearchLoading}
          onSearch={searchBrands}
          value={selectedBrandId ?? undefined}
          onChange={(val) => setSelectedBrandId(val)}
          options={brandOptions.map((b) => ({ label: b.name, value: b.id }))}
        />
      </Modal>
    </div>
  );
};

export default BrandAssignment;