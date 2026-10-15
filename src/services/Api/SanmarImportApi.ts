/** @format */

import axios from "axios";

import { API_BASE_URL } from "@/config/env";

// 🔥 GET SANMAR BRANDS
export const GetSanmarBrandsAPI = async () => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_BASE_URL}sanmar/brands`, {
    headers: { "x-access-token": token },
  });
};

// 🔥 GET STYLES BY BRAND
export const GetSanmarStylesAPI = async (brand: string) => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_BASE_URL}sanmar/styles`, {
    params: {
      brand,
    },
    headers: {
      "x-access-token": token,
    },
  });
};

// 🔥 GET PRODUCT PREVIEW
export const GetSanmarProductAPI = async (
  brand: string,
  style: string,
) => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_BASE_URL}sanmar/products`, {
    params: {
      brand,
      style,
    },
    headers: {
      "x-access-token": token,
    },
  });
};

// 🔥 IMPORT PRODUCT
export const ImportSanmarProductAPI = async (body: {
  brand: string;
  style: string;
}) => {
  const token = localStorage.getItem("token");

  return axios.post(`${API_BASE_URL}sanmar/sync/save`, body, {
    headers: { "x-access-token": token },
  });
};