import axios from "axios";

import { API_BASE_URL } from "@/config/env";

// The admin token is attached by the axios interceptor (services/Api/interceptors.ts).

export const AdminLoginAPI = async (email: string, password: string) => {
  const formData = new FormData();
  formData.append("email", email);
  formData.append("password", password);

  return await axios.post(`${API_BASE_URL}admin/auth/login`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

// Step 1 of forgot password: emails a reset link. Always answers 200.
export const ForgotPasswordApi = (data: { email: string }) => {
  return axios.post(`${API_BASE_URL}admin/auth/forgot-password`, data);
};

// Step 2: the /reset-password page sends the token from the emailed link.
// Also used by new admins setting their first password.
export const ResetPasswordApi = (data: {
  token: string;
  password: string;
  confirm_password: string;
}) => {
  return axios.post(`${API_BASE_URL}admin/auth/forgot-password/reset`, data);
};

// Returns data.token; older tokens stop working, so the caller must store it.
export const ChangePasswordAPI = async (data: {
  old_password: string;
  new_password: string;
  confirm_password: string;
}) => {
  return axios.post(`${API_BASE_URL}admin/auth/change-password`, {
    old_password: data.old_password,
    new_password: data.new_password,
    confirm_password: data.confirm_password,
  });
};

export const GetAdminProfileAPI = async () => {
  return axios.get(`${API_BASE_URL}admin/auth/getProfile`);
};
