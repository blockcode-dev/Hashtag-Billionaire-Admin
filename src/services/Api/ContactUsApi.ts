import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

const getHeaders = () => ({
  "x-access-token": localStorage.getItem("token") || "",
});

export const GetAllContactUsAPI = async () => {
  return axios.get(
    `${API_BASE_URL}contactUs`,
    {
      headers: getHeaders(),
    },
  );
};

export const UpdateContactUsStatusAPI = async (
  id: number,
  status: "NEW" | "IN_PROGRESS" | "CLOSED",
) => {
  return axios.put(
    `${API_BASE_URL}contactUs/${id}`,
    {
      status,
    },
    {
      headers: getHeaders(),
    },
  );
};

export const DeleteContactUsAPI = async (id: number) => {
  return axios.delete(
    `${API_BASE_URL}contactUs/${id}`,
    {
      headers: getHeaders(),
    },
  );
};