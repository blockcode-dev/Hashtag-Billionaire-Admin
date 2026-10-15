import axios from "axios";

import { API_BASE_URL } from "@/config/env";

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