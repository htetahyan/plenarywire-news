// Validation of the model's structured output. Anything that fails is rejected, never published.
import { SECTION_KEYS } from "@/lib/config";
import { slugify } from "./feed";
import { ENTITY_TYPES, type Draft } from "./gemini";

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();

export type Check = { ok: true; draft: Draft } | { ok: false; reasons: string[]; draft?: Draft };

export function metaOk(m: string) { return m.length >= 150 && m.length <= 160; }

export function validateDraft(raw: unknown, sourceText: string, sourceTitle: string): Check {
  const reasons: string[] = [];
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string).replace(/\s+/g, " ").trim() : "");
  const arr = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]).filter((x) => typeof x === "string").map((x) => (x as string).replace(/\s+/g, " ").trim()).filter(Boolean) : []);
  const d: Draft = {
    headline: str("headline").replace(/\.$/, ""), metaDescription: str("metaDescription"), summary: str("summary"),
    keyPoints: arr("keyPoints"), body: arr("body"), section: str("section"), slug: slugify(str("slug") || str("headline")),
    alternativeHeadline: "", keywords: [], entities: [],
  };
  Object.assign(d, seoFields(o, sourceText + "\n" + sourceTitle, d.headline));
  if (d.headline.length < 45 || d.headline.length > 80) reasons.push(`headline length ${d.headline.length} (target 55-70)`);
  if (!metaOk(d.metaDescription)) reasons.push(`meta length ${d.metaDescription.length}`);
  if (d.summary.length < 60 || d.summary.length > 300) reasons.push(`summary length ${d.summary.length}`);
  if (d.keyPoints.length < 2 || d.keyPoints.length > 6) reasons.push(`keyPoints count ${d.keyPoints.length}`);
  if (d.body.length < 2 || d.body.length > 8) reasons.push(`body paragraphs ${d.body.length}`);
  if (!SECTION_KEYS.includes(d.section)) reasons.push(`section ${d.section}`);
  if (d.slug.length < 8) reasons.push("slug too short");

  const out = [d.headline, d.alternativeHeadline, d.metaDescription, d.summary, ...d.keyPoints, ...d.body].join("\n");
  const src = norm(sourceText + "\n" + sourceTitle);
  const srcDigits = src.replace(/(\d),(\d{3})/g, "$1$2");

  // Every number in the output must exist in the source (blocks invented figures and dates).
  for (const n of new Set((out.replace(/(\d),(\d{3})/g, "$1$2").match(/\d+(?:\.\d+)?/g) || []))) {
    if (!new RegExp(`(^|[^\\d.])${n.replace(".", "\\.")}([^\\d]|$)`).test(srcDigits)) reasons.push(`number not in source: ${n}`);
  }
  // Every quoted passage must appear verbatim in the source (blocks invented quotes).
  for (const m of norm(out).matchAll(/"([^"]{12,})"/g)) {
    if (!src.includes(m[1].trim())) reasons.push(`quote not in source: ${m[1].slice(0, 40)}`);
  }
  // Plagiarism guard: no long verbatim runs copied from the source outside quotes.
  const outUnq = norm(out).replace(/"[^"]*"/g, " ");
  const words = outUnq.split(" ");
  for (let i = 0; i + 14 <= words.length; i += 3) {
    const run = words.slice(i, i + 14).join(" ");
    if (run.length > 60 && src.includes(run)) { reasons.push("copied a long passage from the source"); break; }
  }
  // Names guard: capitalised words mid-sentence (likely names/places/organisations) must have a stem in the source.
  const srcLower = src.toLowerCase();
  const ALLOW = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "president", "commission", "european", "union", "white", "house", "according", "statement", "states", "united", "america", "american", "americans"]);
  const unknownNames = new Set<string>();
  for (const sentence of out.split(/(?<=[.!?:])\s+|\n/)) {
    const words = sentence.split(/\s+/).slice(1);
    for (const w0 of words) {
      const w = w0.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").replace(/['\u2019]s$/, "");
      if (w.length < 4 || !/^\p{Lu}\p{Ll}/u.test(w)) continue;
      const lw = w.toLowerCase().normalize("NFKD");
      if (ALLOW.has(lw) || srcLower.includes(lw.slice(0, 5))) continue;
      unknownNames.add(w);
    }
  }
  if (unknownNames.size) reasons.push(`names not in source: ${[...unknownNames].slice(0, 5).join(", ")}`);
  if (/\b(as an ai|language model|i cannot)\b/i.test(out)) reasons.push("model meta-commentary");
  return reasons.length ? { ok: false, reasons, draft: d } : { ok: true, draft: d };
}

const TRAIL_STOP = /\s+(and|or|the|of|to|a|an|in|on|for|with|at|by|as|from|its|their|his|her|that|which|while)$/i;
/** Deterministic fallback for a meta description that is a little too long: cut at a word boundary to 150-160 chars. */
export function trimMeta(m: string): string | null {
  const s = m.replace(/\s+/g, " ").trim();
  if (metaOk(s)) return s;
  if (s.length < 150 || s.length > 220) return null;
  let cut = s.slice(0, 160);
  cut = cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s-]+$/, "");
  while (TRAIL_STOP.test(cut)) cut = cut.replace(TRAIL_STOP, "");
  cut = cut.replace(/[,;:.\s-]+$/, "") + ".";
  return metaOk(cut) ? cut : null;
}

