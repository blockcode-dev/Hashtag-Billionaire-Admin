/** @format */

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Link, useNavigate } from "react-router";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  FileUp,
  Mail,
  RefreshCw,
  TriangleAlert,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { confirm } from "@/components/common/ConfirmDialog";
import { Callout, IssueTable, Rule, Stat } from "@/components/common/ImportBlocks";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { apiErrorMessage } from "@/lib/api-errors";
import { CSV_EXTENSIONS, downloadCsv, extensionOf, fileSize, plural } from "@/lib/csvFiles";
import {
  GetClientImportFormatAPI,
  ImportClientsAPI,
  PreviewClientImportAPI,
  type ClientImportFormat,
  type ClientImportReport,
  type ClientImportResult,
  type ExistingClient,
} from "@/services/Api/UserApi";
import { copyText, formatPhone, loginMessage, sendLoginDetails, sentTime, type SendState } from "./loginDetails";

// The team's existing clients from one CSV file: a name, an email and, if known, a mobile number
// per row. The backend owns the layout (columns, example, limits): this page shows it, checks the
// file as soon as it's chosen, then creates every new client in one go. Built like Import pricing
// templates from CSV.
//
// Each new client gets a password, answered once by the import. This page then emails them their
// login details one by one (when the box is ticked), and shows every password to copy. They're
// never shown again once the page is left.

const LIST_PATH = "/users";

type Imported = ClientImportResult["clients"][number];

const EmailStatus = ({ state, onSend, disabled }: { state: SendState; onSend: () => void; disabled: boolean }) => {
  if (state.status === "sending") {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size="small" label="Sending" />
        Sending…
      </span>
    );
  }
  if (state.status === "sent") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-success">
        <CheckCircle2 className="size-4" aria-hidden />
        Sent {sentTime(state.at)}
      </span>
    );
  }
  return (
    <div className="space-y-1">
      {state.status === "failed" && <p className="text-sm text-destructive">Not sent: {state.error}</p>}
      <Button type="button" size="xs" variant="outline" onClick={onSend} disabled={disabled}>
        {state.status === "failed" ? <RefreshCw aria-hidden /> : <Mail aria-hidden />}
        {state.status === "failed" ? "Try again" : "Send"}
      </Button>
    </div>
  );
};

