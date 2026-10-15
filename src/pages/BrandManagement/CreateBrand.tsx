import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Check, Upload as UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { IMAGE_ACCEPT, checkImageFiles } from "@/lib/uploads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common/PageHeader";
import { FilePicker } from "@/components/common/Upload";
import { Spinner } from "@/components/common/Spinner";
import { CreateManualBrandAPI } from "@/services/Api/BrandsApi";

const TIPS = [
  {
    title: "Use the official name",
    desc: "Write the brand's registered name exactly as it appears on its products.",
  },
  {
    title: "Logo quality",
    desc: "Upload a high-resolution logo on a transparent background for the best result on the site.",
  },
  {
    title: "Visibility",
    desc: "New brands are published and visible on the website as soon as you create them.",
  },
];

export default function CreateBrandPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickLogo = (picked: File[]) => {
    const { accepted, error } = checkImageFiles(picked.slice(0, 1));
    if (error) toast.error(error);
    const [file] = accepted;
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setLogo(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setLogo(null);
    setPreviewUrl(null);
  };

  const createBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Enter the brand name.");
    setError(null);
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("name", name.trim());
      if (logo) formData.append("images", logo);
      await CreateManualBrandAPI(formData);
      toast.success("Brand created");
      navigate("/brand-management");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Couldn't create the brand. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/brand-management"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Brand Management
      </Link>
      <PageHeader title="Create brand" description="Add a brand by hand. Brands imported from suppliers are created automatically." />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_280px]">
        <form onSubmit={createBrand} className="rounded-xl border bg-card shadow-xs">
          <div className="space-y-6 p-6">
            <div className="space-y-2">
              <Label htmlFor="brand-name">
                Brand name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="brand-name"
                placeholder="e.g. Nike, Adidas, Puma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!error}
                aria-describedby="brand-name-hint"
                className="h-10"
              />
              <p id="brand-name-hint" className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                {error || "Shown on the website and in product listings."}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Logo</span>
              <div className="flex flex-wrap items-center gap-5 rounded-lg border border-dashed bg-muted/50 p-5">
                <FilePicker onFiles={pickLogo} accept={IMAGE_ACCEPT}>
                  {previewUrl ? (
                    <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border bg-background">
                      <img src={previewUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex size-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-background text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                      <UploadIcon className="size-5" />
                      Upload
                    </div>
                  )}
                </FilePicker>
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">{logo ? logo.name : "Upload the brand logo"}</p>
                  <p className="text-muted-foreground">PNG, JPG or WebP, up to 20 MB. 200 × 200 px works best.</p>
                  {logo && (
                    <Button type="button" variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={removeLogo}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t bg-muted/40 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => navigate("/brand-management")}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Spinner size="small" className="text-current" /> : <Check />}
              {loading ? "Creating…" : "Create brand"}
            </Button>
          </div>
        </form>

        <aside className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Tips</h2>
          <ol className="space-y-4">
            {TIPS.map((tip, i) => (
              <li key={tip.title} className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-soft-foreground">
                  {i + 1}
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{tip.title}</p>
                  <p className="text-sm text-muted-foreground">{tip.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
