import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
// Minimal resolver compatible with Windows paths
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { fileURLToPath } from 'url';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function r(p: string){
  return path.resolve(__dirname, p);
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    // Ensure a single React instance across monorepo/local file deps
    dedupe: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    alias: {
      react: r('./node_modules/react'),
      'react-dom': r('./node_modules/react-dom'),
      'react-dom/client': r('./node_modules/react-dom/client'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Export libraries (lazy loaded via dynamic imports)
          'export-pdf': ['jspdf'],
          'export-excel': ['xlsx'],
          
          // React core
          'react-vendor': ['react', 'react-dom'],
          
          // State management
          'zustand-vendor': ['zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 600, // Increased from default 500 KB for main chunk
  },
  worker: {
    format: 'es', // Use ES module format for workers instead of IIFE
  },
  server: {
    fs: {
      // allow serving files from the project root to import shared logic
      allow: [
        searchForWorkspaceRoot('.'),
        r('..'),
        r('../src'),
      ],
    },
  },
});
