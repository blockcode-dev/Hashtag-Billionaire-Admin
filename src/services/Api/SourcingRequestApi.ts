import axios from "axios";

import { API_BASE_URL } from "@/config/env";

const getHeaders = () => ({
  "x-access-token": localStorage.getItem("token") || "",
});

export const GetAllSourcingRequestsAPI = async () => {
  return axios.get(`${API_BASE_URL}sourcing-requests/admin`, {
    headers: getHeaders(),
  });
};

export const UpdateSourcingRequestStatusAPI = async (
  id: number,
  status:
    | "PENDING"
    | "IN_REVIEW"
    | "ACCEPTED"
    | "REJECTED"
    | "COMPLETED",
  admin_notes?: string,
) => {
  return axios.put(
    `${API_BASE_URL}/sourcing-requests/${id}`,
    {
      status,
      admin_notes,
    },
    {
      headers: getHeaders(),
    },
  );
};