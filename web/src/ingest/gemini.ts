// Gemini writer: structured JSON output, validated before anything is stored.
import { SECTION_KEYS, TOPICS } from "@/lib/config";

export type Draft = {
  headline: string; metaDescription: string; summary: string; keyPoints: string[];
  body: string[]; section: string; slug: string;
  alternativeHeadline: string; keywords: string[]; entities: { name: string; type: string }[];
};
export const ENTITY_TYPES = ["Person", "Organization", "Place", "Event", "Legislation", "Policy"];
export type Usage = { in: number; out: number };

// Field rules live in the schema descriptions (sent once); the prompt only carries the sourcing rules.
const SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING", description: "Sentence case, 55-70 chars, key name/number first, active verb, no question." },
    alternativeHeadline: { type: "STRING", description: "Sentence case, 70-110 chars, same facts reworded." },
    metaOptions: { type: "ARRAY", items: { type: "STRING" }, description: "3 search descriptions of about 150, 155 and 160 chars: who did what, key number/decision, why it matters." },
    summary: { type: "STRING", description: "One sentence, 120-220 chars." },
    keyPoints: { type: "ARRAY", items: { type: "STRING" }, description: "3-5 short factual sentences." },
    body: { type: "ARRAY", items: { type: "STRING" }, description: "3-5 paragraphs, 50-100 words each." },
    section: { type: "STRING", enum: SECTION_KEYS },
    slug: { type: "STRING", description: "3-9 lowercase words, hyphenated." },
    keywords: { type: "ARRAY", items: { type: "STRING" }, description: "4-8 terms copied exactly from the source." },
    entities: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, type: { type: "STRING", enum: ENTITY_TYPES } }, required: ["name", "type"] }, description: "2-8 names spelled exactly as in the source." },
  },
  required: ["headline", "alternativeHeadline", "metaOptions", "summary", "keyPoints", "body", "section", "slug", "keywords", "entities"],
  propertyOrdering: ["headline", "alternativeHeadline", "metaOptions", "summary", "keyPoints", "body", "section", "slug", "keywords", "entities"],
};

function prompt(publisher: string, title: string, url: string, publishedAt: string | null, text: string, defaultSection: string) {
  const sections = SECTION_KEYS.map((k) => `${k}=${TOPICS[k].name}`).join(", ");
  return `Write an original, neutral wire-style news article from ONLY this official ${publisher} text.
Rules: no facts, numbers, names, titles, dates or background not in the text; every number must appear in the text; at most two short exact quotes; never copy a sentence or long phrase, paraphrase in your own words; attribute claims to ${publisher} or the named official, never state political claims as fact; no loaded adjectives outside quotes; refer to people exactly as the text does (if it says "the President" without a name, add no name; no first names it omits); no background knowledge.
Section (${sections}) by topic, not publisher: central banks, rates, inflation, trade, budgets, markets=economy-policy; digital, platforms, cybersecurity, telecoms, standards, space, science=tech; foreign affairs, conflicts, diplomacy, summits abroad=world; other US government=us-politics, other EU institutions=eu-politics. If unsure: ${defaultSection}.
Title: ${title}
URL: ${url}
Published: ${publishedAt || "unknown"}
TEXT:
${text}`;
}

export type GeminiEndpoint = "vertex-express" | "gemini-api";

