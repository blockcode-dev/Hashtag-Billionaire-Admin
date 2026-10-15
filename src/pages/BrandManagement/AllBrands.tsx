/** @format */

import React, { useEffect, useState } from "react";
import { Upload as UploadIcon, Globe, EyeOff, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/common/DataTable";
import { SearchInput } from "@/components/common/SearchInput";
import { Spinner } from "@/components/common/Spinner";
import { ImageUploadGrid, type UploadItem } from "@/components/common/Upload";
import { toast } from "sonner";
import { Tip } from "@/components/common/Tip";
import { PublishBrandAPI, GetAllBrandsAPI } from "@/services/Api/BrandsApi";
import { useNavigate } from "react-router";

/* ─── tiny helpers ──────────────────────────────────────────── */
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
  { bg: "var(--destructive-soft)", text: "var(--destructive-soft-foreground)" },
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
  const [fileList, setFileList] = useState<UploadItem[]>([]);
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
      toast.success(
        selectedBrand?.show_on_website
          ? "Logo updated successfully"
          : "Brand published successfully",
      );
      setOpen(false);
      setFileList([]);
      getBrands();
    } catch {
      toast.error("Failed to save brand");
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
      toast.success("Brand unpublished successfully");
      getBrands();
    } catch {
      toast.error("Failed to unpublish brand");
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
                borderRadius: "var(--radius-xl)",
                overflow: "hidden",
                flexShrink: 0,
                border: "1px solid var(--border)",
                background: record.logo_url ? "var(--background)" : color.bg,
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
                  color: "var(--foreground)",
                  lineHeight: 1.3,
                }}
              >
                {record.name}
              </div>
              {record.supplier && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
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
              borderRadius: "var(--radius-2xl)",
              background: "var(--success-soft)",
              color: "var(--success-soft-foreground)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--success)",
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
              borderRadius: "var(--radius-2xl)",
              background: "var(--muted)",
              color: "var(--muted-foreground)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--muted-strong)",
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
          <Tip
            content={record.show_on_website ? "Edit logo" : "Publish to website"}
          >
            <Button
              size="sm"
              variant={record.show_on_website ? "outline" : "default"}
              onClick={() => {
                setSelectedBrand(record);
                setFileList([]);
                setOpen(true);
              }}
              style={
                record.show_on_website
                  ? {
                      background: "var(--primary-soft)",
                      borderColor: "var(--primary-border)",
                      color: "var(--primary)",
                      fontWeight: 600,
                      fontSize: 12,
                    }
                  : {
                      background: "var(--primary)",
                      borderColor: "var(--primary)",
                      fontWeight: 600,
                      fontSize: 12,
                    }
              }
            >
              {record.show_on_website ? <Pencil size={13} /> : <Globe size={13} />}
              {record.show_on_website ? "Edit Logo" : "Publish"}
            </Button>
          </Tip>

          {record.show_on_website && (
            <Tip content="Remove from website">
              <Button
                size="sm"
                variant="outline"
                disabled={unpublishingId === record.id}
                onClick={() => unpublishBrand(record.id)}
                style={{
                  borderColor: "var(--destructive-border)",
                  color: "var(--destructive)",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {unpublishingId === record.id ? (
                  <Spinner size="small" className="text-current" />
                ) : (
                  <EyeOff size={13} />
                )}
                Unpublish
              </Button>
            </Tip>
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
          <SearchInput
            size="large"
            placeholder="Search brands by name or supplier…"
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
          <Button
            size="lg"
            onClick={() => navigate("/create-brand")}
            style={{
              background: "var(--primary)",
              borderColor: "var(--primary)",
              borderRadius: "var(--radius-lg)",
              fontWeight: 600,
            }}
          >
            + Create Brand
          </Button>
        </div>

        {/* Table */}
        <DataTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={brands}
          pagination={{
            current: page,
            total,
            pageSize: limit,
            onChange: setPage,
            showTotal: (t) => `${t} brands total`,
          }}
        />
      </div>

      {/* ── Publish / Edit Logo Modal ── */}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          setOpen(false);
          setFileList([]);
        }}
      >
        <DialogContent className="gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[500px]">
        {/* Modal header band */}
        <div
          style={{
            background: "var(--primary)",
            padding: "28px 28px 20px",
            position: "relative",
          }}
        >
          {/* Logo preview */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "var(--radius-2xl)",
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
            <DialogTitle
              style={{
                color: "#fff",
                fontSize: 20,
                fontWeight: 700,
                margin: "0 0 6px",
                letterSpacing: "-0.3px",
              }}
            >
              {selectedBrand?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {selectedBrand?.show_on_website
                ? "Replace the logo shown on the website"
                : "Upload a logo and publish this brand"}
            </DialogDescription>
            {selectedBrand?.supplier && (
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 12px",
                  borderRadius: "var(--radius-2xl)",
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
          <span
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--foreground)",
              display: "block",
              marginBottom: 14,
            }}
          >
            {selectedBrand?.show_on_website
              ? "Replace Website Logo"
              : "Upload Website Logo"}
          </span>

          <ImageUploadGrid
            fileList={fileList}
            onChange={setFileList}
            maxCount={1}
            addLabel={
              <>
                <UploadIcon size={18} />
                <span>Click to upload</span>
                <span className="text-[11px]">PNG, JPG, SVG</span>
              </>
            }
          />

          {selectedBrand?.logo_url && fileList.length === 0 && (
            <div style={{ marginTop: 20 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Current Logo
              </span>
              <div
                style={{
                  marginTop: 10,
                  padding: 16,
                  borderRadius: "var(--radius-xl)",
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  display: "inline-block",
                }}
              >
                <img width={120} src={selectedBrand.logo_url} alt="Current logo" />
              </div>
            </div>
          )}

          {fileList.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--success)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                ✓ New Logo Preview
              </span>
              <div
                style={{
                  marginTop: 10,
                  padding: 16,
                  borderRadius: "var(--radius-xl)",
                  background: "var(--success-soft)",
                  border: "1px solid var(--success-border)",
                  display: "inline-block",
                }}
              >
                <img width={120} src={fileList[0].url} alt="New logo preview" />
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
              borderTop: "1px solid var(--border)",
            }}
          >
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setOpen(false);
                setFileList([]);
              }}
              style={{ borderRadius: "var(--radius-lg)", fontWeight: 600, minWidth: 90 }}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              disabled={publishing}
              onClick={publishBrand}
              style={{
                borderRadius: "var(--radius-lg)",
                fontWeight: 600,
                minWidth: 140,
                background: "var(--primary)",
                borderColor: "var(--primary)",
              }}
            >
              {publishing && <Spinner size="small" className="text-current" />}
              {selectedBrand?.show_on_website ? "Update Logo" : "Publish Brand"}
            </Button>
          </div>
        </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AllBrands;
