/** @format */

import axios from "axios";

const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL ||
	"https://node.hashtagbillionaire.com/api/v1/";

// 🔥 GET STYLES BY BRAND
export const GetStylesByBrandAPI = async (brand: string) => {
	const token = localStorage.getItem("token");

	return axios.get(`${API_BASE_URL}product/ss/styles/${brand}`, {
		headers: { "x-access-token": token },
	});
};

// 🔥 GET PRODUCT PREVIEW
export const GetProductByStyleAPI = async (styleId: string) => {
	const token = localStorage.getItem("token");

	return axios.get(`${API_BASE_URL}product/ss/style/${styleId}`, {
		headers: { "x-access-token": token },
	});
};

// 🔥 IMPORT PRODUCT
export const ImportSSProductAPI = async (styleId: string) => {

	return axios.post(`${API_BASE_URL}product/sync/ss/${styleId}`);
};

export const GetAllBrandsAPI = async () => {
	return axios.get(`${API_BASE_URL}brand`);
};

