/** @format */

import React, { useEffect, useState } from "react";
import {
  Table,
  Input,
  Button,
  Modal,
  Upload,
  message,
  Image,
  Avatar,
  Tag,
  Typography,
  Tooltip,
} from "antd";
import {
  UploadOutlined,
  SearchOutlined,
  GlobalOutlined,
  EyeInvisibleOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { PublishBrandAPI, GetAllBrandsAPI } from "@/services/Api/BrandsApi";
import { useNavigate } from "react-router-dom";

const { Text } = Typography;

/* ─── tiny helpers ──────────────────────────────────────────── */
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
  { bg: "#fee2e2", text: "#991b1b" },
];

const avatarColor = (name: string) =>
  AVATAR_COLORS[
    name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
      AVATAR_COLORS.length
  ];

/* ─── component ─────────────────────────────────────────────── */
const AllBrands: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [fileList, setFileList] = useState<any[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [unpublishingId, setUnpublishingId] = useState<number | null>(null);

  const getBrands = async () => {
    try {
      setLoading(true);
      const res = await GetAllBrandsAPI({ page, limit, search });
      setBrands(res?.data?.data?.data || []);
      setTotal(res?.data?.data?.pagination?.total || 0);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getBrands();
  }, [page, search]);

  const publishBrand = async () => {
    try {
      setPublishing(true);
      const formData = new FormData();
      formData.append("brand_id", selectedBrand.id);
      formData.append("show_on_website", "true");
      if (fileList.length) {
        formData.append("images", fileList[0].originFileObj);
      }
      await PublishBrandAPI(formData);
      message.success(
        selectedBrand?.show_on_website
          ? "Logo updated successfully"
          : "Brand published successfully",
      );
      setOpen(false);
      setFileList([]);
      getBrands();
    } catch {
      message.error("Failed to save brand");
    } finally {
      setPublishing(false);
    }
  };

  const unpublishBrand = async (brandId: number) => {
    try {
      setUnpublishingId(brandId);
      const formData = new FormData();
      formData.append("brand_id", String(brandId));
      formData.append("show_on_website", "false");
      await PublishBrandAPI(formData);
      message.success("Brand unpublished successfully");
      getBrands();
    } catch {
      message.error("Failed to unpublish brand");
    } finally {
      setUnpublishingId(null);
    }
  };

  /* ─── columns ───────────────────────────────────────────────── */
  const columns = [
    {
      title: "Brand",
      key: "brand",
      render: (_: any, record: any) => {
        const color = avatarColor(record.name);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Logo / fallback */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                overflow: "hidden",
                flexShrink: 0,
                border: "1px solid #f0f0f0",
                background: record.logo_url ? "#fff" : color.bg,
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
                    letterSpacing: 0.5,
                  }}
                >
                  {initials(record.name)}
                </span>
              )}
            </div>

            {/* Name + supplier */}
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: "#111827",
                  lineHeight: 1.3,
                }}
              >
                {record.name}
              </div>
              {record.supplier && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    marginTop: 2,
                  }}
                >
                  {record.supplier}
                </div>
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
      render: (_: any, record: any) =>
        record.show_on_website ? (
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
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#10b981",
              }}
            />
            Published
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 20,
              background: "#f3f4f6",
              color: "#6b7280",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#d1d5db",
              }}
            />
            Hidden
          </span>
        ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (_: any, record: any) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Tooltip
            title={record.show_on_website ? "Edit logo" : "Publish to website"}
          >
            <Button
              type="primary"
              size="small"
              icon={
                record.show_on_website ? <EditOutlined /> : <GlobalOutlined />
              }
              onClick={() => {
                setSelectedBrand(record);
                setFileList([]);
                setOpen(true);
              }}
              style={
                record.show_on_website
                  ? {
                      background: "#f0f4ff",
                      borderColor: "#c7d2fe",
                      color: "#4f46e5",
                      fontWeight: 600,
                      fontSize: 12,
                    }
                  : {
                      background: "#4f46e5",
                      borderColor: "#4f46e5",
                      fontWeight: 600,
                      fontSize: 12,
                    }
              }
              ghost={record.show_on_website}
            >
              {record.show_on_website ? "Edit Logo" : "Publish"}
            </Button>
          </Tooltip>

          {record.show_on_website && (
            <Tooltip title="Remove from website">
              <Button
                size="small"
                icon={<EyeInvisibleOutlined />}
                loading={unpublishingId === record.id}
                onClick={() => unpublishBrand(record.id)}
                style={{
                  borderColor: "#fca5a5",
                  color: "#dc2626",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Unpublish
              </Button>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  /* ─── render ────────────────────────────────────────────────── */
  return (
    <>
      <div style={{ padding: "20px 0 4px" }}>
        {/* Search bar */}
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Input
            size="large"
            placeholder="Search brands by name or supplier…"
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
          <Button
            type="primary"
            size="large"
            onClick={() => navigate("/create-brand")}
            style={{
              background: "#4f46e5",
              borderColor: "#4f46e5",
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            + Create Brand
          </Button>
        </div>

        {/* Table */}
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={brands}
          pagination={{
            current: page,
            total,
            pageSize: limit,
            showSizeChanger: false,
            onChange: setPage,
            showTotal: (t) => (
              <span style={{ color: "#9ca3af", fontSize: 13 }}>
                {t} brands total
              </span>
            ),
          }}
          rowClassName={(_, idx) => (idx % 2 === 0 ? "" : "row-alt")}
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

      {/* ── Publish / Edit Logo Modal ── */}
      <Modal
        open={open}
        footer={null}
        width={500}
        title={null}
        onCancel={() => {
          setOpen(false);
          setFileList([]);
        }}
        styles={{
          content: { borderRadius: 20, padding: 0, overflow: "hidden" },
          mask: { backdropFilter: "blur(4px)", background: "rgba(0,0,0,0.3)" },
        }}
      >
        {/* Modal header band */}
        <div
          style={{
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            padding: "28px 28px 20px",
            position: "relative",
          }}
        >
          {/* Logo preview */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              background: "rgba(255,255,255,0.15)",
              border: "2px solid rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              margin: "0 auto 14px",
            }}
          >
            {selectedBrand?.logo_url ? (
              <img
                src={selectedBrand.logo_url}
                alt={selectedBrand.name}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <span style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>
                {selectedBrand?.name ? initials(selectedBrand.name) : "?"}
              </span>
            )}
          </div>

          <div style={{ textAlign: "center" }}>
            <h2
              style={{
                color: "#fff",
                fontSize: 20,
                fontWeight: 700,
                margin: "0 0 6px",
                letterSpacing: "-0.3px",
              }}
            >
              {selectedBrand?.name}
            </h2>
            {selectedBrand?.supplier && (
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 12px",
                  borderRadius: 20,
                  background: "rgba(255,255,255,0.2)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {selectedBrand.supplier}
              </span>
            )}
          </div>
        </div>

        {/* Modal body */}
        <div style={{ padding: 28 }}>
          <Text
            strong
            style={{
              fontSize: 14,
              color: "#374151",
              display: "block",
              marginBottom: 14,
            }}
          >
            {selectedBrand?.show_on_website
              ? "Replace Website Logo"
              : "Upload Website Logo"}
          </Text>

          <Upload
            beforeUpload={() => false}
            fileList={fileList}
            maxCount={1}
            listType="picture-card"
            onChange={({ fileList }) => setFileList(fileList)}
            style={{ borderRadius: 12 }}
          >
            {fileList.length < 1 && (
              <div style={{ padding: "8px 0" }}>
                <UploadOutlined style={{ fontSize: 22, color: "#9ca3af" }} />
                <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
                  Click to upload
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  PNG, JPG, SVG
                </div>
              </div>
            )}
          </Upload>

          {selectedBrand?.logo_url && fileList.length === 0 && (
            <div style={{ marginTop: 20 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Current Logo
              </Text>
              <div
                style={{
                  marginTop: 10,
                  padding: 16,
                  borderRadius: 12,
                  background: "#f8f9fc",
                  border: "1px solid #e5e7eb",
                  display: "inline-block",
                }}
              >
                <Image
                  width={120}
                  src={selectedBrand.logo_url}
                  preview={false}
                />
              </div>
            </div>
          )}

          {fileList.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: "#10b981",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                ✓ New Logo Preview
              </Text>
              <div
                style={{
                  marginTop: 10,
                  padding: 16,
                  borderRadius: 12,
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  display: "inline-block",
                }}
              >
                <Image
                  width={120}
                  preview={false}
                  src={URL.createObjectURL(fileList[0].originFileObj)}
                />
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 28,
              paddingTop: 20,
              borderTop: "1px solid #f3f4f6",
            }}
          >
            <Button
              size="large"
              onClick={() => {
                setOpen(false);
                setFileList([]);
              }}
              style={{ borderRadius: 10, fontWeight: 600, minWidth: 90 }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              size="large"
              loading={publishing}
              onClick={publishBrand}
              style={{
                borderRadius: 10,
                fontWeight: 600,
                minWidth: 140,
                background: "#4f46e5",
                borderColor: "#4f46e5",
              }}
            >
              {selectedBrand?.show_on_website ? "Update Logo" : "Publish Brand"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default AllBrands;
