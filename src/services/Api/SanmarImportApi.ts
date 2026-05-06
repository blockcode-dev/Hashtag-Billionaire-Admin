/** @format */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

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

  return axios.get(`${API_BASE_URL}sanmar/styles/${brand}`, {
    headers: { "x-access-token": token },
  });
};

// 🔥 GET PRODUCT PREVIEW
export const GetSanmarProductAPI = async (
  brand: string,
  style: string
) => {
  const token = localStorage.getItem("token");

  return axios.get(`${API_BASE_URL}sanmar/products/${brand}/${style}`, {
    headers: { "x-access-token": token },
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