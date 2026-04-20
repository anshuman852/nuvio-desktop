import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  clearScreen: false,

  envPrefix: ["VITE_", "TAURI_"], // 🔥 QUESTO MANCAVA

  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  optimizeDeps: {
    include: ["hls.js", "@tauri-apps/api"],
  },

  build: {
    commonjsOptions: {
      include: [/hls\.js/, /node_modules/],
    },
  },
});