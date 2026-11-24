// Per-source rules for the official feeds. Every enabled source must have a rule here and a licence in D1
// (sources.licence_url / licence_note, migration 0005+). Unknown sources fail closed in fetchSourceText.
// Modes: official-rewrite | facts-only (NC/ND tip → extract facts, corroborate with primary, write from primary only).
import type { FeedItem } from "./feed";

export type SourceRule = {
  /** Where the full text comes from: the feed's content:encoded, the feed description, or the linked page. */
  text: "content" | "description" | "page";
  /** Only items whose link matches are in scope (e.g. ECB press releases, not interviews or speeches). */
  allowLink?: RegExp;
  skipTitle?: RegExp;
  skipCategory?: RegExp;
  /** Link host must end with this (fetching pages only from the publisher's own site). */
  host: RegExp;
};

export const SOURCE_RULES: Record<string, SourceRule> = {
  "whitehouse-news": { text: "content", host: /(^|\.)whitehouse\.gov$/ },
  "ec-presscorner": { text: "page", host: /(^|\.)europa\.eu$/ },
  "fed-press": { text: "page", host: /(^|\.)federalreserve\.gov$/, skipCategory: /^(Enforcement Actions|Orders on Banking Applications)$/i },
  // ECB copyright: free use with the ECB cited as source; documents bearing authors' names are excluded, and
  // interviews belong to the interviewing outlet, so only press releases (/press/pr/) are in scope.
  "ecb-press": { text: "page", host: /(^|\.)ecb\.europa\.eu$/, allowLink: /\/press\/pr\//i },
  "ftc-press": { text: "page", host: /(^|\.)ftc\.gov$/ },
  "nist-news": { text: "page", host: /(^|\.)nist\.gov$/ },
  // APOD images and text are mostly third-party (credited photographers), so APOD is out of scope.
  "nasa-news": { text: "content", host: /(^|\.)nasa\.gov$/, skipTitle: /^APOD\b/i },
  "eu-digital": { text: "page", host: /(^|\.)europa\.eu$/ },
  // World / foreign affairs
  "uk-fcdo": { text: "page", host: /(^|\.)gov\.uk$/, allowLink: /\/government\/(news|speeches)\//i },
  "uk-pmo": { text: "page", host: /(^|\.)gov\.uk$/, allowLink: /\/government\/news\//i },
  "uk-cabinet-office": { text: "page", host: /(^|\.)gov\.uk$/, allowLink: /\/government\/(news|speeches)\//i },
  "uk-hmt": { text: "page", host: /(^|\.)gov\.uk$/, allowLink: /\/government\/(news|speeches)\//i },
  "uk-home-office": { text: "page", host: /(^|\.)gov\.uk$/, allowLink: /\/government\/(news|speeches)\//i },
  "uk-mod": { text: "page", host: /(^|\.)gov\.uk$/, allowLink: /\/government\/(news|speeches)\//i },
  "uk-dbt": { text: "page", host: /(^|\.)gov\.uk$/, allowLink: /\/government\/(news|speeches)\//i },
  "uk-dsit": { text: "page", host: /(^|\.)gov\.uk$/, allowLink: /\/government\/(news|speeches)\//i },
  "whitehouse-actions": { text: "content", host: /(^|\.)whitehouse\.gov$/ },
  "dod-news": { text: "page", host: /(^|\.)(defense|war)\.gov$/ },
  "doj-press": { text: "page", host: /(^|\.)justice\.gov$/, allowLink: /\/pr\//i },
  "fr-presdocu": { text: "page", host: /(^|\.)federalregister\.gov$/ },
  // facts-only open newsrooms (NC/ND or tip): tip page may be fetched for fact extraction only; never for the writing call
  "propublica": { text: "page", host: /(^|\.)propublica\.org$/ },
  "conversation": { text: "page", host: /(^|\.)theconversation\.com$/ },
  "globalvoices": { text: "page", host: /(^|\.)globalvoices\.org$/ },
  "democracynow": { text: "page", host: /(^|\.)democracynow\.org$/ },
};

/** Returns a reason when an item is outside what we are cleared to write about, else null. */
export function outOfScope(sourceId: string, it: FeedItem): string | null {
  const r = SOURCE_RULES[sourceId];
  if (!r) return null;
  if (r.allowLink && !r.allowLink.test(it.link)) return "not a press release";
  if (r.skipTitle?.test(it.title)) return "out of scope for this source";
  if (r.skipCategory && (it.categories || []).some((c) => r.skipCategory!.test(c.trim()))) return "routine category";
  return null;
}

const TSTOP = new Set("a an the of to in on for and or by with at from as is are was be this that its it new says said announces announced statement press release".split(" "));
export const titleTokens = (t: string) => new Set(t.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !TSTOP.has(w)));
/** Same story from two publishers (e.g. EU digital-strategy news repeating a Commission press release). */
export function similarTitle(a: Set<string>, b: Set<string>): boolean {
  if (a.size < 3 || b.size < 3) return false;
  let inter = 0; for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter) >= 0.6;
}

/** Topics that must not auto-publish: human review in /admin (status=held). */
const HOLD_RE = /\b(election|midterm|ballot|primary vote|voter suppression|electoral)\b|\b(war|warfare|combat|airstrike|air strike|missile strike|invasion|battlefield|casualties|troops killed)\b|\b(terror|terrorism|terrorist|isis|al-?qaeda|bombing)\b|\b(charg(e|ed|es)|indict(ed|ment)|allegation|alleged|arrest(ed|s)?|plea(ded)?|sentenced|convict(ed|ion)|prosecut)\b|\b(ice\b|deport(ation|ed)?|immigration enforcement|border patrol|asylum seeker|migrant detention)\b/i;

export function needsHumanReview(title: string, summary = "", sourceId = ""): string | null {
  // DOJ / ICE / DHS are enforcement-heavy: hold anything that looks like a person-case or immigration action.
  const blob = `${title}\n${summary}`;
  if (HOLD_RE.test(blob)) {
    if (/\b(election|midterm|ballot|voter)\b/i.test(blob)) return "elections";
    if (/\b(war|combat|airstrike|missile|invasion|battlefield|casualties)\b/i.test(blob)) return "armed conflict";
    if (/\b(terror|isis|al-?qaeda|bombing)\b/i.test(blob)) return "terrorism";
    if (/\b(ice\b|deport|immigration enforcement|border patrol|asylum|migrant detention)\b/i.test(blob)) return "immigration enforcement";
    return "allegations or charges against people";
  }
  if (/^(doj|ice|dhs)-/i.test(sourceId) && /\b(man|woman|suspect|defendant|inmate|parolee)\b/i.test(blob)) {
    return "allegations or charges against people";
  }
  return null;
}
