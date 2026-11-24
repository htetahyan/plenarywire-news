// Honest story labels, derived only from the source document itself (never from the model):
// the document type in the official URL, and "Breaking" only when we published within 90 minutes of the
// source and the story is less than 3 hours old. We never label anything "Analysis" or "Explainer",
// because every story is a summary of one official document, not analysis.
import type { Article } from "./db";

const TYPES: [RegExp, string][] = [
  [/presscorner\/detail\/[a-z]{2}\/ip_/i, "Press release"], [/presscorner\/detail\/[a-z]{2}\/statement_/i, "Statement"],
  [/presscorner\/detail\/[a-z]{2}\/speech_/i, "Speech"], [/presscorner\/detail\/[a-z]{2}\/qanda_/i, "Q&A"],
  [/presscorner\/detail\/[a-z]{2}\/(ac|mex)_/i, "Announcement"],
  [/whitehouse\.gov\/(briefings-statements)\//i, "Statement"], [/whitehouse\.gov\/releases\//i, "Release"],
  [/whitehouse\.gov\/presidential-actions\//i, "Presidential action"], [/whitehouse\.gov\/remarks\//i, "Remarks"],
  [/whitehouse\.gov\/fact-sheets\//i, "Fact sheet"],
];

export function docType(url: string): string {
  return TYPES.find(([re]) => re.test(url))?.[1] ?? "Official source";
}

export function isBreaking(a: Pick<Article, "publishedAt" | "source">, now = Date.now()): boolean {
  const src = a.source.publishedAt ? Date.parse(a.source.publishedAt) : NaN;
  const pub = Date.parse(a.publishedAt);
  return Number.isFinite(src) && pub - src <= 90 * 60_000 && now - pub < 3 * 3600_000;
}
