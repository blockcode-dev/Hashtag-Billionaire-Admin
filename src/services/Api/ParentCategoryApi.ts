import axios from "axios";

import { API_BASE_URL } from "@/config/env";

export const GetParentCategoriesAPI = async (
  page = 1,
  limit = 10,
  search = "",
) => {
  return axios.get(
    `${API_BASE_URL}product-category/get-parent-categories?page=${page}&limit=${limit}&search=${search}`,
  );
};

export const GetParentCategoryByIdAPI = async (
  id: number,
) => {
  return axios.get(
    `${API_BASE_URL}product-category/get-parent-category/${id}`,
  );
};

export const CreateParentCategoryAPI = async (
  body: any,
) => {
  return axios.post(
    `${API_BASE_URL}product-category/create-parent-category`,
    body,
  );
};

export const UpdateParentCategoryAPI = async (
  id: number,
  body: any,
) => {
  return axios.put(
    `${API_BASE_URL}product-category/update-parent-category/${id}`,
    body,
  );
};

export const DeleteParentCategoryAPI = async (
  parent_category_id: number[],
) => {
  return axios.delete(
    `${API_BASE_URL}product-category/delete-parent-category`,
    {
      data: {
        parent_category_id,
      },
    },
  );
};

export const GetProductCategoriesAPI = async (
  page = 1,
  limit = 50,
  search = "",
  supplier = "ALL",
) => {
  return axios.get(`${API_BASE_URL}product-category`, {
    params: {
      page,
      limit,
      search,
      supplier,
    },
  });
};
export const MapParentCategoryAPI = async (
  body: any,
) => {
  return axios.post(
    `${API_BASE_URL}product-category/map-parent-categories`,
    body,
  );
};


export const GetAllBrandsAPI = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(`${API_BASE_URL}brand`, {
    params,
  });
};

export const GetAllCategoriesAPI = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(`${API_BASE_URL}product-category`, {
    params,
  });
};

export const CreateCategoryAPI = async (data: {
  title: string;
  supplier?: string;
}) => {
  return axios.post(`${API_BASE_URL}product-category`, data);
};

export const UpdateCategoryAPI = async (
  id: number,
  data: { title: string },
) => {
  return axios.put(`${API_BASE_URL}product-category/${id}`, data);
};
export const DeleteCategoryAPI = async (id: number) => {
  return axios.post(`${API_BASE_URL}product-category/delete`, {
    category_id: [id],
  });
};



export const AddCategoryToParentAPI = async (body: {
  parent_category_id: number;
  product_category_id: number;
}) => {
  return axios.post(
    `${API_BASE_URL}product-category/add-category-to-parent`,
    body,
  );
};

// ParentCategoryApi.ts
export const RemoveCategoryFromParentAPI = async (body: {
  parent_category_id: number;
  product_category_id: number;
}) => axios.post(`${API_BASE_URL}product-category/remove-category-from-parent`, body);