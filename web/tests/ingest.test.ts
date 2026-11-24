import { seoFields } from "../src/ingest/validate";
import { tagsFor } from "../src/lib/tags";
import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalUrl, parseFeed, slugify, htmlToText } from "../src/ingest/feed";
import { validateDraft, trimMeta } from "../src/ingest/validate";

const SRC = "Today, I begin a visit to the Black Sea region, where security threats are escalating. In Romania and Bulgaria, I will meet with leaders. Freedom of navigation in the Black Sea must be restored and preserved. The EU will provide 250 million euros in support. Published 9 November 2026";
const good = {
  headline: "Von der Leyen heads to Romania and Bulgaria as Black Sea threats grow",
  metaDescription: "",
  summary: "Commission President von der Leyen said she is visiting Romania and Bulgaria to discuss rising security threats in the Black Sea region.",
  keyPoints: ["She will meet leaders in Romania and Bulgaria.", "She said navigation in the Black Sea must be restored."],
  body: ["The Commission President said she would travel to the region to discuss the situation.", "She said the EU will provide 250 million euros, according to the statement."],
  section: "eu-politics", slug: "von-der-leyen-black-sea-visit",
};
good.metaDescription = "Commission President von der Leyen begins a visit to Romania and Bulgaria to discuss escalating security threats and navigation in the Black Sea region.".padEnd(152, ".");

test("valid draft passes", () => { const r = validateDraft(good, SRC, "Statement by President von der Leyen"); assert.equal(r.ok, true, JSON.stringify(r)); });
test("invented number is rejected", () => { const r = validateDraft({ ...good, body: [...good.body, "Officials said 900 people attended."] }, SRC, "Statement by President von der Leyen"); assert.equal(r.ok, false); });
test("invented quote is rejected", () => { const r = validateDraft({ ...good, body: [...good.body, 'She said "we will never surrender to anyone at all".'] }, SRC, "Statement by President von der Leyen"); assert.equal(r.ok, false); });
test("exact quote is allowed", () => { const r = validateDraft({ ...good, body: [...good.body, 'She said "Freedom of navigation in the Black Sea must be restored".'] }, SRC, "Statement by President von der Leyen"); assert.equal(r.ok, true, JSON.stringify(r)); });
test("meta outside 150-160 is rejected", () => { const r = validateDraft({ ...good, metaDescription: "Too short." }, SRC, "Statement by President von der Leyen"); assert.equal(r.ok, false); });
test("unknown section is rejected", () => { const r = validateDraft({ ...good, section: "sport" }, SRC, "Statement by President von der Leyen"); assert.equal(r.ok, false); });
test("non-object output is rejected", () => { assert.equal(validateDraft("nope", SRC, "x").ok, false); });
test("canonicalUrl strips tracking", () => { assert.equal(canonicalUrl("https://www.Example.com/a/?utm_source=x&b=1#h"), "https://example.com/a?b=1"); });
test("slugify", () => { assert.equal(slugify("Von der Leyen: Black Sea — visit!"), "von-der-leyen-black-sea-visit"); });
test("parseFeed reads RSS items with content:encoded", () => {
  const xml = `<rss><channel><item><title>A &amp; B</title><link>https://x.gov/a/</link><pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Hi</p>]]></description><content:encoded><![CDATA[<p>Full text</p>]]></content:encoded></item></channel></rss>`;
  const [it] = parseFeed(xml);
  assert.equal(it.title, "A & B"); assert.equal(it.link, "https://x.gov/a/"); assert.equal(htmlToText(it.contentHtml), "Full text");
});
test("name not in source is rejected", () => { const r = validateDraft({ ...good, summary: good.summary.replace("President von", "President Ursula von") }, SRC, "Statement by President von der Leyen"); assert.equal(r.ok, false); assert.match(JSON.stringify(r), /Ursula/); });
test("trimMeta cuts a long meta to 150-160 at a word boundary", () => { const m = trimMeta("European Commission President von der Leyen announces a visit to Romania and Bulgaria to discuss security threats after speaking with the president of Ukraine today and more"); assert.ok(m && m.length >= 150 && m.length <= 160 && m.endsWith("."), String(m)); });
test("trimMeta refuses a short meta", () => { assert.equal(trimMeta("Too short for a meta description."), null); });
test("names guard handles accented names present in the source", () => { const r = validateDraft({ ...good, body: [...good.body, "She also mentioned Türkiye."] }, SRC + " Türkiye.", "Statement by President von der Leyen"); assert.equal(r.ok, true, JSON.stringify(r)); });
test("seo fields keep only source-backed keywords and entities", () => {
  const f = seoFields({ keywords: ["Eurogroup", "Invented Summit", "fiscal rules"], entities: [{ name: "Valdis Dombrovskis", type: "Person" }, { name: "Atlantis", type: "Place" }, { name: "Eurogroup", type: "Bogus" }], alternativeHeadline: "Dombrovskis tells the Eurogroup that fiscal rules must be applied in full" }, "Valdis Dombrovskis spoke at the Eurogroup about fiscal rules.", "Headline");
  assert.deepEqual(f.keywords, ["Eurogroup", "fiscal rules"]);
  assert.deepEqual(f.entities, [{ name: "Valdis Dombrovskis", type: "Person" }]);
  assert.ok(f.alternativeHeadline.length > 40);
});
test("tags are slugged and deduped", () => {
  assert.deepEqual(tagsFor(["Türkiye", "turkiye"], [{ name: "European Commission", type: "Organization" }]).map((t) => t.tag), ["european-commission", "turkiye"]);
});