function ExistingTable({ rows }: { rows: ExistingClient[] }) {
  return (
    <div className="max-h-80 overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Row</TableHead>
            <TableHead>In your file</TableHead>
            <TableHead>Account</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.row} className="align-top">
              <TableCell className="tabular-nums">{c.row}</TableCell>
              <TableCell className="whitespace-normal">
                <div className="font-medium text-foreground">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.email}</div>
              </TableCell>
              <TableCell className="whitespace-normal text-sm">
                <Link to={`/users/${c.user_id}`} className="font-medium text-primary hover:underline">
                  {c.account_name || c.email}
                </Link>
                {!c.verified && (
                  <div className="text-xs text-muted-foreground">Signed up, email not verified yet</div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const ImportClientsPage = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<AbortController | null>(null);
  // Set when the page closes, so a run of emails stops.
  const leftRef = useRef(false);

  const [format, setFormat] = useState<ClientImportFormat | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [report, setReport] = useState<ClientImportReport | null>(null);
  const [emailOnImport, setEmailOnImport] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ClientImportResult | null>(null);
  // Each imported client's login email, by client id.
  const [sends, setSends] = useState<Record<number, SendState>>({});
  const [sending, setSending] = useState(false);

  const fetchFormat = () =>
    GetClientImportFormatAPI()
      .then((res) => setFormat(res.data.data))
      .catch((err) =>
        setFormatError(
          axios.isAxiosError(err) && err.response?.status === 404
            ? "The server doesn't have the client import yet. It comes with the backend update of 27 Nov."
            : apiErrorMessage(err, "Try again in a moment."),
        ),
      );

  useEffect(() => {
    leftRef.current = false;
    fetchFormat();
    return () => {
      leftRef.current = true;
      checkRef.current?.abort();
    };
  }, []);

  // Closing the tab while emails are going out stops them: ask first.
  useEffect(() => {
    if (!sending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sending]);

  const loadFormat = () => {
    setFormatError(null);
    fetchFormat();
  };

  useEffect(() => {
    if (report) requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [report]);

  useEffect(() => {
    if (result) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [result]);

  const maxMb = format?.limits.max_file_mb ?? 2;

  // Checks the file on the server. A newer check cancels the one before it.
  const check = async (picked: File) => {
    checkRef.current?.abort();
    const controller = new AbortController();
    checkRef.current = controller;
    setChecking(true);
    setCheckError(null);
    setReport(null);

    try {
      const res = await PreviewClientImportAPI(picked, { signal: controller.signal });
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
    check(picked);
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
    setSends({});
  };

  // Emails these clients their login details, one at a time.
  const sendLogins = async (clients: Imported[]) => {
    setSending(true);
    let sent = 0;
    let failed = 0;
    for (const client of clients) {
      if (leftRef.current) return;
      setSends((all) => ({ ...all, [client.id]: { status: "sending" } }));
      const next = await sendLoginDetails(client.id, client.password);
      if (leftRef.current) return;
      setSends((all) => ({ ...all, [client.id]: next }));
      if (next.status === "sent") sent += 1;
      else failed += 1;
    }
    setSending(false);
    if (failed) {
      toast.error(`${plural(failed, "login email")} not sent`, {
        description: sent ? `${plural(sent, "client")} got theirs. Try the others again below.` : "See why below, then try again.",
      });
    } else if (sent) {
      toast.success(sent === 1 ? "Login details emailed" : `Login details emailed to all ${sent} clients`);
    }
  };

  const doImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const res = await ImportClientsAPI(file);
      const imported: ClientImportResult = res.data.data;
      setResult(imported);
      setSends({});
      toast.success(res.data.message || "Clients imported");
      if (emailOnImport) void sendLogins(imported.clients);
    } catch (err) {
      // The file is checked again on import: an account made meanwhile shows up as a problem.
      if (axios.isAxiosError(err) && err.response?.status === 422 && err.response.data?.data) {
        setReport(err.response.data.data);
        toast.error("Nothing was imported", { description: "Something changed since the check: see below." });
      } else {
        toast.error("Couldn't import the clients", { description: apiErrorMessage(err, "Try again in a moment.") });
      }
    } finally {
      setImporting(false);
    }
  };

  const runImport = () => {
    if (!file || !report?.can_import) return;
    const count = report.summary.new_clients;
    const existing = report.summary.already_clients;
    const parts = [
      `${plural(count, "account")} will be created`,
      emailOnImport ? "and each client will be emailed their login details" : "and you can email or copy their login details next",
    ];

    confirm({
      title: `Import ${plural(count, "client")}?`,
      content: `${parts.join(", ")}.${existing ? ` ${plural(existing, "email")} in the file already ${existing === 1 ? "has an account and is" : "have accounts and are"} left as ${existing === 1 ? "it is" : "they are"}.` : ""} Every account in the file is created, or none if something goes wrong.`,
      okText: "Import",
      // Not awaited: the dialog closes and the page shows the import running.
      onOk: () => {
        void doImport();
      },
    });
  };

  const header = (
    <PageHeader
      title="Import clients from CSV"
      description="Add your existing clients from a spreadsheet, each with their own account. Nothing is saved until the file is checked and you press Import."
      actions={
        <Button variant="outline" onClick={() => navigate(LIST_PATH)} disabled={importing}>
          <ArrowLeft aria-hidden />
          Users
        </Button>
      }
    />
  );

  // ---------------------------------------------------------------------------------------
  // After the import: the passwords, and the emails
  // ---------------------------------------------------------------------------------------
  if (result) {
    const clients = result.clients;
    const stateOf = (c: Imported): SendState => sends[c.id] ?? { status: "idle" };
    const sentCount = clients.filter((c) => stateOf(c).status === "sent").length;
    const failedCount = clients.filter((c) => stateOf(c).status === "failed").length;
    const unsent = clients.filter((c) => ["idle", "failed"].includes(stateOf(c).status));
    const started = Object.keys(sends).length > 0;
    const signInUrl = result.sign_in_url ?? null;

    const copyAll = () =>
      copyText(
        clients.map((c) => loginMessage({ name: c.name, email: c.email, password: c.password, signInUrl })).join("\n\n"),
        "Every client's login details",
      );

    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {header}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-success" aria-hidden />
              Imported {plural(clients.length, "client")}
            </CardTitle>
            <CardDescription>
              Their accounts are ready.
              {result.summary.already_clients > 0 &&
                ` ${plural(result.summary.already_clients, "email")} already had an account and ${result.summary.already_clients === 1 ? "was" : "were"} left as ${result.summary.already_clients === 1 ? "it was" : "they were"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Callout tone="warn" icon={TriangleAlert} title="The passwords are shown only on this page">
              Email the login details from here, or copy them before you leave. Later, a client's password can only be
              replaced: open the client and use Set password, which can email the new one.
            </Callout>

            {started && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                {sending ? (
                  <Spinner size="small" label="Sending" />
                ) : failedCount ? (
                  <XCircle className="size-4 text-destructive" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                )}
                <span className="font-medium text-foreground">
                  {sentCount} of {clients.length} login {clients.length === 1 ? "email" : "emails"} sent
                  {failedCount ? `, ${failedCount} not sent` : ""}
                </span>
                {sending && <span className="text-muted-foreground">Keep this page open until they're all sent.</span>}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {unsent.length > 0 && (
                <Button onClick={() => sendLogins(unsent)} disabled={sending}>
                  {failedCount && !sending ? <RefreshCw aria-hidden /> : <Mail aria-hidden />}
                  {failedCount && unsent.length === failedCount
                    ? `Try the ${plural(failedCount, "failed one")} again`
                    : unsent.length === clients.length
                      ? `Email login details to all ${clients.length}`
                      : `Email the other ${unsent.length}`}
                </Button>
              )}
              <Button variant="outline" onClick={copyAll}>
                <Copy aria-hidden />
                Copy all login details
              </Button>
            </div>

            <div className="max-h-[36rem] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Login email</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.id} className="align-top">
                      <TableCell className="whitespace-normal">
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{formatPhone(c.mobile) ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <code className="font-mono text-sm select-all">{c.password}</code>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Copy ${c.name}'s password`}
                            onClick={() => copyText(c.password, "Password")}
                          >
                            <Copy aria-hidden />
                          </Button>
                        </span>
                      </TableCell>
                      <TableCell className="min-w-44 whitespace-normal">
                        <EmailStatus state={stateOf(c)} onSend={() => sendLogins([c])} disabled={sending} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/users/${c.id}`} target="_blank" rel="noreferrer">
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {result.already_clients.length > 0 && (
              <details className="space-y-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  {plural(result.already_clients.length, "email")} already had an account: left as{" "}
                  {result.already_clients.length === 1 ? "it was" : "they were"}
                </summary>
                <ExistingTable rows={result.already_clients} />
              </details>
            )}

            {result.warnings.length > 0 && (
              <details className="space-y-2">
                <summary className="cursor-pointer text-sm font-medium">
                  {plural(result.warnings.length, "note")} from the check
                </summary>
                <IssueTable issues={result.warnings} label="Note" />
              </details>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                onClick={() => {
                  if (sending) {
                    toast.info("Wait until the emails are sent, or they stop.");
                    return;
                  }
                  navigate(LIST_PATH);
                }}
              >
                <Users aria-hidden />
                Go to Users
              </Button>
              <Button variant="outline" onClick={clear} disabled={sending}>
                Import another file
              </Button>
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
  const nothingNew = !!report && report.errors.length === 0 && report.clients.length === 0 && report.already_clients.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {header}

      {/* 1. The layout */}
      <Card>
        <CardHeader>
          <CardTitle>1. Fill in the spreadsheet</CardTitle>
          <CardDescription>
            One row per client: their name, their email and, if you have it, their mobile number. Start from the
            empty template, or look at the example first.
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
                <Button onClick={() => downloadCsv("clients-template.csv", format.template_csv)}>
                  <FileSpreadsheet aria-hidden />
                  Download empty template
                </Button>
                <Button variant="outline" onClick={() => downloadCsv(format.example_file_name, format.example_csv)}>
                  <Download aria-hidden />
                  Download example CSV
                </Button>
              </div>

              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-foreground">The example</p>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 text-muted-foreground">Row</TableHead>
                        {exampleHeader.map((h) => (
                          <TableHead key={h}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exampleBody.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground tabular-nums">{i + 2}</TableCell>
                          {row.map((cell, j) => (
                            <TableCell key={j}>
                              {cell || <span className="text-muted-foreground italic">empty: no mobile</span>}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Row 1 holds the column names. The example's addresses aren't real, so the check refuses them: put your
                  clients' own.
                </p>
              </div>

              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Rule title="One row per client">
                  Name and Email on every row. Add Mobile if you have it, or leave it empty.
                </Rule>
                <Rule title="Their real email">
                  It's what they sign in with, and where their login details are sent. Each email once per file.
                </Rule>
                <Rule title="Clients you already have">
                  An email that already has an account is left as it is, password and orders included. The check lists
                  them.
                </Rule>
                <Rule title="US mobile numbers">
                  10 digits in any format: (832) 555-0123, 832-555-0123 or +1 832 555 0123.
                </Rule>
                <Rule title="A password for each">
                  Every new client gets one. After the import, email it to them from this page or copy it. It's shown only
                  once.
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
                  {showColumns ? "Hide" : "Show"} the {format.columns.length} columns
                </button>
                {showColumns && (
                  <div className="mt-3 overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-32">Column</TableHead>
                          <TableHead className="w-24">Needed</TableHead>
                          <TableHead>What to put</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {format.columns.map((c) => (
                          <TableRow key={c.key} className="align-top">
                            <TableCell className="font-medium text-foreground">{c.header}</TableCell>
                            <TableCell>{c.required ? "Yes" : "No"}</TableCell>
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
            Up to {(format?.limits.max_rows ?? 500).toLocaleString()} clients and {maxMb} MB per file. It's checked as
            soon as you choose it.
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
                id="client-import-file"
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
              <Button variant={checkError ? "default" : "outline"} onClick={() => check(file)}>
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
                <Stat label="New clients" value={report.summary.new_clients} />
                <Stat label="Already a client" value={report.summary.already_clients} />
                <Stat label="Problems" value={report.errors.length} tone={report.errors.length ? "bad" : "good"} />
                <Stat label="Warnings" value={report.summary.warnings} tone={report.summary.warnings ? "warn" : undefined} />
              </div>

              {report.errors.length > 0 && (
                <div className="space-y-3">
                  <Callout
                    tone="bad"
                    icon={XCircle}
                    title={`Fix ${plural(report.errors.length, "problem")} in the file, then upload it again`}
                  >
                    Nothing has been saved.
                  </Callout>
                  <IssueTable issues={report.errors} />
                </div>
              )}

              {nothingNew && (
                <Callout tone="warn" icon={Users} title="Everyone in this file already has an account">
                  There's nothing to import. Their accounts are listed below.
                </Callout>
              )}

              {report.can_import && (
                <Callout tone="good" icon={CheckCircle2} title="The file is ready to import">
                  Check the clients below, then press Import.
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

              {report.clients.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {report.can_import ? "To be added" : "New clients in the file"}: {report.clients.length}
                  </p>
                  <div className="max-h-[32rem] overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Row</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Mobile</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.clients.map((c) => (
                          <TableRow key={c.row}>
                            <TableCell className="tabular-nums">{c.row}</TableCell>
                            <TableCell className="font-medium whitespace-normal text-foreground">{c.name}</TableCell>
                            <TableCell className="whitespace-normal">{c.email}</TableCell>
                            <TableCell>{formatPhone(c.mobile) ?? <span className="text-muted-foreground">—</span>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {report.already_clients.length > 0 && (
                <details className="space-y-3" open={nothingNew}>
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    {plural(report.already_clients.length, "email")} already {report.already_clients.length === 1 ? "has an account" : "have accounts"}:
                    left as {report.already_clients.length === 1 ? "it is" : "they are"}
                  </summary>
                  <ExistingTable rows={report.already_clients} />
                </details>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                {report.can_import ? (
                  <div className="flex items-start gap-3">
                    <Switch
                      id="email-on-import"
                      checked={emailOnImport}
                      onCheckedChange={setEmailOnImport}
                      disabled={importing}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="email-on-import">Email each new client their login details</Label>
                      <p className="text-xs text-muted-foreground">
                        {emailOnImport
                          ? "Sent one by one right after the import, from your support address."
                          : "Nothing is emailed. You can still email them, or copy the passwords, after the import."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {nothingNew ? "Add new clients to the file to import them." : "Fix the file, then choose it again above."}
                  </p>
                )}
                <Button onClick={runImport} disabled={!report.can_import || importing} className="ml-auto">
                  {importing ? <Spinner size="small" className="text-current" /> : <Upload aria-hidden />}
                  {importing
                    ? "Importing…"
                    : report.can_import
                      ? `Import ${plural(report.summary.new_clients, "client")}`
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

export default ImportClientsPage;
