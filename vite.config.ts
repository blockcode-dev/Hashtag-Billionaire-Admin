import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Variables the app can't run without (see .env.example).
const REQUIRED_ENV = ["VITE_API_BASE_URL"];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(", ")}. Copy .env.example to .env and fill it in.`,
    );
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
