/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHOW_MIGRATION_OVERLAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
