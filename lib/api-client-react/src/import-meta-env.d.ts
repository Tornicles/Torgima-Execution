/** Minimal typings for fields used by this package (`import.meta.env`). Vite bundles provide full defs. */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
