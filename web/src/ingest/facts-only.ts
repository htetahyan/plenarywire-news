// facts-only: extract bare facts → corroborate with official primary AND/OR an independent cleared outlet → write from agreed facts (+ primary text).
// Never pass NC/ND tip article text to the writing call. Copy-guard against ALL tip/outlet texts used.
import type { Env } from "@/lib/env";
import type { FeedItem } from "./feed";
import { htmlToText } from "./feed";
import { endpointUrl, type GeminiEndpoint, type Usage } from "./gemini";
import { validateDraft, copiedFromForbidden, type Check } from "./validate";
import { draftItem } from "./draft";
import { trimForModel, USER_AGENT, pageParagraphs } from "./source-text";
import { similarTitle, titleTokens } from "./sources";

export type FactBundle = { facts: string[]; primaryUrls: string[]; names: string[] };
export type MatchHit = {
  url: string; publisher: string; title: string; text: string;
  sourceId: string; mode: string; publishedAt: string | null;
  kind: "official" | "outlet";
};

const PRIMARY_HOST = /(^|\.)(gov|mil)$|(^|\.)(gov\.uk|europa\.eu|ecb\.europa\.eu|federalreserve\.gov|justice\.gov|whitehouse\.gov|nasa\.gov|nist\.gov|ftc\.gov|federalregister\.gov|defense\.gov|war\.gov|congress\.gov|supremecourt\.gov|state\.gov|treasury\.gov|dhs\.gov|ice\.gov|consilium\.europa\.eu)$/i;
const WINDOW_MS = 3 * 86400_000; // ±3 days for same-event matching

const FACT_SCHEMA = {
  type: "OBJECT",
  properties: {
    facts: { type: "ARRAY", items: { type: "STRING" }, description: "6-12 bare neutral fact statements (who/what/when/where/numbers). No quotes, no adjectives, no narrative angle." },
    primaryUrls: { type: "ARRAY", items: { type: "STRING" }, description: "https URLs of government/court/agency primary documents cited, if any." },
    names: { type: "ARRAY", items: { type: "STRING" }, description: "Named people and organisations mentioned." },
  },
  required: ["facts", "primaryUrls", "names"],
};

async function geminiJson(key: string, endpoint: GeminiEndpoint, model: string, prompt: string, schema: object, maxTokens: number): Promise<{ raw: unknown; usage: Usage }> {
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens, responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingBudget: 0 } },
  };
  const res = await fetch(endpointUrl(endpoint, model), {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`gemini: HTTP ${res.status}`);
  const j = JSON.parse(text);
  const out = (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
  const usage = { in: j.usageMetadata?.promptTokenCount || 0, out: j.usageMetadata?.candidatesTokenCount || 0 };
  try { return { raw: JSON.parse(out), usage }; } catch { return { raw: {}, usage }; }
}

export function extractPrimaryUrls(...chunks: string[]): string[] {
  const out = new Set<string>();
  for (const c of chunks) {
    for (const m of String(c || "").matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
      try {
        const u = new URL(m[0].replace(/[),.;]+$/, ""));
        if (u.protocol !== "https:") continue;
        if (PRIMARY_HOST.test(u.hostname)) out.add(u.toString().slice(0, 500));
      } catch { /* ignore */ }
    }
  }
  return [...out].slice(0, 8);
}

