import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // allow serving files from the project root to import shared logic
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '../src'),
      ],
    },
  },
});

