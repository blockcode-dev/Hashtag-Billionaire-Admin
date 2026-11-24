import axios from "axios";

import { API_BASE_URL } from "@/config/env";

// Artwork approval for one paid order: the team uploads proof images for each line and sends
// them; order@ emails the customer a link to the approval site, where they approve each item,
// reject it with a note and pictures, or go back to an earlier version, without signing in, and
// can undo their last choice until the team locks it. Every write answers with the whole view
// below, so the page shows what comes back.
// The admin token is attached by the axios interceptor (services/Api/interceptors.ts).
// The API keeps its own names; on screen a proof is an "artwork preview", a draft is one "not
// sent yet", a note is the customer's rejection and CHANGES_REQUESTED reads "Rejected".

export type ApprovalStatus = "DRAFT" | "WAITING" | "CHANGES_REQUESTED" | "APPROVED";

// PENDING_DECISION: held at payment until the team decides; HOLD: the label waits for Lock.
export type HoldState = "NONE" | "PENDING_DECISION" | "HOLD" | "RELEASED";

// CHANGES_REQUESTED: the customer rejected the newest version.
export type LineStatus = "NOT_SENT" | "NO_PROOF_NEEDED" | "WAITING" | "CHANGES_REQUESTED" | "APPROVED";

// What became of a sent version. WAITING: the newest, nothing chosen on it yet. APPROVED: by
// Approve or by going back to it. REJECTED: by the customer's Reject, or by going back to an
// older version. REPLACED: a newer version was sent before they chose it, or after they approved it.
export type VersionStatus = "WAITING" | "APPROVED" | "REJECTED" | "REPLACED";

// The customer's choices on an item: approve the newest version, reject it (with a note), or go
// back to an older version (which approves it and rejects the newer ones).
export type ChoiceKind = "APPROVED" | "REJECTED" | "WENT_BACK";

// What an event means for the customer's choices; null for every other event.
export type HistoryKind =
  | "SENT"
  | "APPROVED"
  | "WENT_BACK"
  | "REJECTED"
  | "UNDID_APPROVAL"
  | "UNDID_GO_BACK"
  | "UNDID_REJECTION";

// An item's last choice: what the customer's Undo takes back. null while nothing is chosen on
// the newest version, and while the item isn't sent or is marked "No preview needed".
export interface LastChoice {
  // The APPROVED or NOTE_ADDED event.
  event_id: number;
  kind: ChoiceKind;
  // The version it names; for WENT_BACK, the version gone back to.
  version: number;
  at: string;
  // Set when it came from "Approve all".
  batch_id: string | null;
}

// Why the customer's page is read-only.
export type ReadOnlyReason = "LOCKED" | "SHIPPED" | "CANCELLED";

// first: nothing emailed yet; updated: this send made new versions; reminder: neither.
export type EmailKind = "first" | "updated" | "reminder";

export type EventActor = "ADMIN" | "CUSTOMER" | "SYSTEM";

export type EventType =
  | "APPROVAL_STARTED"
  | "PROOF_ADDED"
  | "PROOF_REMOVED"
  | "PROOF_COPIED"
  | "NO_PROOF_SET"
  | "NO_PROOF_CLEARED"
  | "VERSION_SENT"
  | "EMAIL_SENT"
  | "EMAIL_FAILED"
  | "LINK_REPLACED"
  | "LINK_DISABLED"
  | "LINK_ENABLED"
  | "HOLD_SET"
  | "LOCKED"
  | "UNLOCKED"
  | "HOLD_PENDING"
  | "APPROVED"
  | "APPROVAL_UNDONE"
  | "NOTE_ADDED"
  | "NOTE_REMOVED";

export interface ApprovalFile {
  id: number;
  // The file as uploaded; the server sends it as a download.
  url: string;
  // A WebP for showing (SVGs too); null only when it couldn't be made.
  preview_url: string | null;
  name: string;
  mime: string;
  bytes: number;
  created_at: string;
}

