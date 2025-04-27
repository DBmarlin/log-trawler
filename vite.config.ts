import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { tempo } from "tempo-devtools/dist/vite";

const conditionalPlugins: [string, Record<string, any>][] = [];

// @ts-ignore
if (process.env.TEMPO === "true") {
  conditionalPlugins.push(["tempo-devtools/swc", {}]);
}

// https://vitejs.dev/config/
export default defineConfig({
  // Use relative base for Electron production build to ensure all assets resolve correctly
  base: process.env.VITE_ELECTRON === "true" || process.env.NODE_ENV === "production" ? "./" : (process.env.VITE_BASE_PATH || "/"),
  optimizeDeps: {
    entries: ["src/main.tsx", "src/tempobook/**/*"],
  },
  build: {
    rollupOptions: {
      output: {
        // format: "iife", // Remove iife format
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [
    react({
      plugins: conditionalPlugins,
    }),
    tempo(),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
