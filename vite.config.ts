import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set the base path so that assets resolve correctly when hosted as a GitHub Pages project site.
// (Ignored for local dev with `vite dev`).
export default defineConfig({
  base: '/ps-html5auditor/',
  plugins: [react()]
});
