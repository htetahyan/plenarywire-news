// The 30-minute ingest + write job. Runs from the Worker cron trigger and from /admin "Run now".
// Fail-closed: anything unexpected stops the run or rejects the item; nothing half-validated is published.
import type { Env } from "@/lib/env";
import { canonicalUrl, eventFingerprint, parseFeed, sha256, htmlToText, type FeedItem } from "./feed";
import { fetchSourceText, trimForModel, USER_AGENT } from "./source-text";
import { type GeminiEndpoint } from "./gemini";
import { draftItem } from "./draft";
import { fmt } from "@/lib/format";
import { attachImage } from "./images";
import { saveTags } from "@/lib/tags";
import { outOfScope, similarTitle, titleTokens, needsHumanReview } from "./sources";
import { processFactsOnly, secondSourceAgreement, omitConflictingNumbers } from "./facts-only";
import { pickSectionBalanced } from "./fair-select";
import { articleLabelForMode } from "@/lib/licence-credit";

const LOCK_TTL_MS = 25 * 60_000;
const FIRST_SEEN_WINDOW_MS = 48 * 3600_000;
const MAX_FEED_BYTES = 3_000_000;
const MAX_ATTEMPTS = 2;
const ALLOWED_MODES = new Set(["official-rewrite", "link-and-summarise", "facts-only"]);
const BLOCKED_HOSTS = /(^|\.)reuters\.com$/i;

type LogLine = { t: string; event: string; [k: string]: unknown };
type SourceRow = { id: string; name: string; url: string; publisher: string; default_section: string; mode: string; enabled: number; etag: string | null; last_modified: string | null; body_hash: string | null; max_per_day: number | null };

export type RunResult = { runId: number | null; status: string; written: number; log: LogLine[] };

