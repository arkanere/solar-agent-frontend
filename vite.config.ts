import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The AI endpoints live in the FastAPI backend, which in production is a
// different origin (Cloud Run). Proxying them in dev keeps the browser on a
// single origin so CORS never enters the picture — the deployed backend's
// allow-list does not include localhost, so pointing dev at Cloud Run fails.
const backendProxy = { target: 'http://localhost:8000', changeOrigin: true };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api/chatbot': backendProxy,
      '/api/transcribe': backendProxy,
      '/api/speak': backendProxy,
      '/api/generate-cad': backendProxy,
    },
  },
});
