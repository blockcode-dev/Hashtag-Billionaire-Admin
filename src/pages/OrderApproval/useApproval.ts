import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { toastApiError } from "@/lib/api-errors";
import { GetOrderApprovalAPI, MarkApprovalSeenAPI, type ApprovalView } from "@/services/Api/ApprovalApi";
import { buildActivity } from "./activity";

// How often the page looks for the customer's changes while it's open, and the shortest gap
// between two looks (window focus can fire often).
const SYNC_EVERY_MS = 60 * 1000;
const SYNC_MIN_GAP_MS = 15 * 1000;

const customerEvents = (view: ApprovalView) =>
  view.history.filter((event) => event.actor === "CUSTOMER").sort((a, b) => b.id - a.id);

// The customer's new actions as the Activity tab words them, e.g. "The customer approved
// Version 1 of OGIO Envision Polo (Blacktop)".
const summarize = (ids: number[], view: ApprovalView) => {
  const fresh = new Set(ids);
  const texts = buildActivity(view)
    .filter((entry) => entry.ids.some((id) => fresh.has(id)))
    .map((entry) => entry.text);
  const shown = texts.slice(0, 3);
  if (texts.length > 3) shown.push(`and ${texts.length - 3} more`);
  return shown.join(". ");
};

type WriteResponse = { data: { data: ApprovalView } };

// Why the first load failed. "missing": the backend has no such order. "unavailable": a server
// without approvals (the live one until this backend is deployed there), which answers an
// address it doesn't know with its plain 404 "Not found". "unanswered": no answer at all.
// "failed": any other error.
type LoadError = "missing" | "unavailable" | "unanswered" | "failed";

const loadErrorOf = (err: unknown): LoadError => {
  if (!axios.isAxiosError(err)) return "failed";
  if (!err.response) return "unanswered";
  if (err.response.status !== 404) return "failed";
  return err.response.data?.message === "Order not found" ? "missing" : "unavailable";
};

// Loads an order's artwork approval and keeps it current while the page is open: every minute
// and when the window gets focus. It says when the customer changed something and tells the
// backend the team has seen it, which clears the Orders list's dot. Writes run one at a time
// through `run`, and a load that started before a write is dropped, so it can't put older data
// back.
export function useApproval(orderId: number) {
  const [view, setView] = useState<ApprovalView | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The first load's outcome, so loading and errors follow from it.
  const [settled, setSettled] = useState<{ key: number; error: LoadError | null } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Customer events that are new to the team: unseen when the page opened, or arrived since.
  const [newEventIds, setNewEventIds] = useState<ReadonlySet<number>>(() => new Set());
  // The write under way, for its button's spinner.
  const [busy, setBusy] = useState<string | null>(null);
  // Set at once, so a double click can't start a second write before the buttons disable.
  const busyRef = useRef(false);
  // Bumped by every write and every view shown; a load that started before a bump is dropped.
  const generation = useRef(0);
  // The newest customer event shown so far; null until the first load.
  const lastCustomerId = useRef<number | null>(null);
  // The newest customer event the backend has been told the team saw.
  const seenUpTo = useRef(0);

  const apply = useCallback(
    (next: ApprovalView) => {
      generation.current++;
      const customer = customerEvents(next);
      const newest = customer[0]?.id ?? 0;
      const known = lastCustomerId.current;
      // On opening: what nobody on the team has seen yet. Afterwards: whatever is newer.
      const fresh = known === null ? customer.slice(0, next.approval?.unseen ?? 0) : customer.filter((e) => e.id > known);
      if (known !== null && fresh.length) {
        toast.info("New from the customer", { description: summarize(fresh.map((e) => e.id), next) });
      }
      lastCustomerId.current = Math.max(known ?? 0, newest);
      if (fresh.length) setNewEventIds((ids) => new Set([...ids, ...fresh.map((e) => e.id)]));
      setView(next);

      // Only while someone is looking, and once per change.
      if ((next.approval?.unseen ?? 0) > 0 && newest > seenUpTo.current && document.visibilityState === "visible") {
        seenUpTo.current = newest;
        MarkApprovalSeenAPI(orderId).catch(() => {
          // The Orders list keeps its dot; the next load tries again.
          seenUpTo.current = 0;
        });
      }
    },
    [orderId],
  );

  useEffect(() => {
    let active = true;
    GetOrderApprovalAPI(orderId)
      .then((res) => {
        if (!active) return;
        apply(res.data.data);
        setSettled({ key: reloadKey, error: null });
      })
      .catch((err) => {
        if (active) setSettled({ key: reloadKey, error: loadErrorOf(err) });
      });
    return () => {
      active = false;
    };
  }, [orderId, reloadKey, apply]);

  // While the page is open, the customer may act at any time.
  useEffect(() => {
    let lastCheck = Date.now();
    const check = async () => {
      if (document.visibilityState !== "visible" || busyRef.current || Date.now() - lastCheck < SYNC_MIN_GAP_MS) return;
      lastCheck = Date.now();
      const started = generation.current;
      try {
        const res = await GetOrderApprovalAPI(orderId);
        if (started === generation.current && !busyRef.current) apply(res.data.data);
      } catch {
        // Keep what's shown; the next check tries again.
      }
    };
    const timer = setInterval(check, SYNC_EVERY_MS);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [orderId, apply]);

  // `quiet` after a failed write, which has already said what went wrong.
  const refresh = useCallback(
    async (quiet = false) => {
      setRefreshing(true);
      const started = generation.current;
      try {
        const res = await GetOrderApprovalAPI(orderId);
        if (started === generation.current) apply(res.data.data);
      } catch (err) {
        if (!quiet) toastApiError("Couldn't load the artwork approval again", err);
      } finally {
        setRefreshing(false);
      }
    },
    [orderId, apply],
  );

  // Runs one write; returns undefined, without running, while another is under way.
  const run = useCallback(async <T>(action: string, task: () => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    generation.current++;
    setBusy(action);
    try {
      return await task();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, []);

  // A write that answers with the view. On failure it says why and loads the page again, since
  // the order may have changed elsewhere. Resolves true when it worked.
  const write = useCallback(
    (action: string, call: () => Promise<WriteResponse>, failTitle: string) =>
      run(action, async () => {
        try {
          apply((await call()).data.data);
          return true;
        } catch (err) {
          toastApiError(failTitle, err);
          void refresh(true);
          return false;
        }
      }),
    [run, apply, refresh],
  );

  const failed = !view && settled?.key === reloadKey ? settled.error : null;

  return {
    view,
    loading: !view && !failed,
    // Why the first load didn't work (LoadError), or null.
    failed,
    retry: () => setReloadKey((key) => key + 1),
    refresh,
    refreshing,
    newEventIds,
    busy,
    run,
    write,
    apply,
  };
}
