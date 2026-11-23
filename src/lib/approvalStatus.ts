import type { ApprovalStatus, HoldState } from "@/services/Api/ApprovalApi";

// How an order's artwork approval status looks and reads in the Orders list and the order's
// details, after "Artwork: ". `color` is a StatusTag colour. The words follow the approval
// glossary: "artwork preview", never "proof" or "draft".

interface ApprovalTag {
  label: string;
  color: string;
  desc: string;
}

const APPROVAL_STATUS: Record<ApprovalStatus, ApprovalTag> = {
  DRAFT: {
    label: "Not sent yet",
    color: "default",
    desc: "Started. No artwork preview has been sent to the customer yet.",
  },
  WAITING: {
    label: "Waiting for customer",
    color: "blue",
    desc: "Artwork previews sent. The customer hasn't approved every item yet.",
  },
  CHANGES_REQUESTED: {
    label: "Changes requested",
    color: "orange",
    desc: "The customer asked for changes. Upload a new version and send it.",
  },
  APPROVED: { label: "Approved", color: "green", desc: "The customer approved the artwork for every item." },
};

const LOCKED_TAG: ApprovalTag = {
  label: "Locked for production",
  color: "violet",
  desc: "The customer can look at their artwork but can't change anything.",
};

const NEEDS_DECISION_TAG: ApprovalTag = {
  label: "Needs decision",
  color: "orange",
  desc: "Paid with customized items: decide on the Artwork approval page whether the shipping label waits for the customer's approval.",
};

// A paid order with customized items whose artwork approval hasn't started yet.
export const NOT_STARTED_TAG: ApprovalTag = {
  label: "Not started",
  color: "default",
  desc: "Paid with customized items. Start artwork approval to send the customer artwork previews to check.",
};

// One tag per approval: locked first, then a hold decision to make, then the status.
export const approvalTagOf = (approval: { status: ApprovalStatus; hold_state: HoldState; locked: boolean }) => {
  if (approval.locked) return LOCKED_TAG;
  if (approval.hold_state === "PENDING_DECISION") return NEEDS_DECISION_TAG;
  return APPROVAL_STATUS[approval.status] ?? APPROVAL_STATUS.DRAFT;
};
