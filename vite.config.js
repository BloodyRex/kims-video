import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "https://api.bloodyrex.xyz",
        changeOrigin: true,
        bypass: (req) => {
          if (req.url.endsWith(".json")) return req.url;
        },
      },
      "/intelligence/subscribe": {
        target: "https://api.bloodyrex.xyz",
        changeOrigin: true,
      },
      "/intelligence/send-digest": {
        target: "https://api.bloodyrex.xyz",
        changeOrigin: true,
      },
    },
  },
});