/** Same wire/syndication: long shared n-grams or near-identical bodies — not an independent second source. */
export function isSyndicatedCopy(a: string, b: string, nWords = 12): boolean {
  const na = a.toLowerCase().normalize("NFKD").replace(/\s+/g, " ").trim();
  const nb = b.toLowerCase().normalize("NFKD").replace(/\s+/g, " ").trim();
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wa = na.split(" ").filter(Boolean);
  const wb = new Set(nb.split(" ").filter(Boolean));
  if (wa.length < nWords || wb.size < nWords) return false;
  let hits = 0;
  for (let i = 0; i + nWords <= wa.length; i += Math.max(1, Math.floor(nWords / 2))) {
    const run = wa.slice(i, i + nWords).join(" ");
    if (run.length >= nWords * 4 && nb.includes(run)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

/** Within ±3 days (or either undated). */
export function withinEventWindow(a: string | null | undefined, b: string | null | undefined, windowMs = WINDOW_MS): boolean {
  if (!a || !b) return true;
  const ta = Date.parse(a), tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return true;
  return Math.abs(ta - tb) <= windowMs;
}

/** Cheap title/entity overlap for same-event matching (no model). */
export function eventMatchScore(titleA: string, titleB: string, textA = "", textB = ""): number {
  const ta = titleTokens(titleA), tb = titleTokens(titleB);
  if (!similarTitle(ta, tb) && ta.size >= 3 && tb.size >= 3) {
    let inter = 0; for (const w of ta) if (tb.has(w)) inter++;
    if (inter / (ta.size + tb.size - inter) < 0.4) return 0;
  }
  let score = similarTitle(ta, tb) ? 3 : 1;
  // Shared distinctive numbers boost the match.
  const nums = (s: string) => new Set((s.match(/\b\d{2,4}\b/g) || []));
  const na = nums(titleA + " " + textA.slice(0, 500)), nb = nums(titleB + " " + textB.slice(0, 500));
  let nHit = 0; for (const n of na) if (nb.has(n)) nHit++;
  if (nHit) score += Math.min(2, nHit);
  return score;
}

function payloadText(payload: string | null): string {
  try {
    const p = JSON.parse(payload || "{}") as FeedItem;
    return htmlToText(p.contentHtml || "") || p.summary || "";
  } catch { return ""; }
}

/** Any enabled D1 item from a different publisher in the time window with title overlap. Official preferred. */
export async function findIndependentMatches(
  env: Env, tipTitle: string, tipPublisher: string, tipUrl: string, tipPublishedAt: string | null, tipText = "",
): Promise<MatchHit[]> {
  const { results } = await env.DB.prepare(
    `SELECT si.url, si.title, si.payload, si.published_at, si.source_id, s.publisher, s.mode
     FROM source_items si JOIN sources s ON s.id=si.source_id
     WHERE s.enabled=1 AND si.status IN ('written','pending','skipped')
       AND si.first_seen_at >= datetime('now','-7 days')
       AND si.url <> ?
     ORDER BY CASE s.mode WHEN 'official-rewrite' THEN 0 ELSE 1 END, si.first_seen_at DESC LIMIT 120`,
  ).bind(tipUrl).all<{ url: string; title: string; payload: string | null; published_at: string | null; source_id: string; publisher: string; mode: string }>();

  const hits: MatchHit[] = [];
  for (const r of results) {
    if (r.publisher === tipPublisher) continue;
    if (!withinEventWindow(tipPublishedAt, r.published_at)) continue;
    const text = trimForModel(payloadText(r.payload));
    if (eventMatchScore(tipTitle, r.title, tipText, text) < 1) continue;
    if (tipText && text && isSyndicatedCopy(tipText, text)) continue; // same wire → not independent
    hits.push({
      url: r.url, publisher: r.publisher, title: r.title, text,
      sourceId: r.source_id, mode: r.mode, publishedAt: r.published_at,
      kind: r.mode === "official-rewrite" ? "official" : "outlet",
    });
  }
  return hits;
}

export async function extractFacts(key: string, endpoint: GeminiEndpoint, model: string, title: string, tipText: string): Promise<{ bundle: FactBundle; usage: Usage }> {
  const clipped = tipText.slice(0, 6000);
  const { raw, usage } = await geminiJson(key, endpoint, model,
    `Extract ONLY bare facts from this news tip. Output short neutral fact statements (who, what, when, where, numbers, named officials). No quotes, no copied sentences, no angle or adjectives. List any https links to government/court/agency documents cited.\nTitle: ${title}\nTEXT:\n${clipped}`,
    FACT_SCHEMA, 700);
  const o = raw as Record<string, unknown>;
  const facts = Array.isArray(o.facts) ? o.facts.filter((x): x is string => typeof x === "string").map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x.length >= 20 && x.length <= 240).slice(0, 12) : [];
  const primaryUrls = Array.isArray(o.primaryUrls) ? o.primaryUrls.filter((x): x is string => typeof x === "string" && x.startsWith("https://")).slice(0, 8) : [];
  const names = Array.isArray(o.names) ? o.names.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean).slice(0, 12) : [];
  return { bundle: { facts, primaryUrls, names }, usage };
}

export function confirmedFacts(facts: string[], primaryText: string): string[] {
  const src = primaryText.toLowerCase().normalize("NFKD");
  return facts.filter((f) => {
    const toks = f.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3);
    if (toks.length < 4) return false;
    const hit = toks.filter((w) => src.includes(w)).length;
    return hit / toks.length >= 0.55;
  });
}

