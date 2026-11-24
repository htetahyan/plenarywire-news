import { brand } from "@/lib/config";
import { listArticles } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { iso, urlOf, xmlEsc } from "@/lib/format";

export const dynamic = "force-dynamic";

// Google News sitemap: articles published in the last 48 hours. Not submitted anywhere while noindex is on.
export async function GET() {
  const base = siteUrl();
  const cutoff = Date.now() - 2 * 864e5;
  const recent = (await listArticles({ limit: 200 })).filter((a) => Date.parse(a.publishedAt) >= cutoff);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${recent.map((a) => `  <url>\n    <loc>${xmlEsc(base + urlOf(a))}</loc>\n    <news:news>\n      <news:publication><news:name>${xmlEsc(brand.name)}</news:name><news:language>en</news:language></news:publication>\n      <news:publication_date>${iso(a.publishedAt)}</news:publication_date>\n      <news:title>${xmlEsc(a.headline)}</news:title>${a.keywords.length ? `\n      <news:keywords>${xmlEsc(a.keywords.join(", "))}</news:keywords>` : ""}\n    </news:news>\n    <image:image><image:loc>${xmlEsc(a.image ? `${base}/img/${a.image.key}/16x9.webp` : `${base}/brand/cards/${a.section}-16x9.jpg`)}</image:loc></image:image>\n  </url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
