/** @format */

import axios from "axios";

import { API_BASE_URL } from "@/config/env";

export const GetPublishedBrandsAPI = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(
    `${API_BASE_URL}brand/website-brands`,
    {
      params,
    },
  );
};

export const GetAllBrandsAPI = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(
    `${API_BASE_URL}brand`,
    {
      params,
    },
  );
};

export const PublishBrandAPI = async (
  formData: FormData,
) => {
  return axios.post(
    `${API_BASE_URL}brand/publish`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
};

export const CreateManualBrandAPI = async (
  formData: FormData,
) => {
  return axios.post(
    `${API_BASE_URL}brand/manual-brand`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
};

export const GetBrandAssignmentAPI = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(`${API_BASE_URL}product/get-brand-assignment`, {
    params,
  });
};

// ⚠️ ASSUMPTION — you didn't share the assign endpoint, please confirm/adjust
// path + payload shape to match your actual backend route.
export const AssignBrandToProductsAPI = async (payload: {
  product_ids: number[];
  brand_id: number;
}) => {
  return axios.post(`${API_BASE_URL}product/brand-assignment`, payload);
};