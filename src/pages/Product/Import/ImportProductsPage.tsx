/** @format */

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileUp,
  Pencil,
  RefreshCw,
  TriangleAlert,
  Upload,
  XCircle,
} from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { confirm } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { apiErrorMessage } from "@/lib/api-errors";
import {
  GetProductImportFormatAPI,
  type ImportFormat,
  type ImportIssue,
  type ImportPreviewProduct,
} from "@/services/Api/ProductImportApi";
import { ImportProgress } from "./ImportProgress";
import {
  checkFile,
  clearImport,
  getImportJob,
  importFile,
  markSeen,
  plural,
  setTemplate,
  useImportJob,
  useImportPageShowing,
} from "./importJob";

// Several products from one CSV file. The backend owns the layout (columns, example file,
// limits): this page shows it, checks the file as soon as it's chosen, then imports it in one go.
// The file, the check and the import live in importJob.ts, so they carry on on other pages.

const NO_TEMPLATE = "none";
const ACCEPTED = [".csv", ".txt", ".tsv"];
// The product preview lists this many; the rest are counted.
const PREVIEW_LIMIT = 200;

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Saves text as a file. The byte order mark makes Excel open it as UTF-8.
const downloadCsv = (name: string, csv: string) => {
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// How much each column is needed, in words.
const neededLabel = (key: string, required: boolean) => {
  if (required) return "Yes";
  if (key === "price" || key === "pricing_template") return "Price or template";
  if (/^option\d_value$/.test(key)) return "With its option";
  return "No";
};

const TONES = {
  bad: "border-destructive-border bg-destructive-soft text-destructive-soft-foreground",
  warn: "border-warning-border bg-warning-soft text-warning-soft-foreground",
  good: "border-success-border bg-success-soft text-success-soft-foreground",
} as const;

const BACKGROUND_NOTE = "You can open other pages: it carries on, and a message in the corner tells you when it's done.";

// Asks before leaving while a check or an import is running. Either one carries on after.
const confirmLeave = (go: () => void) => {
  const { phase, file, report } = getImportJob();
  if (phase === "idle") return go();
  const products = report?.summary.products ?? 0;
  confirm(
    phase === "importing"
      ? {
          title: `${plural(products, "product")} ${products === 1 ? "is" : "are"} still being imported`,
          content:
            "Leaving doesn't stop the import. It carries on in the background, and a message in the corner tells you when the products are ready.",
          okText: "Leave, keep importing",
          cancelText: "Stay on this page",
          onOk: go,
        }
      : {
          title: "Your file is still being checked",
          content: `${file?.name ?? "The file"} keeps being checked in the background if you leave, and a message in the corner tells you when it's ready to import.`,
          okText: "Leave, keep checking",
          cancelText: "Stay on this page",
          onOk: go,
        },
  );
};

function Callout({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: keyof typeof TONES;
  icon: typeof CheckCircle2;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3", TONES[tone])}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-1 text-sm">
        <p className="font-medium">{title}</p>
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: keyof typeof TONES }) {
  return (
    <div className={cn("min-w-28 rounded-lg border px-3 py-2", tone ? TONES[tone] : "bg-muted/30")}>
      <div className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="rounded-lg border bg-muted/20 px-4 py-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </li>
  );
}

function IssueTable({ issues, label = "What to fix" }: { issues: ImportIssue[]; label?: string }) {
  return (
    <div className="max-h-96 overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Row</TableHead>
            <TableHead className="w-44">Column</TableHead>
            <TableHead>{label}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue, i) => (
            <TableRow key={i}>
              <TableCell className="tabular-nums">{issue.row ?? "File"}</TableCell>
              <TableCell>{issue.column ?? "—"}</TableCell>
              <TableCell className="whitespace-normal">{issue.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const rowsLabel = (rows: number[]) =>
  rows.length === 1 ? `Row ${rows[0]}` : `Rows ${rows.slice(0, 6).join(", ")}${rows.length > 6 ? ", …" : ""}`;

function ProductPreviewTable({ products }: { products: ImportPreviewProduct[] }) {
  const shown = products.slice(0, PREVIEW_LIMIT);
  return (
    <div className="space-y-2">
      <div className="max-h-[32rem] overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Supplier category › Parent category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => {
              const pricing = [...new Set(p.variants.map((v) => v.pricing).filter(Boolean))];
              const stock = p.variants.reduce((n, v) => n + (v.stock ?? 0), 0);
              return (
                <TableRow key={`${p.name}-${p.rows[0]}`} className="align-top">
                  <TableCell className="whitespace-normal">
                    <div className="font-medium text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {rowsLabel(p.rows)}
                      {p.brand ? ` · ${p.brand}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm">
                    {p.options.length ? (
                      p.options.map((o) => (
                        <div key={o.name}>
                          <span className="text-muted-foreground">{o.name}:</span> {o.values.join(", ")}
                        </div>
                      ))
                    ) : (
                      <span className="text-muted-foreground">None ({plural(p.variants.length, "row")})</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm">
                    {p.supplier_categories.length ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {p.supplier_categories.map((c) => (
                          <span key={c.title}>
                            {c.title}
                            {c.is_new && (
                              <Badge variant="outline" className="ml-1">
                                new
                              </Badge>
                            )}
                          </span>
                        ))}
                        {p.sub_categories.length > 0 && <span className="text-muted-foreground">› {p.sub_categories.join(", ")}</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No supplier category</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm">{pricing.join(" · ") || "—"}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", stock === 0 && "text-warning-soft-foreground")}>
                    {stock.toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {products.length > PREVIEW_LIMIT && (
        <p className="text-xs text-muted-foreground">
          The first {PREVIEW_LIMIT} products are shown; the import includes all {products.length.toLocaleString()}.
        </p>
      )}
    </div>
  );
}

const ImportProductsPage = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [format, setFormat] = useState<ImportFormat | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [dragging, setDragging] = useState(false);

  const job = useImportJob();
  const { file, templateId, report, result } = job;
  const checking = job.phase === "checking";
  const importing = job.phase === "importing";
  const busy = job.phase !== "idle";
  useImportPageShowing();

  const leave = (path: string) => confirmLeave(() => navigate(path));

  // While a check or an import runs: links to other pages ask first, and so does closing the tab
  // (that would stop a check, and hide how an import ended).
  useEffect(() => {
    if (!busy) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      confirmLeave(() => navigate(url.pathname + url.search + url.hash));
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [busy, navigate]);

  // A new check (or one that finished while the page wasn't showing) scrolls into view, once the
  // layout above it has loaded and stopped moving it.
  const shownReport = useRef(job.unseen ? null : report);
  const layoutLoaded = !!format || !!formatError;
  useEffect(() => {
    if (!report || report === shownReport.current || !layoutLoaded) return;
    shownReport.current = report;
    markSeen();
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [report, layoutLoaded]);

  useEffect(() => {
    if (result) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [result]);

  const fetchFormat = () =>
    GetProductImportFormatAPI()
      .then((res) => setFormat(res.data.data))
      .catch((err) => setFormatError(apiErrorMessage(err, "Try again in a moment.")));

  useEffect(() => {
    fetchFormat();
  }, []);

  const loadFormat = () => {
    setFormatError(null);
    fetchFormat();
  };

  const templates = format?.pricing_templates ?? [];
  const maxMb = format?.limits.max_file_mb ?? 2;

  // Choosing a file checks it straight away.
  const chooseFile = (picked: File | null | undefined) => {
    if (!picked || importing) return;
    const ext = picked.name.includes(".") ? picked.name.slice(picked.name.lastIndexOf(".")).toLowerCase() : "";
    if (!ACCEPTED.includes(ext)) {
      toast.error("Choose a .csv file", {
        description: "In Excel, Google Sheets or Numbers, save or download the sheet as CSV.",
      });
      return;
    }
    if (picked.size > maxMb * 1024 * 1024) {
      toast.error(`The file is bigger than ${maxMb} MB`, { description: "Split it into smaller files." });
      return;
    }
    checkFile(picked, templateId);
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    chooseFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    chooseFile(e.dataTransfer.files?.[0]);
  };

  const runImport = () => {
    if (!file || !report?.can_import) return;
    const { products, variants, new_supplier_categories: newCategories } = report.summary;

    confirm({
      title: `Import ${plural(products, "product")}?`,
      content:
        `${plural(variants, "option")} will be added to the catalog` +
        (newCategories ? `, with ${plural(newCategories, "new supplier category", "new supplier categories")}` : "") +
        ". Every product in the file is created, or none if something goes wrong.",
      okText: "Import",
      // Not awaited: the dialog closes and the page shows the import's progress.
      onOk: () => {
        importFile();
      },
    });
  };

  const header = (
    <PageHeader
      title="Import products from CSV"
      description="Add many products at once from a spreadsheet. Nothing is saved until the file is checked and you press Import."
      actions={
        <Button variant="outline" onClick={() => leave("/products")}>
          <ArrowLeft aria-hidden />
          Products
        </Button>
      }
    />
  );

  if (result) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        {header}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-success" aria-hidden />
              Imported {plural(result.summary.products, "product")}
            </CardTitle>
            <CardDescription>
              {plural(result.summary.variants, "option")} added
              {result.summary.new_supplier_categories
                ? `, ${plural(result.summary.new_supplier_categories, "new supplier category", "new supplier categories")}`
                : ""}
              {result.summary.sub_category_links
                ? `, ${plural(result.summary.sub_category_links, "supplier category", "supplier categories")} placed in a parent category`
                : ""}
              . The CSV has no pictures: add them on each product's Edit page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {result.warnings.length > 0 && (
              <details className="space-y-2">
                <summary className="cursor-pointer text-sm font-medium">
                  {plural(result.warnings.length, "note")} from the check
                </summary>
                <IssueTable issues={result.warnings} label="Note" />
              </details>
            )}
            <div className="max-h-[32rem] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Options</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-normal font-medium text-foreground">{p.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.variants}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/products/${p.id}/edit-manual`)}>
                          <Pencil aria-hidden />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate("/products")}>Go to Products</Button>
              <Button variant="outline" onClick={clearImport}>
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {header}

      {/* 1. The layout */}
      <Card>
        <CardHeader>
          <CardTitle>1. Fill in the spreadsheet</CardTitle>
          <CardDescription>
            {/* With no pricing templates, the backend's example prices the business cards with Price. */}
            Start from the example. It has a product with no options, one with colours and sizes, and business cards{" "}
            {templates.length ? "priced with a pricing template" : "with a choice of paper"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!format && !formatError && <Spinner />}
          {formatError && (
            <Callout tone="bad" icon={TriangleAlert} title="The import layout couldn't be loaded">
              {formatError}{" "}
              <button type="button" className="font-medium underline" onClick={loadFormat}>
                Try again
              </button>
            </Callout>
          )}
          {format && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => downloadCsv(format.example_file_name, format.example_csv)}>
                  <Download aria-hidden />
                  Download example CSV
                </Button>
                <Button variant="outline" onClick={() => downloadCsv("product-import-template.csv", format.template_csv)}>
                  <FileSpreadsheet aria-hidden />
                  Download empty template
                </Button>
              </div>

              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Rule title="One row per option">
                  Each colour, size or paper choice is its own row. Rows with the same Product name become one product.
                </Rule>
                <Rule title="A price on every row">
                  Fill in Price, or name a pricing template in Pricing template. You can also pick a default template
                  below.
                </Rule>
                <Rule title="Stock decides if it shows">
                  Blank stock means 0. The website shows a product only once one of its options has stock.
                </Rule>
                <Rule title="Place it in a parent category">
                  Name an existing parent category so the product appears under it on the website.
                </Rule>
                <Rule title="Pictures come later">
                  The CSV has no pictures. After importing, add them on each product's Edit page.
                </Rule>
                <Rule title="Save it as CSV">
                  Excel: File › Save As › CSV UTF-8. Google Sheets: File › Download › CSV. Numbers: File › Export To ›
                  CSV.
                </Rule>
              </ul>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Pricing templates you can name in the file</p>
                {templates.length ? (
                  <div className="flex flex-wrap gap-2">
                    {templates.map((t) => (
                      <Badge key={t.id} variant="outline" className="text-sm">
                        {t.name}
                        <span className="text-muted-foreground">· {t.label}</span>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    None yet. Add one on the Pricing Templates page, or use the Price column.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Option types: {format.option_types.join(", ")}. Up to {format.limits.max_options} options per product.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm font-medium text-primary"
                  aria-expanded={showColumns}
                  onClick={() => setShowColumns((v) => !v)}
                >
                  {showColumns ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                  {showColumns ? "Hide" : "Show"} all {format.columns.length} columns
                </button>
                {showColumns && (
                  <div className="mt-3 overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-44">Column</TableHead>
                          <TableHead className="w-36">Needed</TableHead>
                          <TableHead className="w-28">Filled in</TableHead>
                          <TableHead>What to put</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {format.columns.map((c) => (
                          <TableRow key={c.key} className="align-top">
                            <TableCell className="font-medium text-foreground">{c.header}</TableCell>
                            <TableCell>{neededLabel(c.key, c.required)}</TableCell>
                            <TableCell>{c.level === "product" ? "Per product" : "Per row"}</TableCell>
                            <TableCell className="whitespace-normal text-muted-foreground">{c.help}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 2. The file */}
      <Card>
        <CardHeader>
          <CardTitle>2. Upload the file</CardTitle>
          <CardDescription>
            Up to {(format?.limits.max_rows ?? 1000).toLocaleString()} rows and {maxMb} MB per file. It's checked as
            soon as you choose it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2 sm:max-w-md">
            <label className="text-sm font-medium text-foreground" htmlFor="default-pricing-template">
              Default pricing template
            </label>
            <Select
              value={templateId ? String(templateId) : NO_TEMPLATE}
              onValueChange={(value) => setTemplate(value === NO_TEMPLATE ? null : Number(value))}
              disabled={importing}
            >
              <SelectTrigger id="default-pricing-template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEMPLATE}>None: every row has a Price or a template</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name} ({t.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used for rows that leave both Price and Pricing template empty. Changing it checks the file again.
            </p>
          </div>

          {checking && file ? (
            <ImportProgress
              title={`Checking ${file.name}`}
              work="Checking every row"
              sent={job.sent}
              startedAt={job.startedAt}
              note={`Nothing is imported yet. ${BACKGROUND_NOTE}`}
              onCancel={clearImport}
            />
          ) : (
            <div
              role="button"
              tabIndex={importing ? -1 : 0}
              aria-disabled={importing || undefined}
              onClick={() => !importing && inputRef.current?.click()}
              onKeyDown={(e) => {
                if (!importing && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!importing) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
                importing
                  ? "cursor-not-allowed border-border opacity-60"
                  : dragging
                    ? "cursor-pointer border-primary bg-primary/5"
                    : "cursor-pointer border-border hover:border-primary/60 hover:bg-muted/40",
              )}
            >
              <FileUp className="size-8 text-muted-foreground" aria-hidden />
              {file ? (
                <>
                  <p className="font-medium break-all text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {fileSize(file.size)} ·{" "}
                    {importing ? "being imported" : "click or drop another file to check that one instead"}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">Drop your CSV file here, or click to choose it</p>
                  <p className="text-sm text-muted-foreground">
                    It's checked straight away. Nothing is imported until you press Import.
                  </p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={onInput} />
            </div>
          )}

          {job.checkError && (
            <Callout tone="bad" icon={TriangleAlert} title={`${file?.name ?? "The file"} couldn't be checked`}>
              {job.checkError}
            </Callout>
          )}

          {file && !busy && (
            <div className="flex flex-wrap gap-2">
              <Button variant={job.checkError ? "default" : "outline"} onClick={() => checkFile(file, templateId)}>
                <RefreshCw aria-hidden />
                Check again
              </Button>
              <Button variant="ghost" onClick={clearImport}>
                Remove file
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. The check */}
      {report && (
        <div ref={resultsRef} className="scroll-mt-6">
          <Card>
            <CardHeader>
              <CardTitle>3. Check and import</CardTitle>
              <CardDescription>
                {report.file_name ? `${report.file_name}: ` : ""}
                {plural(report.summary.rows, "row")} read. Row numbers match your spreadsheet, with the header as row 1.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Stat label="Products" value={report.summary.products} />
                <Stat label="Options" value={report.summary.variants} />
                <Stat label="New supplier categories" value={report.summary.new_supplier_categories} />
                <Stat label="Placed in a parent category" value={report.summary.sub_category_links} />
                <Stat label="Problems" value={report.summary.errors} tone={report.summary.errors ? "bad" : "good"} />
                <Stat label="Warnings" value={report.summary.warnings} tone={report.summary.warnings ? "warn" : undefined} />
              </div>

              {report.errors.length > 0 ? (
                <div className="space-y-3">
                  <Callout
                    tone="bad"
                    icon={XCircle}
                    title={`Fix ${plural(report.errors.length, "problem")} in the file, then upload it again`}
                  >
                    Nothing has been imported.
                  </Callout>
                  <IssueTable issues={report.errors} />
                </div>
              ) : (
                <Callout tone="good" icon={CheckCircle2} title="The file is ready to import">
                  Check the products below, then press Import.
                </Callout>
              )}

              {report.warnings.length > 0 && (
                <details className="space-y-3" open={report.errors.length === 0}>
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    {plural(report.warnings.length, "warning")}: worth a look, they don't stop the import
                  </summary>
                  <IssueTable issues={report.warnings} label="Note" />
                </details>
              )}

              {(report.new_supplier_categories.length > 0 || report.sub_category_links.length > 0) && (
                <div className="grid gap-4 md:grid-cols-2">
                  {report.new_supplier_categories.length > 0 && (
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium text-foreground">New supplier categories (Manual)</p>
                      <p className="mt-1 text-sm text-muted-foreground">{report.new_supplier_categories.join(", ")}</p>
                    </div>
                  )}
                  {report.sub_category_links.length > 0 && (
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium text-foreground">Placed in parent categories</p>
                      <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                        {report.sub_category_links.map((l) => (
                          <li key={`${l.supplier_category}>${l.sub_category}`}>
                            {l.supplier_category} › {l.sub_category}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {report.products.length > 0 && <ProductPreviewTable products={report.products} />}

              {importing ? (
                <div className="border-t pt-4">
                  <ImportProgress
                    title={`Importing ${plural(report.summary.products, "product")}`}
                    work="Creating the products"
                    sent={job.sent}
                    startedAt={job.startedAt}
                    note={`Every product in the file is created, or none if something goes wrong. ${BACKGROUND_NOTE}`}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                  {!report.can_import && (
                    <p className="mr-auto text-sm text-muted-foreground">Fix the file, then choose it again above.</p>
                  )}
                  <Button onClick={runImport} disabled={!report.can_import}>
                    <Upload aria-hidden />
                    Import {plural(report.summary.products, "product")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ImportProductsPage;