const factToks = (f: string) => new Set(f.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3));
const factNums = (f: string) => [...new Set((f.replace(/(\d),(\d{3})/g, "$1$2").match(/\d+(?:\.\d+)?/g) || []))];

/** Agree facts across two lists; drop single-source claims and number conflicts. */
export function agreeFacts(a: string[], b: string[]): { agreed: string[]; conflicts: string[]; onlyA: string[]; onlyB: string[] } {
  const usedB = new Set<number>();
  const agreed: string[] = [];
  const conflicts: string[] = [];
  const onlyA: string[] = [];
  for (const fa of a) {
    const ta = factToks(fa);
    let best = -1, bestScore = 0;
    for (let i = 0; i < b.length; i++) {
      if (usedB.has(i)) continue;
      const tb = factToks(b[i]);
      let inter = 0; for (const w of ta) if (tb.has(w)) inter++;
      const score = inter / (ta.size + tb.size - inter || 1);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0 || bestScore < 0.45) { onlyA.push(fa); continue; }
    const fb = b[best];
    usedB.add(best);
    const na = factNums(fa), nb = factNums(fb);
    const conflictNum = na.some((n) => nb.length && !nb.includes(n) && nb.some((m) => m !== n && Math.abs(Number(m) - Number(n)) > 0));
    // Stricter: same-ish fact with different numbers → conflict
    if (na.length && nb.length && na.some((n) => !nb.includes(n)) && nb.some((n) => !na.includes(n))) {
      conflicts.push(`${fa} || ${fb}`);
      continue;
    }
    if (conflictNum) { conflicts.push(`${fa} || ${fb}`); continue; }
    agreed.push(fa.length <= fb.length ? fa : fb);
  }
  const onlyB = b.filter((_, i) => !usedB.has(i));
  return { agreed, conflicts, onlyA, onlyB };
}

/**
 * Find number+unit pairs that conflict across two sources (e.g. "3 million" vs "5 million").
 * Official-primary-only numbers are not conflicts; this flags same-unit disagreements.
 */
export function findNumberConflicts(sourceA: string, sourceB: string): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/(\d),(\d{3})/g, "$1$2");
  const re = /(\d+(?:\.\d+)?)\s*(million|billion|percent|%|people|deaths?|killed|years?|months?)/gi;
  const map = (s: string) => {
    const m = new Map<string, string>();
    for (const x of norm(s).matchAll(re)) m.set(x[2].replace(/s$/, ""), x[1]);
    return m;
  };
  const a = map(sourceA), b = map(sourceB);
  const out: string[] = [];
  for (const [unit, na] of a) {
    const nb = b.get(unit);
    if (nb && nb !== na) out.push(`${na} vs ${nb} ${unit}`);
  }
  return out;
}

