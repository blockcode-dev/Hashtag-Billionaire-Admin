import axios from "axios";

import { API_BASE_URL } from "@/config/env";

// The admin token is attached by the axios interceptor (services/Api/interceptors.ts).

export type ContactUsStatus = "NEW" | "IN_PROGRESS" | "CLOSED";

// Sending `page` gets { data[], pagination: { total, page, limit, totalPages } };
// `limit` is capped at 100. Search covers name, email, mobile, reason and message.
export const GetAllContactUsAPI = async (params: {
  page: number;
  limit?: number;
  search?: string;
  status?: ContactUsStatus;
}) => {
  return axios.get(`${API_BASE_URL}contactUs`, { params });
};

export const UpdateContactUsStatusAPI = async (
  id: number,
  status: ContactUsStatus,
) => {
  return axios.put(`${API_BASE_URL}contactUs/${id}`, { status });
};

export const DeleteContactUsAPI = async (id: number) => {
  return axios.delete(`${API_BASE_URL}contactUs/${id}`);
};
