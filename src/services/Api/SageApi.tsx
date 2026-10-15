/** @format */

import axios from "axios";

import { API_BASE_URL } from "@/config/env";

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
  maxItems: number = 20,
  keywords: string = ""
) => {
  const token = localStorage.getItem("token");

  return axios.post(
    `${API_BASE_URL}sage/search`,
    {
      category,
      supplierId,
      page,
      maxItems,
      keywords,
    },
    {
      headers: { "x-access-token": token },
    }
  );
};

// NEW: simple keyword/category search for the SAGE Live Catalog page.
// Same backend route as SearchSageProductsAPI above, but that one
// requires a supplierId — this page has no supplier selected, it's just
// browsing the whole live feed, so a lighter object-based signature
// without that requirement is a better fit than forcing every caller of
// the existing function to pass an unused param.
export const SearchSageCatalogProductsAPI = async (params: {
  keywords?: string;
  category?: string;
  page?: number;
  maxItems?: number;
}) => {
  const token = localStorage.getItem("token");

  return axios.post(
    `${API_BASE_URL}sage/search`,
    {
      keywords: params.keywords || "",
      category: params.category || "",
      page: params.page || 1,
      maxItems: params.maxItems || 20,
    },
    {
      headers: { "x-access-token": token },
    },
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

export const ImportSelectedSageProductsAPI = async (
  prodEIds: number[],
  batchNotes = "",
) => {
  const token = localStorage.getItem("token");

  return axios.post(
    `${API_BASE_URL}sage/import/selected`,
    {
      prodEIds,
      batchNotes,
    },
    {
      headers: {
        "x-access-token": token,
      },
    },
  );
};