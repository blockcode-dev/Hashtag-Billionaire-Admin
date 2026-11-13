import axios from "axios";

import { API_BASE_URL } from "@/config/env";

// The site's settings, stored once in the backend's database, so every admin sees the
// same values (hashtag-backend docs/admin-settings.md). Reading is open to admins;
// revealing secrets and saving take the settings key, which the panel never stores.
// The admin token is attached by the axios interceptor (services/Api/interceptors.ts).

export type SettingType =
  | "string"
  | "url"
  | "email"
  | "sender"
  | "integer"
  | "number"
  | "boolean"
  | "enum"
  | "color"
  | "code2"
  | "hosts"
  // JSON text: { amount, label, category_ids, suppliers } (HANDLING_FEE_RULE).
  | "handling_fee";

export interface Setting {
  key: string;
  label: string;
  description: string | null;
  type: SettingType;
  options?: string[];
  min?: number;
  max?: number;
  secret: boolean;
  required: boolean;
  // Always text ("587", "true", "a.com,b.com"). Masked for secrets unless revealed.
  value: string | null;
  // What applies when nothing is saved; always null for secrets.
  default: string | null;
  source: "admin" | "env" | "default" | "unset";
  missing: boolean;
  updated_at: string | null;
  updated_by: { id: number; name: string | null } | null;
}

export interface SettingsGroup {
  key: string;
  label: string;
  settings: Setting[];
}

export interface SettingsPage {
  revealed: boolean;
  groups: SettingsGroup[];
  // Keys still read from the server's .env file.
  from_env: string[];
  // Required keys with no value anywhere.
  missing_required: string[];
  saved?: string[];
  removed?: string[];
}

export const GetSettingsAPI = async () => {
  return axios.get<{ data: SettingsPage }>(`${API_BASE_URL}admin/settings`);
};

// 403 for a wrong key; 429 after 10 wrong keys in 15 minutes.
export const UnlockSettingsAPI = async (master_key: string) => {
  return axios.post<{ data: SettingsPage }>(`${API_BASE_URL}admin/settings/unlock`, { master_key });
};

// Only the changed settings; null puts one back to .env or its default. All or
// nothing: a 400 carries { errors: { KEY: "message" } } and saves nothing.
export const SaveSettingsAPI = async (master_key: string, values: Record<string, string | null>) => {
  return axios.put<{ data: SettingsPage; message: string }>(`${API_BASE_URL}admin/settings`, {
    master_key,
    values,
  });
};

export interface HandlingFeeOptions {
  categories: { id: number; title: string; supplier: string | null }[];
  // value: SS, SANMAR, OTTOCAP, MANUAL, SAGE (every SAGE supplier) or SAGE:<supplier number>.
  suppliers: { value: string; label: string }[];
}

// What the handling fee can be limited to: about 1,340 categories and a few hundred suppliers.
export const GetHandlingFeeOptionsAPI = async () => {
  return axios.get<{ data: HandlingFeeOptions }>(`${API_BASE_URL}admin/settings/handling-fee-options`);
};

// Sends a test email to the signed-in admin with the saved mail settings.
export const SendSettingsTestEmailAPI = async () => {
  return axios.post<{ data: { sent_to: string }; message: string }>(
    `${API_BASE_URL}admin/settings/test-email`,
  );
};
