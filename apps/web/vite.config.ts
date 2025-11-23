import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: "/index", // 👈 Isso gera /index.html ao invés de /_shell.html
        },
      },
    }),
    nitro(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  ssr: {
    // Mark pg as external so Node.js loads it natively (CommonJS)
    external: ["pg", "pg-native"],
    resolve: {
      conditions: ["node", "import"],
    },
  },
  optimizeDeps: {
    exclude: ["pg", "pg-native"], // Exclude from client bundle
  },
  build: {
    commonjsOptions: {
      include: [/pg/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
});
