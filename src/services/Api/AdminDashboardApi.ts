import axios from "axios";

import { API_BASE_URL } from "@/config/env";


export const GetAdminDashboardAPI = async () => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_BASE_URL}admin/dashboard/counts`, {
    headers: {
      "x-access-token": token,
    },
  });
};