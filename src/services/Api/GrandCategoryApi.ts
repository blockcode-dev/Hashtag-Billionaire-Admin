import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

export const GetGrandCategoriesAPI = async (
  page = 1,
  limit = 10,
  search = ""
) => {
  return axios.get(
    `${API_BASE_URL}product-category/get-grand-categories?page=${page}&limit=${limit}&search=${search}`
  );
};

export const GetGrandCategoryByIdAPI = async (
  id: number
) => {
  return axios.get(
    `${API_BASE_URL}product-category/findGrandCategoryById/${id}`
  );
};

export const CreateGrandCategoryAPI = async (
  body: any
) => {
  return axios.post(
    `${API_BASE_URL}product-category/createGrandCategory`,
    body
  );
};

export const UpdateGrandCategoryAPI = async (
  id: number,
  body: any
) => {
  return axios.put(
    `${API_BASE_URL}product-category/updateGrandCategory/${id}`,
    body
  );
};

export const DeleteGrandCategoryAPI = async (
  grand_category_id: number[]
) => {
  return axios.delete(
    `${API_BASE_URL}product-category/deleteGrandCategory`,
    {
      data: {
        grand_category_id,
      },
    }
  );
};

export const MapGrandCategoryAPI = async (
  body: any
) => {
  return axios.post(
    `${API_BASE_URL}product-category/map-grand-categories`,
    body
  );
};