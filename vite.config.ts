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
  define: {
    // Polyfill Node.js globals per WebTorrent browser build
    'global': 'globalThis',
    'process.browser': 'true',
    'process.env': '{}',
    'process.version': '"v18.0.0"',
    'process.platform': '"browser"',
  },
  optimizeDeps: {
    include: ['webtorrent'],
    esbuildOptions: {
      target: 'es2020',
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          webtorrent: ['webtorrent'],
        },
      },
    },
  },
}));
