/** @format */

// How each order, shipment and payment status looks and reads, wherever the panel shows one:
// the Orders page and the Dashboard. Values and meanings from the go-live API contract,
// section 1. An order has three separate fields: its own status, its payment status and its
// shipment status.

export interface BadgeConfig {
  color: string;
  bg: string;
  dot: string;
  label: string;
  desc?: string;
}

const AWAITING_PAYMENT: BadgeConfig = {
  color: "var(--warning-soft-foreground)",
  bg: "var(--warning-soft)",
  dot: "var(--warning)",
  label: "Awaiting payment",
  desc: "Created at checkout. Not paid yet.",
};

export const ORDER_STATUS: Record<string, BadgeConfig> = {
  PENDING_PAYMENT: AWAITING_PAYMENT,
  // The old value for the same thing; new orders don't get it.
  PENDING: AWAITING_PAYMENT,
  FAILED: { color: "var(--destructive-soft-foreground)", bg: "var(--destructive-soft)", dot: "var(--destructive)", label: "Payment failed", desc: "The last payment attempt failed. The customer can still pay." },
  CONFIRMED: { color: "var(--info-soft-foreground)", bg: "var(--info-soft)", dot: "var(--info)", label: "Confirmed", desc: "Paid. Being made or waiting to ship." },
  SHIPPED: { color: "var(--primary-soft-foreground)", bg: "var(--primary-soft)", dot: "var(--primary)", label: "Shipped", desc: "The carrier has it." },
  DELIVERED: { color: "var(--success-soft-foreground)", bg: "var(--success-soft)", dot: "var(--success)", label: "Delivered", desc: "Tracking says delivered." },
  CANCELLED: { color: "var(--muted-foreground)", bg: "var(--muted)", dot: "var(--placeholder)", label: "Cancelled", desc: "Cancelled by an admin." },
};

// The status filter's choices, in order. PENDING is left out: it's the old name for PENDING_PAYMENT.
export const ORDER_STATUS_FILTERS = ["PENDING_PAYMENT", "FAILED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

const LABEL_BOUGHT: BadgeConfig & { desc: string } = {
  color: "var(--info-soft-foreground)",
  bg: "var(--info-soft)",
  dot: "var(--info)",
  label: "Label bought",
  desc: "The label and tracking number are ready. Waiting for the carrier's first scan.",
};

export const SHIPMENT_STATUS: Record<string, BadgeConfig & { desc: string }> = {
  PENDING: { color: "var(--muted-foreground)", bg: "var(--muted)", dot: "var(--placeholder)", label: "No label yet", desc: "No shipping label has been bought yet." },
  LABEL_CREATED: LABEL_BOUGHT,
  // The old value for LABEL_CREATED.
  SUCCESS: LABEL_BOUGHT,
  FAILED: { color: "var(--destructive-soft-foreground)", bg: "var(--destructive-soft)", dot: "var(--destructive)", label: "Label failed", desc: "ShipStation couldn't buy the label. The order stays paid, and the label can be bought again." },
  IN_TRANSIT: { color: "var(--primary-soft-foreground)", bg: "var(--primary-soft)", dot: "var(--primary)", label: "In transit", desc: "The carrier has the parcel." },
  OUT_FOR_DELIVERY: { color: "var(--violet-soft-foreground)", bg: "var(--violet-soft)", dot: "var(--violet)", label: "Out for delivery", desc: "On the delivery vehicle." },
  DELIVERED: { color: "var(--success-soft-foreground)", bg: "var(--success-soft)", dot: "var(--success)", label: "Delivered", desc: "The carrier confirmed delivery." },
  EXCEPTION: { color: "var(--destructive-soft-foreground)", bg: "var(--destructive-soft)", dot: "var(--destructive)", label: "Delivery problem", desc: "The carrier reported a problem, such as a bad address or a missed delivery. Check the tracking." },
  RETURNED: { color: "var(--warning-soft-foreground)", bg: "var(--warning-soft)", dot: "var(--warning)", label: "Returned", desc: "Going back to the sender. Refund or reship it." },
  CANCELLED: { color: "var(--muted-foreground)", bg: "var(--muted)", dot: "var(--placeholder)", label: "Cancelled", desc: "The order was cancelled, and an unused label was voided." },
};

export const PAYMENT_STATUS: Record<string, BadgeConfig> = {
  SUCCESS: { color: "var(--success-soft-foreground)", bg: "var(--success-soft)", dot: "var(--success)", label: "Paid" },
  PENDING: { color: "var(--warning-soft-foreground)", bg: "var(--warning-soft)", dot: "var(--warning)", label: "Unpaid", desc: "Not paid yet, or a payment is still being processed." },
  REJECTED: { color: "var(--destructive-soft-foreground)", bg: "var(--destructive-soft)", dot: "var(--destructive)", label: "Failed", desc: "The last payment attempt failed." },
};

// The backend lists only paid orders unless payment_status is sent, so the filter always
// sends one. "ALL" lists every payment status.
export const PAYMENT_FILTERS = [
  { value: "SUCCESS", label: "Paid", stat: "Paid orders" },
  { value: "PENDING", label: "Unpaid", stat: "Unpaid orders" },
  { value: "REJECTED", label: "Failed", stat: "Failed payments" },
  { value: "ALL", label: "All", stat: "Orders" },
];

// A link to the Orders page with its filters set (the page reads them from the address).
// `open` opens that order once the list has loaded.
export const ordersLink = (filters: { status?: string; payment_status?: string; search?: string; open?: string }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/orders?${query}` : "/orders";
};
