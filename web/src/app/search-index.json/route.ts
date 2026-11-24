import { brand } from "@/lib/config";
import { listArticles } from "@/lib/db";
import { iso, urlOf } from "@/lib/format";
import { topicName } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await listArticles({ limit: 200 });
  const pages = [["/about/", `About ${brand.name}`], ["/standards/", "Editorial standards"], ["/contact/", "Contact"], ["/corrections/", "Corrections"], ["/terms/", "Terms of Use"], ["/privacy/", "Privacy Policy"], ["/cookies/", "Cookie Policy"], ["/copyright/", "Copyright & licensing"], ["/accessibility/", "Accessibility"], ["/latest/", "Latest"], ["/sections/", "Sections"]].map(([url, headline]) => ({ url, headline, topicName: "Page", type: "page" }));
  const items = [...all.map((a) => ({ id: a.slug, url: urlOf(a), headline: a.headline, dek: a.summary, topic: a.section, topicName: topicName(a.section), label: a.label || "Official source", type: a.type, updatedAt: iso(a.updatedAt) })), ...pages];
  return Response.json({ items }, { headers: { "cache-control": "public, max-age=60" } });
}
