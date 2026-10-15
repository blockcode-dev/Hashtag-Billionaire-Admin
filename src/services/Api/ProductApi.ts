/** @format */

import axios from "axios";

import { API_BASE_URL } from "@/config/env";

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
  source?: string;
  sync_locked?: string;
  grand_category_id?: string;
  parent_category_id?: string;
  min_price?: string;
  max_price?: string;
  tier?: string;
  use_case_id?: string;
}) => {
  return axios.get(`${API_BASE_URL}product/admin/get/all`, {
    params,
  });
};

export const DeleteProductAPI = async (
  data:
    | { product_id: number }
    | { styleId: string; supplier: string },
) => {
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

export const UpdateProductAPI = async (formData: FormData) => {
  return axios.post(`${API_BASE_URL}product/update`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};


export const UpdateManualProductFullAPI = async (formData: FormData) => {
  return axios.put(`${API_BASE_URL}product/manual/full`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

/* ─── Duplicate (manual products only) ──────────────────────────────────
   Returns prefilled data for a copy — it does NOT create anything. The
   Duplicate page saves the copy through CreateProductAPI +
   AddProductVariantsAPI, exactly like Create Product.
   Ids and SKUs are already stripped and " Copy" is appended to the name. */

export interface DuplicateImage {
  id: number;
  file_name?: string;
  file_uri: string;
  file_size?: number | string;
  is_primary: boolean;
}

export interface DuplicateOptionValue {
  name: string;
  color_code?: string;
  measurements?: Record<string, number | string>;
}

export interface DuplicateOption {
  name: string;
  type: string;
  // How the option is shown to shoppers; older products may not have it.
  display_style?: string;
  values: DuplicateOptionValue[];
}

export interface DuplicateVariant {
  sku: string;
  price: number;
  case_price: number;
  stock: number;
  color: string | null;
  color_code: string | null;
  pricing_mode: string;
  bulk_pricing:
    | { min_qty: number; max_qty: number | null; price: number }[]
    | null;
  quantity_pricing: { quantity: number; price: number }[] | null;
  option_values: {
    name: string;
    value: string;
    type: string;
    color_code?: string;
  }[];
  images: DuplicateImage[];
}

export interface DuplicateProductData {
  name: string;
  description: string;
  brand_id: number | null;
  category_ids: number[];
  images: DuplicateImage[];
  options: DuplicateOption[];
  variants: DuplicateVariant[];
  duplicate_from_product_id: number;
  original_product_name: string;
}

export const DuplicateProductAPI = async (id: number | string) => {
  return axios.post<{ data: DuplicateProductData }>(
    `${API_BASE_URL}product/duplicate/${id}`,
  );
};