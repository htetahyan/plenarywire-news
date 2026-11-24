import { isAdmin, sameOrigin } from "@/lib/auth";
import { env } from "@/lib/env";
import { attachImage } from "@/ingest/images";
import { fetchSourceText } from "@/ingest/source-text";
import type { FeedItem } from "@/ingest/feed";

/** Backfill: find + cache licensed images for published articles that have none (max 6 per call). */
export async function POST(req: Request) {
  if (!(await sameOrigin(req)) || !(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const e = env();
  const { results } = await e.DB.prepare(
    "SELECT a.id, a.slug, si.source_id, si.payload, si.url FROM articles a JOIN source_items si ON si.article_id=a.id WHERE a.status='published' AND a.image IS NULL ORDER BY a.id LIMIT 6",
  ).all<{ id: number; slug: string; source_id: string; payload: string | null; url: string }>();
  const out: Record<string, unknown>[] = [];
  for (const r of results) {
    try {
      const item = JSON.parse(r.payload || "{}") as FeedItem;
      if (!item.link) item.link = r.url;
      const src = await fetchSourceText(r.source_id, item);
      const im = await attachImage(e, r.id, r.source_id, item, src.title, src.meta);
      out.push({ slug: r.slug, ...im });
    } catch (err) {
      out.push({ slug: r.slug, ok: false, why: String((err as Error).message || err).slice(0, 120) });
    }
  }
  return Response.json({ processed: out.length, results: out }, { headers: { "cache-control": "no-store" } });
}
