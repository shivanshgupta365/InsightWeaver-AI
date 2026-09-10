import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          cloud: ["@supabase/supabase-js"],
          storage: ["dexie"],
          files: ["fflate", "papaparse", "read-excel-file"],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "InsightWeaver",
        short_name: "InsightWeaver",
        description: "Privacy-first business analysis in your browser.",
        theme_color: "#102b2a",
        background_color: "#f4f1e8",
        display: "standalone",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
    }),
  ],
  worker: { format: "es" },
});
