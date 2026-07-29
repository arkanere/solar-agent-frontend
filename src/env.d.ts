/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Empty in local dev so apiUrl() emits relative paths for the Vite proxy to
  // forward; set to the Cloud Run origin for production builds.
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
