/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "mock" (default): in-browser mock API. "http": the real Nest API via the /v1 proxy. */
  readonly VITE_API_MODE?: 'mock' | 'http';
}
