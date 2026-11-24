// Custom Worker entry: OpenNext's fetch handler + security/robots headers + the 30-minute cron.
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { runPipeline } from "./src/ingest/run";
import type { Env } from "./src/lib/env";

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

// Tiny per-isolate micro-cache for anonymous public GETs (30 s). Keeps CPU per request low on the free plan;
// a new article shows up within 30 s of a run committing it.
const MICRO_TTL_MS = 30_000;
const micro = new Map<string, { at: number; status: number; headers: [string, string][]; body: ArrayBuffer }>();
function cacheable(req: Request, path: string) {
  if (req.method !== "GET" || path.startsWith("/admin") || path.startsWith("/api/") || path.startsWith("/_next/")) return false;
  if ((req.headers.get("cookie") || "").includes("nd_admin=")) return false;
  if (req.headers.has("rsc") || req.headers.has("next-router-prefetch") || req.headers.has("next-router-state-tree")) return false;
  return true;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const path = url.pathname;
    const im = path.match(/^\/img\/([a-f0-9]{24})\/(16x9|16x9-640|4x3|1x1)\.webp$/);
    if (im && (request.method === "GET" || request.method === "HEAD")) {
      const obj = env.IMG ? await env.IMG.get(`img/${im[1]}/${im[2]}.webp`) : null;
      const h = new Headers({ "X-Content-Type-Options": "nosniff" });
      if (env.INDEXING_ENABLED !== "true") h.set("X-Robots-Tag", "noindex, nofollow");
      if (!obj) { h.set("cache-control", "public, max-age=60"); return new Response("Not found", { status: 404, headers: h }); }
      h.set("content-type", "image/webp"); h.set("cache-control", "public, max-age=31536000, immutable"); h.set("etag", obj.httpEtag);
      return new Response(request.method === "HEAD" ? null : obj.body, { headers: h });
    }
    const useMicro = cacheable(request, path);
    const key = url.pathname + url.search;
    const hit = useMicro ? micro.get(key) : undefined;
    if (hit && Date.now() - hit.at < MICRO_TTL_MS) {
      const r = new Response(hit.body.slice(0), { status: hit.status, headers: hit.headers });
      r.headers.set("x-nd-cache", "hit");
      return r;
    }
    const res: Response = await handler.fetch(request, env, ctx);
    const out = new Response(res.body, res);
    // Single indexing switch: INDEXING_ENABLED must be exactly "true" to drop noindex. Admin/API are never indexable.
    if (env.INDEXING_ENABLED !== "true" || path.startsWith("/admin") || path.startsWith("/api/")) out.headers.set("X-Robots-Tag", "noindex, nofollow, max-image-preview:large");
    out.headers.set("X-Content-Type-Options", "nosniff");
    out.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    out.headers.set("Permissions-Policy", "interest-cohort=(), browsing-topics=()");
    out.headers.set("X-Frame-Options", "DENY");
    if ((out.headers.get("content-type") || "").includes("text/html")) out.headers.set("Content-Security-Policy", CSP);
    if (path.startsWith("/admin") || path.startsWith("/api/")) out.headers.set("Cache-Control", "no-store");
    if (useMicro && (out.status === 200 || out.status === 404) && !out.headers.has("set-cookie")) {
      const body = await out.arrayBuffer();
      if (micro.size > 80) micro.clear();
      micro.set(key, { at: Date.now(), status: out.status, headers: [...out.headers], body });
      return new Response(body.slice(0), { status: out.status, headers: out.headers });
    }
    return out;
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Cron is removed from wrangler triggers while paused; if a schedule is re-added by mistake,
    // PIPELINE_ENABLED !== "true" still makes this a no-op (no feed fetches, no model calls).
    if (env.PIPELINE_ENABLED !== "true") {
      console.log(JSON.stringify({ event: "cron.skipped", reason: "PIPELINE_ENABLED!=true" }));
      return;
    }
    ctx.waitUntil(runPipeline(env, "cron").then((r) => console.log(JSON.stringify({ event: "cron.done", runId: r.runId, status: r.status, written: r.written }))));
  },
} satisfies ExportedHandler<Env>;
