// Gets the full official text for a feed item, so the writer works from the primary source, not a teaser.
import { htmlToText, type FeedItem } from "./feed";
import type { SourceMeta } from "./images";
import { decodeEntities } from "./feed";
import { SOURCE_RULES } from "./sources";

const UA = "PlenaryWire-bot/1.0 (+summaries of official press releases; preview, noindex)";
const MAX_CHARS = 14000;
export const MODEL_WORDS = 1500;
const BOILER_STOP = /^(press contacts?|media contacts?|media inquiries|for media inquiries|for more information|general public inquiries|contacts?:|###|-end-|follow us|share this|related (links|documents|content)|disclaimer please note|reproduction is permitted|find further information|read the full details)\b/i;
const BOILER_LINE = /^the federal reserve, the central bank of the united states, provides|^(print|share|tweet|email|copy link|\(watch\)|watch|read more|read the full|click here|subscribe)\b.{0,40}$|@[\w.-]+\.[a-z]{2,}|\+\d{2}[\d\s()]{6,}/i;

/** Cheaper, cleaner model input: drop contact/share boilerplate, keep whole paragraphs up to ~1,500 words. */
export function trimForModel(text: string, maxWords = MODEL_WORDS): string {
  const out: string[] = []; let words = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim(); if (!line) continue;
    if (BOILER_STOP.test(line)) break;
    if (BOILER_LINE.test(line)) continue;
    const n = line.split(/\s+/).length;
    if (words + n > maxWords) { if (!out.length) out.push(line.split(/\s+/).slice(0, maxWords).join(" ")); break; }
    out.push(line); words += n;
  }
  return out.join("\n");
}

export async function fetchSourceText(sourceId: string, item: FeedItem, timeoutMs = 15000): Promise<{ text: string; title: string; meta: SourceMeta }> {
  if (sourceId === "whitehouse-news") {
    // The White House feed carries the full release in content:encoded.
    let text = htmlToText(item.contentHtml || "");
    text = text.replace(/The post .* appeared first on The White House\s*\.?\s*$/s, "").trim();
    // Strip the site navigation block some releases carry at the top ("News Search Select Category ... Remarks Research").
    const nav = text.slice(0, 800).lastIndexOf("Remarks Research");
    if (/^News\s+Search/.test(text) && nav > 0) text = text.slice(nav + "Remarks Research".length).trim();
    text = text.replace(/\(\s*Watch\s*\)/g, "").trim();
    return { text: text.slice(0, MAX_CHARS), title: item.title, meta: {} };
  }
  if (sourceId === "ec-presscorner") {
    // detail/en/statement_26_2374 -> reference STATEMENT/26/2374, via the Press corner's public documents API.
    const m = item.link.match(/detail\/[a-z]{2}\/([a-z]+)_(\d+)_(\d+)/i);
    if (!m) throw new Error("unrecognised EC press corner link");
    const ref = `${m[1].toUpperCase()}/${m[2]}/${m[3]}`;
    const res = await fetch(`https://ec.europa.eu/commission/presscorner/api/documents?reference=${encodeURIComponent(ref)}&language=en`, {
      headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`EC documents API HTTP ${res.status}`);
    const j = (await res.json()) as { docuLanguageResource?: { title?: string; htmlContent?: string }; commissionerResource?: { code?: string; shortDescription?: string }[]; globalImg?: unknown };
    const html = j.docuLanguageResource?.htmlContent || "";
    const commissioners = (j.commissionerResource || []).map((c) => ({ code: String(c.code || ""), name: String(c.shortDescription || "") })).filter((c) => c.name);
    return { text: htmlToText(html).slice(0, MAX_CHARS), title: j.docuLanguageResource?.title || item.title, meta: { commissioners, globalImg: j.globalImg ?? null } };
  }
  const rule = SOURCE_RULES[sourceId];
  if (!rule) throw new Error(`no source-text adapter for ${sourceId}`);
  if (rule.text === "content") return { text: htmlToText(item.contentHtml || "").slice(0, MAX_CHARS), title: item.title, meta: {} };
  if (rule.text === "description" && item.summary.length >= 1200) return { text: item.summary.slice(0, MAX_CHARS), title: item.title, meta: {} };
  const url = new URL(item.link);
  if (url.protocol !== "https:" || !rule.host.test(url.hostname)) throw new Error("item link is not on the publisher's site");
  const res = await fetch(url.toString(), { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`source page HTTP ${res.status}`);
  const html = await res.text();
  return { text: pageParagraphs(html).slice(0, MAX_CHARS), title: item.title, meta: {} };
}

/** Article text from an official page: the <p> paragraphs between the first <h1> and the footer, chrome removed. */
export function pageParagraphs(html: string): string {
  let h = html.slice(0, 3_000_000);
  const i = h.search(/<h1[\s>]/i); if (i >= 0) h = h.slice(i);
  const j = h.search(/<footer[\s>]/i); if (j > 0) h = h.slice(0, j);
  h = h.replace(/<(script|style|nav|aside|form|figure|noscript|header)\b[\s\S]*?<\/\1>/gi, " ");
  const out: string[] = [];
  for (const m of h.matchAll(/<p[\s>][\s\S]*?<\/p>/gi)) {
    const t = decodeEntities(m[0].replace(/<[^>]+>/g, " ")).replace(/-->/g, " ").replace(/\s+/g, " ").trim();
    if (t.length >= 25 && !out.includes(t)) out.push(t);
  }
  return out.join("\n");
}

export const USER_AGENT = UA;
