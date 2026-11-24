#!/usr/bin/env node
// Static site generator. Zero dependencies. Brand comes ONLY from config/brand.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://plenarywire-preview.pages.dev').replace(/\/$/, '');
const PREVIEW = (process.env.PREVIEW ?? '1') !== '0';

export const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/brand.json'), 'utf8'));
const DISCLOSURE = (brand.aiDisclosure || '').trim(); // config/brand.json; empty = hidden
const TOKENS = { name: brand.name, shortName: brand.shortName, tagline: brand.tagline, desk: brand.deskName };
const tok = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in TOKENS)) throw new Error(`unknown token ${m}`); return TOKENS[k]; });
const loadJson = (p) => JSON.parse(tok(fs.readFileSync(p, 'utf8')));

const site = loadJson(path.join(ROOT, 'content/site.json'));
const pageDates = loadJson(path.join(ROOT, 'content/pages.json'));
const mostRead = loadJson(path.join(ROOT, 'content/most-read.json'));
const TOPICS = site.topics;
const LABELS = { Fact: 'Fact', Analysis: 'Analysis', Opinion: 'Opinion' };

const articles = fs.readdirSync(path.join(ROOT, 'content/articles')).filter((f) => f.endsWith('.json')).map((f) => {
  const a = loadJson(path.join(ROOT, 'content/articles', f));
  for (const k of ['slug', 'topic', 'label', 'headline', 'dek', 'publishedAt', 'updatedAt']) if (!a[k]) throw new Error(`${f}: missing ${k}`);
  if (!TOPICS[a.topic]) throw new Error(`${f}: unknown topic ${a.topic}`);
  if (!LABELS[a.label]) throw new Error(`${f}: unknown label ${a.label}`);
  if (Date.parse(a.updatedAt) < Date.parse(a.publishedAt)) throw new Error(`${f}: updatedAt before publishedAt`);
  if (a.sample !== true) throw new Error(`${f}: only sample content is allowed in this preview`);
  if (a.type === 'liveblog') {
    if (!a.updates?.length || !a.keyPoints?.length) throw new Error(`${f}: liveblog needs keyPoints and updates`);
    a.updates.sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
    if (Date.parse(a.updates[0].at) !== Date.parse(a.updatedAt)) throw new Error(`${f}: updatedAt must equal the newest update time`);
    if (Date.parse(a.updates.at(-1).at) < Date.parse(a.publishedAt)) throw new Error(`${f}: update before publishedAt`);
  }
  a.sources = [...(a.sources || [])].sort((x, y) => (x.type === 'primary' ? 0 : 1) - (y.type === 'primary' ? 0 : 1));
  a.variant = [...a.slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 4;
  return a;
}).sort((x, y) => Date.parse(y.updatedAt) - Date.parse(x.updatedAt));
const bySlug = Object.fromEntries(articles.map((a) => [a.slug, a]));
for (const s of mostRead.slugs) if (!bySlug[s]) throw new Error(`most-read: unknown slug ${s}`);
const developing = articles.find((a) => a.type === 'liveblog' && a.developing);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const CONTACT_EMAIL = (brand.contactEmail || site.contact || '').trim();
const CONTACT_NOTE = site.contactNote || '';
const LEGAL_EFF = (brand.legalEffectiveDate || '').trim();
const GOVERNING_LAW = (brand.governingLaw || '').trim();
const SITE_URL_CFG = (brand.siteUrl || '').trim();
const contactLine = (forWhat) => CONTACT_EMAIL
  ? `<p>Email${forWhat ? ` for ${forWhat}` : ''}: <a class="mono" href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>${CONTACT_NOTE ? ` — ${esc(CONTACT_NOTE)}` : ''}</p>`
  : `<p>Contact address${forWhat ? ` for ${forWhat}` : ''}: coming soon.${CONTACT_NOTE ? ` ${esc(CONTACT_NOTE)}` : ''}</p>`;
const effLine = LEGAL_EFF ? `<p>Effective as of ${esc(LEGAL_EFF)}.</p>` : '';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`; };
const fmtShort = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`; };
const iso = (s) => new Date(s).toISOString().replace('.000Z', 'Z');
const time = (s) => `<time datetime="${iso(s)}">${fmt(s)}</time>`;
const relTime = (s) => `<time datetime="${iso(s)}" data-rel title="${fmt(s)}">${fmtShort(s)}</time>`;
const abs = (p) => SITE_URL + p;
const maxDate = (list) => list.reduce((m, a) => (Date.parse(a.updatedAt) > Date.parse(m) ? a.updatedAt : m), '1970-01-01T00:00:00Z');
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const words = (a) => [a.dek, ...(a.keyPoints || []), ...(a.updates || []).flatMap((u) => [u.title, ...u.body]), ...(a.whatHappened || []), ...(a.whyItMatters || []), ...(a.confirmed || []), ...(a.unknown || [])].join(' ').split(/\s+/).length;
const readMins = (a) => Math.max(1, Math.round(words(a) / 230));
const urlOf = (a) => `/news/${a.slug}/`;

const NAV = [...Object.entries(TOPICS).map(([k, t]) => [`/topics/${k}/`, t.name]), ['/latest/', 'Latest'], ['/corrections/', 'Corrections'], ['/about/', 'About']];
const NAV_DESKTOP = [['/latest/', 'Latest'], ...Object.entries(TOPICS).map(([k, t]) => [`/topics/${k}/`, t.short || t.name]), ['/about/', 'About']];

const LOGO = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/logo-paths.json'), 'utf8'));
const C = brand.colors;
const logoSvg = (reuse) => `<svg class="logo" viewBox="${LOGO.viewBox}" aria-hidden="true" focusable="false">${reuse ? '<use href="#pw-logo"/>' : `<g id="pw-logo"><defs><linearGradient id="pw-logo-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.markTop}"/><stop offset="1" stop-color="${C.markBottom}"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#pw-logo-g)"/><path d="M21 47V17h11.5a9.5 9.5 0 0 1 0 19H21" fill="none" stroke="#fff" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M44.8 17.9a15 15 0 0 1 0 17.2M49.3 14.7a20.5 20.5 0 0 1 0 23.6" fill="none" stroke="${C.signal}" stroke-width="3.4" stroke-linecap="round"/><circle cx="32.5" cy="26.5" r="2.6" fill="${C.signal}"/><path class="logo-ink" d="${LOGO.primary}"/><path class="logo-accent" d="${LOGO.accent}"/></g>`}</svg>`;
const icon = {
  search: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M4 11l8-6.5 8 6.5V20h-5.5v-5h-5v5H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  latest: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  sections: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  saved: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M7 4h10v16l-5-3.5L7 20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M12 4v11M7.5 8.5L12 4l4.5 4.5M5 13v6h14v-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path class="bm" d="M7 4h10v16l-5-3.5L7 20z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  pause: '<svg class="i-pause" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><svg class="i-play" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>',
};

