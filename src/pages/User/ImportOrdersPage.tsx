/** @format */

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useNavigate, useParams } from "react-router";
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
  Undo2,
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
  GetOrderImportFormatAPI,
  ImportOrdersAPI,
  PreviewOrderImportAPI,
  UndoOrderImportAPI,
  type OrderImportFormat,
  type OrderImportOrder,
  type OrderImportReport,
  type OrderImportResult,
} from "@/services/Api/OrderImportApi";

// One client's previous orders from a CSV file (their page › Import previous orders). The backend
// owns the layout (columns, example, limits): this page shows it, checks the file as soon as it's
// chosen, then saves every order in one go. Built like Import clients from CSV. An import can be
// undone from its result.

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Dates are saved at noon UTC (or the file's time), so read them in UTC: the day never shifts.
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// The example's main columns, for the preview table on the page (the file has them all).
const EXAMPLE_COLUMNS = ["Order number", "Order date", "Product name", "Color", "Size", "Quantity", "Unit price", "Decoration", "Status"];

const optionText = (line: OrderImportOrder["lines"][number]) => [line.color, line.size].filter(Boolean).join(" / ");

// Why the layout didn't load. A 404 without "Client" is a backend from before the order import.
const formatErrorOf = (err: unknown) =>
  axios.isAxiosError(err) && err.response?.status === 404 && !String(err.response.data?.message ?? "").includes("Client")
    ? "The server doesn't have the order import yet. It comes with the backend update of 27 Nov."
    : apiErrorMessage(err, "Try again in a moment.");

const ImportOrdersPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const clientId = /^\d+$/.test(id ?? "") ? Number(id) : null;
  const clientPath = `/users/${id}`;

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<AbortController | null>(null);

  const [format, setFormat] = useState<OrderImportFormat | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [report, setReport] = useState<OrderImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<OrderImportResult | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    GetOrderImportFormatAPI(clientId)
      .then((res) => active && setFormat(res.data.data))
      .catch((err) => active && setFormatError(formatErrorOf(err)));
    return () => {
      active = false;
      checkRef.current?.abort();
    };
  }, [clientId]);

  useEffect(() => {
    if (report) requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [report]);

  useEffect(() => {
    if (result) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [result]);

  const client = format?.client ?? report?.client ?? result?.client ?? null;
  const clientName = client?.name || client?.email || "this client";
  const maxMb = format?.limits.max_file_mb ?? 2;

  const loadFormat = () => {
    if (!clientId) return;
    setFormatError(null);
    GetOrderImportFormatAPI(clientId)
      .then((res) => setFormat(res.data.data))
      .catch((err) => setFormatError(formatErrorOf(err)));
  };

  // Checks the file on the server. A newer check cancels the one before it.
  const check = async (picked: File) => {
    if (!clientId) return;
    checkRef.current?.abort();
    const controller = new AbortController();
    checkRef.current = controller;
    setChecking(true);
    setCheckError(null);
    setReport(null);
    try {
      const res = await PreviewOrderImportAPI(clientId, picked, { signal: controller.signal });
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

  const chooseFile = (picked: File | null | undefined) => {
    if (!picked || importing) return;
    if (!CSV_EXTENSIONS.includes(extensionOf(picked.name))) {
      toast.error("Choose a .csv file", { description: "In Excel, Google Sheets or Numbers, save or download the sheet as CSV." });
      return;
    }
    if (picked.size > maxMb * 1024 * 1024) {
      toast.error(`The file is bigger than ${maxMb} MB`, { description: "Split it into smaller files." });
      return;
    }
    setFile(picked);
    void check(picked);
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

  const clear = () => {
    checkRef.current?.abort();
    checkRef.current = null;
    setChecking(false);
    setFile(null);
    setReport(null);
    setCheckError(null);
    setResult(null);
    setUndone(false);
  };

  const doImport = async () => {
    if (!file || !clientId) return;
    setImporting(true);
    try {
      const res = await ImportOrdersAPI(clientId, file);
      setResult(res.data.data);
      setUndone(false);
      toast.success(res.data.message || "Orders imported");
    } catch (err) {
      // The file is checked again on import: an order number used meanwhile shows up as a problem.
      if (axios.isAxiosError(err) && err.response?.status === 422 && err.response.data?.data) {
        setReport(err.response.data.data);
        toast.error("Nothing was imported", { description: "Something changed since the check: see below." });
      } else {
        toast.error("Couldn't import the orders", { description: apiErrorMessage(err, "Try again in a moment.") });
      }
    } finally {
      setImporting(false);
    }
  };

  const runImport = () => {
    if (!file || !report?.can_import) return;
    const { orders, lines, total_amount: total } = report.summary;
    confirm({
      title: `Import ${plural(orders, "previous order")} for ${clientName}?`,
      content: `${plural(orders, "order")} with ${plural(lines, "line")}, ${usd(total)} in all, are added to ${clientName}'s orders as records: no payment is taken, no label is bought, no email is sent and no stock changes. Every order in the file is saved, or none, and you can undo the import afterwards.`,
      okText: "Import",
      onOk: () => {
        void doImport();
      },
    });
  };

  const undo = () => {
    if (!result || !clientId) return;
    confirm({
      title: `Undo this import?`,
      content: `The ${plural(result.summary.orders, "order")} it added to ${clientName}'s orders are removed for good. Orders imported before, and the website's own orders, stay.`,
      okText: "Undo import",
      okType: "danger",
      cancelText: "Keep them",
      onOk: async () => {
        setUndoing(true);
        try {
          const res = await UndoOrderImportAPI(clientId, result.batch_id);
          setUndone(true);
          toast.success(res.data.message || "Import undone");
        } catch (err) {
          toast.error("The import wasn't undone", { description: apiErrorMessage(err, "Try again in a moment.") });
        } finally {
          setUndoing(false);
        }
      },
    });
  };

  const header = (
    <PageHeader
      title="Import previous orders"
      description={
        client
          ? `For ${client.name ? `${client.name} (${client.email})` : client.email}: their orders from before the website, from a spreadsheet. Nothing is saved until the file is checked and you press Import.`
          : "A client's orders from before the website, from a spreadsheet."
      }
      actions={
        <Button variant="outline" onClick={() => navigate(clientPath)} disabled={importing}>
          <ArrowLeft aria-hidden />
          {client?.name || "Client"}
        </Button>
      }
    />
  );

  if (!clientId) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        {header}
        <Callout tone="bad" icon={TriangleAlert} title="Client not found" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------------------
  // After the import
  // ---------------------------------------------------------------------------------------
  if (result) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {header}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {undone ? (
                <Undo2 className="size-5 text-muted-foreground" aria-hidden />
              ) : (
                <CheckCircle2 className="size-5 text-success" aria-hidden />
              )}
              {undone ? "Import undone" : `Imported ${plural(result.summary.orders, "previous order")}`}
            </CardTitle>
            <CardDescription>
              {undone
                ? `The ${plural(result.summary.orders, "order")} it added were removed.`
                : `${plural(result.summary.lines, "line")}, ${usd(result.summary.total_amount)} in all. They're on ${clientName}'s page marked Imported, and in their My Orders on the website.`}
              {!undone && result.summary.already_imported > 0 &&
                ` ${plural(result.summary.already_imported, "order")} in the file ${result.summary.already_imported === 1 ? "was" : "were"} imported before and left as ${result.summary.already_imported === 1 ? "it was" : "they were"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!undone && (
              <div className="max-h-[32rem] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium text-foreground">{o.order_number}</TableCell>
                        <TableCell>{day(o.date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{o.status_label}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {o.units} <span className="text-muted-foreground">({plural(o.lines, "line")})</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{usd(o.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {result.warnings.length > 0 && !undone && (
              <details className="space-y-2">
                <summary className="cursor-pointer text-sm font-medium">{plural(result.warnings.length, "note")} from the check</summary>
                <IssueTable issues={result.warnings} label="Note" />
              </details>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button onClick={() => navigate(clientPath)}>
                <ArrowLeft aria-hidden />
                Back to {clientName}
              </Button>
              <Button variant="outline" onClick={clear} disabled={undoing}>
                Import another file
              </Button>
              {!undone && (
                <Button variant="outline" className="ml-auto text-destructive hover:text-destructive" onClick={undo} disabled={undoing}>
                  {undoing ? <Spinner size="small" className="text-current" /> : <Undo2 aria-hidden />}
                  Undo this import
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------------------
  // Before the import: the layout, the file, the check
  // ---------------------------------------------------------------------------------------
  const [exampleHeader = [], ...exampleBody] = format?.example_rows ?? [];
  const shownColumns = EXAMPLE_COLUMNS.map((name) => exampleHeader.indexOf(name)).filter((i) => i >= 0);
  const nothingNew = !!report && report.errors.length === 0 && report.orders.length === 0 && report.already_imported.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {header}

      {/* 1. The layout */}
      <Card>
        <CardHeader>
          <CardTitle>1. Fill in the spreadsheet</CardTitle>
          <CardDescription>
            One row per product ordered. Rows with the same order number make one order. Start from the example: it uses
            one of your own products, so it checks clean.
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
                <Button variant="outline" onClick={() => downloadCsv("previous-orders-template.csv", format.template_csv)}>
                  <FileSpreadsheet aria-hidden />
                  Download empty template
                </Button>
              </div>

              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-foreground">The example (main columns)</p>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14 text-muted-foreground">Row</TableHead>
                        {shownColumns.map((i) => (
                          <TableHead key={i}>{exampleHeader[i]}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exampleBody.map((row, r) => (
                        <TableRow key={r}>
                          <TableCell className="text-muted-foreground tabular-nums">{r + 2}</TableCell>
                          {shownColumns.map((i) => (
                            <TableCell key={i} className="whitespace-normal">
                              {row[i] || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rows 2 and 3 are one order (SAMPLE-1001): its date, status, shipping, tax and address are on its first row
                  only. The file also has Payment method, Shipping, Tax, Order total, Tracking number and the address.
                </p>
              </div>

              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Rule title="One row per product">
                  Rows with the same Order number make one order. Fill the order's date, status, shipping and tax on its
                  first row, or the same on every row.
                </Rule>
                <Rule title="Products from your list">
                  Product name must be one of your products (capitals don't matter). A name you don't have is a problem,
                  with the closest names suggested.
                </Rule>
                <Rule title="Colour and size">
                  When a product comes in several, add Color and Size as the product lists them, or the SKU. The check
                  lists the choices.
                </Rule>
                <Rule title="Prices as they were">
                  Unit price is per item, decoration included. Shipping and Tax are per order. Stock isn't checked or
                  changed.
                </Rule>
                <Rule title="Dates and status">
                  Dates as YYYY-MM-DD or MM/DD/YYYY. Status: {format.statuses.join(", ")}; empty means Delivered.
                </Rule>
                <Rule title="Just a record">
                  No payment, label or email. Orders are marked Imported, show in the client's My Orders, and an import can
                  be undone.
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
                          <TableHead className="w-36">Column</TableHead>
                          <TableHead className="w-20">Needed</TableHead>
                          <TableHead className="w-36">Filled in</TableHead>
                          <TableHead>What to put</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {format.columns.map((c) => (
                          <TableRow key={c.key} className="align-top">
                            <TableCell className="font-medium text-foreground">{c.header}</TableCell>
                            <TableCell>{c.required ? "Yes" : "No"}</TableCell>
                            <TableCell>{c.level === "order" ? "Once per order" : "On every row"}</TableCell>
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
            Up to {(format?.limits.max_rows ?? 2000).toLocaleString()} rows and {maxMb} MB per file. It's checked as soon as
            you choose it.
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
                  <p className="text-sm text-muted-foreground">It's checked straight away. Nothing is saved until you press Import.</p>
                </>
              )}
              <input ref={inputRef} id="order-import-file" type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={onInput} />
            </div>
          )}

          {checkError && (
            <Callout tone="bad" icon={TriangleAlert} title={`${file?.name ?? "The file"} couldn't be checked`}>
              {checkError}
            </Callout>
          )}

          {file && !checking && !importing && (
            <div className="flex flex-wrap gap-2">
              <Button variant={checkError ? "default" : "outline"} onClick={() => void check(file)}>
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
                <Stat label="Orders" value={report.summary.orders} />
                <Stat label="Lines" value={report.summary.lines} />
                <Stat label="Imported before" value={report.summary.already_imported} />
                <Stat label="Problems" value={report.errors.length} tone={report.errors.length ? "bad" : "good"} />
                <Stat label="Warnings" value={report.summary.warnings} tone={report.summary.warnings ? "warn" : undefined} />
              </div>

              {report.errors.length > 0 && (
                <div className="space-y-3">
                  <Callout tone="bad" icon={XCircle} title={`Fix ${plural(report.errors.length, "problem")} in the file, then upload it again`}>
                    Nothing has been saved.
                  </Callout>
                  <IssueTable issues={report.errors} />
                </div>
              )}

              {nothingNew && (
                <Callout tone="warn" icon={TriangleAlert} title="Every order in this file was imported before">
                  There's nothing new to import.
                </Callout>
              )}

              {report.can_import && (
                <Callout tone="good" icon={CheckCircle2} title={`Ready to import ${usd(report.summary.total_amount)} of orders`}>
                  Check the orders below, then press Import.
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

              {report.orders.length > 0 && (
                <div className="max-h-[36rem] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Products</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.orders.map((o) => (
                        <TableRow key={o.order_number} className="align-top">
                          <TableCell className="whitespace-normal">
                            <div className="font-medium text-foreground">{o.order_number}</div>
                            <div className="text-xs text-muted-foreground">
                              {o.rows.length === 1 ? `Row ${o.rows[0]}` : `Rows ${o.rows[0]}–${o.rows[o.rows.length - 1]}`}
                            </div>
                          </TableCell>
                          <TableCell>{day(o.date)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{o.status_label}</Badge>
                          </TableCell>
                          <TableCell className="min-w-72 whitespace-normal">
                            <ul className="space-y-1">
                              {o.lines.map((line) => (
                                <li key={line.row} className="text-sm">
                                  <span className="font-medium text-foreground">{line.product_name}</span>
                                  {optionText(line) && <span className="text-muted-foreground"> · {optionText(line)}</span>}
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · {line.quantity} × {usd(line.unit_price)}
                                  </span>
                                  {line.decoration && <div className="text-xs text-muted-foreground">{line.decoration}</div>}
                                </li>
                              ))}
                            </ul>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums">
                            <div className="font-medium text-foreground">{usd(o.total)}</div>
                            {(o.shipping > 0 || o.tax > 0) && (
                              <div className="text-xs text-muted-foreground">
                                {usd(o.subtotal)}
                                {o.shipping > 0 && ` + ${usd(o.shipping)} shipping`}
                                {o.tax > 0 && ` + ${usd(o.tax)} tax`}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {report.already_imported.length > 0 && (
                <details className="space-y-3" open={nothingNew}>
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    {plural(report.already_imported.length, "order")} imported before: left as{" "}
                    {report.already_imported.length === 1 ? "it is" : "they are"}
                  </summary>
                  <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
                    {report.already_imported.map((o) => o.order_number).join(", ")}
                  </div>
                </details>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                {!report.can_import && (
                  <p className="mr-auto text-sm text-muted-foreground">
                    {nothingNew ? "Add new orders to the file to import them." : "Fix the file, then choose it again above."}
                  </p>
                )}
                <Button onClick={runImport} disabled={!report.can_import || importing}>
                  {importing ? <Spinner size="small" className="text-current" /> : <Upload aria-hidden />}
                  {importing ? "Importing…" : report.can_import ? `Import ${plural(report.summary.orders, "order")}` : "Import"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ImportOrdersPage;
