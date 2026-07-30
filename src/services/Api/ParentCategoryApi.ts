import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

export const GetParentCategoriesAPI = async (
  page = 1,
  limit = 10,
  search = "",
) => {
  return axios.get(
    `${API_BASE_URL}product-category/get-parent-categories??page=${page}&limit=${limit}&search=${search}`,
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