export function endpointUrl(endpoint: GeminiEndpoint, model: string) {
  return endpoint === "vertex-express"
    ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

async function call(key: string, endpoint: GeminiEndpoint, model: string, text: string, schema: object | null, maxTokens: number): Promise<{ text: string; usage: Usage }> {
  const body = {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      temperature: 0.3, maxOutputTokens: maxTokens,
      ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}),
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  // Key goes in a header, never in the URL, so it cannot end up in logs.
  const res = await fetch(endpointUrl(endpoint, model), {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  const raw = await res.text();
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = JSON.parse(raw).error; msg += ` ${e.status || ""} ${String(e.message || "").slice(0, 120)}`; } catch {}
    throw new Error(`gemini: ${msg.split(key).join("[redacted]")}`);
  }
  const j = JSON.parse(raw);
  const cand = j.candidates?.[0];
  if (!cand || cand.finishReason && !["STOP", "MAX_TOKENS"].includes(cand.finishReason)) throw new Error(`gemini: finishReason ${cand?.finishReason || "none"}`);
  const out = (cand.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
  return { text: out, usage: { in: j.usageMetadata?.promptTokenCount || 0, out: j.usageMetadata?.candidatesTokenCount || 0 } };
}

export async function writeDraft(key: string, endpoint: GeminiEndpoint, model: string, src: { publisher: string; title: string; url: string; publishedAt: string | null; text: string; defaultSection?: string }, feedback?: string[]): Promise<{ draft: unknown; usage: Usage; calls: number }> {
  const fb = feedback?.length ? `\n\nA fact check rejected your last draft. Fix every point (drop unsupported items, reword copied text):\n- ${feedback.join("\n- ")}` : "";
  const r = await call(key, endpoint, model, prompt(src.publisher, src.title, src.url, src.publishedAt, src.text, src.defaultSection || SECTION_KEYS[0]) + fb, SCHEMA, 2048);
  let draft: unknown;
  try { draft = JSON.parse(r.text); } catch { throw new Error("gemini: output was not valid JSON"); }
  // Three meta lengths in one call: models cannot count characters, so picking one in range avoids a repair call.
  const o = draft as { metaOptions?: unknown; metaDescription?: unknown; metaAlternatives?: string[] };
  if (o && Array.isArray(o.metaOptions)) {
    const opts = o.metaOptions.filter((x): x is string => typeof x === "string").map((x) => x.replace(/\s+/g, " ").trim());
    const best = opts.find((x) => x.length >= 150 && x.length <= 160) ?? opts.slice().sort((a, b) => Math.abs(a.length - 155) - Math.abs(b.length - 155))[0] ?? "";
    o.metaDescription = best; o.metaAlternatives = opts.filter((x) => x !== best); delete o.metaOptions;
  }
  return { draft, usage: r.usage, calls: 1 };
}

/** Last resort when only the meta description length is off and no clean local fix exists (~300 tokens, at most once). */
export async function fixMeta(key: string, endpoint: GeminiEndpoint, model: string, summary: string, current: string): Promise<{ meta: string; usage: Usage }> {
  const r = await call(key, endpoint, model, `Rewrite to 150-160 characters (aim 155), one complete sentence, no new facts.\nSummary: ${summary}\nCurrent (${current.length}): ${current}`,
    { type: "OBJECT", properties: { metaDescription: { type: "STRING" } }, required: ["metaDescription"] }, 200);
  try { return { meta: String(JSON.parse(r.text).metaDescription || "").trim(), usage: r.usage }; } catch { return { meta: "", usage: r.usage }; }
}

/** Backfill only: alternative headline, keywords and entities for an already-published article (no body changes). */
export async function enrich(key: string, endpoint: GeminiEndpoint, model: string, headline: string, sourceText: string): Promise<{ raw: unknown; usage: Usage }> {
  const schema = { type: "OBJECT", properties: { alternativeHeadline: SCHEMA.properties.alternativeHeadline, keywords: SCHEMA.properties.keywords, entities: SCHEMA.properties.entities }, required: ["alternativeHeadline", "keywords", "entities"] };
  const r = await call(key, endpoint, model, `For the published news headline below, give SEO metadata taken ONLY from the source text. alternativeHeadline: 70-110 characters, same facts, no new facts. keywords and entities: copied exactly as they appear in the source.\nHeadline: ${headline}\n\nSOURCE TEXT START\n${sourceText}\nSOURCE TEXT END`, schema, 600);
  try { return { raw: JSON.parse(r.text), usage: r.usage }; } catch { return { raw: {}, usage: r.usage }; }
}
