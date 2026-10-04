import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built into ../docs/library: GitHub Pages publishes this repo from /docs, so it is served at /library/.
// `base: './'` keeps every asset path relative, so it works under any sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: '../docs/library',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
