/** @format */

import axios from "axios";

const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL ||
	"https://node.hashtagbillionaire.com/api/v1/";



export const GetAllProductsAPI = async () => {
	return axios.get(`${API_BASE_URL}product/get/variant`);
};

