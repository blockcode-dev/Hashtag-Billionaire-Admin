/** @format */

import axios from "axios";

import { API_BASE_URL } from "@/config/env";

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

// Buys the label again for a paid order whose label failed. A 502 carries ShipStation's reason.
export const RetryOrderLabelAPI = async (orderId: number) => {
  return axios.post(`${API_BASE_URL}order/admin/${orderId}/label`);
};
