import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

const getHeaders = () => ({
  "x-access-token": localStorage.getItem("token"),
});

// Get all products
export const GetOttoProductsAPI = async (search = "") => {
  return axios.get(`${API_BASE_URL}ottocap/products`, {
    params: { search },
    headers: getHeaders(),
  });
};

// Get product + variants
export const GetOttoProductVariantsAPI = async (sku: string) => {
  return axios.get(`${API_BASE_URL}ottocap/products/${sku}`, {
    headers: getHeaders(),
  });
};

// Import all variants
export const ImportOttoAllVariantsAPI = async (skuNo: string) => {
  return axios.post(
    `${API_BASE_URL}ottocap/import-products`,
    {
      skuNo,
    },
    {
      headers: getHeaders(),
    }
  );
};
// Import selected variants
export const ImportOttoSelectedVariantsAPI = async (
  parentSku,
  variantSkus
) => {
  return axios.post(
    `${API_BASE_URL}ottocap/import-selected-variants`,
    {
      parentSku,
      variantSkus,
    },
    {
      headers: getHeaders(),
    }
  );
};