// Public pages carry no AI-related wording unless config/brand.json `aiDisclosure` is set.
import { BYLINE, DISCLOSURE } from "../src/lib/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const AI_RE = /\bAI\b|artificial intelligence|Gemini|model-written|AI-assisted/i;
test("byline and disclosure flag: no AI wording by default", () => {
  assert.equal(DISCLOSURE, "");
  assert.ok(!AI_RE.test(BYLINE), BYLINE);
});
test("public page sources contain no AI wording (admin excluded)", () => {
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  const files = [...walk("src/app"), ...walk("src/components"), "client/app.js"].filter((f) => /\.(tsx?|js)$/.test(f) && !/[\\/]admin[\\/]|[\\/]api[\\/]/.test(f));
  const hits = files.filter((f) => AI_RE.test(readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
  assert.deepEqual(hits, []);
});

// Efficiency pass: smaller model input, local fixes instead of extra model calls.
import { trimForModel } from "../src/ingest/source-text";
import { localFix, sentenceCase, FACTUAL } from "../src/ingest/draft";
test("trimForModel drops contact boilerplate and caps words", () => {
  const t = trimForModel("Para one about the summit.\nShare\nPara two with 3 numbers.\nPress contacts:\nJane Doe +32 2 299 00 00\njane@ec.europa.eu");
  assert.equal(t, "Para one about the summit.\nPara two with 3 numbers.");
  const long = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} ` + "word ".repeat(60)).join("\n");
  assert.ok(trimForModel(long).split(/\s+/).length <= 1500);
});
test("sentenceCase keeps source capitalisation for names", () => {
  const src = "the European Commission said on Monday that Ursula von der Leyen will travel to Romania.";
  assert.equal(sentenceCase("Von Der Leyen Says European Commission Will Boost Black Sea Security", src), "Von der Leyen says European Commission will boost black sea security");
});
test("localFix repairs meta length and section without a model call", () => {
  const d = { headline: "Commission proposes new rules to protect Black Sea shipping", alternativeHeadline: "", metaDescription: "Too short.", summary: "The European Commission proposed new rules on Monday to protect shipping routes in the Black Sea region, citing escalating security threats to trade and navigation.", keyPoints: ["The proposal covers shipping.", "It cites security threats."], body: ["a", "b"], section: "nope", slug: "commission-black-sea-rules", keywords: [], entities: [] };
  const { draft, fixes } = localFix(d, "", "eu-politics");
  assert.ok(draft.metaDescription.length >= 150 && draft.metaDescription.length <= 160, draft.metaDescription);
  assert.equal(draft.section, "eu-politics");
  assert.ok(fixes.includes("meta trimmed locally"));
  assert.ok(FACTUAL.test("number not in source: 7") && !FACTUAL.test("meta length 120"));
});
import { fitMeta } from "../src/ingest/validate";
test("fitMeta prefers whole sentences and never ends on a stop word or name", () => {
  const s1 = "The White House released a presidential message celebrating Diwali, highlighting the Festival of Lights as a time of hope.";
  assert.equal(fitMeta([s1, `${s1} The message wishes Americans who celebrate a happy and safe holiday.`]), null);
  const s2 = "The White House said the message marks Diwali for Americans.";
  const ok = fitMeta([s1, s2.replace("for Americans", "for millions of Americans")]);
  assert.ok(!ok || (ok.length >= 150 && ok.length <= 160), String(ok));
  const w = fitMeta(["Attorney General Todd Blanche defended the executive branch during Sunday talk show appearances, arguing that Democratic oversight plans amount to political retribution against the administration."]);
  assert.ok(!w || !/(political|the|President)\.$/.test(w), String(w));
});

// New official sources: scope rules, cross-source dedupe, page text, NASA-only image credits.
import { outOfScope, similarTitle, titleTokens } from "../src/ingest/sources";
import { pageParagraphs } from "../src/ingest/source-text";
import { nasaFigure } from "../src/ingest/images";
test("source scope rules", () => {
  const it = (o: Partial<{ title: string; link: string; categories: string[] }>) => ({ title: "T", link: "https://x/", guid: "", pubDate: "", summary: "", contentHtml: "", ...o });
  assert.equal(outOfScope("ecb-press", it({ link: "https://www.ecb.europa.eu//press/inter/date/2026/html/x.en.html" })), "not a press release");
  assert.equal(outOfScope("ecb-press", it({ link: "https://www.ecb.europa.eu//press/pr/date/2026/html/x.en.html" })), null);
  assert.ok(outOfScope("nasa-news", it({ title: "APOD: 2026 November 9 – Rigel" })));
  assert.ok(outOfScope("fed-press", it({ categories: ["Enforcement Actions"] })));
  assert.equal(outOfScope("fed-press", it({ categories: ["Monetary Policy"] })), null);
});
test("similarTitle catches the same story from two publishers", () => {
  assert.ok(similarTitle(titleTokens("Commission preliminarily finds TikTok's 'For You' feed in breach of Digital Services Act"), titleTokens("Commission preliminarily finds TikTok For You feed in breach of the Digital Services Act for rabbit holes")));
  assert.ok(!similarTitle(titleTokens("Federal Reserve issues FOMC statement"), titleTokens("ECB publishes supervisory banking statistics")));
});
test("pageParagraphs keeps article paragraphs only", () => {
  const html = `<nav><p>Menu item that is long enough to count</p></nav><h1>Title</h1><p>The Commission said on Monday that it will act.</p><script>x</script><p>Second paragraph with enough words.</p><footer><p>Footer paragraph that should be ignored</p></footer>`;
  assert.equal(pageParagraphs(html), "The Commission said on Monday that it will act.\nSecond paragraph with enough words.");
});
test("nasaFigure accepts NASA credits only", () => {
  const fig = (credit: string) => `<figure><img src="https://www.nasa.gov/wp-content/uploads/a.jpg?w=2048" srcset="https://www.nasa.gov/wp-content/uploads/a.jpg?resize=1200,800 1200w, https://www.nasa.gov/wp-content/uploads/a.jpg?resize=300,200 300w" alt="Crew"></figure><figcaption><div>Caption.</div><div class="hds-credits">${credit}</div></figcaption>`;
  assert.equal(nasaFigure(fig("NASA/James Blair"), "https://www.nasa.gov/x/", "t")?.src, "https://www.nasa.gov/wp-content/uploads/a.jpg?resize=1200,800");
  assert.ok(nasaFigure(fig("Credit: NASA"), "u", "t"));
  assert.equal(nasaFigure(fig("NASA, ESA, and J. Smith (STScI)"), "u", "t"), null);
  assert.equal(nasaFigure(fig("SpaceX"), "u", "t"), null);
});

import { needsHumanReview } from "../src/ingest/sources";
test("parseFeed reads Atom entries (GOV.UK-style)", () => {
  const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Joint statement on Chad</title><link href="https://www.gov.uk/government/news/joint-statement-on-chad" rel="alternate"/><id>tag:gov.uk,2026:a</id><updated>2026-11-09T10:00:00+00:00</updated><summary>Official statement.</summary></entry></feed>`;
  const [it] = parseFeed(xml);
  assert.equal(it.title, "Joint statement on Chad");
  assert.equal(it.link, "https://www.gov.uk/government/news/joint-statement-on-chad");
  assert.ok(it.pubDate.startsWith("2026-11-09"));
});
test("needsHumanReview holds charges and immigration", () => {
  assert.equal(needsHumanReview("Man charged with fraud in Ohio"), "allegations or charges against people");
  assert.equal(needsHumanReview("ICE announces new deportation flights"), "immigration enforcement");
  assert.equal(needsHumanReview("FCDO announces new ambassador to Chad"), null);
});

import { copiedFromForbidden } from "../src/ingest/validate";
import { extractPrimaryUrls, confirmedFacts, agreeFacts, isSyndicatedCopy, eventMatchScore, withinEventWindow, findNumberConflicts } from "../src/ingest/facts-only";
test("copiedFromForbidden catches 8-word runs from a tip outlet", () => {
  const tip = "The agency announced a sweeping new rule that will reshape how hospitals bill patients for emergency care nationwide starting next year.";
  const ok = "Officials said hospitals must change emergency billing under a new federal rule next year.";
  const bad = "The agency announced a sweeping new rule that will reshape how hospitals bill patients for emergency care nationwide starting next year and more.";
  assert.equal(copiedFromForbidden(ok, tip, 8), null);
  assert.ok(copiedFromForbidden(bad, tip, 8));
});
test("extractPrimaryUrls keeps only official hosts", () => {
  const urls = extractPrimaryUrls('See https://www.justice.gov/opa/pr/example and https://www.propublica.org/article/x and https://www.gov.uk/government/news/y');
  assert.ok(urls.some((u) => u.includes("justice.gov")));
  assert.ok(urls.some((u) => u.includes("gov.uk")));
  assert.ok(!urls.some((u) => u.includes("propublica.org")));
});
test("confirmedFacts drops claims absent from the primary", () => {
  const primary = "The Department of Justice charged Jane Doe with wire fraud on 9 November 2026 in Ohio.";
  const keep = confirmedFacts([
    "The Department of Justice charged Jane Doe with wire fraud in Ohio.",
    "Officials said Mars has new oceans according to a private think tank.",
  ], primary);
  assert.equal(keep.length, 1);
  assert.match(keep[0], /Jane Doe/);
});

test("agreeFacts keeps shared facts and drops number conflicts", () => {
  const a = [
    "The Department of Justice charged Jane Doe with wire fraud in Ohio.",
    "Prosecutors said losses totaled 3 million dollars.",
  ];
  const b = [
    "Justice Department charged Jane Doe with wire fraud in Ohio courts.",
    "Prosecutors said losses totaled 5 million dollars.",
  ];
  const r = agreeFacts(a, b);
  assert.ok(r.agreed.some((f) => /Jane Doe/.test(f)));
  assert.ok(r.conflicts.length >= 1);
  assert.ok(!r.agreed.some((f) => /3 million|5 million/.test(f)));
});
test("isSyndicatedCopy detects shared long runs; independent outlets differ", () => {
  const wire = "Alpha agency announced a sweeping new environmental rule that will reshape how factories report emissions across every state starting next summer according to officials.";
  assert.ok(isSyndicatedCopy(wire, wire + " Extra sentence at the end."));
  assert.ok(!isSyndicatedCopy(wire, "Officials in Ohio said factories must file new emission reports under a separate state law."));
});
test("eventMatchScore and time window for same-event matching", () => {
  assert.ok(eventMatchScore("UK and Finland condemn Novaya Gazeta closure in Russia", "Britain and Finland condemn closure of Novaya Gazeta") >= 1);
  assert.equal(eventMatchScore("Federal Reserve raises rates", "NASA launches Artemis rocket"), 0);
  assert.ok(withinEventWindow("2026-11-09T10:00:00Z", "2026-11-10T12:00:00Z"));
  assert.ok(!withinEventWindow("2026-11-01T10:00:00Z", "2026-11-09T12:00:00Z"));
});
test("findNumberConflicts flags same-unit disagreements", () => {
  const c = findNumberConflicts("Losses totaled 3 million dollars.", "Losses totaled 5 million dollars.");
  assert.ok(c.some((x) => /3 vs 5 million/.test(x)));
  assert.deepEqual(findNumberConflicts("Losses totaled 3 million dollars.", "The case was filed in Ohio."), []);
});

import { pickSectionBalanced, SECTION_ROTATION } from "../src/ingest/fair-select";
test("pickSectionBalanced rotates sections so tech cannot fill the whole budget", () => {
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => ({ default_section: "tech", mode: "official-rewrite", published_at: `2026-11-09T1${i}:00:00Z`, id: `t${i}` })),
    { default_section: "us-politics", mode: "official-rewrite", published_at: "2026-11-09T12:00:00Z", id: "us1" },
    { default_section: "eu-politics", mode: "official-rewrite", published_at: "2026-11-09T12:00:00Z", id: "eu1" },
    { default_section: "world", mode: "official-rewrite", published_at: "2026-11-09T12:00:00Z", id: "w1" },
  ];
  const picked = pickSectionBalanced(rows, 5, 0);
  assert.equal(picked.length, 5);
  const secs = picked.map((r) => r.default_section);
  assert.ok(secs.includes("us-politics") && secs.includes("eu-politics") && secs.includes("world"));
  assert.ok(secs.filter((s) => s === "tech").length <= 2);
});
test("pickSectionBalanced prefers official-rewrite over facts-only in a section", () => {
  const rows = [
    { default_section: "world", mode: "facts-only", published_at: "2026-11-09T18:00:00Z", id: "tip" },
    { default_section: "world", mode: "official-rewrite", published_at: "2026-11-09T17:00:00Z", id: "off" },
  ];
  const picked = pickSectionBalanced(rows, 1, 0);
  assert.equal((picked[0] as { id: string }).id, "off");
});
test("SECTION_ROTATION lists politics before tech", () => {
  assert.ok(SECTION_ROTATION.indexOf("us-politics") < SECTION_ROTATION.indexOf("tech"));
});

import { articleLabelForMode, sourceTypeLabel, textLicenceCredit } from "../src/lib/licence-credit";
test("article labels distinguish official and tip outlets", () => {
  assert.equal(articleLabelForMode("official-rewrite"), "Official source");
  assert.equal(articleLabelForMode("facts-only"), "Reporting credit");
  assert.equal(sourceTypeLabel({ sourceId: "propublica", mode: "facts-only", publisher: "ProPublica", licenceUrl: null, licenceNote: null }), "Source");
  const ogl = textLicenceCredit({ sourceId: "uk-fcdo", mode: "official-rewrite", publisher: "UK FCDO", licenceUrl: "https://example", licenceNote: "OGL v3.0" });
  assert.ok(ogl && /Open Government Licence v3\.0/.test(ogl.text));
});
