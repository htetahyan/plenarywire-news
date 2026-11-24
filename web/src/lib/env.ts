import { getCloudflareContext } from "@opennextjs/cloudflare";

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  ASSETS: Fetcher;
  IMG?: R2Bucket;
  IMAGES?: ImagesBinding;
  MAX_IMAGES_PER_RUN?: string;
  INDEXING_ENABLED?: string;
  SITE_URL?: string;
  GEMINI_MODEL?: string;
  GEMINI_ENDPOINT?: string; // "vertex-express" | "gemini-api"
  GEMINI_API_KEY?: string;
  ADMIN_PASSWORD?: string;
  PIPELINE_ENABLED?: string;
  MAX_NEW_PER_RUN?: string;
  MAX_NEW_PER_DAY?: string;
  MAX_PER_SOURCE_PER_RUN?: string;
};

export function env(): Env {
  return getCloudflareContext().env as unknown as Env;
}

/** Single switch for search-engine indexing. Anything other than the exact string "true" keeps noindex ON. */
export function indexingEnabled(e: Env = env()): boolean {
  return e.INDEXING_ENABLED === "true";
}

export function siteUrl(e: Env = env()): string {
  return (e.SITE_URL || "https://plenarywire.htetahyan.workers.dev").replace(/\/$/, "");
}
