/** @format */

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import axios from "axios";
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
import { apiErrorMessage, toastApiError } from "@/lib/api-errors";
import {
  GetProductImportFormatAPI,
  ImportProductsAPI,
  PreviewProductImportAPI,
  type ImportFormat,
  type ImportIssue,
  type ImportPreviewProduct,
  type ImportReport,
  type ImportResult,
} from "@/services/Api/ProductImportApi";

// Several products from one CSV file. The backend owns the layout (columns, example file,
// limits): this page shows it, uploads the file for a check, then imports it in one go.

const NO_TEMPLATE = "none";
const ACCEPTED = [".csv", ".txt", ".tsv"];
// The product preview lists this many; the rest are counted.
const PREVIEW_LIMIT = 200;

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

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
              <TableHead>Supplier category › Sub-category</TableHead>
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
                      <span className="text-muted-foreground">Not in a category</span>
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
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

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

  // A different file or default template means the last check no longer applies.
  const chooseFile = (picked: File | null | undefined) => {
    if (!picked) return;
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
    setFile(picked);
    setReport(null);
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

  const check = async () => {
    if (!file) return;
    setChecking(true);
    setReport(null);
    try {
      const res = await PreviewProductImportAPI(file, templateId);
      setReport(res.data.data);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      toastApiError("The file couldn't be checked", err);
    } finally {
      setChecking(false);
    }
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
      onOk: async () => {
        setImporting(true);
        try {
          const res = await ImportProductsAPI(file, templateId);
          setResult(res.data.data);
          setReport(null);
          toast.success(res.data.message || "Products imported");
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 422 && err.response.data?.data) {
            setReport(err.response.data.data);
            toast.error("Nothing was imported", {
              description: "Something the file names changed since the check. See the problems listed.",
            });
          } else {
            toastApiError("Nothing was imported", err);
          }
        } finally {
          setImporting(false);
        }
      },
    });
  };

  const startOver = () => {
    setFile(null);
    setReport(null);
    setResult(null);
  };

  const header = (
    <PageHeader
      title="Import products from CSV"
      description="Add many products at once from a spreadsheet. Nothing is saved until the file is checked and you press Import."
      actions={
        <Button variant="outline" onClick={() => navigate("/products")}>
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
                ? `, ${plural(result.summary.sub_category_links, "supplier category", "supplier categories")} placed in a Sub-category`
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
              <Button variant="outline" onClick={startOver}>
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
                <Rule title="Place it in a Sub-category">
                  Name an existing Sub-category so the product appears under it on the website.
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
            Up to {(format?.limits.max_rows ?? 1000).toLocaleString()} rows and {maxMb} MB per file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-muted/40",
            )}
          >
            <FileUp className="size-8 text-muted-foreground" aria-hidden />
            {file ? (
              <>
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {fileSize(file.size)} · click or drop another file to replace it
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">Drop your CSV file here, or click to choose it</p>
                <p className="text-sm text-muted-foreground">Saved from Excel, Google Sheets or Numbers</p>
              </>
            )}
            <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={onInput} />
          </div>

          <div className="grid gap-2 sm:max-w-md">
            <label className="text-sm font-medium text-foreground" htmlFor="default-pricing-template">
              Default pricing template
            </label>
            <Select
              value={templateId ? String(templateId) : NO_TEMPLATE}
              onValueChange={(value) => {
                setTemplateId(value === NO_TEMPLATE ? null : Number(value));
                setReport(null);
              }}
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
              Used for rows that leave both Price and Pricing template empty.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={check} disabled={!file || checking}>
              {checking ? <Spinner size="small" label="Checking" /> : <CheckCircle2 aria-hidden />}
              Check file
            </Button>
            {file && (
              <Button variant="ghost" onClick={startOver} disabled={checking}>
                Clear
              </Button>
            )}
          </div>
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
                <Stat label="Placed in a Sub-category" value={report.summary.sub_category_links} />
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
                      <p className="text-sm font-medium text-foreground">Placed in Sub-categories</p>
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

              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                {!report.can_import && (
                  <p className="mr-auto text-sm text-muted-foreground">
                    Fix the file, choose it again above, and check it again.
                  </p>
                )}
                <Button onClick={runImport} disabled={!report.can_import || importing}>
                  {importing ? <Spinner size="small" label="Importing" /> : <Upload aria-hidden />}
                  Import {plural(report.summary.products, "product")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ImportProductsPage;