/** Remove from draft any number that participates in a cross-source unit conflict. */
export function omitConflictingNumbers(draftText: string, sourceA: string, sourceB: string): { cleaned: string; omitted: string[] } {
  const conflicts = findNumberConflicts(sourceA, sourceB);
  if (!conflicts.length) return { cleaned: draftText, omitted: [] };
  const bad = new Set(conflicts.flatMap((c) => c.match(/\d+(?:\.\d+)?/g) || []));
  const omitted: string[] = [];
  let cleaned = draftText.replace(/(\d),(\d{3})/g, "$1$2");
  for (const n of bad) {
    if (!cleaned.includes(n)) continue;
    omitted.push(n);
    cleaned = cleaned.replace(new RegExp(`(^|[^\d.])${n.replace(".", "\.")}([^\d]|$)`, "g"), "$1$2");
  }
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return { cleaned, omitted };
}

async function fetchPrimaryPage(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !PRIMARY_HOST.test(u.hostname)) return null;
    const res = await fetch(u.toString(), { headers: { "user-agent": USER_AGENT, accept: "text/html" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const html = await res.text();
    const text = pageParagraphs(html);
    if (text.length < 250) return null;
    const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return { title: htmlToText(tm?.[1] || u.pathname).slice(0, 200), text: trimForModel(text) };
  } catch { return null; }
}

export async function fetchTipText(item: FeedItem, _sourceId: string): Promise<string> {
  const fromFeed = htmlToText(item.contentHtml || "") || item.summary || "";
  if (fromFeed.length >= 800) return fromFeed.slice(0, 14000);
  try {
    const u = new URL(item.link);
    if (u.protocol !== "https:") return fromFeed;
    const res = await fetch(u.toString(), { headers: { "user-agent": USER_AGENT, accept: "text/html" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return fromFeed;
    const html = await res.text();
    const text = pageParagraphs(html);
    return (text.length > fromFeed.length ? text : fromFeed).slice(0, 14000);
  } catch { return fromFeed; }
}

export type FactsOnlyResult =
  | {
      ok: true; check: Check; usage: Usage; calls: number; tipOriginal: string;
      primary: { primaryUrl: string; primaryPublisher: string; primaryTitle: string; primaryText: string; via: string } | null;
      confirmed: string[]; credit: string; outlets: string[]; matched: number; tokensPerArticle: number;
    }
  | { ok: false; reason: string; usage: Usage; calls: number; kind?: "no-match" | "conflict" | "other" };

/**
 * Corroborate via (a) official primary and/or (b) ≥1 independent cleared outlet.
 * Prefer 2+ total sources. Writing never sees NC/ND tip text — only agreed facts (+ primary text).
 */
export async function processFactsOnly(
  env: Env, key: string, endpoint: GeminiEndpoint, model: string,
  tip: { publisher: string; title: string; url: string; publishedAt: string | null; item: FeedItem; defaultSection: string; sourceId: string },
): Promise<FactsOnlyResult> {
  const usage: Usage = { in: 0, out: 0 }; let calls = 0;
  const tipPreview = htmlToText(tip.item.contentHtml || "") || tip.item.summary || "";
  const linkCandidates = extractPrimaryUrls(tip.item.contentHtml || "", tip.item.summary || "");
  const matches = await findIndependentMatches(env, tip.title, tip.publisher, tip.url, tip.publishedAt, tipPreview);

  let primaryText = "";
  let primaryMeta: { primaryUrl: string; primaryPublisher: string; primaryTitle: string; primaryText: string; via: string } | null = null;
  const official = matches.find((m) => m.kind === "official" && m.text.length >= 200);
  if (official) {
    primaryMeta = { primaryUrl: official.url, primaryPublisher: official.publisher, primaryTitle: official.title, primaryText: official.text, via: "d1-official" };
    primaryText = official.text;
  } else if (linkCandidates.length) {
    for (const u of linkCandidates) {
      const page = await fetchPrimaryPage(u);
      if (page) {
        primaryMeta = { primaryUrl: u, primaryPublisher: new URL(u).hostname.replace(/^www\./, ""), primaryTitle: page.title, primaryText: page.text, via: "link" };
        primaryText = page.text;
        break;
      }
    }
  }

  const peer = matches.find((m) => m.kind === "outlet" && m.text.length >= 200 && m.publisher !== tip.publisher)
    || matches.find((m) => m.text.length >= 200 && m.publisher !== tip.publisher && m.kind === "official" && !primaryMeta);

  // Need at least one corroborator: primary OR independent outlet.
  if (!primaryMeta && !peer) {
    return { ok: false, reason: "no corroboration candidate (no official primary and no independent outlet match)", usage, calls, kind: "no-match" };
  }

  const tipOriginal = await fetchTipText(tip.item, tip.sourceId);
  if (tipOriginal.length < 200) return { ok: false, reason: "tip text too short to extract facts", usage, calls, kind: "other" };

  // Re-check syndication once we have full tip text.
  if (peer && isSyndicatedCopy(tipOriginal, peer.text)) {
    if (!primaryMeta) return { ok: false, reason: "matched outlet is syndicated copy, not independent", usage, calls, kind: "no-match" };
  }

  const tipFacts = await extractFacts(key, endpoint, model, tip.title, tipOriginal);
  usage.in += tipFacts.usage.in; usage.out += tipFacts.usage.out; calls++;

  // Upgrade primary from extracted URLs if needed.
  if (!primaryMeta) {
    for (const u of tipFacts.bundle.primaryUrls) {
      const page = await fetchPrimaryPage(u);
      if (page) {
        primaryMeta = { primaryUrl: u, primaryPublisher: new URL(u).hostname.replace(/^www\./, ""), primaryTitle: page.title, primaryText: page.text, via: "link" };
        primaryText = page.text;
        break;
      }
    }
  }

  let agreed: string[] = [];
  const outlets = [tip.publisher];
  const guardTexts = [tipOriginal];

  if (primaryMeta && peer && peer.kind === "outlet" && !isSyndicatedCopy(tipOriginal, peer.text)) {
    // Primary + tip + peer: agree tip vs peer, keep those also in primary (or allow official-only extras).
    const peerFacts = await extractFacts(key, endpoint, model, peer.title, peer.text);
    usage.in += peerFacts.usage.in; usage.out += peerFacts.usage.out; calls++;
    outlets.push(peer.publisher);
    guardTexts.push(peer.text);
    const cross = agreeFacts(tipFacts.bundle.facts, peerFacts.bundle.facts);
    if (cross.conflicts.length && !cross.agreed.length) {
      return { ok: false, reason: `core fact conflict between outlets: ${cross.conflicts[0].slice(0, 120)}`, usage, calls, kind: "conflict" };
    }
    const inPrimary = confirmedFacts(cross.agreed, primaryText);
    const officialOnly = confirmedFacts(tipFacts.bundle.facts, primaryText).filter((f) => !inPrimary.includes(f));
    agreed = [...inPrimary, ...officialOnly].slice(0, 12);
    if (cross.conflicts.length) {
      // Drop conflicts; if nothing left after drop, skip.
      if (agreed.length < 2) return { ok: false, reason: `core fact conflict; insufficient agreed facts`, usage, calls, kind: "conflict" };
    }
  } else if (primaryMeta) {
    agreed = confirmedFacts(tipFacts.bundle.facts, primaryText);
  } else if (peer) {
    // Outlet + outlet (no official primary): extract peer facts and agree.
    if (isSyndicatedCopy(tipOriginal, peer.text)) {
      return { ok: false, reason: "matched outlet is syndicated copy, not independent", usage, calls, kind: "no-match" };
    }
    const peerFacts = await extractFacts(key, endpoint, model, peer.title, peer.text);
    usage.in += peerFacts.usage.in; usage.out += peerFacts.usage.out; calls++;
    outlets.push(peer.publisher);
    guardTexts.push(peer.text);
    const cross = agreeFacts(tipFacts.bundle.facts, peerFacts.bundle.facts);
    if (cross.conflicts.length && cross.agreed.length < 2) {
      return { ok: false, reason: `core fact conflict between outlets: ${cross.conflicts[0].slice(0, 120)}`, usage, calls, kind: "conflict" };
    }
    agreed = cross.agreed;
    // Dual-outlet write uses agreed facts only (no NC/ND body text). Optionally include peer summary numbers already in agreed.
  }

  if (agreed.length < 2) return { ok: false, reason: "no core facts confirmed across sources", usage, calls, kind: "no-match" };

  const credit = outlets.length > 1 ? `Reported by ${outlets.join(" and ")}` : `First reported by ${outlets[0]}`;
  const factBlock = agreed.map((f, i) => `${i + 1}. ${f}`).join("\n");
  const primaryBlock = primaryText ? `${primaryText}\n\n` : "";
  const writeText = `${primaryBlock}Agreed facts (confirmed across sources; do not invent):\n${factBlock}\n\nCredit required: "${credit}". Quotes only from any official primary text above.`;
  const sourcePublisher = primaryMeta?.primaryPublisher || tip.publisher;
  const sourceUrl = primaryMeta?.primaryUrl || tip.url;
  const sourceTitle = primaryMeta?.primaryTitle || tip.title;

  const dr = await draftItem(key, endpoint, model, {
    publisher: sourcePublisher,
    title: sourceTitle,
    url: sourceUrl,
    publishedAt: tip.publishedAt,
    text: writeText,
    defaultSection: tip.defaultSection,
    extraFacts: `${credit}. Attribution links (do not copy their wording): ${[tip.url, peer?.url].filter(Boolean).join(" · ")}`,
  });
  usage.in += dr.usage.in; usage.out += dr.usage.out; calls += dr.calls;
  if (!dr.check.ok || !dr.check.draft) {
    return { ok: false, reason: `draft failed: ${(dr.check.ok ? [] : dr.check.reasons).slice(0, 4).join("; ")}`, usage, calls, kind: "other" };
  }

  const outText = [dr.check.draft.headline, dr.check.draft.summary, ...dr.check.draft.keyPoints, ...dr.check.draft.body].join("\n");
  for (const g of guardTexts) {
    const hit = copiedFromForbidden(outText, g, 8);
    if (hit) return { ok: false, reason: `copied from source text: ${hit}`, usage, calls, kind: "other" };
  }

  const validateAgainst = (primaryText || factBlock) + "\n" + factBlock + "\n" + credit;
  const re = validateDraft(dr.check.draft, validateAgainst, sourceTitle);
  if (!re.ok) return { ok: false, reason: `validate: ${re.reasons.slice(0, 4).join("; ")}`, usage, calls, kind: "other" };

  const tokensPerArticle = usage.in + usage.out;
  return {
    ok: true, check: re, usage, calls, tipOriginal, primary: primaryMeta, confirmed: agreed, credit, outlets,
    matched: (primaryMeta ? 1 : 0) + (peer ? 1 : 0) + 1, tokensPerArticle,
  };
}

/** For official-rewrite: if an independent second source exists, omit A-only numbers that conflict with B. No model call. */
export async function secondSourceAgreement(
  env: Env, title: string, publisher: string, url: string, publishedAt: string | null, primaryText: string,
): Promise<{ peer: MatchHit | null; omitted: string[] }> {
  const matches = await findIndependentMatches(env, title, publisher, url, publishedAt, primaryText.slice(0, 800));
  const peer = matches.find((m) => m.text.length >= 200 && m.publisher !== publisher) || null;
  if (!peer) return { peer: null, omitted: [] };
  if (isSyndicatedCopy(primaryText, peer.text)) return { peer: null, omitted: [] };
  return { peer, omitted: [] }; // omission applied by caller on draft text
}
