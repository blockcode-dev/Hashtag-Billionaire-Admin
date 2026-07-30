/** @format */

import React, { useEffect, useState } from "react";
import { Table, Input, Image, Typography, Empty } from "antd";
import { SearchOutlined, GlobalOutlined } from "@ant-design/icons";
import { GetPublishedBrandsAPI } from "@/services/Api/BrandsApi";

const { Text } = Typography;

/* ─── helpers ───────────────────────────────────────────────── */
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const AVATAR_COLORS = [
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#d1fae5", text: "#065f46" },
  { bg: "#fce7f3", text: "#9d174d" },
  { bg: "#fef3c7", text: "#92400e" },
];

const avatarColor = (name: string) =>
  AVATAR_COLORS[
    name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
      AVATAR_COLORS.length
  ];

/* ─── component ─────────────────────────────────────────────── */
const PublishedBrands: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const getBrands = async () => {
    try {
      setLoading(true);
      const res = await GetPublishedBrandsAPI({ page, limit, search });
      setBrands(res?.data?.data?.data || []);
      setTotal(res?.data?.data?.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getBrands();
  }, [page, search]);

  const columns = [
    {
      title: "Brand",
      key: "brand",
      render: (_: any, record: any) => {
        const color = avatarColor(record.name);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Logo box */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid #f0f0f0",
                background: record.logo_url ? "#fff" : color.bg,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {record.logo_url ? (
                <img
                  src={record.logo_url}
                  alt={record.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: 4,
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: color.text,
                  }}
                >
                  {initials(record.name)}
                </span>
              )}
            </div>

            <div>
              <Text
                strong
                style={{ fontSize: 14, color: "#111827", display: "block" }}
              >
                {record.name}
              </Text>
              {record.supplier && (
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  {record.supplier}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 130,
      render: () => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 20,
            background: "#d1fae5",
            color: "#065f46",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <GlobalOutlined style={{ fontSize: 11 }} />
          Live on site
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: "20px 0 4px" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Input
          size="large"
          placeholder="Search published brands…"
          prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
          allowClear
          onChange={(e) => {
            if (!e.target.value) {
              setPage(1);
              setSearch("");
            }
          }}
          onPressEnter={(e) => {
            setPage(1);
            setSearch((e.target as HTMLInputElement).value);
          }}
          onBlur={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          style={{
            maxWidth: 400,
            borderRadius: 10,
            borderColor: "#e5e7eb",
            fontSize: 14,
          }}
        />

        {/* Count pill */}
        <div
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            background: "#d1fae5",
            border: "1px solid #a7f3d0",
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700, color: "#065f46" }}>
            {total}
          </span>
          <span style={{ fontSize: 12, color: "#059669", marginLeft: 6 }}>
            brands live
          </span>
        </div>
      </div>

      {/* Brand grid (logo cards) — only shown on non-search view with data */}
      {!search && brands.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: 10,
            marginBottom: 24,
            padding: "16px",
            background: "#f8f9fc",
            borderRadius: 14,
            border: "1px solid #e5e7eb",
          }}
        >
          {brands.slice(0, 20).map((brand) => {
            const color = avatarColor(brand.name);
            return (
              <div
                key={brand.id}
                title={brand.name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 7,
                  padding: "12px 8px",
                  borderRadius: 12,
                  background: "#fff",
                  border: "1px solid #f0f0f0",
                  cursor: "default",
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 4px 16px rgba(79,70,229,0.10)";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "#c7d2fe";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "#f0f0f0";
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: brand.logo_url ? "#fafafa" : color.bg,
                    border: "1px solid #f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {brand.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        padding: 3,
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: color.text,
                      }}
                    >
                      {initials(brand.name)}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "#374151",
                    fontWeight: 600,
                    textAlign: "center",
                    lineHeight: 1.3,
                    maxWidth: 90,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%",
                  }}
                >
                  {brand.name}
                </span>
              </div>
            );
          })}
          {brands.length > 20 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 8px",
                borderRadius: 12,
                background: "#f3f4f6",
                border: "1px dashed #d1d5db",
                color: "#9ca3af",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              +{brands.length - 20} more
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={brands}
        locale={{
          emptyText: (
            <Empty
              description={
                <span style={{ color: "#9ca3af" }}>
                  {search
                    ? `No brands found for "${search}"`
                    : "No published brands yet"}
                </span>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        pagination={{
          current: page,
          total,
          pageSize: limit,
          onChange: setPage,
          showTotal: (t) => (
            <span style={{ color: "#9ca3af", fontSize: 13 }}>
              {t} brands total
            </span>
          ),
        }}
        style={{ borderRadius: 12, overflow: "hidden" }}
        components={{
          header: {
            cell: (props: any) => (
              <th
                {...props}
                style={{
                  ...props.style,
                  background: "#f8f9fc",
                  color: "#6b7280",
                  fontWeight: 600,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  borderBottom: "1px solid #e5e7eb",
                  padding: "12px 16px",
                }}
              />
            ),
          },
        }}
      />
    </div>
  );
};

export default PublishedBrands;