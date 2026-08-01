import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The AI endpoints live in the FastAPI backend, which in production is a
// different origin (Cloud Run). Proxying them in dev keeps the browser on a
// single origin so CORS never enters the picture — the deployed backend's
// allow-list does not include localhost, so pointing dev at Cloud Run fails.
const backendProxy = { target: 'http://localhost:8000', changeOrigin: true };

/**
 * Lead submission has no real home in this SPA.
 *
 * In the Svelte app the form POSTs to `/in/api/submitLead`, a SvelteKit server
 * route that writes to Postgres and sends a confirmation email. A standalone
 * client has no server, and the FastAPI backend has no lead endpoint — so the
 * whole form, its validation, its prefill and both of its outcomes are built and
 * exercised against this, and only the database write is fake. It is dev-only:
 * a production build has no middleware, the request 404s, and the form shows its
 * failure state rather than a success that did not happen.
 */
function mockLeadEndpoint(): Plugin {
  let submissions = 0;
  return {
    name: 'mock-lead-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/submit-lead', (req, res, next) => {
        if (req.method !== 'POST') return next();
        submissions += 1;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            success: true,
            id: `MOCK-${String(submissions).padStart(4, '0')}`,
          }),
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mockLeadEndpoint()],
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
