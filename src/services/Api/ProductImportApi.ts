/** @format */

import axios, { type AxiosRequestConfig } from "axios";

import { API_BASE_URL } from "@/config/env";

// Several products from one CSV file (hashtag-backend docs/admin-panel-changes.md, 17 Nov 2026).
// The preview saves nothing; the import creates every product in the file, or none.

export interface ImportColumn {
  key: string;
  header: string;
  required: boolean;
  // "product": the same on every row of a product. "variant": one value per row (option).
  level: "product" | "variant";
  help: string;
}

export interface ImportTemplateOption {
  id: number;
  name: string;
  pricing_mode: "tiered" | "quantity_fixed";
  label: string;
}

export interface ImportFormat {
  columns: ImportColumn[];
  option_types: string[];
  pricing_templates: ImportTemplateOption[];
  limits: { max_rows: number; max_file_mb: number; max_options: number };
  example_file_name: string;
  example_csv: string;
  template_csv: string;
}

// row: the spreadsheet row (the header is row 1); null for the file as a whole.
export interface ImportIssue {
  row: number | null;
  column: string | null;
  message: string;
}

export interface ImportPreviewProduct {
  name: string;
  rows: number[];
  brand: string | null;
  supplier_categories: { title: string; is_new: boolean }[];
  sub_categories: string[];
  options: { name: string; type: string; values: string[] }[];
  variants: {
    row: number;
    sku: string;
    options: string[];
    pricing: string | null;
    stock: number | null;
    weight_lb: number | null;
  }[];
}

export interface ImportReport {
  file_name: string | null;
  summary: {
    rows: number;
    products: number;
    variants: number;
    new_supplier_categories: number;
    sub_category_links: number;
    errors: number;
    warnings: number;
  };
  products: ImportPreviewProduct[];
  new_supplier_categories: string[];
  sub_category_links: { supplier_category: string; sub_category: string }[];
  ignored_columns: string[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  can_import: boolean;
}

export interface ImportResult {
  imported: true;
  batch_id: string;
  products: { id: number; name: string; variants: number }[];
  summary: {
    products: number;
    variants: number;
    new_supplier_categories: number;
    sub_category_links: number;
  };
  warnings: ImportIssue[];
}

const importBody = (file: File, defaultTemplateId: number | null) => {
  const body = new FormData();
  body.append("file", file);
  if (defaultTemplateId) body.append("default_pricing_template_id", String(defaultTemplateId));
  return body;
};

// `options` carries the upload progress listener, and for a check, the signal that cancels it.
type UploadOptions = Pick<AxiosRequestConfig, "signal" | "onUploadProgress">;

const multipart = (options?: UploadOptions) => ({ headers: { "Content-Type": "multipart/form-data" }, ...options });

export const GetProductImportFormatAPI = async () => {
  return axios.get(`${API_BASE_URL}product/import/format`);
};

// Checks the file and answers an ImportReport. Saves nothing.
export const PreviewProductImportAPI = async (file: File, defaultTemplateId: number | null, options?: UploadOptions) => {
  return axios.post(`${API_BASE_URL}product/import/preview`, importBody(file, defaultTemplateId), multipart(options));
};

// 201 with an ImportResult. A file with problems answers 422, with the ImportReport in data.
export const ImportProductsAPI = async (file: File, defaultTemplateId: number | null, options?: UploadOptions) => {
  return axios.post(`${API_BASE_URL}product/import`, importBody(file, defaultTemplateId), multipart(options));
};
