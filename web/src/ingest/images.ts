// Licensed lead images. Only three kinds of image are ever used, and each carries its credit and licence:
//  1. European Commission images (press corner / commission.europa.eu): "© European Union", CC BY 4.0
//     (Commission reuse policy, https://commission.europa.eu/legal-notice_en).
//  2. whitehouse.gov photos captioned "Official White House Photo by …": public domain (US government work).
//     Anything credited to an agency or non-government photographer (AP, Getty, Reuters, …) is skipped.
//  2b. nasa.gov release photos whose caption credit is NASA itself ("Credit: NASA", "NASA/<photographer>",
//     "NASA Earth Observatory/<name>"): public domain (US government work). Third-party credits are skipped.
//  3. Hand-listed Wikimedia Commons files (config/image-registry.json) whose licence the Commons API reports as
//     PD, CC0, CC BY or CC BY-SA at the moment of use.
// Images are resized/cropped with the Images binding (free plan) to webp and stored in R2 under img/<key>/.
// Fail closed: if anything is unclear, no image is used and the page shows the branded topic card.
import type { Env } from "@/lib/env";
import registry from "@/generated/image-registry.json";
import { decodeEntities, htmlToText, sha256 } from "./feed";

export type ImageCandidate = { src: string; credit: string; licence: string; licenceUrl: string; sourcePage: string; alt: string; kind: "ec-global" | "ec-portrait" | "wh-figure" | "nasa-figure" | "commons"; portrait: boolean };
export type StoredImage = { key: string; credit: string; licence: string; licenceUrl: string; sourcePage: string; alt: string; kind: string; w: number; h: number };
export type SourceMeta = { commissioners?: { code: string; name: string }[]; globalImg?: unknown };

const UA = "PlenaryWire-bot/1.0 (+summaries of official press releases; preview, noindex)";
export const VARIANTS: Record<string, [number, number]> = { "16x9": [1200, 675], "16x9-640": [640, 360], "4x3": [1200, 900], "1x1": [1200, 1200] };
const MAX_BYTES = 15_000_000;
/** Agencies and outlets whose photos are never cleared, whatever the page says. */
export const BLOCKED_CREDIT = /\b(AP|Associated Press|Getty|Reuters|AFP|Agence France|Bloomberg|EPA|Pool|Shutterstock|Alamy|NYT|New York Times|Washington Post|Polaris|Sipa|ZUMA|Anadolu|Xinhua|TASS)\b/i;
const CC_BY_40 = "https://creativecommons.org/licenses/by/4.0/";
const US_PD = "https://www.usa.gov/government-copyright";
const EC_HOST = /(^|\.)(europa\.eu)$/i;

const attr = (tag: string, name: string) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i")); return m ? decodeEntities(m[2] ?? m[3] ?? "") : ""; };

/** whitehouse.gov: a <figure> in the release body whose caption names an official White House photographer. */
export function whFigure(contentHtml: string, pageUrl: string, title: string): ImageCandidate | null {
  for (const m of contentHtml.matchAll(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/gi)) {
    if (/banner/i.test(m[1])) continue;
    const img = m[2].match(/<img\b[^>]*>/i)?.[0];
    const cap = htmlToText(m[2].match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] || "");
    if (!img || !cap) continue;
    const credit = cap.match(/\(?\s*(Official White House Photo(?: by [^)\n.]{3,60})?)\s*\)?/i)?.[1]?.trim();
    if (!credit || BLOCKED_CREDIT.test(cap)) continue;
    let src = attr(img, "src");
    const set = attr(img, "srcset").split(/,\s+/).map((s) => s.trim().split(/\s+/)).filter((p) => p[0] && /\d+w$/.test(p[1] || "")).map((p) => ({ u: p[0], w: parseInt(p[1], 10) }));
    const best = set.filter((p) => p.w >= 1200 && p.w <= 2400).sort((a, b) => a.w - b.w)[0];
    if (best) src = best.u;
    try { if (new URL(src).hostname !== "www.whitehouse.gov") continue; } catch { continue; }
    const alt = attr(img, "alt") || cap.replace(credit, "").replace(/[()]/g, "").trim() || title;
    return { src, credit, licence: "Public domain (U.S. government work)", licenceUrl: US_PD, sourcePage: pageUrl, alt: alt.slice(0, 200), kind: "wh-figure", portrait: false };
  }
  return null;
}

