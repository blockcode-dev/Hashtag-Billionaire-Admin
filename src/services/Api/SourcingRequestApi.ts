import axios from "axios";

import { API_BASE_URL } from "@/config/env";

// The admin token is attached by the axios interceptor (services/Api/interceptors.ts).

export type SourcingRequestStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "COMPLETED";

// Returns { data[], pagination: { total, page, limit, totalPages } }. Search covers
// name, email, company, the product asked for and the request text.
export const GetAllSourcingRequestsAPI = async (params: {
  page: number;
  limit?: number;
  search?: string;
  status?: SourcingRequestStatus;
}) => {
  return axios.get(`${API_BASE_URL}sourcing-requests/admin`, { params });
};

export const UpdateSourcingRequestStatusAPI = async (
  id: number,
  status: SourcingRequestStatus,
  admin_notes?: string,
) => {
  return axios.put(`${API_BASE_URL}sourcing-requests/${id}`, {
    status,
    admin_notes,
  });
};
