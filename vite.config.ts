import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  // AGGIUNGI QUESTA SEZIONE
  optimizeDeps: {
    include: ['hls.js']
  },
  build: {
    commonjsOptions: {
      include: [/hls.js/, /node_modules/]
    }
  }
}));