function adSlot(id, extraClass = '') {
  return `<aside class="ad-slot ${extraClass}" aria-label="Advertisement (${id.replace(/-/g, ' ')})" data-ad-slot="${id}" data-ad-state="empty"><span class="ad-label">Advertisement</span><div class="ad-box"></div></aside>`;
}
function illo(a, cls = '') {
  return `<div class="illo illo-${a.topic} illo-v${a.variant} ${cls}" role="img" aria-label="Sample illustration: abstract placeholder pattern, not a photo"><span class="illo-tag" aria-hidden="true">Sample illustration</span></div>`;
}
const saveBtn = (a) => `<button class="icon-btn js-only" type="button" data-save="${esc(a.slug)}" data-title="${esc(a.headline)}" data-url="${urlOf(a)}" data-topic="${esc(TOPICS[a.topic].name)}" aria-pressed="false" aria-label="Save for later: ${esc(a.headline)}">${icon.bookmark}</button>`;

function liveStrip() {
  const items = articles.slice(0, 8);
  const track = items.map((a) => `<li><a href="${urlOf(a)}">${esc(a.headline)}</a></li>`).join('');
  return `<section class="live-strip" aria-label="Developing story and latest headlines (sample)">
  ${developing ? `<div class="dev-banner" role="note"><div class="wrap dev-inner"><span class="dev-tag"><span class="dot" aria-hidden="true"></span>Developing</span><span class="chip chip-sample">Sample</span><a class="dev-link" href="${urlOf(developing)}">${esc(developing.headline)}</a></div></div>` : ''}
  <section class="ticker" aria-label="Latest headlines (sample feed)">
    <div class="wrap ticker-inner">
      <span class="ticker-label">Latest <span class="ticker-sample">Sample feed</span></span>
      <div class="ticker-viewport"><ul class="ticker-track">${track}</ul><ul class="ticker-track ticker-dup" aria-hidden="true">${items.map((a) => `<li><a href="${urlOf(a)}" tabindex="-1">${esc(a.headline)}</a></li>`).join('')}</ul></div>
      <button class="ticker-btn js-only" type="button" data-ticker-toggle aria-pressed="false" aria-label="Pause headline ticker">${icon.pause}</button>
    </div>
  </section>
</section>`;
}

