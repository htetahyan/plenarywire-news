#!/usr/bin/env node
// Static checks on the built site (npm test). Builds first, then asserts SEO/sample/ad invariants.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = (process.env.SITE_URL || 'https://plenarywire-preview.pages.dev').replace(/\/$/, '');
const PREVIEW = (process.env.PREVIEW ?? '1') !== '0';
execFileSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs')], { stdio: 'inherit', env: process.env });
const D = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(path.join(D, p), 'utf8');
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/brand.json'), 'utf8'));
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.error('FAIL', msg); } };
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const htmlFiles = walk(D).filter((f) => f.endsWith('.html'));
for (const f of htmlFiles) {
  const h = fs.readFileSync(f, 'utf8');
  const rel = path.relative(D, f);
  ok([...h.matchAll(/<script[^>]+src="([^"]+)"/gi)].every((m) => ['/assets/theme.js', '/assets/app.js'].includes(m[1])), `${rel}: unexpected script src`);
  ok(!/<script(?![^>]*(application\/ld\+json|src="\/assets\/(theme|app)\.js"))/i.test(h), `${rel}: inline or unexpected script found`);
  ok(!/<iframe/i.test(h), `${rel}: iframe found`);
  if (PREVIEW) ok(/<meta name="robots" content="noindex/.test(h), `${rel}: missing noindex meta`);
  if (rel !== '404.html') {
    const can = [...h.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
    const expected = SITE_URL + '/' + rel.replace(/index\.html$/, '');
    ok(can.length === 1 && can[0][1] === expected, `${rel}: canonical ${can.map((c) => c[1])} != ${expected}`);
  }
  for (const m of h.matchAll(/<aside class="ad-slot[^"]*"[^>]*>([\s\S]*?)<\/aside>/g)) {
    ok(m[1] === '<span class="ad-label">Advertisement</span><div class="ad-box"></div>', `${rel}: ad slot not empty`);
  }
}

const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/g)];
ok(locs.length > 0, 'sitemap has urls');
const arts = fs.readdirSync(path.join(ROOT, 'content/articles')).map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content/articles', f), 'utf8').replace(/\{\{name\}\}/g, brand.name)));
for (const a of arts) {
  const h = read(`news/${a.slug}/index.html`);
  ok(h.includes('Sample article — not real news'), `${a.slug}: sample banner`);
  const lds = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  ok(lds.length === 1, `${a.slug}: one JSON-LD`);
  const j = JSON.parse(lds[0][1]);
  const h1 = decode(h.match(/<h1 id="headline">([\s\S]*?)<\/h1>/)[1]);
  const dek = decode(h.match(/<p class="dek">([\s\S]*?)<\/p>/)[1]);
  const times = [...h.match(/<p class="meta">Published([\s\S]*?)<\/p>/)[1].matchAll(/datetime="([^"]+)"/g)].map((m) => m[1]);
  ok(j['@type'] === (a.type === 'liveblog' ? 'LiveBlogPosting' : 'NewsArticle'), `${a.slug}: type`);
  if (a.type === 'liveblog') {
    const vis = [...h.matchAll(/<li class="lb-update" id="update-([^"]+)"><article[^>]*>\s*<p class="lb-time"><time datetime="([^"]+)"[\s\S]*?<h3 id="t-[^"]+">([\s\S]*?)<\/h3>/g)].map((m) => ({ id: m[1], at: m[2], title: decode(m[3]) }));
    ok(vis.length === a.updates.length && vis.length === j.liveBlogUpdate.length, `${a.slug}: liveblog update count`);
    vis.forEach((v, i) => { const u = j.liveBlogUpdate[i]; ok(u && u.headline === v.title && u.datePublished === v.at && u.url === `${SITE_URL}/news/${a.slug}/#update-${v.id}`, `${a.slug}: liveblog update ${v.id} matches JSON-LD`); });
    ok(vis.every((v, i) => i === 0 || Date.parse(vis[i - 1].at) >= Date.parse(v.at)), `${a.slug}: updates newest first`);
    ok(Date.parse(vis[0].at) === Date.parse(j.dateModified), `${a.slug}: dateModified = newest update`);
    ok(h.includes('class="key-points"'), `${a.slug}: key points`);
  }
  ok(j.headline === h1, `${a.slug}: headline matches h1`);
  ok(j.description === dek, `${a.slug}: description matches dek`);
  ok(j.datePublished === times[0] && j.dateModified === times[1], `${a.slug}: dates match visible times`);
  ok(j.author['@type'] === 'Organization' && j.publisher.name === brand.name && j.author.name === brand.deskName, `${a.slug}: author/publisher`);
  ok(j.mainEntityOfPage === `${SITE_URL}/news/${a.slug}/`, `${a.slug}: mainEntityOfPage`);
  for (const s of ['below-lead', 'article-break', 'sidebar']) ok(h.includes(`data-ad-slot="${s}" data-ad-state="empty"`), `${a.slug}: ad slot ${s}`);
  const lm = locs.find((l) => l[1] === `${SITE_URL}/news/${a.slug}/`);
  ok(lm && Date.parse(lm[2]) === Date.parse(a.updatedAt), `${a.slug}: sitemap lastmod = updatedAt`);
}
ok(fs.existsSync(path.join(D, '404.html')), '404.html exists');
ok(!fs.existsSync(path.join(D, '_redirects')), 'no _redirects');
const robots = read('robots.txt');
const headers = read('_headers');
if (PREVIEW) { ok(/Disallow: \/\s*$/m.test(robots), 'robots disallow all'); ok(/X-Robots-Tag: noindex/.test(headers), 'X-Robots-Tag header'); }
ok(read('news-sitemap.xml').includes('xmlns:news='), 'news sitemap scaffold');
const latest = JSON.parse(read('latest.json'));
ok(latest.sample === true && latest.items.length === arts.length && latest.items.every((it, i) => it.sample === true && (i === 0 || Date.parse(latest.items[i - 1].updatedAt) >= Date.parse(it.updatedAt))), 'latest.json: all sample, all articles, newest first');
ok(JSON.parse(read('search-index.json')).items.length >= arts.length, 'search index');
for (const p of ['latest/index.html', 'sections/index.html', 'search/index.html', 'saved/index.html', 'topics/tech/index.html']) ok(fs.existsSync(path.join(D, p)), `${p} exists`);
const mr = read('index.html');
ok(mr.includes('Sample ranking — not real readership') && !/\d[\d,.]*\s*(views|reads)/i.test(mr), 'most read labelled, no view counts');
ok(/class="ticker"[\s\S]*Sample feed/.test(mr), 'ticker labelled sample');
ok(!/connect-src [^;]*(https?:|\*)/.test(headers) && /script-src 'self';/.test(headers), 'CSP self-only');
// No AI-related wording on any public output unless the owner sets brand.aiDisclosure.
if (!(brand.aiDisclosure || '').trim()) {
  const AI_RE = /\bAI\b|artificial intelligence|Gemini|model-written|AI-assisted/i;
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const hits = walk(D).filter((f) => /\.(html|xml|json|js|css|txt|webmanifest)$/.test(f) || path.basename(f) === '_headers').filter((f) => AI_RE.test(fs.readFileSync(f, 'utf8')));
  ok(hits.length === 0, `no AI wording in dist (hits: ${hits.map((f) => path.relative(D, f)).join(', ') || 'none'})`);
  ok(!fs.existsSync(path.join(D, 'ai-use')) && !fs.existsSync(path.join(D, 'disclosure')), 'no ai-use/disclosure page while flag empty');
}
if (fails) { console.error(`${fails} check(s) failed`); process.exit(1); }
console.log(`All checks passed (${htmlFiles.length} HTML files, ${arts.length} sample articles).`);
