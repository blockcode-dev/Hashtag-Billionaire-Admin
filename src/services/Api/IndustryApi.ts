import axios from "axios";

import { API_BASE_URL } from "@/config/env";

/* ===========================
   INDUSTRIES
=========================== */

export const GetIndustriesAPI = async (
  page = 1,
  limit = 10,
  search = ""
) => {
  return axios.get(
    `${API_BASE_URL}industry?page=${page}&limit=${limit}&search=${search}`
  );
};

export const GetIndustryByIdAPI = async (
  id: number
) => {
  return axios.get(
    `${API_BASE_URL}industry/${id}`
  );
};

export const CreateIndustryAPI = async (
  body: any
) => {
  return axios.post(
    `${API_BASE_URL}industry`,
    body
  );
};

export const UpdateIndustryAPI = async (
  id: number,
  body: any
) => {
  return axios.put(
    `${API_BASE_URL}industry/${id}`,
    body
  );
};

export const DeleteIndustryAPI = async (
  id: number
) => {
  return axios.delete(
    `${API_BASE_URL}industry/${id}`
  );
};

/* ===========================
   USE CASES
=========================== */

export const GetUseCasesAPI = async (
  page = 1,
  limit = 10,
  search = ""
) => {
  return axios.get(
    `${API_BASE_URL}industry/use-case?page=${page}&limit=${limit}&search=${search}`
  );
};

export const GetUseCaseByIdAPI = async (
  id: number
) => {
  return axios.get(
    `${API_BASE_URL}industry/use-case/${id}`
  );
};

export const GetUseCasesByIndustryAPI = async (
  industryId: number
) => {
  return axios.get(
    `${API_BASE_URL}industry/use-case/industry/${industryId}`
  );
};

export const CreateUseCaseAPI = async (
  body: any
) => {
  return axios.post(
    `${API_BASE_URL}industry/use-case`,
    body
  );
};

export const UpdateUseCaseAPI = async (
  id: number,
  body: any
) => {
  return axios.put(
    `${API_BASE_URL}industry/use-case/${id}`,
    body
  );
};

export const DeleteUseCaseAPI = async (
  id: number
) => {
  return axios.delete(
    `${API_BASE_URL}industry/use-case/${id}`
  );
};

/* ===========================
   USE CASE ↔ PARENT CATEGORY
=========================== */

export const GetUseCaseParentCategoriesAPI = async (
  useCaseId: number
) => {
  return axios.get(
    `${API_BASE_URL}industry/use-case/${useCaseId}/parent-categories`
  );
};

export const UpdateUseCaseParentCategoriesAPI = async (
  useCaseId: number,
  body: any
) => {
  return axios.put(
    `${API_BASE_URL}industry/use-case/${useCaseId}/parent-categories`,
    body
  );
};

/* ===========================
   USE CASE ↔ PRODUCTS
=========================== */

export const GetUseCaseProductsAPI = async (
  useCaseId: number,
  page = 1,
  limit = 20,
  search = ""
) => {
  return axios.get(
    `${API_BASE_URL}industry/use-case/${useCaseId}/products?page=${page}&limit=${limit}&search=${search}`
  );
};

export const AddProductsToUseCaseAPI = async (
  useCaseId: number,
  productIds: number[]
) => {
  return axios.post(
    `${API_BASE_URL}industry/use-case/${useCaseId}/products/add`,
    { product_ids: productIds }
  );
};

export const ExcludeProductsFromUseCaseAPI = async (
  useCaseId: number,
  productIds: number[]
) => {
  return axios.post(
    `${API_BASE_URL}industry/use-case/${useCaseId}/products/exclude`,
    { product_ids: productIds }
  );
};

export const ClearUseCaseProductOverrideAPI = async (
  useCaseId: number,
  productId: number
) => {
  return axios.delete(
    `${API_BASE_URL}industry/use-case/${useCaseId}/products/${productId}/override`
  );
};

export const MoveProductsBetweenUseCasesAPI = async (
  productIds: number[],
  fromUseCaseId: number,
  toUseCaseId: number
) => {
  return axios.post(
    `${API_BASE_URL}industry/use-case/products/move`,
    {
      product_ids: productIds,
      from_use_case_id: fromUseCaseId,
      to_use_case_id: toUseCaseId,
    }
  );
};

export const GetUseCasesForProductAPI = async (productId: number) => {
  return axios.get(
    `${API_BASE_URL}industry/products/${productId}/use-cases`
  );
};