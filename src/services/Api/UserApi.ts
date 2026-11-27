/** @format */

import axios, { type AxiosRequestConfig } from "axios";

import { API_BASE_URL } from "@/config/env";
import type { ImportIssue } from "@/components/common/ImportBlocks";

export const GetAllUsersAPI = async (params: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return axios.get(
    `${API_BASE_URL}admin/user/getAllUsers`,
    {
      params,

      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};

// A client added by the team (Add User, or the CSV import), with the password the backend
// generated. The password is answered once: it's stored one-way.
export interface NewClient {
  id: number;
  name: string;
  email: string;
  // 10 digits, or null.
  mobile: string | null;
}

// 201 { client, password }; nothing is emailed until SendLoginDetailsAPI. 400 with the reason:
// a missing name, a bad email or mobile, or an email that already has an account.
export const AddUserAPI = async (body: {
  name: string;
  email: string;
  mobile?: string;
}) => {
  return axios.post(
    `${API_BASE_URL}admin/user/createUser`,
    body,
    {
      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};

export const DeleteUserAPI = async (
  user_id: number[],
) => {
  return axios.post(
    `${API_BASE_URL}admin/user/deleteUser`,
    {
      user_id,
    },
    {
      headers: {
        "x-access-token":
          localStorage.getItem("token") || "",
      },
    },
  );
};

export const GetUserDetailsAPI = async (userId: number) => {
  return axios.get(`${API_BASE_URL}admin/user/getUserById`, {
    params: { id: userId },
  });
};

// Sets a customer's password for the admin to share. The customer is signed out
// everywhere and any emailed reset link stops working.
export const SetUserPasswordAPI = async (
  userId: number,
  body: { password: string; confirm_password: string },
) => {
  return axios.put(`${API_BASE_URL}admin/user/setPassword/${userId}`, body);
};

// Emails the client their email and this password, with a link to sign in. The password must be
// their current one: 409 when it isn't (it was changed since) or the account can't sign in.
export const SendLoginDetailsAPI = async (userId: number, password: string) => {
  return axios.post(`${API_BASE_URL}admin/user/sendLoginDetails/${userId}`, { password });
};

// ------------------------------------------------------------------------------------------
// Clients from a CSV file (hashtag-backend docs/admin-panel-changes.md, 27 Nov 2026). The preview
// saves nothing; the import creates every new client in the file, or none.
// ------------------------------------------------------------------------------------------

export interface ClientImportFormat {
  columns: { key: string; header: string; required: boolean; help: string }[];
  limits: { max_rows: number; max_file_mb: number; name_max: number };
  example_file_name: string;
  example_csv: string;
  // The example as rows of cells, the header first.
  example_rows: string[][];
  template_csv: string;
}

// A row whose email already has an account: left as it is.
export interface ExistingClient {
  row: number;
  name: string;
  email: string;
  user_id: number;
  account_name: string | null;
  // False: signed up on the website and hasn't verified the email yet.
  verified: boolean;
}

export interface ClientImportReport {
  file_name: string | null;
  summary: { rows: number; new_clients: number; already_clients: number; errors: number; warnings: number };
  clients: { row: number; name: string; email: string; mobile: string | null }[];
  already_clients: ExistingClient[];
  ignored_columns: string[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  can_import: boolean;
}

export interface ClientImportResult {
  imported: true;
  clients: (NewClient & { row: number; password: string })[];
  already_clients: ExistingClient[];
  summary: { created: number; already_clients: number };
  warnings: ImportIssue[];
  // The website's sign-in page, for "Copy all login details"; null when it isn't set.
  sign_in_url: string | null;
}

type UploadOptions = Pick<AxiosRequestConfig, "signal" | "onUploadProgress">;

const csvBody = (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return body;
};

const multipart = (options?: UploadOptions) => ({ headers: { "Content-Type": "multipart/form-data" }, ...options });

export const GetClientImportFormatAPI = async () => {
  return axios.get(`${API_BASE_URL}admin/user/import/format`);
};

// Checks the file and answers a ClientImportReport. Saves nothing.
export const PreviewClientImportAPI = async (file: File, options?: UploadOptions) => {
  return axios.post(`${API_BASE_URL}admin/user/import/preview`, csvBody(file), multipart(options));
};

// 201 with a ClientImportResult. A file with problems answers 422, with the report in data.
export const ImportClientsAPI = async (file: File, options?: UploadOptions) => {
  return axios.post(`${API_BASE_URL}admin/user/import`, csvBody(file), multipart(options));
};
