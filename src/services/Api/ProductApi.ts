/** @format */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

export const GetAllProductsAPI = async (params: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(`${API_BASE_URL}product/get/variant`, {
    params,
  });
};


export const GetProductStatsAPI = async () => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_BASE_URL}product/admin/stats`, {
    headers: { "x-access-token": token },
  });
};
