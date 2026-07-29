// The AI endpoints (chatbot, transcribe, speak, generate-cad) live in the
// FastAPI backend, not alongside this SPA. In production that's a different
// origin (Cloud Run), so paths must be absolute. Locally the base is empty and
// the Vite proxy in vite.config.ts forwards the relative path to localhost:8000,
// which keeps dev same-origin and out of CORS entirely — the deployed backend's
// allow-list does not include localhost, so there is no local-to-cloud path.
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export const apiUrl = (path: string) => `${BASE}${path}`;
