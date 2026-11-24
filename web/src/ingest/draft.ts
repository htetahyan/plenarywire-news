// One article draft from one source text: a single Gemini call, deterministic local fixes, and at most one
// repair call — only when a factual guard (numbers, quotes, copying, names) fails.
import { slugify } from "./feed";
import { writeDraft, fixMeta, type Draft, type GeminiEndpoint, type Usage } from "./gemini";
import { validateDraft, metaOk, fitMeta, type Check } from "./validate";
import { SECTION_KEYS } from "@/lib/config";

export const FACTUAL = /^(number not in source|quote not in source|copied a long passage|names not in source|model meta-commentary)/;

export type DraftInput = { publisher: string; title: string; url: string; publishedAt: string | null; text: string; defaultSection: string; extraFacts?: string };
export type DraftResult = { check: Check; usage: Usage; calls: number; repaired: boolean; localFixes: string[]; firstReasons: string[] };

export async function draftItem(key: string, endpoint: GeminiEndpoint, model: string, src: DraftInput): Promise<DraftResult> {
  const usage: Usage = { in: 0, out: 0 }; let calls = 0; const localFixes: string[] = [];
  const facts = `${src.text}\n${src.extraFacts || ""}`;
  const attempt = async (feedback?: string[]) => {
    const r = await writeDraft(key, endpoint, model, src, feedback);
    usage.in += r.usage.in; usage.out += r.usage.out; calls++;
    let c = validateDraft(r.draft, facts, src.title);
    if (!c.ok && c.draft) {
      const alts = ((r.draft as { metaAlternatives?: string[] })?.metaAlternatives) || [];
      const { draft, fixes } = localFix(c.draft, src.text, src.defaultSection, alts);
      if (fixes.length) { localFixes.push(...fixes.filter((f) => !localFixes.includes(f))); c = validateDraft(draft, facts, src.title); }
    }
    return c;
  };
  let check = await attempt();
  let repaired = false; const firstReasons = check.ok ? [] : check.reasons.slice(0, 6);
  if (!check.ok && check.reasons.some((r) => FACTUAL.test(r))) { repaired = true; check = await attempt(check.reasons.filter((r) => FACTUAL.test(r))); }
  // Rejecting here would cost a full rewrite on the next run; a one-line meta rewrite is ~300 tokens.
  if (!check.ok && check.draft && check.reasons.every((r) => r.startsWith("meta length"))) {
    const fx = await fixMeta(key, endpoint, model, check.draft.summary, check.draft.metaDescription);
    usage.in += fx.usage.in; usage.out += fx.usage.out; calls++; localFixes.push("meta rewrite call");
    const meta = metaOk(fx.meta) ? fx.meta : fitMeta([fx.meta]);
    if (meta) check = validateDraft({ ...check.draft, metaDescription: meta }, facts, src.title);
  }
  return { check, usage, calls, repaired, localFixes, firstReasons };
}

const cutAt = (s: string, max: number) => { if (s.length <= max) return s; const c = s.slice(0, max); const i = Math.max(c.lastIndexOf(". "), c.lastIndexOf("; ")); return i > max * 0.5 ? c.slice(0, i + 1) : c.slice(0, c.lastIndexOf(" ")).replace(/[,;:\s-]+$/, "") + "."; };

/** Title Case -> sentence case, keeping words the source itself capitalises mid-sentence (names, institutions). */
export function sentenceCase(h: string, source: string): string {
  const words = h.split(" ");
  const rest = words.slice(1).filter((w) => /^\p{L}{4,}/u.test(w));
  const caps = rest.filter((w) => /^\p{Lu}/u.test(w));
  if (rest.length < 4 || caps.length / rest.length < 0.6) return h;
  return words.map((w, i) => {
    if (i === 0 || !/^\p{Lu}\p{Ll}+/u.test(w)) return w;
    const bare = w.replace(/[^\p{L}'-]+$/u, "");
    const midSentenceCap = new RegExp(`[\\p{Ll},;] ${bare.replace(/[-']/g, "\\$&")}\\b`, "u").test(source);
    return midSentenceCap ? w : w.toLowerCase();
  }).join(" ");
}

export function localFix(d0: Draft, source: string, defaultSection: string, metaAlts: string[] = []): { draft: Draft; fixes: string[] } {
  const d: Draft = { ...d0, keyPoints: [...d0.keyPoints], body: [...d0.body] }; const fixes: string[] = [];
  const sc = sentenceCase(d.headline, source); if (sc !== d.headline) { d.headline = sc; fixes.push("headline casing"); }
  if (d.headline.length > 80) {
    const parts = d.headline.split(/: | — | - /); const h = parts[0].length >= 45 && parts[0].length <= 80 ? parts[0] : "";
    if (h) { d.headline = h; fixes.push("headline shortened at clause"); }
  }
  if (d.headline.length < 45 && d.alternativeHeadline && d.alternativeHeadline.length <= 80) { [d.headline, d.alternativeHeadline] = [d.alternativeHeadline, ""]; fixes.push("headline from alternative"); }
  if (!metaOk(d.metaDescription)) {
    const m = fitMeta([d.metaDescription, ...metaAlts, d.summary, ...d.keyPoints, ...d.keyPoints.map((k) => `${d.metaDescription} ${k}`), ...d.keyPoints.map((k) => `${d.summary} ${k}`), `${d.metaDescription} ${d.summary}`]);
    if (m) { d.metaDescription = m; fixes.push("meta trimmed locally"); }
  }
  if (d.summary.length > 300) { d.summary = cutAt(d.summary, 300); fixes.push("summary cut"); }
  if (d.keyPoints.length > 6) { d.keyPoints = d.keyPoints.slice(0, 5); fixes.push("keyPoints capped"); }
  if (d.body.length > 8) { d.body = d.body.slice(0, 8); fixes.push("body capped"); }
  if (!SECTION_KEYS.includes(d.section) && SECTION_KEYS.includes(defaultSection)) { d.section = defaultSection; fixes.push("section default"); }
  if (d.slug.length < 8) { d.slug = slugify(d.headline); fixes.push("slug from headline"); }
  return { draft: d, fixes };
}
