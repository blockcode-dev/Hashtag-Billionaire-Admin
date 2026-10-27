/** @format */

import axios from "axios";

import { API_BASE_URL } from "@/config/env";

// All of these are Super Admin only (other admins get 403). The admin token is
// attached by the axios interceptor (services/Api/interceptors.ts).

export const GetAllAdminsAPI = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(`${API_BASE_URL}admin/auth/getAllAdmins`, { params });
};

// No password: the new admin is emailed a link to set their own.
export const AddAdminAPI = async (body: {
  name: string;
  email: string;
  role_id: number;
  department_id: number;
}) => {
  return axios.post(`${API_BASE_URL}admin/auth/register`, body);
};

export const UpdateAdminAPI = async (
  admin_id: number,
  body: {
    name?: string;
    email?: string;
    role_id?: number;
    department_id?: number;
  },
) => {
  return axios.put(`${API_BASE_URL}admin/auth/updateAdmin/${admin_id}`, body);
};

// Super Admins can be deleted too; nobody can delete themselves (400).
export const DeleteAdminAPI = async (admin_id: number) => {
  return axios.post(`${API_BASE_URL}admin/auth/deleteAdmin`, { admin_id });
};

// Sets another admin's password for the Super Admin to share. Their sessions
// end. Your own password goes through change-password instead (400 here).
export const SetAdminPasswordAPI = async (
  admin_id: number,
  body: { password: string; confirm_password: string },
) => {
  return axios.put(`${API_BASE_URL}admin/auth/setAdminPassword/${admin_id}`, body);
};

export const GetAdminDetailsAPI = async (adminId: number) => {
  return axios.get(`${API_BASE_URL}admin/auth/findAdminById/${adminId}`);
};

// Readable by any admin.
export const GetRolesAPI = async () => {
  return axios.get(`${API_BASE_URL}role`);
};

export const GetDepartmentsAPI = async () => {
  return axios.get(`${API_BASE_URL}department`);
};
