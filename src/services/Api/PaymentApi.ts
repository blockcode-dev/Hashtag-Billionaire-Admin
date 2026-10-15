import axios from "axios";

import { API_BASE_URL } from "@/config/env";

export const GetAllPaymentsAPI = async (params: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(
    `${API_BASE_URL}/payment/admin/all`,
    {
      params,

      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};