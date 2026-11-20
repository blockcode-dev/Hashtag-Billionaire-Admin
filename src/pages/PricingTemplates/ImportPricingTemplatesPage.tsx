/** @format */

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
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
  RefreshCw,
  TriangleAlert,
  Upload,
  XCircle,
} from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { confirm } from "@/components/common/ConfirmDialog";
import { Callout, IssueTable, Rule, Stat } from "@/components/common/ImportBlocks";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { apiErrorMessage } from "@/lib/api-errors";
import { CSV_EXTENSIONS, downloadCsv, extensionOf, fileSize, plural } from "@/lib/csvFiles";
import {
  GetPricingTemplateImportFormatAPI,
  ImportPricingTemplatesAPI,
  PreviewPricingTemplateImportAPI,
  type TemplateImportFormat,
  type TemplateImportReport,
  type TemplateImportResult,
} from "@/services/Api/PricingTemplateImportApi";
import { QUANTITY_MODE_INFO, describeQuantityRows, formatMoney } from "@/utils/variantPricing";

// Several pricing templates from one CSV file, in either pricing style. The backend owns the layout
// (columns, example, limits): this page shows it, checks the file as soon as it's chosen, then
// saves every template in one go. Built like Import products from CSV.
//
// A name in the file that's already a template isn't changed unless the admin says so: the check
// asks, naming the template, and "Update" checks the file again with replace_existing.

const LIST_PATH = "/pricing-templates";

const quoted = (names: string[]) => names.map((n) => `“${n}”`).join(", ");

// The example's rows for one pricing style, as cells by header.
const exampleFor = (format: TemplateImportFormat, label: string) => {
  const [header, ...rows] = format.example_rows;
  const at = (name: string) => header.indexOf(name);
  const cell = (row: string[], name: string) => (at(name) >= 0 ? row[at(name)] ?? "" : "");
  const mine = rows.filter((row) => cell(row, "Pricing style") === label);
  return { name: mine[0] ? cell(mine[0], "Template name") : "", rows: mine, cell };
};

