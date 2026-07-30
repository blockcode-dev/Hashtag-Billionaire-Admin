/** @format */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

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