/** @format */

// Every environment-specific value the panel uses comes from here. Values are
// read from .env at build time (see .env.example). Anything prefixed VITE_ is
// compiled into the browser bundle and is visible to anyone using the panel,
// so never put a secret here.

const required = (name: keyof ImportMetaEnv): string => {
  const value = import.meta.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and set it, then restart or rebuild.`,
    );
  }
  return value;
};

const optional = (name: keyof ImportMetaEnv): string | undefined =>
  import.meta.env[name]?.trim() || undefined;

// Backend API root, always with a trailing slash, e.g. https://api.example.com/api/v1/
export const API_BASE_URL = required("VITE_API_BASE_URL").replace(/\/*$/, "/");

// Host that serves uploaded files, without a trailing slash. Defaults to the
// API's origin, which is where the backend serves them.
export const IMAGE_BASE_URL = (
  optional("VITE_IMAGE_BASE_URL") || new URL(API_BASE_URL).origin
).replace(/\/+$/, "");