export interface ApprovalVersion {
  version: number;
  sent_at: string;
  // The team's message with that Send.
  message: string | null;
  files: ApprovalFile[];
  status: VersionStatus;
  // When the customer approved or rejected it; null for WAITING and REPLACED.
  decided_at: string | null;
  // REJECTED by going back to an older version: that version.
  went_back_to: number | null;
  // REJECTED: the customer's rejection of this version, when they wrote one.
  note: ApprovalNote | null;
}

// A customer's rejection: what to change, and their pictures. The API calls it a note.
export interface ApprovalNote {
  // The customer's NOTE_ADDED event.
  event_id: number;
  body: string | null;
  created_at: string;
  // The version they rejected.
  version: number;
  // Undone with Undo.
  removed: boolean;
  removed_at: string | null;
  pictures: { id: number; url: string; name: string }[];
}

export interface ApprovalLineDetail {
  color: string | null;
  sizes: { size: string; quantity: number }[];
  // "S×2 · M×3"
  sizes_text: string;
  print_methods: string[];
  locations: string[];
  // The customer's own files from the order. Either can be null when the order didn't keep it.
  customer_artwork: { url: string | null; name: string | null }[];
}

// What the customer approves: the order items of one product, colour and design, all sizes.
export interface ApprovalLine {
  // null on the proposed lines shown before the approval starts.
  id: number | null;
  position: number;
  title: string;
  product_id: number | null;
  order_item_ids: number[];
  detail: ApprovalLineDetail;
  no_proof: boolean;
  status: LineStatus;
  current_version: number;
  approved_version: number | null;
  approved_at: string | null;
  // Uploaded but not sent yet.
  drafts: ApprovalFile[];
  // Oldest first.
  versions: ApprovalVersion[];
  // The customer's rejections, oldest first.
  notes: ApprovalNote[];
  last_choice: LastChoice | null;
}

export interface ApprovalEventMeta {
  // PROOF_ADDED and PROOF_REMOVED: the file's name.
  name?: string;
  // EMAIL_SENT and EMAIL_FAILED.
  to?: string;
  kind?: EmailKind;
  error?: string;
  // HOLD_SET.
  hold_state?: HoldState;
  // LOCKED: "label" when buying the label locked it.
  reason?: string;
}

export interface ApprovalEvent {
  id: number;
  type: EventType;
  actor: EventActor;
  admin: { id: number; name: string } | null;
  line_id: number | null;
  line_title: string | null;
  // APPROVAL_UNDONE and NOTE_REMOVED: the version of the choice they undid.
  version: number | null;
  // APPROVAL_UNDONE and NOTE_REMOVED: the choice they undid.
  target_event_id: number | null;
  // Approvals made together with "Approve all", and their undo.
  batch_id: string | null;
  body: string | null;
  meta: ApprovalEventMeta | null;
  created_at: string;
  // Customer events only.
  ip: string | null;
  user_agent: string | null;
  // A choice the customer undid: an approval, a go back or a rejection.
  undone: boolean;
  kind: HistoryKind | null;
  // A choice: the item's newest version when it was made. APPROVAL_UNDONE and NOTE_REMOVED: that
  // of the choice they undid. Otherwise null.
  newest_version: number | null;
}

export interface Approval {
  id: number;
  status: ApprovalStatus;
  hold_state: HoldState;
  locked_at: string | null;
  locked_by: { id: number; name: string } | null;
  // url is null until the first Send makes the link.
  link: { url: string | null; disabled: boolean; created_at: string | null };
  first_sent_at: string | null;
  last_sent_at: string | null;
  approved_at: string | null;
  // Customer events newer than the team's last look (POST …/seen).
  unseen: number;
  // null while the customer can still change things.
  read_only_reason: ReadOnlyReason | null;
}

export interface ApprovalOrder {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  shipment_status: string;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  has_label: boolean;
}

