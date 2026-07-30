/** @format */

import React from "react";
import { Tabs } from "antd";
import PublishedBrands from "./PublishedBrands";
import AllBrands from "./AllBrands";

const BrandManagement: React.FC = () => {
  const items = [
    {
      key: "published",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#10b981",
              display: "inline-block",
            }}
          />
          Published Brands
        </span>
      ),
      children: <PublishedBrands />,
    },
    {
      key: "all",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#6366f1",
              display: "inline-block",
            }}
          />
          All Brands
        </span>
      ),
      children: <AllBrands />,
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f9fc",
        padding: "32px 28px",
        fontFamily:
          "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "#111827",
            margin: 0,
            letterSpacing: "-0.5px",
          }}
        >
          Brand Management
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "#6b7280",
            margin: "6px 0 0",
          }}
        >
          Manage your brand catalogue and website visibility
        </p>
      </div>

      {/* Tab Card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        <Tabs
          defaultActiveKey="published"
          items={items}
          size="large"
          style={{ padding: "0 24px" }}
          tabBarStyle={{
            marginBottom: 0,
            borderBottom: "1px solid #f3f4f6",
          }}
        />
      </div>
    </div>
  );
};

export default BrandManagement;