function StyleExample({ format, styleKey }: { format: TemplateImportFormat; styleKey: "tiered" | "quantity_fixed" }) {
  const style = format.styles.find((s) => s.key === styleKey);
  if (!style) return null;
  const { name, rows, cell } = exampleFor(format, style.label);
  const tiered = styleKey === "tiered";

  return (
    // min-w-0: on a phone the table scrolls inside the box instead of widening it.
    <div className="min-w-0 space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{style.label}</p>
          <span className="text-xs text-muted-foreground">Fill in: {style.columns.join(", ")}</span>
        </div>
        <p className="text-sm text-muted-foreground">{QUANTITY_MODE_INFO[styleKey].description}</p>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {tiered ? (
                <>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Price per item</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="text-right">Total price</TableHead>
                  <TableHead className="text-right text-muted-foreground">Works out at</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) =>
              tiered ? (
                <TableRow key={i}>
                  <TableCell className="tabular-nums">{cell(row, "From")}</TableCell>
                  <TableCell className="tabular-nums">
                    {cell(row, "To") || <span className="text-muted-foreground italic">blank: and up</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">${cell(row, "Price per item")}</TableCell>
                </TableRow>
              ) : (
                <TableRow key={i}>
                  <TableCell className="tabular-nums">{cell(row, "Quantity")}</TableCell>
                  <TableCell className="text-right tabular-nums">${cell(row, "Total price")}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    ${formatMoney(Number(cell(row, "Total price")) / Number(cell(row, "Quantity")))} each
                  </TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        In the example: “{name}”, one row per {tiered ? "tier" : "quantity"}, with Template name and Pricing style on
        every row.
      </p>
    </div>
  );
}

const neededLabel = (column: TemplateImportFormat["columns"][number]) =>
  column.required ? "Yes" : column.style ? `For ${column.style}` : "No";

const ImportPricingTemplatesPage = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<AbortController | null>(null);

  const [format, setFormat] = useState<TemplateImportFormat | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  // Update the templates the file names that already exist (asked after the check).
  const [update, setUpdate] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [report, setReport] = useState<TemplateImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<TemplateImportResult | null>(null);

  const fetchFormat = () =>
    GetPricingTemplateImportFormatAPI()
      .then((res) => setFormat(res.data.data))
      .catch((err) => setFormatError(apiErrorMessage(err, "Try again in a moment.")));

  useEffect(() => {
    fetchFormat();
    return () => checkRef.current?.abort();
  }, []);

  const loadFormat = () => {
    setFormatError(null);
    fetchFormat();
  };

  // A new check scrolls into view.
  useEffect(() => {
    if (report) requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [report]);

  useEffect(() => {
    if (result) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [result]);

  const maxMb = format?.limits.max_file_mb ?? 2;

  // Checks the file on the server. A newer check cancels the one before it.
  const check = async (picked: File, updateExisting: boolean) => {
    checkRef.current?.abort();
    const controller = new AbortController();
    checkRef.current = controller;
    setChecking(true);
    setCheckError(null);
    setReport(null);

    try {
      const res = await PreviewPricingTemplateImportAPI(picked, updateExisting, { signal: controller.signal });
      if (!controller.signal.aborted) setReport(res.data.data);
    } catch (err) {
      if (axios.isCancel(err) || controller.signal.aborted) return;
      setCheckError(apiErrorMessage(err, "Try again in a moment."));
    } finally {
      if (checkRef.current === controller) {
        checkRef.current = null;
        setChecking(false);
      }
    }
  };

  // Choosing a file checks it straight away. A new file never updates anything until asked.
  const chooseFile = (picked: File | null | undefined) => {
    if (!picked || importing) return;
    if (!CSV_EXTENSIONS.includes(extensionOf(picked.name))) {
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
    setUpdate(false);
    check(picked, false);
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

  const changeUpdate = (value: boolean) => {
    setUpdate(value);
    if (file) check(file, value);
  };

  const clear = () => {
    checkRef.current?.abort();
    checkRef.current = null;
    setChecking(false);
    setFile(null);
    setUpdate(false);
    setReport(null);
    setCheckError(null);
    setResult(null);
  };

  const doImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const res = await ImportPricingTemplatesAPI(file, update);
      setResult(res.data.data);
      toast.success(res.data.message || "Pricing templates imported");
      fetchFormat();
    } catch (err) {
      // The file is checked again on import: a template saved meanwhile shows up as a problem.
      if (axios.isAxiosError(err) && err.response?.status === 422 && err.response.data?.data) {
        setReport(err.response.data.data);
        toast.error("Nothing was imported", { description: "Something changed since the check: see below." });
      } else {
        toast.error("Couldn't import the templates", { description: apiErrorMessage(err, "Try again in a moment.") });
      }
    } finally {
      setImporting(false);
    }
  };

  const runImport = () => {
    if (!file || !report?.can_import) return;
    const created = report.summary.new_templates;
    const updated = report.templates.filter((t) => t.action === "replace").map((t) => t.replaces?.name ?? t.name);
    const parts = [
      created ? `${plural(created, "new template")} will be added` : null,
      updated.length === 1
        ? `“${updated[0]}” will be updated with the prices in the file`
        : updated.length
          ? `${updated.length} templates you already have will be updated with the prices in the file`
          : null,
    ].filter(Boolean);

    confirm({
      title: `Import ${plural(report.summary.templates, "pricing template")}?`,
      content: `${parts.join(", and ")}. Every template in the file is saved, or none if something goes wrong.`,
      okText: "Import",
      // Not awaited: the dialog closes and the page shows the import running.
      onOk: () => {
        void doImport();
      },
    });
  };

  const header = (
    <PageHeader
      title="Import pricing templates from CSV"
      description="Add many pricing templates at once from a spreadsheet, in either pricing style. Nothing is saved until the file is checked and you press Import."
      actions={
        <Button variant="outline" onClick={() => navigate(LIST_PATH)} disabled={importing}>
          <ArrowLeft aria-hidden />
          Pricing Templates
        </Button>
      }
    />
  );

  if (result) {
    const { created, replaced } = result.summary;
    return (
      <div className="mx-auto w-full max-w-6xl">
        {header}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-success" aria-hidden />
              Imported {plural(result.summary.templates, "pricing template")}
            </CardTitle>
            <CardDescription>
              {[created ? plural(created, "new template") : null, replaced ? `${replaced} updated` : null]
                .filter(Boolean)
                .join(", ")}
              . Load {result.summary.templates === 1 ? "it" : "them"} into products while creating or editing them, as with
              any template.
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
                    <TableHead>Template</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>Prices</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.templates.map((t) => (
                    <TableRow key={t.id} className="align-top">
                      <TableCell className="font-medium whitespace-normal text-foreground">{t.name}</TableCell>
                      <TableCell>{QUANTITY_MODE_INFO[t.pricing_mode].label}</TableCell>
                      <TableCell className="min-w-56 whitespace-normal text-muted-foreground">
                        {describeQuantityRows(t.pricing_mode, t.bulk_pricing ?? [], t.quantity_pricing ?? [])}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{t.action === "replace" ? "Updated" : "New"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate(LIST_PATH)}>Go to Pricing Templates</Button>
              <Button variant="outline" onClick={clear}>
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Names in the file that are already templates. Until the admin chooses to update them they're
  // asked about on their own, not listed with the file's other problems.
  const taken = report?.already_exist ?? [];
  const askToUpdate = !!report && taken.length > 0 && !report.replace_existing;
  const takenRows = new Set(taken.map((t) => t.rows[0]));
  const otherErrors = (report?.errors ?? []).filter(
    (e) => !(askToUpdate && e.column === "Template name" && e.row !== null && takenRows.has(e.row)),
  );
  const updating = (report?.templates ?? []).filter((t) => t.action === "replace").map((t) => t.replaces?.name ?? t.name);
  const takenNames = taken.map((t) => t.name);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {header}

      {/* 1. The layout */}
      <Card>
        <CardHeader>
          <CardTitle>1. Fill in the spreadsheet</CardTitle>
          <CardDescription>
            Start from the example. It has one template of each pricing style. Every row is one price: a tier or a
            quantity.
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
                <Button variant="outline" onClick={() => downloadCsv("pricing-templates-template.csv", format.template_csv)}>
                  <FileSpreadsheet aria-hidden />
                  Download empty template
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <StyleExample format={format} styleKey="tiered" />
                <StyleExample format={format} styleKey="quantity_fixed" />
              </div>

              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Rule title="One row per price">
                  Each tier or quantity is its own row. Rows with the same Template name become one template.
                </Rule>
                <Rule title="Say the pricing style">
                  Write Variable ranges or Fixed quantities on the template's first row, or on every row. A template has
                  one style.
                </Rule>
                <Rule title="Names you already have">
                  If your file uses the name of a template you already have, the check asks whether to update it.
                  Nothing you have changes unless you say so.
                </Rule>
                <Rule title="Cover every quantity">
                  Quantities no tier covers can't be ordered. The check warns about gaps, a first tier above 1, and a last
                  tier with a To.
                </Rule>
                <Rule title="Products keep their prices">
                  Loading a template copies its prices into a product, so importing or updating templates never changes
                  products already priced.
                </Rule>
                <Rule title="Save it as CSV">
                  Excel: File › Save As › CSV UTF-8. Google Sheets: File › Download › CSV. Numbers: File › Export To ›
                  CSV.
                </Rule>
              </ul>

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
                          <TableHead className="w-40">Column</TableHead>
                          <TableHead className="w-44">Needed</TableHead>
                          <TableHead className="w-36">Filled in</TableHead>
                          <TableHead>What to put</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {format.columns.map((c) => (
                          <TableRow key={c.key} className="align-top">
                            <TableCell className="font-medium text-foreground">{c.header}</TableCell>
                            <TableCell>{neededLabel(c)}</TableCell>
                            <TableCell>{c.level === "template" ? "Once per template" : "On every row"}</TableCell>
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
            Up to {(format?.limits.max_rows ?? 1000).toLocaleString()} rows and {maxMb} MB per file, and up to{" "}
            {format?.limits.max_prices_per_template ?? 50} prices per template. It's checked as soon as you choose it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {checking && file ? (
            <div className="flex items-center gap-3 rounded-lg border px-4 py-6">
              <Spinner size="small" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Checking {file.name}</p>
                <p className="text-muted-foreground">Nothing is saved yet.</p>
              </div>
            </div>
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
                    {fileSize(file.size)} · {importing ? "being imported" : "click or drop another file to check that one instead"}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">Drop your CSV file here, or click to choose it</p>
                  <p className="text-sm text-muted-foreground">
                    It's checked straight away. Nothing is saved until you press Import.
                  </p>
                </>
              )}
              <input
                ref={inputRef}
                id="pricing-template-file"
                type="file"
                accept=".csv,.tsv,.txt,text/csv"
                className="hidden"
                onChange={onInput}
              />
            </div>
          )}

          {checkError && (
            <Callout tone="bad" icon={TriangleAlert} title={`${file?.name ?? "The file"} couldn't be checked`}>
              {checkError}
            </Callout>
          )}

          {file && !checking && !importing && (
            <div className="flex flex-wrap gap-2">
              <Button variant={checkError ? "default" : "outline"} onClick={() => check(file, update)}>
                <RefreshCw aria-hidden />
                Check again
              </Button>
              <Button variant="ghost" onClick={clear}>
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
                <Stat label="New templates" value={report.summary.new_templates} />
                {report.replace_existing && <Stat label="To update" value={report.summary.replaced_templates} />}
                {askToUpdate && <Stat label="Already a template" value={taken.length} tone="warn" />}
                <Stat label="Problems" value={otherErrors.length} tone={otherErrors.length ? "bad" : "good"} />
                <Stat label="Warnings" value={report.summary.warnings} tone={report.summary.warnings ? "warn" : undefined} />
              </div>

              {askToUpdate && (
                <Callout
                  tone="warn"
                  icon={RefreshCw}
                  title={
                    taken.length === 1
                      ? `“${takenNames[0]}” is already a template`
                      : `${taken.length} names in your file are already templates: ${quoted(takenNames)}`
                  }
                >
                  <div className="space-y-3">
                    <p>
                      {taken.length === 1
                        ? `Your file has prices for it. Update “${takenNames[0]}” to use them, or give it another name in your file to add it as a new template instead.`
                        : "Your file has prices for them. Update them to use these prices, or give them other names in your file to add them as new templates instead."}{" "}
                      Products already priced with {taken.length === 1 ? "it" : "them"} keep their prices.
                    </p>
                    <Button size="sm" onClick={() => changeUpdate(true)} disabled={checking}>
                      <RefreshCw aria-hidden />
                      {taken.length === 1
                        ? `Update “${takenNames[0]}” with this file's prices`
                        : `Update these ${taken.length} templates with this file's prices`}
                    </Button>
                  </div>
                </Callout>
              )}

              {report.replace_existing && updating.length > 0 && (
                <Callout
                  tone="warn"
                  icon={RefreshCw}
                  title={
                    updating.length === 1
                      ? `“${updating[0]}” will be updated with the prices in this file`
                      : `${updating.length} templates will be updated with the prices in this file: ${quoted(updating)}`
                  }
                >
                  Products already priced with {updating.length === 1 ? "it" : "them"} keep their prices.{" "}
                  <button type="button" className="font-medium underline" onClick={() => changeUpdate(false)}>
                    Don't update {updating.length === 1 ? "it" : "them"}
                  </button>
                </Callout>
              )}

              {otherErrors.length > 0 && (
                <div className="space-y-3">
                  <Callout
                    tone="bad"
                    icon={XCircle}
                    title={`Fix ${plural(otherErrors.length, "problem")} in the file, then upload it again`}
                  >
                    Nothing has been saved.
                  </Callout>
                  <IssueTable issues={otherErrors} />
                </div>
              )}

              {report.can_import && (
                <Callout tone="good" icon={CheckCircle2} title="The file is ready to import">
                  Check the templates below, then press Import.
                </Callout>
              )}

              {report.warnings.length > 0 && (
                <details className="space-y-3" open={otherErrors.length === 0}>
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    {plural(report.warnings.length, "warning")}: worth a look, they don't stop the import
                  </summary>
                  <IssueTable issues={report.warnings} label="Note" />
                </details>
              )}

              {report.templates.length > 0 && (
                <div className="max-h-[32rem] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead>Prices</TableHead>
                        <TableHead>What happens</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.templates.map((t) => (
                        <TableRow key={`${t.name}-${t.rows[0]}`} className="align-top">
                          <TableCell className="whitespace-normal">
                            <div className="font-medium text-foreground">{t.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.rows.length === 1 ? `Row ${t.rows[0]}` : `Rows ${t.rows[0]}–${t.rows[t.rows.length - 1]}`}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{t.style}</Badge>
                          </TableCell>
                          <TableCell className="min-w-56 whitespace-normal text-sm">{t.description}</TableCell>
                          <TableCell className="whitespace-normal text-sm">
                            {t.action === "replace" && t.replaces ? `Updates “${t.replaces.name}”` : "New template"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                {!report.can_import && (
                  <p className="mr-auto text-sm text-muted-foreground">
                    {askToUpdate && otherErrors.length === 0
                      ? "Choose above whether to update it, or rename it in your file."
                      : "Fix the file, then choose it again above."}
                  </p>
                )}
                <Button onClick={runImport} disabled={!report.can_import || importing}>
                  {importing ? <Spinner size="small" className="text-current" /> : <Upload aria-hidden />}
                  {importing
                    ? "Importing…"
                    : report.can_import
                      ? `Import ${plural(report.summary.templates, "template")}`
                      : "Import"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ImportPricingTemplatesPage;