/** nasa.gov: the first captioned figure whose credit is NASA only (not ESA, JAXA, SpaceX, universities, agencies, …). */
export function nasaFigure(contentHtml: string, pageUrl: string, title: string): ImageCandidate | null {
  // NASA nests <figure>s, so pair each caption with the closest image before it.
  for (const m of contentHtml.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi)) {
    const before = contentHtml.slice(Math.max(0, (m.index || 0) - 6000), m.index);
    const img = [...before.matchAll(/<img\b[^>]*>/gi)].pop()?.[0];
    const cap = htmlToText(m[1]);
    if (!img || !cap || BLOCKED_CREDIT.test(cap)) continue;
    const credit = htmlToText(m[1].match(/<div class="hds-credits">([\s\S]*?)<\/div>/i)?.[1] || "").replace(/^(Image |Photo )?Credit:\s*/i, "").trim();
    const cm = credit.match(/^(NASA(?: [A-Z][\w]+){0,3}(?:\/[A-Z][\w.'-]+(?: [A-Z][\w.'-]+){0,3})?)$/);
    if (!cm || /[,&]| and /.test(cm[1])) continue;
    let src = attr(img, "src").replace(/\?.*$/, "");
    const set = attr(img, "srcset").split(/,\s+/).map((x) => x.trim().split(/\s+/)).filter((p) => p[0] && /\d+w$/.test(p[1] || "")).map((p) => ({ u: p[0], w: parseInt(p[1], 10) }));
    const best = set.filter((p) => p.w >= 1200 && p.w <= 2400).sort((a, b) => a.w - b.w)[0];
    if (best) src = best.u;
    try { if (!/(^|\.)nasa\.gov$/.test(new URL(src).hostname)) continue; } catch { continue; }
    const alt = attr(img, "alt") || title;
    return { src, credit: cm[1], licence: "Public domain (U.S. government work)", licenceUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/", sourcePage: pageUrl, alt: alt.slice(0, 200), kind: "nasa-figure", portrait: false };
  }
  return null;
}

