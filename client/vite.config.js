import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: { manifest: true },
  server: { proxy: { '/api': 'http://localhost:5000', '/uploads': 'http://localhost:5000', '/sitemap.xml': 'http://localhost:5000', '/sitemaps': 'http://localhost:5000', '/robots.txt': 'http://localhost:5000' } },
  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
