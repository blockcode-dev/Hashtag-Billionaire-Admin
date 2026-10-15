import axios from "axios";

import { API_BASE_URL } from "@/config/env";

export const GetCustomizationOptionsAPI = async (
  page = 1,
  limit = 20,
  search = "",
) => {
  return axios.get(
    `${API_BASE_URL}customization-option?page=${page}&limit=${limit}&search=${encodeURIComponent(
      search,
    )}`,
  );
};

export const GetCustomizationOptionByIdAPI = async (id: number) => {
  return axios.get(`${API_BASE_URL}customization-option/${id}`);
};

export const CreateCustomizationOptionAPI = async (body: {
  name: string;
  description?: string;
  allow_text_input?: boolean;
  allow_image_upload?: boolean;
}) => {
  return axios.post(`${API_BASE_URL}customization-option`, body);
};

export const UpdateCustomizationOptionAPI = async (
  id: number,
  body: {
    name?: string;
    description?: string;
    allow_text_input?: boolean;
    allow_image_upload?: boolean;
  },
) => {
  return axios.put(`${API_BASE_URL}customization-option/${id}`, body);
};

export const DeleteCustomizationOptionAPI = async (id: number) => {
  return axios.delete(`${API_BASE_URL}customization-option/${id}`);
};

export interface CustomizationValuePayload {
  name: string;
  pricing_type?: "FIXED" | "TIERED" | "QUANTITY_BASED";
  fixed_price?: number | null;
}

export const CreateCustomizationOptionValueAPI = async (
  optionId: number,
  body: CustomizationValuePayload,
) => {
  return axios.post(
    `${API_BASE_URL}customization-option/${optionId}/value`,
    body,
  );
};

export const UpdateCustomizationOptionValueAPI = async (
  id: number,
  body: CustomizationValuePayload,
) => {
  return axios.put(
    `${API_BASE_URL}customization-option/customization-option-value/${id}`,
    body,
  );
};

export const DeleteCustomizationOptionValueAPI = async (id: number) => {
  return axios.delete(
    `${API_BASE_URL}customization-option/customization-option-value/${id}`,
  );
};

/** TIERED row: a quantity range with a price per item. */
export interface CustomizationTierPricingPayload {
  min_quantity: number;
  max_quantity: number | null;
  price: number;
}

/** QUANTITY_BASED row: one exact quantity with a price per item. */
export interface CustomizationQuantityPricingPayload {
  quantity: number;
  price: number;
}

export type CustomizationPricingPayload =
  | CustomizationTierPricingPayload
  | CustomizationQuantityPricingPayload;

export const GetCustomizationPricingAPI = async (valueId: number) => {
  return axios.get(
    `${API_BASE_URL}customization-option/value/${valueId}/pricing`,
  );
};

export const CreateCustomizationPricingAPI = async (
  valueId: number,
  body: CustomizationPricingPayload,
) => {
  return axios.post(
    `${API_BASE_URL}customization-option/value/${valueId}/pricing`,
    body,
  );
};

export const UpdateCustomizationPricingAPI = async (
  pricingId: number,
  body: CustomizationPricingPayload,
) => {
  return axios.put(
    `${API_BASE_URL}customization-option/value/pricing/${pricingId}`,
    body,
  );
};

export const DeleteCustomizationPricingAPI = async (pricingId: number) => {
  return axios.delete(
    `${API_BASE_URL}customization-option/value/pricing/${pricingId}`,
  );
};

/* ============================================================
   PRODUCT ↔ CUSTOMIZATIONS
============================================================ */

export interface ProductCustomizationPayload {
  customization_option_id: number;
  /** Values of this customization the product offers. */
  value_ids: number[];
}

export const GetProductCustomizationsAPI = async (productId: number) => {
  return axios.get(
    `${API_BASE_URL}customization-option/product/${productId}/customizations`,
  );
};

/** Replaces the product's whole list. An empty array removes all. */
export const AssignProductCustomizationsAPI = async (
  productId: number,
  customizations: ProductCustomizationPayload[],
) => {
  return axios.post(
    `${API_BASE_URL}customization-option/product/${productId}/customizations`,
    {
      customizations,
    },
  );
};