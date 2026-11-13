/** @format */

import axios from "axios";

import { API_BASE_URL } from "@/config/env";

// payment_status: SUCCESS (the backend's default), PENDING, REJECTED or ALL.
export const GetAdminOrdersAPI = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  payment_status?: string;
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
// ShipStation's reason.
export const RetryOrderLabelAPI = async (orderId: number) => {
  return axios.post(`${API_BASE_URL}order/admin/${orderId}/label`);
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
