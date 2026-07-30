"use client";

import React, { useState } from "react";
import { Input, Upload, Button, Typography, message, Tag } from "antd";
import {
  UploadOutlined,
  ArrowLeftOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import { CreateManualBrandAPI } from "@/services/Api/BrandsApi";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

const COLORS = {
  brandYellow: "#F6DF4F",
  darkGrey: "#1C1C1E",
  lightBg: "#F9FAFB",
  borderLight: "#E5E7EB",
  mutedText: "#6B7280",
  successGreen: "#16A34A",
  successBg: "#DCFCE7",
};

export default function CreateBrandPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [fileList, setFileList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = ({ fileList: newList }: any) => {
    setFileList(newList);
    if (newList.length > 0 && newList[0].originFileObj) {
      setPreviewUrl(URL.createObjectURL(newList[0].originFileObj));
    } else {
      setPreviewUrl(null);
    }
  };

  const createBrand = async () => {
    if (!name.trim()) {
      return message.error("Brand name is required");
    }
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("name", name);
      if (fileList.length) {
        formData.append("images", fileList[0].originFileObj);
      }
      await CreateManualBrandAPI(formData);
      message.success("Brand created successfully");
      navigate("/brand-management");
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Failed to create brand");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: COLORS.lightBg,
        minHeight: "calc(100vh - 64px)",
        width: "100%",
      }}
    >
      {/* ── Top Navigation Bar ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 32px",
          borderBottom: `1px solid ${COLORS.borderLight}`,
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined style={{ fontSize: 14 }} />}
            onClick={() => navigate("/brand-management")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: COLORS.lightBg,
              border: `1px solid ${COLORS.borderLight}`,
              flexShrink: 0,
            }}
          />
          <div>
            {/* Breadcrumb */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.mutedText,
                  cursor: "pointer",
                }}
                onClick={() => navigate("/brand-management")}
              >
                Brand Management
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.mutedText }}>/</Text>
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.darkGrey,
                  fontWeight: 500,
                }}
              >
                Create Brand
              </Text>
            </div>
            <Title
              level={4}
              style={{ margin: 0, fontWeight: 600, fontSize: 17 }}
            >
              Create Brand
            </Title>
          </div>
        </div>

        {/* Right side status badge */}
        <Tag
          style={{
            background: COLORS.successBg,
            color: COLORS.successGreen,
            border: "none",
            borderRadius: 20,
            padding: "4px 12px",
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          ● Manual Entry
        </Tag>
      </div>

      {/* ── Page Body ── */}
      <div
        style={{
          padding: "32px",
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        {/* ── LEFT: Main Form Card ── */}
        <div
          style={{
            flex: 1,
            background: "#fff",
            borderRadius: 12,
            border: `1px solid ${COLORS.borderLight}`,
            overflow: "hidden",
          }}
        >
          {/* Card Header */}
          <div
            style={{
              padding: "18px 24px",
              borderBottom: `1px solid ${COLORS.borderLight}`,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLORS.brandYellow,
                border: `2px solid ${COLORS.darkGrey}`,
              }}
            />
            <Text strong style={{ fontSize: 14, color: COLORS.darkGrey }}>
              Brand Details
            </Text>
          </div>

          {/* Card Body */}
          <div style={{ padding: "28px 24px" }}>
            {/* Brand Name */}
            <div style={{ marginBottom: 28 }}>
              <Text
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.darkGrey,
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Brand Name <span style={{ color: "#EF4444" }}>*</span>
              </Text>
              <Input
                size="large"
                placeholder="e.g. Nike, Adidas, Puma..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onPressEnter={createBrand}
                style={{
                  borderRadius: 8,
                  height: 44,
                  borderColor: COLORS.borderLight,
                  fontSize: 14,
                }}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.mutedText,
                  marginTop: 6,
                  display: "block",
                }}
              >
                This name will appear on the website and in product listings.
              </Text>
            </div>

            {/* Brand Logo */}
            <div>
              <Text
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.darkGrey,
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Brand Logo
              </Text>

              <div
                style={{
                  border: `1.5px dashed ${COLORS.borderLight}`,
                  borderRadius: 10,
                  padding: "24px",
                  background: COLORS.lightBg,
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                {/* Upload Control */}
                <Upload
                  beforeUpload={() => false}
                  maxCount={1}
                  fileList={fileList}
                  onChange={handleFileChange}
                  showUploadList={false}
                >
                  {previewUrl ? (
                    <div
                      style={{
                        width: 88,
                        height: 88,
                        border: `1px solid ${COLORS.borderLight}`,
                        borderRadius: 10,
                        overflow: "hidden",
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={previewUrl}
                        alt="Logo preview"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 88,
                        height: 88,
                        border: `1.5px dashed ${COLORS.borderLight}`,
                        borderRadius: 10,
                        background: "#fff",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        cursor: "pointer",
                        transition: "border-color 0.2s",
                      }}
                    >
                      <UploadOutlined
                        style={{ fontSize: 20, color: COLORS.mutedText }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          color: COLORS.mutedText,
                          fontWeight: 500,
                        }}
                      >
                        Upload
                      </span>
                    </div>
                  )}
                </Upload>

                {/* Upload Info */}
                <div>
                  <Text
                    style={{
                      fontWeight: 500,
                      fontSize: 14,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {previewUrl
                      ? fileList[0]?.name || "Logo uploaded"
                      : "Upload brand logo"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: COLORS.mutedText,
                      display: "block",
                      lineHeight: "1.6",
                    }}
                  >
                    PNG, JPG or SVG · Max 5 MB
                    <br />
                    Recommended: 200×200px
                  </Text>
                  {previewUrl && (
                    <Button
                      size="small"
                      danger
                      type="text"
                      style={{
                        padding: 0,
                        fontSize: 12,
                        height: "auto",
                        marginTop: 6,
                      }}
                      onClick={() => {
                        setFileList([]);
                        setPreviewUrl(null);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card Footer / Actions */}
          <div
            style={{
              padding: "18px 24px",
              borderTop: `1px solid ${COLORS.borderLight}`,
              display: "flex",
              gap: 10,
              background: COLORS.lightBg,
            }}
          >
            <Button
              type="primary"
              size="large"
              loading={loading}
              icon={!loading && <CheckOutlined />}
              onClick={createBrand}
              style={{
                background: COLORS.darkGrey,
                borderColor: COLORS.darkGrey,
                color: COLORS.brandYellow,
                borderRadius: 8,
                padding: "0 24px",
                fontWeight: 600,
                height: 42,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Create Brand
            </Button>
            <Button
              size="large"
              onClick={() => navigate("/brand-management")}
              style={{
                borderRadius: 8,
                padding: "0 20px",
                height: 42,
                borderColor: COLORS.borderLight,
                color: COLORS.mutedText,
              }}
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* ── RIGHT: Tips Card ── */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            background: "#fff",
            borderRadius: 12,
            border: `1px solid ${COLORS.borderLight}`,
            overflow: "hidden",
          }}
        >
          {/* Tips Header */}
          <div
            style={{
              padding: "14px 18px",
              background: COLORS.darkGrey,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                background: COLORS.brandYellow,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: COLORS.darkGrey,
              }}
            >
              ?
            </div>
            <Text strong style={{ color: "#fff", fontSize: 13 }}>
              Tips
            </Text>
          </div>

          {/* Tips Body */}
          <div style={{ padding: "18px" }}>
            {[
              {
                title: "Use official name",
                desc: "Use the brand's official registered name exactly as it appears on their products.",
              },
              {
                title: "Logo quality",
                desc: "Upload a high-res logo on a transparent background for best results on the site.",
              },
              {
                title: "Visibility",
                desc: "New brands are automatically published and visible on the website immediately after creation.",
              },
            ].map((tip, i) => (
              <div key={i} style={{ marginBottom: i < 2 ? 16 : 0 }}>
                <div
                  style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: COLORS.lightBg,
                      border: `1px solid ${COLORS.borderLight}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: COLORS.darkGrey,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <Text
                      strong
                      style={{
                        fontSize: 13,
                        display: "block",
                        marginBottom: 3,
                      }}
                    >
                      {tip.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: COLORS.mutedText,
                        lineHeight: "1.55",
                      }}
                    >
                      {tip.desc}
                    </Text>
                  </div>
                </div>
                {i < 2 && (
                  <div
                    style={{
                      marginTop: 14,
                      marginLeft: 30,
                      borderBottom: `1px solid ${COLORS.borderLight}`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
