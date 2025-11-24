/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MICROCMS_API_KEY?: string;
  readonly MICROCMS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
