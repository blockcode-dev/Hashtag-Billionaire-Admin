/** @format */

import React, { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { DataTable } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { SearchInput } from "@/components/common/SearchInput";
import { GetPublishedBrandsAPI } from "@/services/Api/BrandsApi";

/* ─── helpers ───────────────────────────────────────────────── */
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const AVATAR_COLORS = [
  { bg: "var(--violet-soft)", text: "var(--violet)" },
  { bg: "var(--primary-soft)", text: "var(--primary)" },
  { bg: "var(--success-soft)", text: "var(--success-soft-foreground)" },
  { bg: "var(--violet-soft)", text: "var(--violet-soft-foreground)" },
  { bg: "var(--warning-soft)", text: "var(--warning-soft-foreground)" },
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
                borderRadius: "var(--radius-xl)",
                overflow: "hidden",
                border: "1px solid var(--border)",
                background: record.logo_url ? "var(--background)" : color.bg,
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
              <strong
                style={{ fontSize: 14, color: "var(--foreground)", display: "block", fontWeight: 600 }}
              >
                {record.name}
              </strong>
              {record.supplier && (
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
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
            borderRadius: "var(--radius-2xl)",
            background: "var(--success-soft)",
            color: "var(--success-soft-foreground)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Globe size="1em" style={{ fontSize: 11 }} />
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
        <SearchInput
          size="large"
          placeholder="Search published brands…"
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
          style={{ maxWidth: 400 }}
        />

        {/* Count pill */}
        <div
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius-lg)",
            background: "var(--success-soft)",
            border: "1px solid var(--success-border)",
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700, color: "var(--success-soft-foreground)" }}>
            {total}
          </span>
          <span style={{ fontSize: 12, color: "var(--success-soft-foreground)", marginLeft: 6 }}>
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
            background: "var(--muted)",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border)",
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
                  borderRadius: "var(--radius-xl)",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  cursor: "default",
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 4px 16px color-mix(in srgb, var(--primary) 10%, transparent)";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--primary-border)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--muted)";
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "var(--radius-lg)",
                    overflow: "hidden",
                    background: brand.logo_url ? "var(--muted)" : color.bg,
                    border: "1px solid var(--border)",
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
                    color: "var(--foreground)",
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
                borderRadius: "var(--radius-xl)",
                background: "var(--muted)",
                border: "1px dashed var(--input)",
                color: "var(--muted-foreground)",
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
      <DataTable
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={brands}
        emptyText={
          <EmptyState
            description={
              search ? `No brands found for "${search}"` : "No published brands yet"
            }
          />
        }
        pagination={{
          current: page,
          total,
          pageSize: limit,
          onChange: setPage,
          showTotal: (t) => `${t} brands total`,
        }}
      />
    </div>
  );
};

export default PublishedBrands;