import { indexingEnabled, siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = indexingEnabled()
    ? `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /search/\nDisallow: /saved/\n\nSitemap: ${siteUrl()}/sitemap.xml\nSitemap: ${siteUrl()}/news-sitemap.xml\n`
    : `# Preview: not for indexing (INDEXING_ENABLED=false)\nUser-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
