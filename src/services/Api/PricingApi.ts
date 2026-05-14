import axios from "axios";

const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL ||
	"https://node.hashtagbillionaire.com/api/v1/";

export const GetPricingMarkupAPI = async () => {
  return axios.get(`${API_BASE_URL}product/pricing/markup`);
};

export const UpdatePricingMarkupAPI = async (
  id: number,
  body: {
    markup_percent: number;
  },
) => {
  return axios.put(
    `${API_BASE_URL}product/pricing/${id}`,
    body,
  );
};