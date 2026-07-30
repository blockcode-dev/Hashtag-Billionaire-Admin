/** @format */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

export const GetAllVariantAPI = async (params: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(`${API_BASE_URL}product/get/variant`, {
    params,
  });
};


export const GetProductStatsAPI = async () => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_BASE_URL}product/admin/stats`, {
    headers: { "x-access-token": token },
  });
};

export const GetAllProductsAdminAPI = async (params: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(`${API_BASE_URL}product/admin/get/all`, {
    params,
  });
};

export const DeleteProductAPI = async (data: {
  styleId: string;
  supplier: string;
}) => {
  const token = localStorage.getItem("token");

  return axios.post(`${API_BASE_URL}product/delete`, data, {
    headers: { "x-access-token": token },
  });
};

export const  GetProductByIdAPI = async (id: number | string) => {

  return axios.get(`${API_BASE_URL}product/admin/${id}`, {
  });
};


export const CreateProductAPI = async (data: FormData) => {
  return axios.post(`${API_BASE_URL}product/create-product`, data, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const AddProductVariantsAPI = async (data: FormData) => {
  return axios.post(`${API_BASE_URL}product/add-product-variants`, data, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};
