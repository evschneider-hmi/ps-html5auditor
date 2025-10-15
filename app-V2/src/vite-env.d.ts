/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHOW_MIGRATION_OVERLAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.js?raw' {
  const content: string;
  export default content;
}
