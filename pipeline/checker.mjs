#!/usr/bin/env node
// PlenaryWire — 30-minute source checker, DRY-RUN / DRAFT-ONLY.
// There is no publish code path. No cron or schedule is created by this repo.
// Usage: node pipeline/checker.mjs [--config pipeline/config.json] [--sources pipeline/sources.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalUrl, eventFingerprint, parseFeed, sha256, slugify, estimateTokens } from './lib.mjs';
import { getProvider } from './providers/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const log = (event, data = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), event, ...data }));

class FailClosed extends Error {}

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJsonAtomic(p, obj) {
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function validate(cfg, sources) {
  if (cfg.dryRun !== true || cfg.draftOnly !== true) throw new FailClosed('config must have dryRun:true and draftOnly:true; publishing is not approved');
  for (const k of ['maxCandidatesPerRun', 'maxModelCallsPerRun', 'maxTokensPerRun', 'maxFeedBytes', 'requestTimeoutMs', 'maxRetries', 'backoffBaseSeconds', 'backoffMaxSeconds', 'lockStaleMinutes'])
    if (!Number.isFinite(cfg[k]) || cfg[k] < 0) throw new FailClosed(`invalid cap/config value: ${k}`);
  if (cfg.maxRetries > 5) throw new FailClosed('maxRetries must be <= 5 (bounded backoff)');
  const ids = new Set();
  for (const s of sources) {
    if (!s.id || ids.has(s.id)) throw new FailClosed(`duplicate or missing source id: ${s.id}`);
    ids.add(s.id);
    if (!s.enabled) continue;
    if (s.mode === 'not-cleared' || s.rights === 'not-cleared') throw new FailClosed(`source ${s.id} is not cleared but enabled`);
    if (s.automatedAccess === false) throw new FailClosed(`source ${s.id} forbids automated access but is enabled`);
    if (/(^|\.)reuters\.com$/i.test(new URL(s.url).hostname)) throw new FailClosed('automated access to reuters.com is not permitted');
    if (new URL(s.url).protocol !== 'https:') throw new FailClosed(`source ${s.id} must use https`);
  }
}

function acquireLock(lockPath, staleMin) {
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    fs.closeSync(fd);
    return true;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let info = {};
    try { info = loadJson(lockPath); } catch {}
    const age = (Date.now() - Date.parse(info.at || 0)) / 60000;
    let alive = false;
    try { if (info.pid) { process.kill(info.pid, 0); alive = true; } } catch {}
    if (!alive && age > staleMin) {
      log('lock.stale_removed', { pid: info.pid, ageMinutes: Math.round(age) });
      fs.rmSync(lockPath, { force: true });
      return acquireLock(lockPath, staleMin);
    }
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchFeed(src, st, cfg) {
  const headers = { 'user-agent': cfg.userAgent, accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5' };
  if (st.etag) headers['if-none-match'] = st.etag;
  if (st.lastModified) headers['if-modified-since'] = st.lastModified;
  let lastErr;
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    if (attempt) await sleep(Math.min(1000 * 2 ** attempt, 8000)); // bounded in-run retry backoff
    try {
      const res = await fetch(src.url, { headers, redirect: 'follow', signal: AbortSignal.timeout(cfg.requestTimeoutMs) });
      if (res.status === 304) return { status: 304 };
      if (res.status === 429 || res.status >= 500) { lastErr = new Error(`HTTP ${res.status}`); continue; }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      const len = Number(res.headers.get('content-length') || 0);
      if (len > cfg.maxFeedBytes) throw Object.assign(new Error('feed exceeds maxFeedBytes'), { fatal: true });
      const body = await res.text();
      if (body.length > cfg.maxFeedBytes) throw Object.assign(new Error('feed exceeds maxFeedBytes'), { fatal: true });
      return { status: res.status, body, etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') };
    } catch (e) {
      lastErr = e;
      if (e.fatal) break;
    }
  }
  throw lastErr;
}

async function main() {
  const cfgPath = path.resolve(ROOT, arg('--config', 'pipeline/config.json'));
  const srcPath = path.resolve(ROOT, arg('--sources', 'pipeline/sources.json'));
  const cfg = loadJson(cfgPath);
  const sources = loadJson(srcPath).sources;
  validate(cfg, sources);
  let provider;
  try { provider = getProvider(cfg.provider); } catch (e) { throw new FailClosed(e.message); } // only stub/noop exist

  const stateDir = path.resolve(ROOT, cfg.stateDir);
  const draftsDir = path.resolve(ROOT, cfg.draftsDir);
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(draftsDir, { recursive: true });
  const lockPath = path.join(stateDir, 'run.lock');
  if (!acquireLock(lockPath, cfg.lockStaleMinutes)) {
    log('run.skipped_overlap', { reason: 'another run holds the lock' });
    return { skipped: true };
  }

  const cursorPath = path.join(stateDir, 'cursor.json');
  const state = fs.existsSync(cursorPath) ? loadJson(cursorPath) : { version: 1, sources: {}, seenUrls: {}, seenFingerprints: {} };
  const runId = new Date().toISOString();
  const stats = { runId, provider: provider.name, sourcesPolled: 0, notModified: 0, fetched: 0, backoffSkipped: 0, failed: 0, itemsSeen: 0, unchangedSkipped: 0, duplicateFingerprint: 0, baselined: 0, newCandidates: 0, held: 0, modelCalls: 0, tokens: 0, draftsWritten: 0 };
  const candidates = [];

  try {
    for (const src of sources.filter((s) => s.enabled)) {
      const st = (state.sources[src.id] ||= { failures: 0 });
      if (st.backoffUntil && Date.parse(st.backoffUntil) > Date.now()) { stats.backoffSkipped++; log('source.backoff', { id: src.id, until: st.backoffUntil }); continue; }
      stats.sourcesPolled++;
      let r;
      try {
        r = await fetchFeed(src, st, cfg);
      } catch (e) {
        st.failures = (st.failures || 0) + 1;
        const secs = Math.min(cfg.backoffBaseSeconds * 2 ** (st.failures - 1), cfg.backoffMaxSeconds);
        st.backoffUntil = new Date(Date.now() + secs * 1000).toISOString();
        st.lastError = String(e.message).slice(0, 200);
        stats.failed++;
        log('source.failed', { id: src.id, error: st.lastError, backoffSeconds: secs });
        if (stats.failed >= cfg.maxFailedSourcesBeforeAbort) throw new FailClosed('too many failed sources');
        continue;
      }
      st.failures = 0; delete st.backoffUntil; delete st.lastError;
      st.lastCheckedAt = runId;
      if (r.status === 304) { stats.notModified++; log('source.not_modified', { id: src.id, status: 304, modelCalls: 0 }); continue; }
      stats.fetched++;
      const bodyHash = sha256(r.body);
      if (r.etag) st.etag = r.etag;
      if (r.lastModified) st.lastModified = r.lastModified;
      if (st.bodyHash === bodyHash) { log('source.unchanged_body', { id: src.id, status: r.status, modelCalls: 0 }); continue; }
      const firstPoll = !st.bodyHash;
      st.bodyHash = bodyHash;
      const items = parseFeed(r.body, cfg.maxItemsPerFeed);
      let newHere = 0;
      for (const it of items) {
        stats.itemsSeen++;
        const url = canonicalUrl(it.link);
        if (!url) continue;
        const fp = eventFingerprint(it.title, it.pubDate);
        if (state.seenUrls[url]) { stats.unchangedSkipped++; continue; }
        if (state.seenFingerprints[fp]) { stats.duplicateFingerprint++; state.seenUrls[url] = { fp, at: runId, dupOf: state.seenFingerprints[fp].url }; continue; }
        const ageH = (Date.now() - Date.parse(it.pubDate)) / 3.6e6;
        if (firstPoll && !(ageH <= cfg.firstRunWindowHours)) { // baseline old items on first poll; avoids a backlog flood
          stats.baselined++; state.seenUrls[url] = { fp, at: runId, baseline: true }; state.seenFingerprints[fp] = { url, at: runId }; continue;
        }
        candidates.push({ src, it, url, fp }); newHere++;
      }
      log('source.fetched', { id: src.id, status: r.status, items: items.length, newCandidates: newHere, firstPoll });
    }

    candidates.sort((a, b) => (Date.parse(b.it.pubDate) || 0) - (Date.parse(a.it.pubDate) || 0));
    stats.newCandidates = candidates.length;
    const batch = candidates.slice(0, cfg.maxCandidatesPerRun);
    stats.held = candidates.length - batch.length; // held items are NOT marked seen: they are picked up next run
    for (const c of batch) {
      const promptTokens = estimateTokens(c.it.title + c.it.summary.slice(0, 600));
      if (stats.modelCalls + 1 > cfg.maxModelCallsPerRun || stats.tokens + promptTokens > cfg.maxTokensPerRun) { stats.held++; log('cap.reached', { modelCalls: stats.modelCalls, tokens: stats.tokens }); continue; }
      const out = await provider.draft({ item: c.it, source: c.src, budget: cfg.maxTokensPerRun - stats.tokens });
      stats.modelCalls++;
      stats.tokens += promptTokens + (out.tokensUsed || 0);
      writeDraft(draftsDir, c, out, runId);
      stats.draftsWritten++;
      state.seenUrls[c.url] = { fp: c.fp, at: runId };
      state.seenFingerprints[c.fp] = { url: c.url, at: runId };
    }
    state.lastRun = { ...stats, ok: true };
    writeJsonAtomic(cursorPath, state);
    log('run.complete', stats);
    return stats;
  } catch (e) {
    // Fail closed: persist failure info, write nothing further, exit non-zero.
    state.lastRun = { ...stats, ok: false, error: String(e.message).slice(0, 200) };
    try { writeJsonAtomic(cursorPath, state); } catch {}
    throw e;
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
}

function writeDraft(dir, c, out, runId) {
  const day = (Date.parse(c.it.pubDate) ? new Date(c.it.pubDate) : new Date()).toISOString().slice(0, 10);
  const file = path.join(dir, `${day}-${c.src.id}-${slugify(c.it.title)}-${c.fp.slice(0, 6)}.md`);
  if (fs.existsSync(file)) return;
  const fm = {
    status: 'needs-review',
    publish: false,
    dryRun: true,
    label: 'unlabelled — editor must choose Fact / Attributed / Analysis / Opinion',
    sourceId: c.src.id,
    sourceName: c.src.name,
    sourceMode: c.src.mode,
    sourceRights: c.src.rights,
    sourceUrl: c.url,
    sourceTitle: c.it.title,
    sourcePublished: c.it.pubDate || null,
    eventFingerprint: c.fp,
    discoveredAt: runId,
    provider: 'stub',
  };
  // Only metadata and the generated stub are stored; the source article body is NOT copied.
  const body = `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n# [NEEDS REVIEW] ${c.it.title}\n\nSource (link only): ${c.url}\n\n${out.text}\n`;
  fs.writeFileSync(file, body, { flag: 'wx' });
}

main().then(
  (s) => process.exit(0),
  (e) => { log('run.failed_closed', { error: String(e.message) }); process.exit(e instanceof FailClosed ? 2 : 1); },
);
