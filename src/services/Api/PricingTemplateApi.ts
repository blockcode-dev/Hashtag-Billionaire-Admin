/** @format */

import axios from "axios";

import { API_BASE_URL } from "@/config/env";
import type {
  BulkTier,
  QuantityPrice,
  QuantityPricingMode,
} from "@/utils/variantPricing";

// Pricing templates: named quantity pricing saved once and loaded into other
// products (BACKEND_QUESTIONS.md F29). Rows use the same shape as
// ProductVariant.meta; only the list for pricing_mode is set, the other is null.
export interface PricingTemplatePayload {
  name: string;
  pricing_mode: QuantityPricingMode;
  bulk_pricing: BulkTier[] | null;
  quantity_pricing: QuantityPrice[] | null;
}

// Newest first. Answers 404 until the backend has the route.
export const GetPricingTemplatesAPI = async () => {
  return axios.get(`${API_BASE_URL}pricing-template`);
};

export const CreatePricingTemplateAPI = async (body: PricingTemplatePayload) => {
  return axios.post(`${API_BASE_URL}pricing-template`, body);
};

export const UpdatePricingTemplateAPI = async (
  id: number,
  body: PricingTemplatePayload,
) => {
  return axios.put(`${API_BASE_URL}pricing-template/${id}`, body);
};

export const DeletePricingTemplateAPI = async (id: number) => {
  return axios.delete(`${API_BASE_URL}pricing-template/${id}`);
};
