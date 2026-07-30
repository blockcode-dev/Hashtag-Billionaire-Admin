/** @format */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

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