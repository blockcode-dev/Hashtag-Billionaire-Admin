/** @format */

import axios from "axios";

import { API_BASE_URL } from "@/config/env";

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
  return axios.get(`${API_BASE_URL}admin/user/getUserById`, {
    params: { id: userId },
  });
};

// Sets a customer's password for the admin to share. The customer is signed out
// everywhere and any emailed reset link stops working.
export const SetUserPasswordAPI = async (
  userId: number,
  body: { password: string; confirm_password: string },
) => {
  return axios.put(`${API_BASE_URL}admin/user/setPassword/${userId}`, body);
};
