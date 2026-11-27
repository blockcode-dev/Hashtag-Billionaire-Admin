/** @format */

import axios from "axios";

import { API_BASE_URL } from "@/config/env";
import type { ApprovalStatus, HoldState } from "./ApprovalApi";

// A list row's artwork approval (`approval`, null when the order has none). Every order's
// Artwork approval page opens; it says there why an unpaid or cancelled order can't start one.
export interface OrderApprovalSummary {
  status: ApprovalStatus;
  hold_state: HoldState;
  locked: boolean;
  // Customer changes nobody on the team has looked at yet.
  unseen: number;
  // Artwork previews have been sent at least once.
  sent: boolean;
}

// payment_status: SUCCESS (the backend's default), PENDING, REJECTED or ALL. user_id: one
// client's orders (the client page).
export const GetAdminOrdersAPI = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  payment_status?: string;
  user_id?: number;
}) => {
  return axios.get(
    `${API_BASE_URL}order/admin`,
    {
      params,
    },
  );
};

// Buys the label for a paid order with no label: "Buy label" (shipment PENDING) and "Try again"
// (FAILED). 200 carries the shipment fields; 409 a label is already being bought; 502 carries
// ShipStation's reason. 409 with data.code APPROVAL_OPEN: artwork previews were sent and the
// artwork approval isn't locked. `confirm` then buys it anyway and locks the approval.
export const RetryOrderLabelAPI = async (orderId: number, confirm = false) => {
  return axios.post(`${API_BASE_URL}order/admin/${orderId}/label`, confirm ? { confirm: true } : undefined);
};

// Voids an unused label, cancels the order in ShipStation and puts paid stock back. It doesn't
// refund. 200: { order, warnings }. 400: it can't be cancelled. 409: the label couldn't be voided,
// or a label is being bought; nothing changed.
export const CancelOrderAPI = async (orderId: number, reason?: string) => {
  return axios.post(`${API_BASE_URL}order/admin/${orderId}/cancel`, reason ? { reason } : {});
};

// Hides an unpaid or cancelled order from the panel and the customer's account. 400 says why not.
export const DeleteOrderAPI = async (orderId: number) => {
  return axios.delete(`${API_BASE_URL}order/admin/${orderId}`);
};
