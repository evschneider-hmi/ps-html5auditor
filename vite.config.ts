import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set the base path so that assets resolve correctly when hosted at
// https://evan-schneider.github.io/html5-audit-tool/
// (GitHub Pages project site). For local dev (vite dev) this is ignored.
export default defineConfig({
  base: '/html5-audit-tool/',
  plugins: [react()]
});
