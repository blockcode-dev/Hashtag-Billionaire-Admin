/** @format */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

export const GetAllUsersAPI = async (params: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(
    `${API_BASE_URL}admin/user/getAllUsers`,
    {
      params,

      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};

export const AddUserAPI = async (body: {
  name: string;
  email: string;
}) => {
  return axios.post(
    `${API_BASE_URL}admin/user/createUser`,
    body,
    {
      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};

export const DeleteUserAPI = async (
  user_id: number[],
) => {
  return axios.post(
    `${API_BASE_URL}admin/user/deleteUser`,
    {
      user_id,
    },
    {
      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};

export const GetUserDetailsAPI = async (userId: number) => {
  const token = localStorage.getItem("token");
  return axios.get(`${API_BASE_URL}admin/user/getUserById?/${userId}`, {
    headers: { "x-access-token": token },
  });
};
