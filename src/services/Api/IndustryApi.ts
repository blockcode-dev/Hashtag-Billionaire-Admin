import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

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