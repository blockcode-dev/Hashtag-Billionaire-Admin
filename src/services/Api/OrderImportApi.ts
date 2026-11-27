/** @format */

import axios, { type AxiosRequestConfig } from "axios";

import { API_BASE_URL } from "@/config/env";
import type { ImportIssue } from "@/components/common/ImportBlocks";

// A client's previous orders from a CSV file (hashtag-backend docs/admin-panel-changes.md,
// 27 Nov 2026). One row per order line; rows with the same order number make one order. The
// preview saves nothing; the import creates every order in the file, or none, and can be undone.

export interface OrderImportClient {
  id: number;
  name: string | null;
  email: string;
}

export interface OrderImportColumn {
  key: string;
  header: string;
  required: boolean;
  // "order": the same for every row of an order. "line": one value per row.
  level: "order" | "line";
  help: string;
}

export interface OrderImportFormat {
  client: OrderImportClient;
  columns: OrderImportColumn[];
  statuses: string[];
  limits: { max_rows: number; max_file_mb: number; order_number_max: number };
  example_file_name: string;
  example_csv: string;
  // The example as rows of cells, the header first.
  example_rows: string[][];
  template_csv: string;
}

export interface OrderImportLine {
  row: number;
  product_id: number;
  product_name: string;
  variant_id: number;
  sku: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  decoration: string | null;
  print_method: string | null;
}

export interface OrderImportOrder {
  order_number: string;
  rows: number[];
  // ISO date-time.
  date: string;
  status: string;
  status_label: string;
  payment_method: string;
  tracking_number: string | null;
  ship_to: Record<string, string | null> | null;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  lines: OrderImportLine[];
}

// An order of this client imported before, with the same number: left as it is.
export interface AlreadyImported {
  order_number: string;
  rows: number[];
  order_id: number;
  date: string;
}

export interface OrderImportReport {
  file_name: string | null;
  client: OrderImportClient;
  summary: {
    rows: number;
    orders: number;
    lines: number;
    total_amount: number;
    already_imported: number;
    errors: number;
    warnings: number;
  };
  orders: OrderImportOrder[];
  already_imported: AlreadyImported[];
  ignored_columns: string[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  can_import: boolean;
}

export interface OrderImportResult {
  imported: true;
  // Undo with UndoOrderImportAPI.
  batch_id: string;
  client: OrderImportClient;
  orders: { id: number; order_number: string; date: string; status: string; status_label: string; total: number; lines: number; units: number }[];
  already_imported: AlreadyImported[];
  summary: { orders: number; lines: number; total_amount: number; already_imported: number };
  warnings: ImportIssue[];
}

type UploadOptions = Pick<AxiosRequestConfig, "signal" | "onUploadProgress">;

const csvBody = (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return body;
};

const multipart = (options?: UploadOptions) => ({ headers: { "Content-Type": "multipart/form-data" }, ...options });

export const GetOrderImportFormatAPI = async (clientId: number) => {
  return axios.get(`${API_BASE_URL}admin/user/${clientId}/orders/import/format`);
};

// Checks the file and answers an OrderImportReport. Saves nothing.
export const PreviewOrderImportAPI = async (clientId: number, file: File, options?: UploadOptions) => {
  return axios.post(`${API_BASE_URL}admin/user/${clientId}/orders/import/preview`, csvBody(file), multipart(options));
};

// 201 with an OrderImportResult. A file with problems answers 422, with the report in data.
export const ImportOrdersAPI = async (clientId: number, file: File, options?: UploadOptions) => {
  return axios.post(`${API_BASE_URL}admin/user/${clientId}/orders/import`, csvBody(file), multipart(options));
};

// Removes every order of that import. 200 { removed, order_numbers }; 404 when nothing is left.
export const UndoOrderImportAPI = async (clientId: number, batchId: string) => {
  return axios.delete(`${API_BASE_URL}admin/user/${clientId}/orders/import/${batchId}`);
};
