/** @format */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

export const GetAllAdminsAPI = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(
    `${API_BASE_URL}admin/auth/getAllAdmins`,
    {
      params,
      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};

export const AddAdminAPI = async (body: {
  name: string;
  email: string;
  password: string;
}) => {
  return axios.post(
    `${API_BASE_URL}admin/auth/register`,
    {
      ...body,
      role_id: 1,
    },
    {
      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};

export const UpdateAdminAPI = async (
  admin_id: number,
  body: {
    name: string;
    email: string;
  },
) => {
  return axios.put(
    `${API_BASE_URL}admin/auth/updateAdmin/${admin_id}`,
    {
      admin_id,
      ...body,
    },
    {
      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};

export const DeleteAdminAPI = async (
  admin_id: number[],
) => {
  return axios.post(
    `${API_BASE_URL}admin/auth/deleteAdmin`,
    {
      admin_id,
    },
    {
      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};

export const GetAdminDetailsAPI = async (
  adminId: number,
) => {
  return axios.get(
    `${API_BASE_URL}admin/auth/findAdminById/${adminId}`,
    {
      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};