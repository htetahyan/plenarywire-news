// Feed parsing and dedupe helpers (ported from pipeline/lib.mjs, WebCrypto instead of node:crypto).
const TRACKING = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|cmpid$)/i;

export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(String(raw).trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.protocol = "https:";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch { return null; }
}

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const STOP = new Set("a an the of to in on for and or by with at from as is are was be this that its it into over after before about new says said statement press release readout".split(" "));
export async function eventFingerprint(title: string, pubDate?: string | null): Promise<string> {
  const tokens = [...new Set(String(title).toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t && !STOP.has(t)))].sort();
  const d = pubDate ? new Date(pubDate) : null;
  const day = d && !isNaN(+d) ? d.toISOString().slice(0, 10) : "nodate";
  return (await sha256(`${tokens.join(" ")}|${day}`)).slice(0, 24);
}

export function decodeEntities(s: string): string {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}

export function htmlToText(html: string): string {
  return decodeEntities(
    decodeEntities(html)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|br|tr)>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  ).replace(/[ \t\f\v]+/g, " ").replace(/\n\s*/g, "\n").replace(/\n{2,}/g, "\n").trim();
}

export type FeedItem = { title: string; link: string; guid: string; pubDate: string; summary: string; contentHtml: string; categories?: string[] };

export function parseFeed(xml: string, maxItems = 50): FeedItem[] {
  const items: FeedItem[] = [];
  const rss = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of rss) {
    items.push({
      title: htmlToText(tag(b, "title")),
      link: decodeEntities(tag(b, "link")) || decodeEntities(tag(b, "guid")),
      guid: decodeEntities(tag(b, "guid")),
      pubDate: decodeEntities(tag(b, "pubDate") || tag(b, "dc:date")),
      summary: htmlToText(tag(b, "description")),
      contentHtml: decodeEntities(tag(b, "content:encoded")),
      categories: [...b.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)].map((m) => decodeEntities(m[1])).filter(Boolean).slice(0, 8),
    });
  }
  // Atom (e.g. GOV.UK .atom, Canada News Centre, The Conversation): <link href="...">, published/updated.
  if (!rss.length) {
    for (const b of xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || []) {
      const href = b.match(/<link[^>]*rel=["']?alternate["']?[^>]*href=["']([^"']+)["']/i)
        || b.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']?alternate["']/i)
        || b.match(/<link[^>]*href=["']([^"']+)["']/i);
      items.push({
        title: htmlToText(tag(b, "title")),
        link: href ? decodeEntities(href[1]) : "",
        guid: decodeEntities(tag(b, "id")),
        pubDate: decodeEntities(tag(b, "published") || tag(b, "updated")),
        summary: htmlToText(tag(b, "summary") || tag(b, "content")),
        contentHtml: decodeEntities(tag(b, "content")),
        categories: [...b.matchAll(/<category[^>]*term=["']([^"']+)["']/gi)].map((m) => decodeEntities(m[1])).filter(Boolean).slice(0, 8),
      });
    }
  }
  return items.filter((i) => i.title && i.link).slice(0, maxItems);
}

export function slugify(s: string): string {
  return String(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-+$/, "") || "story";
}