/** European Commission: the press release's own image if it has one, else the official portrait of the lead commissioner. */
export async function ecImage(meta: SourceMeta, pageUrl: string, title: string): Promise<ImageCandidate | null> {
  const g = meta.globalImg as Record<string, unknown> | null | undefined;
  if (g && typeof g === "object") {
    const url = ["url", "uri", "imageUrl", "path", "link"].map((k) => g[k]).find((v) => typeof v === "string" && /^https:\/\//.test(v)) as string | undefined;
    const copy = String(g["copyright"] ?? g["credit"] ?? "© European Union").trim() || "© European Union";
    if (url && EC_HOST.test(new URL(url).hostname) && !BLOCKED_CREDIT.test(copy) && /European Union|EU/i.test(copy)) {
      return { src: url, credit: copy, licence: "CC BY 4.0", licenceUrl: CC_BY_40, sourcePage: pageUrl, alt: String(g["title"] ?? g["description"] ?? title).slice(0, 200), kind: "ec-global", portrait: false };
    }
  }
  const c = meta.commissioners?.[0];
  if (!c?.name) return null;
  const slug = c.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const page = /VONDERLEYEN/i.test(c.code) ? "https://commission.europa.eu/about/organisation/president_en" : `https://commission.europa.eu/about/organisation/college-commissioners/${slug}_en`;
  const res = await fetch(page, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const html = await res.text();
  const og = html.match(/<meta[^>]+property="og:image"[^>]*>/i)?.[0];
  const src = og ? attr(og, "content") : "";
  // The site-wide fallback card is not a portrait; only accept uploaded files.
  if (!src || !/^https:\/\/commission\.europa\.eu\/sites\/default\/files\//.test(src)) return null;
  return { src, credit: `© European Union / portrait of ${c.name}`, licence: "CC BY 4.0", licenceUrl: CC_BY_40, sourcePage: page, alt: `Official portrait of ${c.name}, European Commission`, kind: "ec-portrait", portrait: true };
}

/** Wikimedia Commons, only for files listed in config/image-registry.json and only with a free licence right now. */
export async function commonsImage(title: string): Promise<ImageCandidate | null> {
  const entry = (registry.commons as { id: string; titleMatch: string; file: string; alt: string; portrait: boolean }[]).find((e) => new RegExp(e.titleMatch, "i").test(title));
  if (!entry) return null;
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&titles=${encodeURIComponent(entry.file)}`;
  const res = await fetch(api, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const j = (await res.json()) as { query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }> } };
  const ii = Object.values(j.query?.pages || {})[0]?.imageinfo?.[0];
  if (!ii?.thumburl || !ii.descriptionurl) return null;
  const meta = (k: string) => htmlToText(String(ii.extmetadata?.[k]?.value ?? "")).trim();
  const lic = meta("LicenseShortName");
  // Automated pipeline always crops/resizes. CC BY-SA adaptations would need ShareAlike on the crop;
  // until we ship uncropped originals, accept only PD/CC0/CC BY (not BY-SA).
  if (!/^(public domain|pd\b.*|cc0( 1\.0)?|cc by( |-)?\d\.\d|cc by \d\.\d)$/i.test(lic) || /by-sa/i.test(lic)) return null;
  const artist = meta("Artist") || meta("Credit") || "Unknown author";
  if (BLOCKED_CREDIT.test(artist) || BLOCKED_CREDIT.test(meta("Credit"))) return null;
  const licenceUrl = meta("LicenseUrl") || ii.descriptionurl;
  const notice = [meta("AttributionRequired"), meta("Permission"), meta("UsageTerms")].filter(Boolean).join(" · ");
  const credit = notice ? `${artist} / Wikimedia Commons · ${notice}` : `${artist} / Wikimedia Commons`;
  return { src: ii.thumburl, credit, licence: lic, licenceUrl, sourcePage: ii.descriptionurl, alt: entry.alt, kind: "commons", portrait: entry.portrait };
}

export async function findImage(sourceId: string, item: { link: string; contentHtml?: string }, title: string, meta: SourceMeta): Promise<{ cand: ImageCandidate | null; why: string }> {
  if (sourceId === "whitehouse-news") {
    const f = whFigure(item.contentHtml || "", item.link, title);
    if (f) return { cand: f, why: "captioned official White House photo" };
    const c = await commonsImage(title);
    return c ? { cand: c, why: "registry Commons file, licence checked" } : { cand: null, why: "no captioned official photo; no registry match" };
  }
  if (sourceId === "nasa-news") {
    const f = nasaFigure(item.contentHtml || "", item.link, title);
    return f ? { cand: f, why: "NASA-credited release photo" } : { cand: null, why: "no NASA-credited photo" };
  }
  if (sourceId === "ec-presscorner") {
    const c = await ecImage(meta, item.link, title);
    return c ? { cand: c, why: c.kind } : { cand: null, why: "no EC image or portrait" };
  }
  return { cand: null, why: "no image adapter" };
}

/** Downloads the image once, stores webp crops in R2, records it in `images`. Reuses an existing cache entry. */
export async function cacheImage(env: Env, cand: ImageCandidate): Promise<StoredImage | null> {
  if (!env.IMG || !env.IMAGES) return null;
  const key = (await sha256(cand.src)).slice(0, 24);
  const row = await env.DB.prepare("SELECT * FROM images WHERE key=?").bind(key).first<Record<string, string | number>>();
  if (row) return { key, credit: String(row.credit), licence: String(row.licence), licenceUrl: String(row.licence_url), sourcePage: String(row.source_page), alt: String(row.alt), kind: String(row.kind), w: Number(row.width), h: Number(row.height) };
  const res = await fetch(cand.src, { headers: { "user-agent": UA, accept: "image/webp,image/jpeg,image/png;q=0.9" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`image HTTP ${res.status}`);
  const type = res.headers.get("content-type") || "";
  if (!/^image\/(jpeg|png|webp)/i.test(type)) throw new Error(`image type ${type}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES || buf.byteLength < 5000) throw new Error(`image size ${buf.byteLength}`);
  const info = await env.IMAGES.info(new Blob([buf]).stream());
  const w = "width" in info ? info.width : 0, h = "height" in info ? info.height : 0;
  if (w < 600 || h < 400) throw new Error(`image too small ${w}x${h}`);
  for (const [name, [vw, vh]] of Object.entries(VARIANTS)) {
    let out: ArrayBuffer;
    try {
      out = await transform(env, buf, vw, vh, cand.portrait ? "face" : "auto");
    } catch {
      out = await transform(env, buf, vw, vh, cand.portrait ? "top" : "center");
    }
    await env.IMG.put(`img/${key}/${name}.webp`, out, { httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { credit: cand.credit, licence: cand.licence, src: cand.src } });
  }
  await env.DB.prepare("INSERT OR REPLACE INTO images (key, src, credit, licence, licence_url, source_page, alt, kind, width, height, variants, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(key, cand.src, cand.credit, cand.licence, cand.licenceUrl, cand.sourcePage, cand.alt, cand.kind, w, h, JSON.stringify(Object.keys(VARIANTS)), new Date().toISOString()).run();
  return { key, credit: cand.credit, licence: cand.licence, licenceUrl: cand.licenceUrl, sourcePage: cand.sourcePage, alt: cand.alt, kind: cand.kind, w, h };
}

async function transform(env: Env, buf: ArrayBuffer, width: number, height: number, gravity: "face" | "auto" | "top" | "center"): Promise<ArrayBuffer> {
  const r = await env.IMAGES!.input(new Blob([buf]).stream()).transform({ width, height, fit: "cover", gravity }).output({ format: "image/webp", quality: 80 });
  return await new Response(r.image()).arrayBuffer();
}

/** Find + cache + attach to an article. Never throws; returns a short log reason. */
export async function attachImage(env: Env, articleId: number, sourceId: string, item: { link: string; contentHtml?: string }, title: string, meta: SourceMeta): Promise<{ ok: boolean; why: string; credit?: string }> {
  try {
    const { cand, why } = await findImage(sourceId, item, title, meta);
    if (!cand) return { ok: false, why };
    const img = await cacheImage(env, cand);
    if (!img) return { ok: false, why: "image bindings not configured" };
    await env.DB.prepare("UPDATE articles SET image=? WHERE id=? AND image IS NULL").bind(JSON.stringify(img), articleId).run();
    return { ok: true, why, credit: `${img.credit} (${img.licence})` };
  } catch (e) {
    return { ok: false, why: `error: ${String((e as Error).message || e).slice(0, 120)}` };
  }
}