function layout({ title, description, pathname, type = 'website', body, jsonld = '', current = '', bodyClass = '', tab = '', robotsExtra = false }) {
  const canonical = abs(pathname);
  const tabs = [['/', 'Home', 'home'], ['/latest/', 'Latest', 'latest'], ['/sections/', 'Sections', 'sections'], ['/search/', 'Search', 'search'], ['/saved/', 'Saved', 'saved']];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${PREVIEW || robotsExtra ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<link rel="canonical" href="${esc(canonical)}">
<meta property="og:site_name" content="${esc(brand.name)}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(abs(brand.logo.og))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(abs(brand.logo.og))}">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<link rel="manifest" href="/brand/site.webmanifest">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="${esc(brand.themeColorLight)}">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${esc(brand.themeColorDark)}">
<meta name="application-name" content="${esc(brand.shortName)}">
<link rel="preload" href="/assets/fonts/newsreader-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/theme.js"></script>
<script src="/assets/app.js" defer></script>
<link rel="alternate" type="application/rss+xml" title="${esc(brand.name)}" href="/feed.xml">
${jsonld}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
${PREVIEW ? `<section aria-label="Preview notice"><div class="preview-strip" role="note">Preview build — not indexed. ${esc(brand.name)} is in development.</div></section>` : ''}
<header class="site-header">
  <div class="wrap header-inner">
    <a class="wordmark" href="/">${logoSvg(false)}<span class="visually-hidden">${esc(brand.name)} — home</span></a>
    <nav class="nav-desktop" aria-label="Sections"><ul>${NAV_DESKTOP.map(([h, l]) => `<li><a href="${h}"${h === current ? ' aria-current="page"' : ''}>${esc(l)}</a></li>`).join('')}</ul></nav>
    <div class="header-tools">
      <a class="tool-btn search-btn" href="/search/" data-search-open aria-label="Search">${icon.search}<span class="tool-text">Search</span></a>
      <button class="tool-btn theme-toggle js-only" type="button" data-theme-toggle aria-label="Switch colour theme"><span class="ti ti-sun" aria-hidden="true"></span><span class="ti ti-moon" aria-hidden="true"></span></button>
      <details class="nav-mobile">
        <summary class="tool-btn" aria-label="Open section menu"><span class="burger" aria-hidden="true"></span></summary>
        <nav class="nav-mobile-panel" aria-label="Sections (menu)"><ul><li><a href="/"${current === '/' ? ' aria-current="page"' : ''}>Home</a></li>${NAV.map(([h, l]) => `<li><a href="${h}"${h === current ? ' aria-current="page"' : ''}>${esc(l)}</a></li>`).join('')}<li><a href="/standards/">Editorial standards</a></li><li><a href="/contact/">Contact</a></li></ul></nav>
      </details>
    </div>
  </div>
</header>
${liveStrip()}
${bodyClass.includes('is-article') ? '<div class="progress" aria-hidden="true"></div>' : ''}
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="wordmark wordmark-footer" aria-hidden="true">${logoSvg(true)}</p>
      <p class="footer-tag">${esc(brand.tagline)}</p>
    </div>
    <nav aria-label="Publication"><ul class="footer-links">
      <li><a href="/about/">About</a></li><li><a href="/standards/">Editorial standards</a></li><li><a href="/corrections/">Corrections</a></li><li><a href="/contact/">Contact</a></li><li><a href="/sections/">All sections</a></li>
    </ul></nav>
    <nav aria-label="Legal"><ul class="footer-links">
      <li><a href="/terms/">Terms of Use</a></li><li><a href="/privacy/">Privacy</a></li><li><a href="/cookies/">Cookies</a></li><li><a href="/copyright/">Copyright &amp; licensing</a></li><li><a href="/accessibility/">Accessibility</a></li>
    </ul></nav>
    <p class="footer-legal">© 2026 ${esc(brand.name)} (in development). An independent publication. All articles on this preview are samples, not real news.${DISCLOSURE ? ` ${esc(DISCLOSURE)}` : ''}</p>
  </div>
</footer>
<nav class="tabbar" aria-label="Primary">
  <ul>${tabs.map(([h, l, k]) => `<li><a href="${h}"${k === tab ? ' aria-current="page"' : ''}${k === 'search' ? ' data-search-open' : ''}>${icon[k]}<span>${l}</span></a></li>`).join('')}</ul>
</nav>
<div class="new-pill-wrap"><button class="new-pill" type="button" data-new-pill hidden></button></div>
<div class="toast" role="status" aria-live="polite" data-toast></div>
<dialog class="search-dialog" aria-labelledby="search-title" data-search-dialog>
  <div class="search-panel">
    <div class="search-head">
      <h2 id="search-title" class="visually-hidden">Search ${esc(brand.name)}</h2>
      ${icon.search}
      <label class="visually-hidden" for="search-input">Search sample stories</label>
      <input id="search-input" type="search" placeholder="Search sample stories" autocomplete="off" spellcheck="false" data-search-input aria-describedby="search-status" aria-controls="search-results">
      <button class="esc-btn" type="button" data-search-close aria-label="Close search">Esc</button>
    </div>
    <p id="search-status" class="search-status" role="status" aria-live="polite"></p>
    <ul id="search-results" class="search-results" data-search-results></ul>
  </div>
</dialog>
</body>
</html>
`;
}

const chip = (label) => `<span class="chip chip-${label.toLowerCase()}">${esc(label)}</span>`;
const kicker = (a) => `<p class="kicker"><a href="/topics/${a.topic}/">${esc(TOPICS[a.topic].name)}</a>${a.type === 'liveblog' ? '<span class="chip chip-live">Live blog</span>' : chip(a.label)}<span class="chip chip-sample">Sample</span></p>`;

function card(a, { size = 'md', heading = 3, img = true } = {}) {
  return `<article class="card card-${size}" data-topic="${a.topic}">
  ${img ? `<a class="card-media" href="${urlOf(a)}" tabindex="-1" aria-hidden="true">${illo(a)}</a>` : ''}
  <div class="card-body">
    ${kicker(a)}
    <h${heading} class="card-title"><a href="${urlOf(a)}">${esc(a.headline)}</a></h${heading}>
    ${size !== 'sm' ? `<p class="card-dek">${esc(a.dek)}</p>` : ''}
    <p class="meta">Updated ${time(a.updatedAt)} · ${readMins(a)} min read</p>
  </div>
</article>`;
}

// Latest-feed item: fixed-width time column holds the relative time and the NEW/UPDATED badge, so JS updates never shift layout.
function feedItem(a, { dek = true, h = 3 } = {}) {
  return `<li class="feed-item" data-id="${esc(a.slug)}" data-topic="${a.topic}" data-updated="${iso(a.updatedAt)}">
  <div class="feed-time">${relTime(a.updatedAt)}<span class="badge" data-badge data-published="${iso(a.publishedAt)}" data-updated="${iso(a.updatedAt)}"></span></div>
  <div class="feed-body">
    ${kicker(a)}
    <h${h} class="feed-title"><a href="${urlOf(a)}">${esc(a.headline)}</a></h${h}>
    ${dek ? `<p class="feed-dek">${esc(a.dek)}</p>` : ''}
  </div>
  <div class="feed-actions">${saveBtn(a)}</div>
</li>`;
}

const filterChips = (scope) => `<nav class="filter-chips" aria-label="Filter ${scope} by section" data-filter-scope="${scope}">
  <ul><li><a href="/latest/" data-filter="all" aria-current="true">All</a></li>${Object.entries(TOPICS).map(([k, t]) => `<li><a href="/topics/${k}/" data-filter="${k}">${esc(t.short || t.name)}</a></li>`).join('')}</ul>
</nav>`;

const mostReadBox = () => `<section class="most-read" aria-labelledby="mr-h"><h2 id="mr-h" class="section-title">Most read</h2><p class="mr-label">${esc(mostRead.label)}</p><ol>${mostRead.slugs.map((s) => `<li><a href="${urlOf(bySlug[s])}">${esc(bySlug[s].headline)}</a></li>`).join('')}</ol><p class="mr-note">${esc(mostRead.note)}</p></section>`;

const pages = [];
function write(pathname, html, lastmod) {
  const file = path.join(OUT, pathname, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  if (lastmod) pages.push({ pathname, lastmod });
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets/fonts'), { recursive: true });
for (const f of ['site.css', 'theme.js', 'app.js']) fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(OUT, 'assets', f));
for (const f of fs.readdirSync(path.join(ROOT, 'assets/fonts'))) fs.copyFileSync(path.join(ROOT, 'assets/fonts', f), path.join(OUT, 'assets/fonts', f));
fs.cpSync(path.join(ROOT, 'assets/brand'), path.join(OUT, 'brand'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'assets/brand/favicon.ico'), path.join(OUT, 'favicon.ico'));

const sampleNotice = `<div class="sample-notice" role="note"><strong>Sample content — not real news.</strong> Every story on this preview uses fictional places and placeholder sources to test the layout. ${esc(brand.name)} has not published real reporting yet.</div>`;
const feedNote = `<p class="feed-note">Sample feed: stories are placeholders, listed newest first. Relative times are worked out in your browser from each story's published and updated times.</p>`;

// Home
{
  const [lead, ...rest] = articles.filter((a) => a.type !== 'liveblog');
  const top = rest.slice(0, 4);
  const rail = (key) => {
    const list = articles.filter((a) => a.topic === key).slice(0, 3);
    if (!list.length) return '';
    return `<section class="rail" aria-labelledby="rail-${key}"><div class="rail-head"><h2 id="rail-${key}" class="section-title">${esc(TOPICS[key].name)}</h2><a class="rail-more" href="/topics/${key}/">All ${esc(TOPICS[key].name)} <span aria-hidden="true">→</span></a></div><div class="rail-track">${list.map((a) => card(a, { size: 'sm' })).join('\n')}</div></section>`;
  };
  const body = `<div class="wrap">${sampleNotice}
<h1 class="visually-hidden">${esc(brand.name)} — latest US, EU and world politics (sample)</h1>
<section class="hero" aria-labelledby="hero-title">
  <a class="hero-media" href="${urlOf(lead)}" tabindex="-1" aria-hidden="true">${illo(lead, 'illo-hero')}</a>
  <div class="hero-body">
    <p class="eyebrow">Lead story</p>
    ${kicker(lead)}
    <h2 id="hero-title" class="hero-title"><a href="${urlOf(lead)}">${esc(lead.headline)}</a></h2>
    <p class="hero-dek">${esc(lead.dek)}</p>
    <p class="meta">Updated ${time(lead.updatedAt)} · ${readMins(lead)} min read</p>
  </div>
</section>
<div class="with-sidebar home-top">
  <div class="primary">
    <section aria-labelledby="top-h"><h2 id="top-h" class="section-title">Top stories</h2><div class="top-grid carousel">${top.map((a) => card(a)).join('\n')}</div></section>
    <section class="latest-rail" aria-labelledby="latest-h" data-feed>
      <div class="rail-head"><h2 id="latest-h" class="section-title">Latest <span class="title-sample">(sample feed)</span></h2><a class="rail-more" href="/latest/">All latest <span aria-hidden="true">→</span></a></div>
      ${filterChips('latest stories')}
      <p class="visually-hidden" role="status" aria-live="polite" data-filter-status></p>
      <ol class="feed" data-feed-list data-feed-limit="6">${articles.slice(0, 6).map((a) => feedItem(a, { dek: false })).join('\n')}</ol>
      <p class="feed-empty" data-feed-empty hidden>No sample stories in this section yet. <a href="/sections/">Browse all sections</a>.</p>
    </section>
  </div>
  <div class="sidebar">${adSlot('home-sidebar', 'ad-sidebar ad-300x250')}
    <section class="side-box"><h2>How we work</h2><p>Every item carries a label — Fact, Attributed, Analysis or Opinion — and links its sources, primary documents first.</p><p><a href="/standards/">Sources &amp; standards</a> · <a href="/about/">About</a></p></section>
  </div>
</div>
${adSlot('home-break', 'ad-inline')}
${['us-politics', 'eu-politics', 'world'].map(rail).join('\n')}
<div class="home-bottom">${mostReadBox()}</div>
</div>`;
  const jsonld = ld({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', name: brand.name, alternateName: brand.shortName, url: abs('/') },
    { '@type': 'Organization', name: brand.name, url: abs('/') },
  ] });
  write('/', layout({ title: `${brand.name} — ${brand.tagline}`, description: site.description, pathname: '/', body, jsonld, current: '/', tab: 'home' }), maxDate(articles));
}

// Latest feed page
{
  const body = `<div class="wrap">${sampleNotice}
<div class="with-sidebar">
  <section class="primary" data-feed aria-labelledby="latest-title">
    <header class="page-head"><p class="eyebrow">Live feed</p><h1 id="latest-title">Latest <span class="title-sample">(sample feed)</span></h1>${feedNote}</header>
    ${filterChips('the feed')}
    <p class="visually-hidden" role="status" aria-live="polite" data-filter-status></p>
    <ol class="feed feed-full" data-feed-list>${articles.slice(0, 4).map((a) => feedItem(a, { h: 2 })).join('\n')}</ol>
    ${adSlot('feed-break', 'ad-inline')}
    <ol class="feed feed-full" data-feed-list data-feed-continued start="5">${articles.slice(4).map((a) => feedItem(a, { h: 2 })).join('\n')}</ol>
    <p class="feed-empty" data-feed-empty hidden>No sample stories in this section yet. <a href="/sections/">Browse all sections</a>.</p>
  </section>
  <div class="sidebar">${adSlot('latest-sidebar', 'ad-sidebar ad-300x600')}${mostReadBox()}</div>
</div>
</div>`;
  write('/latest/', layout({ title: `Latest (sample feed) — ${brand.name}`, description: `The latest sample stories from ${brand.name}, newest first.`, pathname: '/latest/', body, current: '/latest/', tab: 'latest' }), maxDate(articles));
}

// Topic hubs
for (const [key, t] of Object.entries(TOPICS)) {
  const list = articles.filter((a) => a.topic === key);
  const [first, ...more] = list;
  const body = `<div class="wrap">${sampleNotice}
<header class="page-head"><p class="eyebrow">Section</p><h1>${esc(t.name)}</h1><p class="lede">${esc(t.description)}</p></header>
${first ? `<div class="topic-lead">${card(first, { size: 'lg', heading: 2 })}</div><div class="top-grid">${more.map((a) => card(a)).join('\n')}</div>` : '<p class="empty">No stories in this section yet.</p>'}
</div>`;
  const p = `/topics/${key}/`;
  write(p, layout({ title: `${t.name} — ${brand.name}`, description: `${t.name} coverage from ${brand.name}: ${t.description}`, pathname: p, body, current: p, tab: 'sections' }), list.length ? maxDate(list) : pageDates.sections);
}

// Sections index
write('/sections/', layout({ title: `Sections — ${brand.name}`, description: `All ${brand.name} sections.`, pathname: '/sections/', current: '/sections/', tab: 'sections', body: `<div class="wrap"><header class="page-head"><p class="eyebrow">Browse</p><h1>Sections</h1></header>
<ul class="section-grid">${Object.entries(TOPICS).map(([k, t]) => `<li><a href="/topics/${k}/"><strong>${esc(t.name)}</strong><span>${esc(t.description)}</span><span class="count">${articles.filter((a) => a.topic === k).length} sample stories</span></a></li>`).join('')}
<li><a href="/latest/"><strong>Latest (sample feed)</strong><span>Every sample story, newest first.</span></a></li><li><a href="/corrections/"><strong>Corrections</strong><span>Every correction, dated.</span></a></li></ul></div>` }), pageDates.sections);

// Search (no-JS fallback lists everything; JS filters by ?q=)
write('/search/', layout({ title: `Search — ${brand.name}`, description: `Search sample stories on ${brand.name}.`, pathname: '/search/', current: '/search/', tab: 'search', robotsExtra: true, body: `<div class="wrap"><header class="page-head"><p class="eyebrow">Find</p><h1>Search</h1></header>
<form class="search-form" action="/search/" method="get" role="search" data-search-page><label for="q" class="visually-hidden">Search sample stories</label><input id="q" name="q" type="search" placeholder="Search sample stories" autocomplete="off"><button type="submit">Search</button></form>
<p class="search-hint" data-search-hint>Instant search needs JavaScript. Every sample story is listed below.</p>
<ol class="feed search-page-results" data-search-page-results>${articles.map((a) => feedItem(a, { dek: false, h: 2 })).join('\n')}</ol></div>` }));

// Saved (localStorage only)
write('/saved/', layout({ title: `Saved for later — ${brand.name}`, description: 'Stories you saved in this browser.', pathname: '/saved/', current: '/saved/', tab: 'saved', robotsExtra: true, body: `<div class="wrap"><header class="page-head"><p class="eyebrow">Your list</p><h1>Saved for later</h1><p class="lede">Saved stories are kept only in this browser (localStorage). Nothing is sent to ${esc(brand.name)}.</p></header>
<div class="saved-wrap"><p class="saved-empty" data-saved-empty>Saving stories needs JavaScript. Use the bookmark button on any story to save it here.</p><ol class="feed" data-saved-list></ol></div></div>` }));

// Articles
const sectionsHtml = (a) => {
  const paras = (list) => list.map((t) => `<p>${esc(t)}</p>`).join('');
  return `
  <section aria-labelledby="h-conf"><h2 id="h-conf">What's confirmed</h2><ul class="labelled">${(a.confirmed || []).map((c) => `<li>${chip('Fact')} <span>${esc(c)}</span></li>`).join('')}</ul></section>
  <section aria-labelledby="h-att"><h2 id="h-att">What's alleged or attributed</h2>${(a.attributed || []).length ? `<ul class="labelled">${a.attributed.map((c) => `<li><span class="chip chip-attributed">Attributed</span> <span>${esc(c.claim)} <span class="attr">— ${esc(c.attributedTo)}</span></span></li>`).join('')}</ul>` : '<p>No attributed claims in this piece.</p>'}</section>
  <section aria-labelledby="h-unk"><h2 id="h-unk">What we don't know yet</h2><ul class="unknowns">${(a.unknown || []).map((u) => `<li>${esc(u)}</li>`).join('')}</ul></section>
  <section aria-labelledby="h-src" class="box"><h2 id="h-src">Sources</h2><ol class="sources">${a.sources.map((s) => `<li><span class="src-type">${s.type === 'primary' ? 'Primary' : 'Secondary'}</span> <a href="${esc(s.url)}" rel="nofollow noopener">${esc(s.title)}</a> <span class="src-pub">${esc(s.publisher)}</span></li>`).join('')}</ol></section>
  <section aria-labelledby="h-log" class="box"><h2 id="h-log">Change log</h2><ol class="changelog">${(a.changelog || []).map((c) => `<li>${time(c.at)} — ${esc(c.note)}</li>`).join('')}</ol></section>
  ${(a.corrections || []).length ? `<section aria-labelledby="h-cor" class="box corrections"><h2 id="h-cor">Corrections</h2><ol>${a.corrections.map((c) => `<li>${time(c.at)} — ${esc(c.note)}</li>`).join('')}</ol><p><a href="/corrections/">See the full corrections log</a></p></section>` : ''}`;
};

for (const a of articles) {
  const p = urlOf(a);
  const topic = TOPICS[a.topic];
  const live = a.type === 'liveblog';
  const related = [...articles.filter((x) => x.topic === a.topic && x.slug !== a.slug), ...articles.filter((x) => x.topic !== a.topic)].slice(0, 3);
  const paras = (list) => list.map((t) => `<p>${esc(t)}</p>`).join('');
  const pull = a.pullQuote || (a.whyItMatters || [])[0]?.split(/(?<=\.)\s/)[0];
  const head = `<div class="sample-banner" role="note"><strong>Sample article — not real news.</strong> Names, places, figures and sources below are fictional placeholders.</div>
  ${a.label === 'Opinion' ? '<div class="opinion-banner" role="note"><strong>Opinion.</strong> This piece argues a point of view. It is not news reporting, and it is labelled so readers can tell the difference.</div>' : ''}
  <header class="story-head">
    ${kicker(a)}
    <h1 id="headline">${esc(a.headline)}</h1>
    <p class="dek">${esc(a.dek)}</p>
    <div class="byline-row">
      <span class="avatar" aria-hidden="true">${esc(brand.shortName)}</span>
      <div class="byline-text"><p class="byline">By ${esc(brand.deskName)} · Sample</p>
      <p class="meta">Published ${time(a.publishedAt)} · Updated ${time(a.updatedAt)}</p></div>
      <div class="story-actions"><button class="icon-btn js-only" type="button" data-share data-url="${abs(p)}" data-title="${esc(a.headline)}" aria-label="Share this story">${icon.share}</button>${saveBtn(a)}</div>
    </div>
  </header>`;
  const bodyMain = live ? `
  <section class="key-points" aria-labelledby="h-key"><h2 id="h-key">Key points <span class="chip chip-sample">Sample</span></h2><ul>${a.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></section>
  ${adSlot('below-lead', 'ad-inline')}
  <div class="story-body">
  <section aria-labelledby="h-updates" class="lb"><h2 id="h-updates">Updates <span class="lb-order">newest first</span></h2>
  <ol class="lb-list">${a.updates.map((u, i) => `<li class="lb-update" id="update-${esc(u.id)}"><article aria-labelledby="t-${esc(u.id)}">
    <p class="lb-time">${relTime(u.at)}<a class="lb-anchor" href="#update-${esc(u.id)}" aria-label="Link to this update">#</a></p>
    <h3 id="t-${esc(u.id)}">${esc(u.title)}</h3>${paras(u.body)}</article></li>${i === 1 ? `</ol>${adSlot('article-break', 'ad-inline')}<ol class="lb-list" start="${i + 2}">` : ''}`).join('')}</ol></section>
  <section aria-labelledby="h-why"><h2 id="h-why">Why it matters ${chip('Analysis')}</h2>${paras(a.whyItMatters || [])}</section>
  ${sectionsHtml(a)}
  </div>` : `
  <figure class="story-figure">${illo(a, 'illo-hero')}<figcaption>Sample illustration — an abstract placeholder, not a photograph.</figcaption></figure>
  ${adSlot('below-lead', 'ad-inline')}
  <div class="story-body">
  <section aria-labelledby="h-what"><h2 id="h-what">What happened</h2>${paras(a.whatHappened || [])}</section>
  ${pull ? `<aside class="pullquote" aria-hidden="true"><p>${esc(pull)}</p></aside>` : ''}
  <section aria-labelledby="h-why"><h2 id="h-why">Why it matters ${chip(a.label === 'Opinion' ? 'Opinion' : 'Analysis')}</h2>${paras(a.whyItMatters || [])}</section>
  ${adSlot('article-break', 'ad-inline')}
  ${sectionsHtml(a)}
  </div>`;
  const body = `<div class="wrap with-sidebar article-layout">
<article class="story primary${live ? ' story-live' : ''}" aria-labelledby="headline">
  ${head}
  ${bodyMain}
</article>
<div class="sidebar">${adSlot('sidebar', 'ad-sidebar ad-300x600')}</div>
</div>
${related.length ? `<section class="wrap related" aria-labelledby="h-rel"><h2 id="h-rel" class="section-title">Related stories</h2><div class="top-grid related-grid">${related.map((r) => card(r, { size: 'sm' })).join('')}</div></section>` : ''}`;
  const common = {
    '@context': 'https://schema.org', '@type': live ? 'LiveBlogPosting' : 'NewsArticle',
    headline: a.headline, description: a.dek,
    datePublished: iso(a.publishedAt), dateModified: iso(a.updatedAt),
    author: { '@type': 'Organization', name: brand.deskName },
    publisher: { '@type': 'Organization', name: brand.name, url: abs('/') },
    mainEntityOfPage: abs(p), url: abs(p), articleSection: topic.name, genre: a.label, isAccessibleForFree: true, inLanguage: 'en',
  };
  if (live) {
    common.coverageStartTime = iso(a.publishedAt);
    common.liveBlogUpdate = a.updates.map((u) => ({ '@type': 'BlogPosting', headline: u.title, datePublished: iso(u.at), url: `${abs(p)}#update-${u.id}`, articleBody: u.body.join(' ') }));
  }
  write(p, layout({ title: `${a.headline} — ${brand.name}`, description: a.dek, pathname: p, type: 'article', body, jsonld: ld(common), current: `/topics/${a.topic}/`, bodyClass: 'is-article', tab: '' }), a.updatedAt);
}

// Static pages (disclosure text unchanged; brand from config)
const B = esc(brand.name);
const staticPage = (key, p, title, description, inner) => write(p, layout({ title: `${title} — ${brand.name}`, description, pathname: p, current: p, body: `<div class="wrap"><article class="prose"><p class="eyebrow">${B}</p><h1>${esc(title)}</h1>${inner}<p class="meta">Page last updated ${time(pageDates[key])}</p></article></div>` }), pageDates[key]);

staticPage('about', '/about/', `About ${brand.name}`, `What ${brand.name} is: an independent news publication in development, covering US and EU politics.`, `
<p>${B} is an independent, English-language news publication <strong>in development</strong>. It covers US and EU politics first, and major world news when it matters, with policy, economy and technology where they connect to political decisions.</p>
<p>We are not an established newsroom. We have no staff reporters, bureaus or awards, and we do not claim any. Our stories are based on <strong>official sources</strong> — press releases, statements and other public records — each linked so you can read the original. Where we also draw on reporting by other outlets, we credit them and write in our own words.</p>
<p>Official statements tell you what a government or institution said, not that it is true. We attribute every claim to the body that made it. ${B} is nonpartisan and has not chosen an editorial line.</p>
<p>This preview contains <strong>sample content only</strong>. Nothing here is real news, and the preview is not indexed by search engines.</p>
<p>Read our <a href="/standards/">editorial standards</a>, <a href="/corrections/">corrections policy</a>, <a href="/copyright/">copyright and licensing</a>, and <a href="/contact/">how to contact us</a>.</p>`);

if (DISCLOSURE) staticPage('disclosure', '/disclosure/', 'Disclosure', DISCLOSURE.slice(0, 160), `<p>${esc(DISCLOSURE)}</p>`);

staticPage('standards', '/standards/', 'Editorial standards', `${brand.name} sourcing, corroboration, attribution, sensitive-topic review, images and corrections.`, `
<p>These are the rules ${B} follows when choosing sources, writing stories and deciding what to publish.</p>
<h2>Labels</h2>
<ul><li><strong>Official source</strong> — the story is based on an official release, linked at the end of the article.</li><li><strong>Story type</strong> — the kind of document (statement, speech, press release, remarks).</li><li><strong>Live blog</strong> — a developing story with timestamped updates, newest first.</li><li><strong>Coverage tip / first reported by</strong> — when a story draws on reporting first published by another outlet, we credit that outlet with a link. We do not copy their wording.</li></ul>
<h2>Sourcing</h2>
<ul><li>We only use sources on an approved list, including official feeds and a small set of tip outlets used under the corroboration rules below.</li><li>Official statements prove what an official said, not that it is true. They are attributed.</li><li>Primary documents come first.</li><li>We represent views fairly, without false balance.</li><li>Times are given with an explicit time zone (UTC on this site).</li></ul>
<h2>Corroboration</h2>
<ul><li>For tip outlets whose licence does not allow reuse of their wording, we do not adapt their text. We may use bare facts, confirm them elsewhere, and write our own article.</li><li>We publish those stories only when core facts are confirmed by an official primary document we can link, or by at least one other independent outlet we already clear — not a syndicated copy of the same wire.</li><li>Conflicting or single-source non-official facts are dropped.</li></ul>
<h2>Attribution and credit</h2>
<ul><li>Every story links the official or primary source we relied on.</li><li>When another outlet first reported the news, we credit “First reported by …” or “Reported by … and …” with a link.</li><li>Quotes come from primary documents we link.</li></ul>
<h2>Sensitive topics</h2>
<p>Stories about elections, armed conflict, terrorism, immigration enforcement, or allegations or charges against people are held for human review before publication.</p>
<h2>Images</h2>
<p>We use only images we own or have a licence to use. Agency photos are never used. More detail: <a href="/copyright/">Copyright &amp; licensing</a>.</p>
<h2>Corrections</h2>
<p>When we get something wrong we fix the existing story, add a dated note, and list it in the <a href="/corrections/">corrections log</a>.</p>`);

staticPage('contact', '/contact/', 'Contact', `How to reach ${brand.name} editors, request a correction, or ask about licensing.`, `
<p>${B} is an independent publication. We take no funding from political parties or campaigns.</p>
<h2>Reach us</h2>
${contactLine()}
${SITE_URL_CFG ? ('<p>Site: <a href="' + esc(SITE_URL_CFG) + '">' + esc(SITE_URL_CFG.replace(/^https?:\/\//, '')) + '</a></p>') : ''}
<h2>Corrections</h2>
<p>If you think something we published is wrong, tell us which article and what is wrong. See the <a href="/corrections/">corrections</a> page.</p>
<h2>Copyright and takedown</h2>
<p>See <a href="/copyright/">Copyright &amp; takedown</a>.</p>
<h2>Privacy</h2>
<p>See <a href="/privacy/">Privacy Policy</a>.</p>`);

{
  const all = articles.flatMap((a) => (a.corrections || []).map((c) => ({ ...c, a }))).sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
  staticPage('corrections', '/corrections/', 'Corrections', `Corrections policy and every correction ${brand.name} has made.`, `
<h2>Policy</h2>
<p>When we get something wrong we fix the existing story, add a dated note on that story, and list the correction here.</p>
<ul><li><strong>What we correct.</strong> Factual errors in names, numbers, dates, titles, quotes and what a source said.</li><li><strong>How to ask.</strong> Tell us the article URL, what is wrong, and what the correct information is.</li><li><strong>Updates vs corrections.</strong> New developments are updates; a correction is used when we were wrong.</li></ul>
${contactLine('correction requests')}
<h2>Log</h2>
<p>Entries below come from sample articles and are not real corrections.</p>
${all.length ? ('<ol class="corr-log">' + all.map((c) => '<li>' + time(c.at) + ' — <a href="/news/' + c.a.slug + '/">' + esc(c.a.headline) + '</a><br>' + esc(c.note) + '</li>').join('') + '</ol>') : '<p>No corrections yet.</p>'}`);
}

staticPage('terms', '/terms/', 'Terms of Use', `Terms of Use for ${brand.name}: acceptable use, intellectual property, disclaimers and liability.`, `
${effLine}
<p>These Terms govern your use of the ${B} website and its feeds. By using the site you agree to them.</p>
<h2>What this site is</h2>
<p>${B} publishes news and related pages for general information. Content may change, be corrected or be removed.</p>
<h2>Acceptable use</h2>
<ul><li>Use the site lawfully. Do not disrupt, overload, or bypass access controls.</li><li>Do not misrepresent ${B} as endorsing a product, party or campaign.</li><li>Do not republish our original wording as your own without permission, except as allowed by fair use / fair dealing.</li></ul>
<h2>Intellectual property</h2>
<p>Original text, design and branding belong to ${B} unless a page says otherwise. Third-party material remains under its own licence; see <a href="/copyright/">Copyright &amp; licensing</a>.</p>
<h2>Links to third parties</h2>
<p>Links are not endorsements. Third-party sites have their own terms.</p>
<h2>No warranty</h2>
<p>The site is provided “as is”. We do not warrant that content is complete, current or free of error.</p>
<h2>Limitation of liability</h2>
<p>To the fullest extent permitted by law, ${B} is not liable for indirect or consequential damages arising from use of the site. Nothing excludes liability that cannot be excluded by law.</p>
<h2>Changes</h2>
<p>We may update these Terms. Continued use after a change means you accept the updated Terms.</p>
${GOVERNING_LAW ? ('<h2>Governing law</h2><p>These Terms are governed by the laws of ' + esc(GOVERNING_LAW) + '.</p>') : ''}
<h2>Contact</h2>
<p>See <a href="/contact/">Contact</a>.</p>`);

staticPage('privacy', '/privacy/', 'Privacy Policy', `How ${brand.name} handles personal data: hosting, cookies, logs, admin access and your rights.`, `
${effLine}
<p>This policy describes what ${B} collects. We do not run advertising networks or third-party analytics trackers on the public site.</p>
<h2>Who we are</h2>
<p>${B} operates this website. Privacy requests: <a href="/contact/">Contact</a>.</p>
<h2>Hosting and processors</h2>
<p>The site runs on Cloudflare (Workers, D1, KV and related services). Cloudflare processes requests as our infrastructure provider.</p>
<h2>What we collect</h2>
<ul><li><strong>Server and edge logs</strong> (IP, user agent, URL, timing) for security and reliability.</li><li><strong>Local preferences</strong> in your browser (<code>localStorage</code>) for theme and saved articles — not synced to our servers.</li><li><strong>Admin session cookie</strong> <code>nd_admin</code> (HttpOnly, Secure, SameSite=Strict) after editor login.</li><li><strong>Failed-login counters</strong> in KV keyed by IP for about 15 minutes.</li></ul>
<h2>Cookies</h2>
<p>See the <a href="/cookies/">Cookie Policy</a>.</p>
<h2>Fonts and embeds</h2>
<p>Fonts are self-hosted. No Google Fonts, comment widgets or ad iframes on article pages.</p>
<h2>Your rights</h2>
<p>Depending on where you live, you may have access, correction, deletion and related rights under GDPR, UK GDPR or CCPA-style laws. Use <a href="/contact/">Contact</a>.</p>
${contactLine('privacy requests')}
<h2>Children</h2>
<p>The site is not directed at children under 16.</p>
<h2>Changes</h2>
<p>We may update this policy. The effective date above will change when we do.</p>`);

staticPage('cookies', '/cookies/', 'Cookie Policy', `Cookies and local storage used by ${brand.name}.`, `
${effLine}
<p>The public site does not use advertising or analytics cookies.</p>
<h2>Cookies we set</h2>
<table><thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>Duration</th></tr></thead><tbody>
<tr><td><code>nd_admin</code></td><td>First-party, HttpOnly, Secure, SameSite=Strict</td><td>Editor admin session. Not used for public readers.</td><td>About 12 hours, or until sign-out</td></tr>
</tbody></table>
<h2>Local storage (not cookies)</h2>
<ul><li><strong>theme</strong> — light/dark preference.</li><li><strong>saved articles</strong> — on this device only.</li></ul>
<h2>Cloudflare</h2>
<p>Cloudflare may set or read cookies or similar signals for security and performance.</p>
<p>More: <a href="/privacy/">Privacy Policy</a>.</p>`);

staticPage('copyright', '/copyright/', 'Copyright & licensing', `How ${brand.name} credits OGL, CC BY and public-domain sources, and how to request a takedown.`, `
${effLine}
<h2>Our original text</h2>
<p>Articles and page copy written for ${B} are our original expression unless a credit says otherwise.</p>
<h2>Official and open licences</h2>
<ul><li><strong>UK Open Government Licence (OGL)</strong> — reuse with required attribution.</li><li><strong>CC BY</strong> — keep the credit and licence link.</li><li><strong>Public domain</strong> — credited when known.</li><li><strong>Other official releases</strong> — we link the original; we do not claim ownership.</li></ul>
<h2>Other newsrooms</h2>
<p>Where a tip outlet’s licence does not allow adapting their wording, we do not copy or rewrite their prose. We may confirm facts elsewhere, write our own article, and credit “First reported by …”.</p>
<h2>Takedown requests</h2>
<p>Email us with your name, the URL, a description of the work, and a good-faith statement that the use is unauthorised.</p>
${contactLine('takedown and licensing')}
<p>Related: <a href="/standards/">Editorial standards</a> · <a href="/terms/">Terms</a>.</p>`);

staticPage('accessibility', '/accessibility/', 'Accessibility statement', `Accessibility statement for ${brand.name}.`, `
${effLine}
<p>${B} aims to make its website usable by as many people as possible.</p>
<h2>What we do</h2>
<ul><li>Semantic headings, landmarks and a skip link.</li><li>Text alternatives for meaningful images.</li><li>Keyboard-usable controls and focus styles.</li><li>Self-hosted fonts with reduced layout shift.</li><li>Light and dark themes.</li></ul>
<h2>Standards</h2>
<p>We aim to meet WCAG 2.2 Level AA for pages we control. The site is still in development.</p>
<h2>Reporting a problem</h2>
${contactLine('accessibility')}
`);


// 404 (real 404: Cloudflare Pages serves dist/404.html with status 404; no SPA fallback)
fs.writeFileSync(path.join(OUT, '404.html'), layout({ title: `Page not found — ${brand.name}`, description: 'This page does not exist.', pathname: '/404.html', body: `<div class="wrap"><article class="prose notfound"><p class="eyebrow">Error 404</p><h1>Page not found</h1><p>There is no page at this address. It may never have existed, or the link may be wrong.</p><p><a href="/">Go to the home page</a>, see the <a href="/latest/">latest sample stories</a> or <a href="/sections/">browse sections</a>.</p></article></div>` }).replace(/<link rel="canonical"[^>]*>\n/, '').replace(/<meta name="robots"[^>]*>\n/, '').replace('<head>', '<head>\n<meta name="robots" content="noindex">'));

// JSON for the client: latest feed and search index (sample data, from the same article files)
const feedJson = articles.map((a) => ({ id: a.slug, url: urlOf(a), headline: a.headline, dek: a.dek, topic: a.topic, topicName: TOPICS[a.topic].name, label: a.label, type: a.type || 'article', sample: true, publishedAt: iso(a.publishedAt), updatedAt: iso(a.updatedAt) }));
fs.writeFileSync(path.join(OUT, 'latest.json'), JSON.stringify({ sample: true, note: 'Sample feed. Placeholder stories only; not real news.', items: feedJson }));
const staticIdx = [['/about/', `About ${brand.name}`], ['/standards/', 'Editorial standards'], ['/contact/', 'Contact'], ['/corrections/', 'Corrections'], ['/terms/', 'Terms of Use'], ['/privacy/', 'Privacy Policy'], ['/cookies/', 'Cookie Policy'], ['/copyright/', 'Copyright & licensing'], ['/accessibility/', 'Accessibility'], ['/latest/', 'Latest (sample feed)'], ['/sections/', 'Sections']].map(([url, title]) => ({ url, headline: title, topicName: 'Page', type: 'page' }));
fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify({ sample: true, items: [...feedJson.map(({ id, url, headline, dek, topic, topicName, label, type, updatedAt }) => ({ id, url, headline, dek, topic, topicName, label, type, updatedAt })), ...staticIdx] }));

