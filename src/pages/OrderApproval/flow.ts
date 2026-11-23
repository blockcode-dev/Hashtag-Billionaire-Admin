import type { ApprovalLine, ApprovalView } from "@/services/Api/ApprovalApi";

// Where a started approval stands in the page's four steps (add artwork previews, send to the
// customer, customer reviews, lock for production) and why, so the page can say what to do next.

export type Situation =
  // Nothing sent yet and no previews added.
  | "add-first"
  // Nothing sent yet; some items have previews ready, others still need one.
  | "add-rest"
  // Nothing sent yet; every item has its previews ready.
  | "send-first"
  // The customer asked for changes and the item has no new version yet.
  | "changes"
  // Sent before, but some items never got a preview.
  | "add-new-items"
  // New versions are ready to send.
  | "send-new"
  | "waiting"
  // Everything approved, not locked yet.
  | "approved"
  // Every item is marked "No preview needed".
  | "nothing-to-check"
  | "locked"
  | "shipped"
  | "cancelled";

export interface Flow {
  situation: Situation;
  // The step to work on (1–4); 5 once every step is done; 0 when none can happen (cancelled).
  step: number;
  // Items the customer approves (not "No preview needed").
  toCheck: ApprovalLine[];
  approved: ApprovalLine[];
  // Never sent and nothing added yet.
  missing: ApprovalLine[];
  // Changes asked for, with no new version added yet.
  changes: ApprovalLine[];
  // Items with previews that aren't sent yet, and how many previews that is. An item marked
  // "No preview needed" never counts: its previews aren't offered for sending.
  ready: ApprovalLine[];
  readyFiles: number;
  // Something was sent to the customer at least once.
  sentBefore: boolean;
}

export function flowOf(view: ApprovalView): Flow {
  const { approval, lines } = view;
  const toCheck = lines.filter((line) => !line.no_proof);
  const ready = toCheck.filter((line) => line.drafts.length > 0);
  const base = {
    toCheck,
    approved: toCheck.filter((line) => line.status === "APPROVED"),
    missing: toCheck.filter((line) => line.current_version === 0 && !line.drafts.length),
    changes: toCheck.filter((line) => line.status === "CHANGES_REQUESTED" && !line.drafts.length),
    ready,
    readyFiles: ready.reduce((total, line) => total + line.drafts.length, 0),
    sentBefore: Boolean(approval?.first_sent_at),
  };
  const at = (situation: Situation, step: number): Flow => ({ ...base, situation, step });

  const reason = approval?.read_only_reason;
  if (reason === "LOCKED") return at("locked", 5);
  if (reason === "SHIPPED") return at("shipped", 5);
  if (reason === "CANCELLED") return at("cancelled", 0);
  if (!toCheck.length) return at("nothing-to-check", 4);
  if (base.changes.length) return at("changes", 1);
  if (base.missing.length) {
    if (base.sentBefore) return at("add-new-items", 1);
    return at(base.readyFiles ? "add-rest" : "add-first", 1);
  }
  if (base.readyFiles) return at(base.sentBefore ? "send-new" : "send-first", 2);
  if (approval?.status === "APPROVED") return at("approved", 4);
  return at("waiting", 3);
}

// The customer's notes that still count on an item: sent after its newest version and not
// removed. Their event ids are newer than the newest "sent" event of the item.
export function activeNotes(view: ApprovalView, line: ApprovalLine) {
  const lastSent = Math.max(
    0,
    ...view.history.filter((event) => event.type === "VERSION_SENT" && event.line_id === line.id).map((event) => event.id),
  );
  return line.notes.filter((note) => !note.removed && note.event_id > lastSent);
}
