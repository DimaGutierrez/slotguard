import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'demo',
  base: '/slotguard/',
  plugins: [react()],
  build: { outDir: '../demo-dist', emptyOutDir: true },
});