export interface ApprovalView {
  order: ApprovalOrder;
  // null until it starts; `lines` are then the proposed lines, with no ids or files.
  approval: Approval | null;
  lines: ApprovalLine[];
  // Every event, newest first.
  history: ApprovalEvent[];
}

export interface ApprovalEmailResult {
  sent: boolean;
  to: string | null;
  kind: EmailKind;
  error?: string;
}

type ViewResponse = { data: ApprovalView; message?: string };

const approvalUrl = (orderId: number) => `${API_BASE_URL}order/admin/${orderId}/approval`;

// The approval, or `approval: null` and the proposed lines before it starts. 404: no such order.
export const GetOrderApprovalAPI = async (orderId: number) => {
  return axios.get<ViewResponse>(approvalUrl(orderId));
};

// Starts it; safe to repeat. 409 unless the order is paid and not cancelled.
export const StartOrderApprovalAPI = async (orderId: number) => {
  return axios.post<ViewResponse>(approvalUrl(orderId));
};

// One proof image, saved as a draft of the line: PNG, JPG or SVG, up to 20 MB.
export const UploadApprovalProofAPI = async (orderId: number, lineId: number, file: File) => {
  const body = new FormData();
  body.append("approval_proof", file);
  return axios.post<ViewResponse>(`${approvalUrl(orderId)}/lines/${lineId}/proofs`, body);
};

// Removes a draft that was never sent. 409 once it has been sent: sent proofs stay.
export const RemoveApprovalFileAPI = async (orderId: number, fileId: number) => {
  return axios.delete<ViewResponse>(`${approvalUrl(orderId)}/files/${fileId}`);
};

// Copies a sent version's images into the line's drafts, without uploading them again.
export const CopyApprovalVersionAPI = async (orderId: number, lineId: number, version: number) => {
  return axios.post<ViewResponse>(`${approvalUrl(orderId)}/lines/${lineId}/copy`, { version });
};

// "No proof needed": the line counts as done, and the customer sees that instead of a proof.
export const SetApprovalNoProofAPI = async (orderId: number, lineId: number, no_proof: boolean) => {
  return axios.post<ViewResponse>(`${approvalUrl(orderId)}/lines/${lineId}/no-proof`, { no_proof });
};

// Turns each line's drafts into its next version, then emails the link from order@ to `to`
// (default: the customer's account email). The versions stay even when the email fails: `email`
// says what happened. 400: nothing to send, or no address; 429 after 20 sends in an hour.
export const SendApprovalAPI = async (orderId: number, body: { to?: string; message?: string }) => {
  return axios.post<{ data: ApprovalView & { email: ApprovalEmailResult }; message?: string }>(
    `${approvalUrl(orderId)}/send`,
    body,
  );
};

// true: the label waits until the approval is locked. false: released, and bought now when
// automatic labels are on.
export const SetApprovalHoldAPI = async (orderId: number, hold: boolean) => {
  return axios.post<ViewResponse>(`${approvalUrl(orderId)}/hold`, { hold });
};

// Lock for production: the customer's page turns read-only and a held label is released.
export const LockApprovalAPI = async (orderId: number) => {
  return axios.post<ViewResponse>(`${approvalUrl(orderId)}/lock`);
};

// The customer can change things again. A label already bought stays.
export const UnlockApprovalAPI = async (orderId: number) => {
  return axios.post<ViewResponse>(`${approvalUrl(orderId)}/unlock`);
};

// replace: a new link, and the old one stops working; disable / enable: switches the link off or on.
export const ApprovalLinkAPI = async (orderId: number, action: "replace" | "disable" | "enable") => {
  return axios.post<ViewResponse>(`${approvalUrl(orderId)}/link`, { action });
};

// The team has seen the customer's changes so far: clears the Orders list's dot.
export const MarkApprovalSeenAPI = async (orderId: number) => {
  return axios.post<ViewResponse>(`${approvalUrl(orderId)}/seen`);
};
