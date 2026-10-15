import axios from "axios";

import { API_BASE_URL } from "@/config/env";

const getHeaders = () => ({
  "x-access-token": localStorage.getItem("token") || "",
});

export const GetAllContactUsAPI = async () => {
  return axios.get(
    `${API_BASE_URL}contactUs`,
    {
      headers: getHeaders(),
    },
  );
};

export const UpdateContactUsStatusAPI = async (
  id: number,
  status: "NEW" | "IN_PROGRESS" | "CLOSED",
) => {
  return axios.put(
    `${API_BASE_URL}contactUs/${id}`,
    {
      status,
    },
    {
      headers: getHeaders(),
    },
  );
};

export const DeleteContactUsAPI = async (id: number) => {
  return axios.delete(
    `${API_BASE_URL}contactUs/${id}`,
    {
      headers: getHeaders(),
    },
  );
};