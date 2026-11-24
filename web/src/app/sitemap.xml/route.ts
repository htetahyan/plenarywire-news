import { DISCLOSURE, TOPICS } from "@/lib/config";
import { listArticles } from "@/lib/db";
import { env, siteUrl } from "@/lib/env";
import { iso, urlOf, xmlEsc } from "@/lib/format";
import { PAGES_UPDATED } from "@/components/StaticPage";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = siteUrl();
  const all = await listArticles({ limit: 200 });
  const newest = all[0]?.updatedAt || PAGES_UPDATED;
  const { results: tags } = await env().DB.prepare("SELECT t.tag, MAX(a.updated_at) AS at FROM article_tags t JOIN articles a ON a.id=t.article_id WHERE a.status='published' GROUP BY t.tag ORDER BY t.tag LIMIT 500").all<{ tag: string; at: string }>();
  const entries: [string, string][] = [
    ["/", newest], ["/latest/", newest], ["/sections/", newest],
    ...Object.keys(TOPICS).map((k) => [`/topics/${k}/`, all.find((a) => a.section === k)?.updatedAt || PAGES_UPDATED] as [string, string]),
    ...["/about/", "/standards/", "/contact/", "/corrections/", "/terms/", "/privacy/", "/cookies/", "/copyright/", "/accessibility/", ...(DISCLOSURE ? ["/disclosure/"] : [])].map((p) => [p, PAGES_UPDATED] as [string, string]),
    ...all.map((a) => [urlOf(a), a.updatedAt] as [string, string]),
    ...tags.map((t) => [`/tags/${t.tag}/`, t.at] as [string, string]),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.map(([p, d]) => `  <url><loc>${xmlEsc(base + p)}</loc><lastmod>${iso(d)}</lastmod><xhtml:link rel="alternate" hreflang="en" href="${xmlEsc(base + p)}"/></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
