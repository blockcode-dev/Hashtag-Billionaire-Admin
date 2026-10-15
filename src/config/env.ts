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

// Firebase web app config (optional; only needed if Firestore is used).
export const FIREBASE_CONFIG = {
  apiKey: optional("VITE_FIREBASE_API_KEY"),
  authDomain: optional("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: optional("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: optional("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: optional("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: optional("VITE_FIREBASE_APP_ID"),
};
