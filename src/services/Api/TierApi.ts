import axios from "axios";

import { API_BASE_URL } from "@/config/env";

/* ===========================
   TIERS
=========================== */

export const GetAllTiersAPI = async () => {
  return axios.get(`${API_BASE_URL}tiers`);
};

export const GetTierParentCategoriesAPI = async (
  tierId: number,
  useCaseId?: number
) => {
  const params = useCaseId ? `?use_case_id=${useCaseId}` : "";

  return axios.get(
    `${API_BASE_URL}tiers/${tierId}/parent-categories${params}`
  );
};

export const UpdateTierParentCategoriesAPI = async (
  tierId: number,
  body: {
    parent_category_ids: number[];
  }
) => {
  return axios.put(
    `${API_BASE_URL}tiers/${tierId}/parent-categories`,
    body
  );
};

/* ===========================
   TIER ↔ PRODUCTS
=========================== */

export const GetTierProductsAPI = async (
  tierId: number,
  page = 1,
  limit = 20,
  search = "",
  useCaseId?: number
) => {
  return axios.get(
    `${API_BASE_URL}tiers/${tierId}/products?page=${page}&limit=${limit}&search=${encodeURIComponent(
      search
    )}${useCaseId ? `&use_case_id=${useCaseId}` : ""}`
  );
};

/* ===========================
   ADD PRODUCTS TO TIER
   Scoped by Use Case
=========================== */

export const AddProductsToTierAPI = async (
  tierId: number,
  productIds: number[],
  useCaseId: number
) => {
  return axios.post(`${API_BASE_URL}tiers/${tierId}/products/add`, {
    product_ids: productIds,
    use_case_id: useCaseId,
  });
};

/* ===========================
   SET / MOVE PRODUCT TIER
   Scoped by Use Case
=========================== */

export const SetProductTierAPI = async (
  productId: number,
  tierId: number,
  useCaseId: number
) => {
  return axios.patch(`${API_BASE_URL}tiers/products/${productId}`, {
    tier_id: tierId,
    use_case_id: useCaseId,
  });
};

/* ===========================
   CLEAR PRODUCT TIER OVERRIDE
   Scoped by Use Case
=========================== */

export const ClearProductTierOverrideAPI = async (
  productId: number,
  useCaseId: number
) => {
  return axios.delete(
    `${API_BASE_URL}tiers/products/${productId}/override`,
    {
      data: {
        use_case_id: useCaseId,
      },
    }
  );
};

/* ===========================
   EXCLUDE PRODUCT FROM ALL TIERS
   Scoped by Use Case
=========================== */

export const ExcludeProductFromAllTiersAPI = async (
  productId: number,
  useCaseId: number
) => {
  return axios.delete(
    `${API_BASE_URL}tiers/products/${productId}/exclude`,
    {
      data: {
        use_case_id: useCaseId,
      },
    }
  );
};

/* ===========================
   CURRENT PRODUCT TIERS
   Scoped by Use Case
=========================== */

export const GetCurrentTiersForProductsAPI = async (
  productIds: number[],
  useCaseId: number
) => {
  return axios.get(
    `${API_BASE_URL}tiers/products/current?product_ids=${productIds.join(
      ","
    )}&use_case_id=${useCaseId}`
  );
};

/* ===========================
   BULK CLEAR TIER OVERRIDES
   Scoped by Use Case
=========================== */

export const BulkClearProductTierOverrideAPI = async (
  productIds: number[],
  useCaseId: number
) => {
  return axios.post(`${API_BASE_URL}tiers/products/bulk-remove`, {
    product_ids: productIds,
    use_case_id: useCaseId,
  });
};