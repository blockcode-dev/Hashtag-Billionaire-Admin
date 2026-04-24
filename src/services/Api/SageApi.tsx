/** @format */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

export const GetAllCategoriesAPI = async () => {
  return axios.get(`${API_BASE_URL}sage/get/categories`);
};

export const GetSupplierByCategoryAPI = async (category: string) => {
  const token = localStorage.getItem("token");
  return axios.post(
    `${API_BASE_URL}sage/suppliers-by-category`,
    { category },
    {
      headers: { "x-access-token": token },
    },
  );
};

export const GetProductByStyleAPI = async (styleId: string) => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_BASE_URL}product/ss/style/${styleId}`, {
    headers: { "x-access-token": token },
  });
};

export const SearchSageProductsAPI = async (
  category: string,
  supplierId: number,
  page: number = 1,
  maxItems: number = 20
) => {
  const token = localStorage.getItem("token");

  return axios.post(
    `${API_BASE_URL}sage/search`,
    {
      category,
      supplierId,
      page,        // ✅ ADD THIS
      maxItems,
    },
    {
      headers: { "x-access-token": token },
    }
  );
};

export const GetSageProductDetailsAPI = async (prodEId: number) => {
  const token = localStorage.getItem("token");

  return axios.get(
    `${API_BASE_URL}sage/product/${prodEId}`,
    {
      headers: { "x-access-token": token },
    }
  );
};

export const ImportSageProductsAPI = async (
  category: string,
  supplierId: number,
) => {
  const token = localStorage.getItem("token");
  return axios.post(
    `${API_BASE_URL}sage/import`,
    { category, supplierId },
    {
      headers: { "x-access-token": token },
    },
  );
};