export async function runPipeline(env: Env, trigger: "cron" | "admin" | "manual"): Promise<RunResult> {
  const log: LogLine[] = [];
  const L = (event: string, data: Record<string, unknown> = {}) => { const line = { t: new Date().toISOString(), event, ...data }; log.push(line); console.log(JSON.stringify(line)); };
  if (env.PIPELINE_ENABLED !== "true") { L("pipeline.disabled"); return { runId: null, status: "skipped", written: 0, log }; }

  const holder = crypto.randomUUID();
  const now = Date.now();
  const lock = await env.DB.prepare(
    "INSERT INTO locks (name, holder, expires_at) VALUES ('pipeline', ?1, ?2) ON CONFLICT(name) DO UPDATE SET holder=excluded.holder, expires_at=excluded.expires_at WHERE locks.expires_at < ?3",
  ).bind(holder, now + LOCK_TTL_MS, now).run();
  if (!lock.meta.changes) { L("lock.busy"); return { runId: null, status: "skipped", written: 0, log }; }

  const started = new Date().toISOString();
  const runRow = await env.DB.prepare("INSERT INTO runs (trigger, started_at) VALUES (?, ?) RETURNING id").bind(trigger, started).first<{ id: number }>();
  const runId = runRow!.id;
  const stats = { feeds_checked: 0, feeds_not_modified: 0, items_new: 0, articles_written: 0, rejected: 0, model_calls: 0, tokens_in: 0, tokens_out: 0, repairs: 0, local_fixes: 0 };
  let status = "ok";
  try {
    const { results: sources } = await env.DB.prepare("SELECT * FROM sources WHERE enabled=1").all<SourceRow>();
    for (const s of sources) {
      // Fail closed on any source that is not explicitly cleared.
      const host = new URL(s.url).hostname;
      if (!ALLOWED_MODES.has(s.mode) || BLOCKED_HOSTS.test(host) || !s.url.startsWith("https://")) throw new Error(`source ${s.id} is not cleared for automated access`);
    }

    // 1) Discover
    for (const s of sources) {
      stats.feeds_checked++;
      try {
        const headers: Record<string, string> = { "user-agent": USER_AGENT, accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.5" };
        if (s.etag) headers["if-none-match"] = s.etag;
        if (s.last_modified) headers["if-modified-since"] = s.last_modified;
        // The EC press corner can take 10-20 s to answer; allow 25 s and one retry on timeout or 5xx.
        let res: Response | null = null;
        for (let attempt = 0; attempt < 2 && !res; attempt++) {
          try {
            const r = await fetch(s.url, { headers, signal: AbortSignal.timeout(25000) });
            if (r.status >= 500 && attempt === 0) { L("feed.retry", { source: s.id, status: r.status }); continue; }
            res = r;
          } catch (e) { if (attempt === 1) throw e; L("feed.retry", { source: s.id, error: String((e as Error).message || e).slice(0, 80) }); }
        }
        if (!res) throw new Error("no response after retry");
        const checked = new Date().toISOString();
        if (res.status === 304) {
          stats.feeds_not_modified++;
          await env.DB.prepare("UPDATE sources SET last_checked_at=?, last_status=304, consecutive_failures=0 WHERE id=?").bind(checked, s.id).run();
          L("feed.not_modified", { source: s.id });
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        if (xml.length > MAX_FEED_BYTES) throw new Error("feed too large");
        // Some servers ignore conditional GET: skip parsing when the body is byte-identical to the last run.
        const bodyHash = (await sha256(xml)).slice(0, 32);
        await env.DB.prepare("UPDATE sources SET etag=?, last_modified=?, body_hash=?, last_checked_at=?, last_status=?, consecutive_failures=0 WHERE id=?")
          .bind(res.headers.get("etag"), res.headers.get("last-modified"), bodyHash, checked, res.status, s.id).run();
        if (bodyHash === s.body_hash) { stats.feeds_not_modified++; L("feed.unchanged", { source: s.id }); continue; }
        const items = parseFeed(xml, 60);
        const fresh = await recordItems(env, s, items);
        stats.items_new += fresh;
        L("feed.ok", { source: s.id, items: items.length, new: fresh });
      } catch (e) {
        status = "partial";
        await env.DB.prepare("UPDATE sources SET last_checked_at=?, last_status=0, consecutive_failures=consecutive_failures+1 WHERE id=?").bind(new Date().toISOString(), s.id).run();
        L("feed.error", { source: s.id, error: String((e as Error).message || e).slice(0, 200) });
      }
    }

    // 2) Write (caps: per run and per UTC day)
    const perRun = clampInt(env.MAX_NEW_PER_RUN, 5, 0, 10);
    const perDay = clampInt(env.MAX_NEW_PER_DAY, 150, 0, 300);
    const today = new Date().toISOString().slice(0, 10);
    const writtenToday = (await env.DB.prepare("SELECT COUNT(*) AS n FROM articles WHERE published_at >= ? AND published_at < ?").bind(`${today}T00:00:00`, `${today}T23:59:59.999Z`).first<{ n: number }>())!.n;
    const budget = Math.max(0, Math.min(perRun, perDay - writtenToday));
    // Fair share: round-robin across sources (newest first within each), at most MAX_PER_SOURCE_PER_RUN per source
    // per run and sources.max_per_day per source per UTC day, inside the global per-run and per-day caps.
    const perSource = clampInt(env.MAX_PER_SOURCE_PER_RUN, 2, 1, 10);
    // Pull a wider candidate pool (per-source capped), then balance across sections so tech cannot monopolise the run.
    const candidateLimit = Math.max(budget * 6, 24);
    const { results: candidates } = budget ? await env.DB.prepare(
      `WITH today AS (SELECT source_id, COUNT(*) AS n FROM source_items WHERE status='written' AND updated_at >= ?1 GROUP BY source_id),
       ranked AS (SELECT si.*, s.publisher, s.default_section, s.mode, s.name AS source_name, COALESCE(s.max_per_day, 30) AS cap, COALESCE(t.n, 0) AS done_today,
         ROW_NUMBER() OVER (PARTITION BY si.source_id ORDER BY COALESCE(si.published_at, si.first_seen_at) DESC) AS rn
         FROM source_items si JOIN sources s ON s.id=si.source_id LEFT JOIN today t ON t.source_id=si.source_id
         WHERE si.status='pending' AND s.enabled=1)
       SELECT * FROM ranked WHERE rn <= ?2 AND rn + done_today <= cap ORDER BY rn, COALESCE(published_at, first_seen_at) DESC LIMIT ?3`,
    ).bind(`${today}T00:00:00`, perSource, candidateLimit).all<Record<string, string | number | null>>() : { results: [] as Record<string, string | number | null>[] };
    const rotate = runId + new Date().getUTCHours();
    type PendingRow = Record<string, string | number | null> & { default_section: string; mode: string };
    const ranked: PendingRow[] = candidates.map((r) => ({ ...r, default_section: String(r.default_section || "world"), mode: String(r.mode || "") }));
    const pending = pickSectionBalanced(ranked, budget, rotate);
    L("write.plan", { budget, writtenToday, candidates: candidates.length, pending: pending.length, rotate, sections: pending.map((p) => p.default_section) });

    const key = env.GEMINI_API_KEY;
    if (pending.length && !key) { L("write.skipped", { reason: "GEMINI_API_KEY secret is not set; items stay pending" }); status = status === "ok" ? "skipped" : status; }
    const endpoint = (env.GEMINI_ENDPOINT === "vertex-express" ? "vertex-express" : "gemini-api") as GeminiEndpoint;
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    let imagesLeft = clampInt(env.MAX_IMAGES_PER_RUN, 4, 0, 10);
    let held = 0;
    let skippedNoCorr = 0;

    for (const p of key ? pending : []) {
      const urlHash = String(p.url_hash);
      try {
        const payload = JSON.parse(String(p.payload || "{}")) as FeedItem;
        const mode = String(p.mode);
        const at = new Date().toISOString();
        const holdWhy = needsHumanReview(String(p.title || payload.title || ""), payload.summary || "", String(p.source_id));

        if (mode === "facts-only") {
          const fo = await processFactsOnly(env, key!, endpoint, model, {
            publisher: String(p.publisher), title: String(payload.title || p.title || ""), url: String(p.url),
            publishedAt: p.published_at as string | null, item: payload, defaultSection: String(p.default_section), sourceId: String(p.source_id),
          });
          stats.model_calls += fo.calls; stats.tokens_in += fo.usage.in; stats.tokens_out += fo.usage.out;
          if (!fo.ok) {
            skippedNoCorr++;
            await setItem(env, urlHash, "skipped", fo.reason.slice(0, 500));
            L(fo.kind === "conflict" ? "item.skipped_conflict" : fo.kind === "no-match" ? "item.skipped_no_match" : "item.skipped",
              { url: p.url, reason: fo.reason.slice(0, 160), source: p.source_id, calls: fo.calls });
            continue;
          }
          const d = fo.check.ok ? fo.check.draft : null;
          if (!d) { skippedNoCorr++; await setItem(env, urlHash, "skipped", "facts-only draft missing"); continue; }
          const slug = await uniqueSlug(env, d.slug);
          const hold = holdWhy || needsHumanReview(d.headline + " " + d.summary, d.body.join(" "), String(p.source_id));
          const artStatus = hold ? "held" : "published";
          const via = fo.primary?.via || "outlet-pair";
          const srcPub = fo.primary?.primaryPublisher || String(p.publisher);
          const srcUrl = fo.primary?.primaryUrl || String(p.url);
          const srcTitle = fo.primary?.primaryTitle || String(payload.title || p.title || "");
          const note = hold
            ? `Held for human review (${hold}). ${fo.credit}; via ${via}.`
            : `${fo.credit}. Corroborated via ${via}.`;
          const art = await env.DB.prepare(
            `INSERT INTO articles (slug, section, type, status, label, headline, meta_description, summary, key_points, body, source_name, source_publisher, source_url, source_title, source_published_at, model, published_at, updated_at, changelog, alt_headline, keywords, entities)
             VALUES (?, ?, 'article', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          ).bind(slug, d.section, artStatus, articleLabelForMode("facts-only"), d.headline, d.metaDescription, d.summary, JSON.stringify(d.keyPoints), JSON.stringify(d.body),
            srcPub, srcPub, srcUrl, srcTitle, p.published_at, model, at, at,
            JSON.stringify([{ at, note }, { at, note: `${fo.credit}: ${String(p.url)}` }]),
            d.alternativeHeadline || null, JSON.stringify(d.keywords), JSON.stringify(d.entities),
          ).first<{ id: number }>();
          await saveTags(env, art!.id, d.keywords, d.entities);
          await env.DB.prepare("UPDATE source_items SET status='written', article_id=?, attempts=attempts+1, updated_at=? WHERE url_hash=?").bind(art!.id, at, urlHash).run();
          if (hold) { held++; L("item.held", { slug, reason: hold, source: p.source_id, mode: "facts-only" }); }
          else { stats.articles_written++; L("item.written", { slug, section: d.section, source: p.source_id, mode: "facts-only", via, facts: fo.confirmed.length, matched: fo.matched, tokens: fo.tokensPerArticle }); }
          continue;
        }

        const src = await fetchSourceText(String(p.source_id), payload);
        const text = trimForModel(src.text);
        if (text.length < 250) { await setItem(env, urlHash, "skipped", "source text too short to write from"); L("item.skipped", { url: p.url, reason: "short" }); continue; }
        const pubHuman = p.published_at ? fmt(String(p.published_at)).replace(/, \d\d:\d\d UTC$/, "") + " " + new Date(String(p.published_at)).toUTCString() : "";
        const dr = await draftItem(key!, endpoint, model, { publisher: String(p.publisher), title: src.title, url: String(p.url), publishedAt: p.published_at as string | null, text, defaultSection: String(p.default_section), extraFacts: pubHuman });
        stats.model_calls += dr.calls; stats.tokens_in += dr.usage.in; stats.tokens_out += dr.usage.out;
        if (dr.repaired) stats.repairs++;
        if (dr.localFixes.length) stats.local_fixes++;
        L("item.drafted", { url: p.url, words: text.split(/\s+/).length, calls: dr.calls, tokens_in: dr.usage.in, tokens_out: dr.usage.out, fixes: dr.localFixes });
        const check = dr.check;
        if (!check.ok) {
          stats.rejected++;
          const attempts = Number(p.attempts) + 1;
          await env.DB.prepare("UPDATE source_items SET attempts=?, status=?, last_error=?, updated_at=? WHERE url_hash=?")
            .bind(attempts, attempts >= MAX_ATTEMPTS ? "rejected" : "pending", check.reasons.join("; ").slice(0, 500), new Date().toISOString(), urlHash).run();
          L("item.rejected", { url: p.url, reasons: check.reasons.slice(0, 6) });
          continue;
        }
        let d = check.draft;
        // Cheap second-source agreement: omit numbers that appear only in this release when an independent peer conflicts.
        const peerAgg = await secondSourceAgreement(env, src.title, String(p.publisher), String(p.url), p.published_at as string | null, text);
        if (peerAgg.peer) {
          const joined = [d.headline, d.summary, ...d.keyPoints, ...d.body].join("\n");
          const { cleaned, omitted } = omitConflictingNumbers(joined, text, peerAgg.peer.text);
          if (omitted.length) {
            // Re-split roughly: keep headline/summary; filter body lines that lost all substance.
            L("item.peer_agreement", { url: p.url, peer: peerAgg.peer.publisher, omitted });
            d = { ...d, body: d.body.map((para) => omitConflictingNumbers(para, text, peerAgg.peer!.text).cleaned).filter((para) => para.length > 40) };
            if (d.body.length < 2) d = check.draft; // revert if we gutted the piece
          }
        }
        const slug = await uniqueSlug(env, d.slug);
        const hold = holdWhy || needsHumanReview(d.headline + " " + d.summary, d.body.join(" "), String(p.source_id));
        const artStatus = hold ? "held" : "published";
        const note = hold
          ? `Held for human review (${hold}). Source: ${p.publisher}.`
          : `Published from ${p.publisher}${peerAgg.peer ? `; also checked against ${peerAgg.peer.publisher}` : ""}.`;
        const art = await env.DB.prepare(
          `INSERT INTO articles (slug, section, type, status, label, headline, meta_description, summary, key_points, body, source_name, source_publisher, source_url, source_title, source_published_at, model, published_at, updated_at, changelog, alt_headline, keywords, entities)
           VALUES (?, ?, 'article', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        ).bind(slug, d.section, artStatus, articleLabelForMode(String(p.mode || "official-rewrite")), d.headline, d.metaDescription, d.summary, JSON.stringify(d.keyPoints), JSON.stringify(d.body), String(p.source_name), String(p.publisher), String(p.url), src.title, p.published_at, model, at, at,
          JSON.stringify([{ at, note }]),
          d.alternativeHeadline || null, JSON.stringify(d.keywords), JSON.stringify(d.entities),
        ).first<{ id: number }>();
        await saveTags(env, art!.id, d.keywords, d.entities);
        await env.DB.prepare("UPDATE source_items SET status='written', article_id=?, attempts=attempts+1, updated_at=? WHERE url_hash=?").bind(art!.id, at, urlHash).run();
        if (hold) { held++; L("item.held", { slug, reason: hold, source: p.source_id }); }
        else {
          stats.articles_written++;
          L("item.written", { slug, section: d.section, source: p.source_id });
          if (imagesLeft > 0) {
            imagesLeft--;
            const im = await attachImage(env, art!.id, String(p.source_id), payload, src.title, src.meta);
            L(im.ok ? "image.attached" : "image.none", { slug, why: im.why, credit: im.credit });
          }
        }
      } catch (e) {
        status = "partial";
        const msg = String((e as Error).message || e).slice(0, 300);
        const attempts = Number(p.attempts) + 1;
        await env.DB.prepare("UPDATE source_items SET attempts=?, status=?, last_error=?, updated_at=? WHERE url_hash=?")
          .bind(attempts, attempts >= MAX_ATTEMPTS + 1 ? "failed" : "pending", msg, new Date().toISOString(), urlHash).run();
        L("item.error", { url: p.url, error: msg });
        if (/gemini: HTTP (401|403|429)/.test(msg)) { L("write.stopped", { reason: "model auth or quota error" }); break; }
      }
    }
    if (held) L("write.held", { held });
    if (skippedNoCorr) L("write.skipped_no_corroboration", { skippedNoCorr });
  } catch (e) {
    status = "error";
    L("run.error", { error: String((e as Error).message || e).slice(0, 300) });
  } finally {
    // One round trip: finish the run row, release the lock, keep run history bounded.
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE runs SET finished_at=?, status=?, feeds_checked=?, feeds_not_modified=?, items_new=?, articles_written=?, rejected=?, model_calls=?, tokens_in=?, tokens_out=?, log=? WHERE id=?",
      ).bind(new Date().toISOString(), status, stats.feeds_checked, stats.feeds_not_modified, stats.items_new, stats.articles_written, stats.rejected, stats.model_calls, stats.tokens_in, stats.tokens_out, JSON.stringify(log).slice(0, 60000), runId),
      env.DB.prepare("DELETE FROM locks WHERE name='pipeline' AND holder=?").bind(holder),
      env.DB.prepare("DELETE FROM runs WHERE id < ? - 2000").bind(runId),
    ]);
  }
  return { runId, status, written: stats.articles_written, log };

}

function clampInt(v: string | undefined, d: number, lo: number, hi: number) { const n = parseInt(v ?? "", 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; }

async function setItem(env: Env, urlHash: string, status: string, err: string | null) {
  await env.DB.prepare("UPDATE source_items SET status=?, last_error=?, updated_at=? WHERE url_hash=?").bind(status, err, new Date().toISOString(), urlHash).run();
}

async function uniqueSlug(env: Env, base: string) {
  let slug = base, n = 2;
  while (await env.DB.prepare("SELECT 1 FROM articles WHERE slug=?").bind(slug).first()) slug = `${base}-${n++}`;
  return slug;
}

/** Records new feed items; returns how many were queued for writing. One indexed lookup per feed, not per item. */
async function recordItems(env: Env, s: SourceRow, items: FeedItem[]): Promise<number> {
  const rows: { it: FeedItem; url: string; urlHash: string; contentHash: string }[] = [];
  for (const it of items) {
    const url = canonicalUrl(it.link);
    if (!url || BLOCKED_HOSTS.test(new URL(url).hostname)) continue;
    const text = it.contentHtml ? htmlToText(it.contentHtml) : it.summary;
    rows.push({ it, url, urlHash: (await sha256(url)).slice(0, 32), contentHash: (await sha256(`${it.title}\n${text}`)).slice(0, 32) });
  }
  if (!rows.length) return 0;
  const known = new Map<string, string>();
  for (let i = 0; i < rows.length; i += 90) {
    const chunk = rows.slice(i, i + 90);
    const { results } = await env.DB.prepare(`SELECT url_hash, content_hash FROM source_items WHERE url_hash IN (${chunk.map(() => "?").join(",")})`).bind(...chunk.map((r) => r.urlHash)).all<{ url_hash: string; content_hash: string }>();
    for (const r of results) known.set(r.url_hash, r.content_hash);
  }
  const nowIso = new Date().toISOString();
  let fresh = 0;
  let recent: Set<string>[] | null = null;
  const recentTitles = async () => recent ??= (await env.DB.prepare("SELECT title FROM source_items WHERE first_seen_at >= ? AND source_id <> ?").bind(new Date(Date.now() - 3 * 86400_000).toISOString(), s.id).all<{ title: string }>()).results.map((x) => titleTokens(x.title));
  for (const r of rows) {
    if (known.has(r.urlHash)) {
      if (known.get(r.urlHash) !== r.contentHash) await env.DB.prepare("UPDATE source_items SET content_hash=?, updated_at=? WHERE url_hash=?").bind(r.contentHash, nowIso, r.urlHash).run();
      continue;
    }
    fresh += (await recordNew(env, s, r.it, r.urlHash, r.contentHash, nowIso, recentTitles)) ? 1 : 0;
  }
  return fresh;
}

async function recordNew(env: Env, s: SourceRow, it: FeedItem, urlHash: string, contentHash: string, nowIso: string, recentTitles: () => Promise<Set<string>[]>): Promise<boolean> {
  const pub = it.pubDate && !isNaN(Date.parse(it.pubDate)) ? new Date(it.pubDate).toISOString() : null;
  // Fingerprint is per-source so two independent outlets on the same event both stay available for corroboration.
  const fp = (await eventFingerprint(it.title, pub)) + ":" + s.id;
  let status = "pending", reason: string | null = null;
  const scope = outOfScope(s.id, it);
  if (scope) { status = "skipped"; reason = scope; }
  else if (/^daily news \d/i.test(it.title)) { status = "skipped"; reason = "multi-topic digest"; }
  else if (pub && Date.now() - Date.parse(pub) > FIRST_SEEN_WINDOW_MS) { status = "skipped"; reason = "older than 48h when first seen"; }
  else if (await env.DB.prepare("SELECT 1 FROM source_items WHERE fingerprint=?").bind(fp).first()) { status = "skipped"; reason = "duplicate event fingerprint"; }
  else if (s.mode === "official-rewrite") {
    // Official feeds still skip cross-source duplicates at discovery (one article per event from primary).
    // Tip/facts-only feeds keep siblings so corroboration can compare two outlets.
    const tt = titleTokens(it.title);
    if ((await recentTitles()).some((x) => similarTitle(tt, x))) { status = "skipped"; reason = "same story from another source"; }
  }
  const payload = JSON.stringify({ ...it, contentHtml: it.contentHtml.slice(0, 60000) });
  const r = await env.DB.prepare(
    "INSERT OR IGNORE INTO source_items (url_hash, source_id, url, title, published_at, content_hash, fingerprint, payload, status, last_error, first_seen_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(urlHash, s.id, it.link, it.title.slice(0, 400), pub, contentHash, fp, status === "pending" ? payload : null, status, reason, nowIso, nowIso).run();
  return !!r.meta.changes && status === "pending";
}
