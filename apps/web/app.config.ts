import { defineConfig } from "@tanstack/start/config";

export default defineConfig({
  server: {
    preset: "vercel",
  },
  vite: {
    build: {
      outDir: "dist",
    },
  },
});
