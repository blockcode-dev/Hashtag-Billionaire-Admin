/** @format */

import axios from "axios";
import { API_BASE_URL } from "@/config/env";
import { clearSession, getToken } from "@/lib/session";

// Every API module calls the default axios instance, so these interceptors cover
// all of them. Installed once from main.tsx.

const API_ORIGIN = new URL(API_BASE_URL, window.location.origin).origin;

// Pages that work without a session; a 401 there must not bounce to sign-in.
const PUBLIC_PATHS = ["/", "/forgot-password", "/reset-password"];

const isApiRequest = (url?: string) => {
  if (!url) return false;
  try {
    return new URL(url, window.location.origin).origin === API_ORIGIN;
  } catch {
    return false;
  }
};

let redirecting = false;

axios.interceptors.request.use((config) => {
  // Only our backend gets the token, never third-party URLs.
  if (!isApiRequest(config.url)) return config;

  const token = getToken();
  if (token && !config.headers.get("x-access-token")) {
    config.headers.set("x-access-token", token);
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401: token missing, invalid or expired, the admin was removed or their
    // password changed. Sign in again. (403 means "not allowed" and is left to
    // the page to show; the session stays.)
    if (
      error?.response?.status === 401 &&
      isApiRequest(error.config?.url) &&
      !PUBLIC_PATHS.includes(window.location.pathname) &&
      !redirecting
    ) {
      redirecting = true;
      clearSession();
      window.location.href = "/?sessionExpired=true";
    }
    return Promise.reject(error);
  },
);