// Sitemaps (lastmod from real content dates only, never build time). /search/ and /saved/ are utility pages and excluded.
const urlset = pages.map((p) => `  <url><loc>${esc(abs(p.pathname))}</loc><lastmod>${iso(p.lastmod)}</lastmod></url>`).join('\n');
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlset}\n</urlset>\n`);
const newsNow = Date.parse(process.env.NEWS_SITEMAP_NOW || articles.reduce((m, a) => (Date.parse(a.publishedAt) > Date.parse(m) ? a.publishedAt : m), '1970-01-01T00:00:00Z'));
const recent = articles.filter((a) => newsNow - Date.parse(a.publishedAt) <= 2 * 864e5 && Date.parse(a.publishedAt) <= newsNow);
fs.writeFileSync(path.join(OUT, 'news-sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Google News sitemap scaffold: sample content, not submitted anywhere. -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${recent.map((a) => `  <url>\n    <loc>${esc(abs(urlOf(a)))}</loc>\n    <news:news>\n      <news:publication><news:name>${esc(brand.name)}</news:name><news:language>en</news:language></news:publication>\n      <news:publication_date>${iso(a.publishedAt)}</news:publication_date>\n      <news:title>${esc(a.headline)}</news:title>\n    </news:news>\n  </url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(brand.name)}</title><link>${esc(abs('/'))}</link><description>${esc(site.description)}</description><language>en</language><lastBuildDate>${new Date(maxDate(articles)).toUTCString()}</lastBuildDate>\n${articles.map((a) => `<item><title>${esc(a.headline)}</title><link>${esc(abs(urlOf(a)))}</link><guid isPermaLink="true">${esc(abs(urlOf(a)))}</guid><pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate><description>${esc(a.dek)}</description><category>${esc(a.label)}</category></item>`).join('\n')}\n</channel></rss>\n`);

// robots + headers
fs.writeFileSync(path.join(OUT, 'robots.txt'), PREVIEW ? `# Preview build: not for indexing\nUser-agent: *\nDisallow: /\n` : `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\nSitemap: ${abs('/news-sitemap.xml')}\n`);
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
fs.writeFileSync(path.join(OUT, '_headers'), `/*\n${PREVIEW ? '  X-Robots-Tag: noindex, nofollow\n' : ''}  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Content-Security-Policy: ${csp}\n  Permissions-Policy: interest-cohort=(), browsing-topics=()\n\n/assets/*\n  Cache-Control: public, max-age=3600\n\n/assets/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n  Access-Control-Allow-Origin: *\n\n/latest.json\n  Cache-Control: no-cache\n`);

console.log(`Built ${pages.length} pages + 404 into dist/ (brand=${brand.name}, SITE_URL=${SITE_URL}, PREVIEW=${PREVIEW ? 1 : 0})`);
