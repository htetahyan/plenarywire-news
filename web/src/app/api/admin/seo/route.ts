import { isAdmin, sameOrigin } from "@/lib/auth";
import { env } from "@/lib/env";
import { enrich, type GeminiEndpoint } from "@/ingest/gemini";
import { seoFields } from "@/ingest/validate";
import { fetchSourceText } from "@/ingest/source-text";
import { saveTags } from "@/lib/tags";
import type { FeedItem } from "@/ingest/feed";

/** Backfill keywords/entities/alternative headline for published articles that have none (max 5 per call). */
export async function POST(req: Request) {
  if (!(await sameOrigin(req)) || !(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const e = env();
  if (!e.GEMINI_API_KEY) return Response.json({ error: "model key not set" }, { status: 503 });
  const { results } = await e.DB.prepare(
    "SELECT a.id, a.slug, a.headline, si.source_id, si.payload, si.url FROM articles a JOIN source_items si ON si.article_id=a.id WHERE a.status='published' AND a.keywords='[]' ORDER BY a.id LIMIT 5",
  ).all<{ id: number; slug: string; headline: string; source_id: string; payload: string | null; url: string }>();
  const endpoint = (e.GEMINI_ENDPOINT === "vertex-express" ? "vertex-express" : "gemini-api") as GeminiEndpoint;
  const out: Record<string, unknown>[] = [];
  for (const r of results) {
    try {
      const item = JSON.parse(r.payload || "{}") as FeedItem;
      if (!item.link) item.link = r.url;
      const src = await fetchSourceText(r.source_id, item);
      const { raw } = await enrich(e.GEMINI_API_KEY, endpoint, e.GEMINI_MODEL || "gemini-3.5-flash", r.headline, src.text);
      const f = seoFields((raw || {}) as Record<string, unknown>, `${src.text}\n${src.title}`, r.headline);
      await e.DB.prepare("UPDATE articles SET alt_headline=?, keywords=?, entities=? WHERE id=?").bind(f.alternativeHeadline || null, JSON.stringify(f.keywords), JSON.stringify(f.entities), r.id).run();
      await saveTags(e, r.id, f.keywords, f.entities);
      out.push({ slug: r.slug, keywords: f.keywords.length, entities: f.entities.length, alt: !!f.alternativeHeadline });
    } catch (err) {
      out.push({ slug: r.slug, error: String((err as Error).message || err).slice(0, 120) });
    }
  }
  return Response.json({ processed: out.length, results: out }, { headers: { "cache-control": "no-store" } });
}
