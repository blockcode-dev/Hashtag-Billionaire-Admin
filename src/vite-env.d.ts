/// <reference types="vite/client" />

// Variables read from .env. Keep in sync with .env.example and src/config/env.ts.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_IMAGE_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
