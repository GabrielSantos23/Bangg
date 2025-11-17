import { defineConfig } from "@tanstack/start/config";

export default defineConfig({
  server: {
    preset: "static",
  },
  vite: {
    build: {
      outDir: "dist",
    },
  },
});
