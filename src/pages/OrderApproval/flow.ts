import type { ApprovalLine, ApprovalView, LineStatus } from "@/services/Api/ApprovalApi";

// Where a started approval stands and why, so the page can say what to do next: the summary at
// the top, and the bar at the bottom with the one main button.

export type Situation =
  // Nothing sent yet and no previews added.
  | "add-first"
  // Nothing sent yet; some items have previews ready, others still need one.
  | "add-rest"
  // Nothing sent yet; every item has its previews ready.
  | "send-first"
  // The customer rejected an item and it has no new version yet.
  | "rejected"
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
  // Items the customer approves (not "No preview needed").
  toCheck: ApprovalLine[];
  // Approved, by Approve or by going back to an earlier version.
  approved: ApprovalLine[];
  // Never sent and nothing added yet.
  missing: ApprovalLine[];
  // Rejected by the customer, with no new version added yet.
  rejected: ApprovalLine[];
  // Items with previews that aren't sent yet, and how many previews that is. An item marked
  // "No preview needed" never counts: its previews aren't offered for sending.
  ready: ApprovalLine[];
  readyFiles: number;
  // Ready items the customer already approved: sending asks them to check again.
  readyApproved: ApprovalLine[];
  // Approved items where the customer went back to an earlier version.
  wentBack: ApprovalLine[];
  // How many items are in each state, for the summary's counts.
  counts: Record<LineStatus, number>;
  // Something was sent to the customer at least once.
  sentBefore: boolean;
}

// The earlier version an approved item went back to (the one to make), or null.
export const wentBackTo = (line: ApprovalLine) =>
  line.status === "APPROVED" && line.approved_version !== null && line.approved_version < line.current_version
    ? line.approved_version
    : null;

export function flowOf(view: ApprovalView): Flow {
  const { approval, lines } = view;
  const toCheck = lines.filter((line) => !line.no_proof);
  const ready = toCheck.filter((line) => line.drafts.length > 0);
  const counts: Record<LineStatus, number> = {
    APPROVED: 0,
    CHANGES_REQUESTED: 0,
    WAITING: 0,
    NOT_SENT: 0,
    NO_PROOF_NEEDED: 0,
  };
  for (const line of lines) counts[line.status] += 1;
  const base = {
    toCheck,
    approved: toCheck.filter((line) => line.status === "APPROVED"),
    missing: toCheck.filter((line) => line.current_version === 0 && !line.drafts.length),
    rejected: toCheck.filter((line) => line.status === "CHANGES_REQUESTED" && !line.drafts.length),
    ready,
    readyFiles: ready.reduce((total, line) => total + line.drafts.length, 0),
    readyApproved: ready.filter((line) => line.status === "APPROVED"),
    wentBack: toCheck.filter((line) => wentBackTo(line) !== null),
    counts,
    sentBefore: Boolean(approval?.first_sent_at),
  };
  const at = (situation: Situation): Flow => ({ ...base, situation });

  const reason = approval?.read_only_reason;
  if (reason === "LOCKED") return at("locked");
  if (reason === "SHIPPED") return at("shipped");
  if (reason === "CANCELLED") return at("cancelled");
  if (!toCheck.length) return at("nothing-to-check");
  if (base.rejected.length) return at("rejected");
  if (base.missing.length) {
    if (base.sentBefore) return at("add-new-items");
    return at(base.readyFiles ? "add-rest" : "add-first");
  }
  if (base.readyFiles) return at(base.sentBefore ? "send-new" : "send-first");
  if (approval?.status === "APPROVED") return at("approved");
  return at("waiting");
}
