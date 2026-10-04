import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built into ../library so GitHub Pages serves it at /library/.
// `base: './'` keeps every asset path relative, so it works under any sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: '../library',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
