/** @format */

import { useEffect, useSyncExternalStore } from "react";
import axios, { type AxiosProgressEvent } from "axios";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/api-errors";
import { getToken, onSessionChange } from "@/lib/session";
import {
  ImportProductsAPI,
  PreviewProductImportAPI,
  type ImportReport,
  type ImportResult,
} from "@/services/Api/ProductImportApi";

// The CSV import's file, check and result live here, not in the page, so a check or an import
// keeps going when the admin opens another page. While the import page isn't showing, a message
// in the corner says how it's going, then opens the page again when it's done.

export const IMPORT_PATH = "/import-products";
const TOAST_ID = "product-import";
// How long a "done" message stays up while the admin is on another page.
const DONE_TOAST_MS = 30_000;

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export type ImportPhase = "idle" | "checking" | "importing";

export interface ImportJob {
  file: File | null;
  templateId: number | null;
  phase: ImportPhase;
  // Share of the file sent so far, 0 to 1. At 1 the server is working on it.
  sent: number;
  // When the running check or import started (Date.now()).
  startedAt: number;
  report: ImportReport | null;
  result: ImportResult | null;
  // Why the last check didn't finish.
  checkError: string | null;
  // A check finished while the page wasn't showing; the page scrolls to it when it opens.
  unseen: boolean;
}

const EMPTY: ImportJob = {
  file: null,
  templateId: null,
  phase: "idle",
  sent: 0,
  startedAt: 0,
  report: null,
  result: null,
  checkError: null,
  unseen: false,
};

let state = EMPTY;
const listeners = new Set<() => void>();
// Each check or import gets the next number. An answer for an older one is ignored.
let current = 0;
let controller: AbortController | null = null;
let pagesShowing = 0;
// Set by <ImportJobNavigator />, which sits inside the router.
let openPage: (() => void) | null = null;

const set = (patch: Partial<ImportJob>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getImportJob = () => state;

export const useImportJob = () => useSyncExternalStore(subscribe, getImportJob);

const fileName = () => state.file?.name ?? "The file";

// A message in the corner, used only while the page isn't showing. Same id, so each one
// replaces the last.
const notify = (kind: "success" | "error" | "loading", title: string, description: string, label = "Open") => {
  if (pagesShowing || !getToken()) return;
  toast[kind](title, {
    id: TOAST_ID,
    description,
    action: { label, onClick: () => openPage?.() },
    duration: kind === "loading" ? undefined : DONE_TOAST_MS,
  });
};

const tracker = (job: number) => ({
  onUploadProgress: (e: AxiosProgressEvent) => {
    if (job === current && e.progress != null) set({ sent: e.progress });
  },
});

const checkErrorMessage = (err: unknown) =>
  axios.isAxiosError(err) && !err.response
    ? "The file couldn't be sent. Check your connection, or choose the file again if you changed it since choosing it."
    : apiErrorMessage(err, "Try again in a moment.");

// Checks the file on the server. Saves nothing. A new check stops the one before it.
export const checkFile = async (file: File, templateId: number | null) => {
  if (state.phase === "importing") return;
  controller?.abort();
  controller = new AbortController();
  const job = ++current;
  set({ ...EMPTY, file, templateId, phase: "checking", startedAt: Date.now() });

  try {
    const res = await PreviewProductImportAPI(file, templateId, { signal: controller.signal, ...tracker(job) });
    if (job !== current) return;
    const report: ImportReport = res.data.data;
    set({ phase: "idle", report, unseen: !pagesShowing });
    if (report.can_import) {
      notify(
        "success",
        `${fileName()} is ready to import`,
        `${plural(report.summary.products, "product")} checked. Nothing is imported until you press Import.`,
      );
    } else {
      notify(
        "error",
        `${fileName()} has ${plural(report.summary.errors, "problem")} to fix`,
        "Nothing was imported. Open it to see what to change.",
      );
    }
  } catch (err) {
    if (job !== current) return;
    const message = checkErrorMessage(err);
    set({ phase: "idle", checkError: message });
    notify("error", `${fileName()} couldn't be checked`, message);
  }
};

export const setTemplate = (templateId: number | null) => {
  if (state.phase === "importing") return;
  if (state.file) checkFile(state.file, templateId);
  else set({ templateId });
};

// Stops any check and forgets the file. The default template stays.
export const clearImport = () => {
  if (state.phase === "importing") return;
  controller?.abort();
  current++;
  set({ ...EMPTY, templateId: state.templateId });
};

// Creates every product in the checked file. It can't be stopped once started: the server
// finishes it even if the page or the tab is closed.
export const importFile = async () => {
  const { file, templateId, report } = state;
  if (!file || !report?.can_import || state.phase !== "idle") return;
  const job = ++current;
  set({ phase: "importing", sent: 0, startedAt: Date.now(), unseen: false });

  try {
    const res = await ImportProductsAPI(file, templateId, tracker(job));
    if (job !== current) return;
    const result: ImportResult = res.data.data;
    set({ phase: "idle", result, report: null });
    if (pagesShowing) toast.success(res.data.message || "Products imported");
    notify("success", `Imported ${plural(result.summary.products, "product")}`, `From ${file.name}.`, "View");
  } catch (err) {
    if (job !== current) return;
    if (axios.isAxiosError(err) && err.response?.status === 422 && err.response.data?.data) {
      set({ phase: "idle", report: err.response.data.data, unseen: !pagesShowing });
      if (pagesShowing) {
        toast.error("Nothing was imported", {
          description: "Something the file names changed since the check. See the problems listed.",
        });
      }
      notify("error", "Nothing was imported", "Something the file names changed since the check. Open it to see why.");
    } else if (axios.isAxiosError(err) && !err.response) {
      // The server may have finished it: the import doesn't stop when the connection does.
      set({ phase: "idle" });
      toast.error("The connection dropped during the import", {
        id: TOAST_ID,
        description: "The products may have been created. Look on the Products page before importing the file again.",
        duration: Infinity,
      });
    } else {
      set({ phase: "idle" });
      const message = apiErrorMessage(err, "Try again in a moment.");
      if (pagesShowing) toast.error("Nothing was imported", { description: message });
      notify("error", "Nothing was imported", message);
    }
  }
};

// Signing out forgets the file and its check. An import already sent still finishes on the server.
onSessionChange(() => {
  if (getToken()) return;
  controller?.abort();
  current++;
  state = EMPTY;
  listeners.forEach((listener) => listener());
  toast.dismiss(TOAST_ID);
});

// The import page calls this while it's showing.
export const useImportPageShowing = () => {
  useEffect(() => {
    pagesShowing++;
    toast.dismiss(TOAST_ID);
    return () => {
      pagesShowing--;
      // A tick later, in case the page is showing again straight away.
      setTimeout(() => {
        if (pagesShowing) return;
        if (state.phase === "checking") {
          notify("loading", `Checking ${fileName()}`, "It carries on while you work. This message updates when it's done.");
        } else if (state.phase === "importing") {
          notify(
            "loading",
            `Importing ${plural(state.report?.summary.products ?? 0, "product")}`,
            "It carries on while you work. This message updates when it's done.",
          );
        } else if (state.result) {
          // The result was seen; the next visit starts with a new file.
          set({ ...EMPTY, templateId: state.templateId });
        }
      }, 0);
    };
  }, []);
};

export const markSeen = () => {
  if (state.unseen) set({ unseen: false });
};

// Lets the corner message open the import page. Mount once inside the router.
export const registerImportPageOpener = (open: (() => void) | null) => {
  openPage = open;
};
