/** @format */

import axios, { type AxiosRequestConfig } from "axios";

import { API_BASE_URL } from "@/config/env";
import type { ImportIssue } from "@/components/common/ImportBlocks";
import type { BulkTier, QuantityPrice, QuantityPricingMode } from "@/utils/variantPricing";

// Several pricing templates from one CSV file (hashtag-backend docs/admin-panel-changes.md,
// 20 Nov 2026). The preview saves nothing; the import saves every template in the file, or none.

export interface TemplateImportColumn {
  key: string;
  header: string;
  required: boolean;
  // "template": the same on every row of a template. "row": one value per row (tier or quantity).
  level: "template" | "row";
  // The pricing style the column is for ("Variable ranges" or "Fixed quantities"); null for both.
  style: string | null;
  help: string;
}

export interface TemplateImportStyle {
  key: QuantityPricingMode;
  label: string;
  columns: string[];
  description: string;
}

export interface TemplateImportFormat {
  columns: TemplateImportColumn[];
  styles: TemplateImportStyle[];
  limits: { max_rows: number; max_file_mb: number; max_prices_per_template: number; name_max: number };
  existing_templates: number;
  example_file_name: string;
  example_csv: string;
  // The example as rows of cells, the header first.
  example_rows: string[][];
  template_csv: string;
}

export interface TemplateImportPreview {
  name: string;
  rows: number[];
  pricing_mode: QuantityPricingMode;
  style: string;
  bulk_pricing: BulkTier[] | null;
  quantity_pricing: QuantityPrice[] | null;
  description: string;
  // "replace": a template with this name exists and is replaced (replace_existing).
  action: "create" | "replace";
  replaces: { id: number; name: string; style: string } | null;
}

export interface TemplateImportReport {
  file_name: string | null;
  replace_existing: boolean;
  // Templates in the file whose name is already a template (`name` is the existing one's). Without
  // replace_existing each is a problem; with it, each is updated with the file's prices.
  already_exist?: { name: string; file_name: string; rows: number[]; style: string }[];
  summary: {
    rows: number;
    templates: number;
    new_templates: number;
    replaced_templates: number;
    variable_ranges: number;
    fixed_quantities: number;
    errors: number;
    warnings: number;
  };
  templates: TemplateImportPreview[];
  ignored_columns: string[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  can_import: boolean;
}

export interface TemplateImportResult {
  imported: true;
  templates: {
    id: number;
    name: string;
    pricing_mode: QuantityPricingMode;
    bulk_pricing: BulkTier[] | null;
    quantity_pricing: QuantityPrice[] | null;
    action: "create" | "replace";
  }[];
  summary: { templates: number; created: number; replaced: number };
  warnings: ImportIssue[];
}

const importBody = (file: File, replaceExisting: boolean) => {
  const body = new FormData();
  body.append("file", file);
  if (replaceExisting) body.append("replace_existing", "true");
  return body;
};

type UploadOptions = Pick<AxiosRequestConfig, "signal">;

const multipart = (options?: UploadOptions) => ({ headers: { "Content-Type": "multipart/form-data" }, ...options });

export const GetPricingTemplateImportFormatAPI = async () => {
  return axios.get(`${API_BASE_URL}pricing-template/import/format`);
};

// Checks the file and answers a TemplateImportReport. Saves nothing.
export const PreviewPricingTemplateImportAPI = async (file: File, replaceExisting: boolean, options?: UploadOptions) => {
  return axios.post(`${API_BASE_URL}pricing-template/import/preview`, importBody(file, replaceExisting), multipart(options));
};

// 201 with a TemplateImportResult. A file with problems answers 422, with the report in data.
export const ImportPricingTemplatesAPI = async (file: File, replaceExisting: boolean) => {
  return axios.post(`${API_BASE_URL}pricing-template/import`, importBody(file, replaceExisting), multipart());
};
