import { listArticles } from "@/lib/db";
import { iso, urlOf } from "@/lib/format";
import { topicName } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await listArticles({ limit: 60 });
  const items = all.map((a) => ({ id: a.slug, url: urlOf(a), headline: a.headline, dek: a.summary, topic: a.section, topicName: topicName(a.section), label: a.label || "Official source", type: a.type, publishedAt: iso(a.publishedAt), updatedAt: iso(a.updatedAt) }));
  return Response.json({ items }, { headers: { "cache-control": "no-cache" } });
}
