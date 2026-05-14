import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

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