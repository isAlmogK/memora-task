/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Unset: the real API via the /v1 proxy. "mock": the in-browser mock (npm run dev:mock). */
  readonly VITE_API_MODE?: 'mock';
  /** API key for the real API; defaults to the seeded dev user (dev-alice-user-key). */
  readonly VITE_API_KEY?: string;
}
