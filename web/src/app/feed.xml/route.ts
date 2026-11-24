import { brand, SITE_DESCRIPTION } from "@/lib/config";
import { listArticles } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { urlOf, xmlEsc } from "@/lib/format";
import { topicName } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = siteUrl();
  const all = await listArticles({ limit: 50 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlEsc(brand.name)}</title><link>${xmlEsc(base + "/")}</link><atom:link href="${xmlEsc(base + "/feed.xml")}" rel="self" type="application/rss+xml"/><description>${xmlEsc(SITE_DESCRIPTION)}</description><language>en</language>${all[0] ? `<lastBuildDate>${new Date(all[0].updatedAt).toUTCString()}</lastBuildDate>` : ""}\n${all.map((a) => `<item><title>${xmlEsc(a.headline)}</title><link>${xmlEsc(base + urlOf(a))}</link><guid isPermaLink="true">${xmlEsc(base + urlOf(a))}</guid><pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate><description>${xmlEsc(a.metaDescription)}</description><category>${xmlEsc(topicName(a.section))}</category><source url="${xmlEsc(a.source.url)}">${xmlEsc(a.source.publisher)}</source></item>`).join("\n")}\n</channel></rss>\n`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