const WEAK_END = /(al|ic|ive|ous|ary|ent|ant|ing|ed)$/i;
const WEAK_STOP = /^(against|about|after|before|between|through|during|without|within|toward|towards|under|upon|across|among|amid|following|including|plus|per|via|who|whom|whose|that|which|will|would|could|should|is|are|was|were|has|have|had|be|been|said|says|not|also|into|over|than|this|these|those|such|very|more|most|new)$/i;
/**
 * Deterministic meta description from text the model already wrote (and the validator checks): whole sentences first,
 * then a clause boundary, then a word boundary that does not end on a name, stop word or dangling adjective.
 */
export function fitMeta(candidates: string[]): string | null {
  const c = candidates.map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  for (const x of c) if (metaOk(x)) return x;
  const sents = [...new Set(c.flatMap((x) => x.split(/(?<=[.!?])\s+/)).map((x) => x.trim()).filter((x) => x.length > 20))].map((x) => (/[.!?]$/.test(x) ? x : x + "."));
  for (let i = 0; i < sents.length; i++) for (let j = 0; j < sents.length; j++) { if (i === j) continue; const t = `${sents[i]} ${sents[j]}`; if (metaOk(t)) return t; }
  for (const x of c) {
    for (const m of x.matchAll(/(, | — | – |; | and | while | as | after )/g)) { const t = x.slice(0, m.index).replace(/[,;:\s-]+$/, "") + "."; if (metaOk(t)) return t; }
  }
  for (const x of c) {
    if (x.length < 150) continue;
    const all = x.split(" "); const words = x.slice(0, 160).split(" "); words.pop();
    while (words.length && all.length - words.length <= 3) {
      const t = words.join(" ").replace(/[,;:.\s-]+$/, "") + "."; const last = words[words.length - 1].replace(/[^\p{L}]/gu, "");
      if (t.length < 150) break;
      const frag = t.length - (t.lastIndexOf(". ") + 2);
      if (metaOk(t) && (t.indexOf(". ") < 0 || frag >= 60) && !TRAIL_STOP.test(" " + last) && !WEAK_STOP.test(last) && !/^\p{Lu}/u.test(last) && !WEAK_END.test(last)) return t;
      words.pop();
    }
  }
  return null;
}

/** Keywords/entities are metadata: anything not found verbatim (accent-insensitive) in the source is dropped, not published. */
export function seoFields(o: Record<string, unknown>, source: string, headline: string): Pick<Draft, "alternativeHeadline" | "keywords" | "entities"> {
  const src = norm(source).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const has = (s: string) => s.length >= 3 && src.includes(norm(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, ""));
  const kw = [...new Set((Array.isArray(o.keywords) ? o.keywords : []).filter((k): k is string => typeof k === "string").map((k) => k.replace(/\s+/g, " ").trim()).filter((k) => k.length <= 60 && has(k)))].slice(0, 8);
  const ents: { name: string; type: string }[] = [];
  for (const e of Array.isArray(o.entities) ? o.entities : []) {
    const name = String((e as { name?: unknown })?.name ?? "").replace(/\s+/g, " ").trim();
    const type = String((e as { type?: unknown })?.type ?? "");
    if (name && ENTITY_TYPES.includes(type) && has(name) && !ents.some((x) => x.name === name)) ents.push({ name, type });
  }
  let alt = typeof o.alternativeHeadline === "string" ? o.alternativeHeadline.replace(/\s+/g, " ").trim().replace(/\.$/, "") : "";
  if (alt.length < 40 || alt.length > 120 || alt.toLowerCase() === headline.toLowerCase()) alt = "";
  const srcDigits = src.replace(/(\d),(\d{3})/g, "$1$2");
  for (const n of alt.replace(/(\d),(\d{3})/g, "$1$2").match(/\d+(?:\.\d+)?/g) || []) if (!new RegExp(`(^|[^\\d.])${n.replace(".", "\\.")}([^\\d]|$)`).test(srcDigits)) alt = "";
  return { alternativeHeadline: alt, keywords: kw, entities: ents.slice(0, 8) };
}

/** Reject drafts that share an 8+ word run with a forbidden text (e.g. an NC/ND tip outlet article). */
export function copiedFromForbidden(output: string, forbidden: string, nWords = 8): string | null {
  const out = norm(output).replace(/"[^"]*"/g, " ");
  const src = norm(forbidden);
  if (!src || src.length < 40) return null;
  const words = out.split(" ").filter(Boolean);
  for (let i = 0; i + nWords <= words.length; i++) {
    const run = words.slice(i, i + nWords).join(" ");
    if (run.length >= nWords * 4 && src.includes(run)) return run.slice(0, 80);
  }
  return null;
}
