import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://api.turningpages.io:9090/api/v1/";


export const GetAdminDashboardAPI = async () => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_BASE_URL}admin/dashboard/counts`, {
    headers: {
      "x-access-token": token,
    },
  });
};