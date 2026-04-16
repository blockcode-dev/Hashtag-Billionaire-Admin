import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://api.turningpages.io:9090/api/v1/";

export const AdminLoginAPI = async (email: string, password: string) => {
  const formData = new FormData();
  formData.append("email", email);
  formData.append("password", password);

  return await axios.post(`${API_BASE_URL}admin/auth/login`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};


export const SendOtpApi = (data: {
  email: string;
}) => {
  return axios.post(`${API_BASE_URL}admin/auth/otp`, data);
};


export const VerifyOtpApi = (data: {
  email: string;
  otp: string;
  otp_type: string;
}) => {
  return axios.post(`${API_BASE_URL}admin/auth/verify-otp`, data);
};


export const ForgotPasswordApi = (data: {
  email: string;
  password: string;
  confirm_password: string;
  token: string;
}) => {
  return axios.post(`${API_BASE_URL}admin/auth/forgot-password`, data);
};

export const ChangePasswordAPI = async (data: any) => {
  return axios.post(
    `${API_BASE_URL}admin/auth/change-password`,
    {
      old_password: data.old_password,
      new_password: data.new_password,
      confirm_password: data.confirm_password,
    },
    {
      headers: {
        "x-access-token": data.token,
      },
    }
  );
};

export const GetAdminProfileAPI = async (data: any) => {
  return axios.get(
    `${API_BASE_URL}admin/auth/getProfile`, 
    {
      headers: {
        "x-access-token": data.token,
      },
    }
  );
};

