import axios from "axios";

import { API_BASE_URL } from "@/config/env";

/* ===========================
   ADD-ON PRODUCTS
=========================== */

export const GetAddOnProductsAPI = async (
  page = 1,
  limit = 20,
  search = ""
) => {
  return axios.get(
    `${API_BASE_URL}add-on/addon-product?page=${page}&limit=${limit}&search=${encodeURIComponent(
      search
    )}`
  );
};

export const GetAddOnProductByIdAPI = async (
  id: number
) => {
  return axios.get(
    `${API_BASE_URL}add-on/addon-product/${id}`
  );
};

export const CreateAddOnProductAPI = async (
 body: FormData
) => {
  return axios.post(
    `${API_BASE_URL}add-on/addon-product`,
    body
  );
};

export const UpdateAddOnProductAPI = async (
  id: number,
  body: FormData
) => {
  return axios.put(
    `${API_BASE_URL}add-on/addon-product/${id}`,
    body
  );
};

export const DeleteAddOnProductAPI = async (
  id: number
) => {
  return axios.delete(
    `${API_BASE_URL}add-on/addon-product/${id}`
  );
};

/* ===========================
   PRODUCT ↔ ADD-ONS
=========================== */

export const GetProductAddOnsAPI = async (
  productId: number
) => {
  return axios.get(
    `${API_BASE_URL}add-on/product/${productId}/addons`
  );
};

export const AssignProductAddOnsAPI = async (
  productId: number,
  addons: {
    addon_product_id: number;
    price: number;
    sort_order?: number;
  }[]
) => {
  return axios.post(
    `${API_BASE_URL}add-on/product/${productId}/addons`,
    {
      addons,
    }
  );
};