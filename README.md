# PlenaryWire

An independent, English-language news publication **in development**, led by US and EU politics with room for major world news. Nonpartisan. Not an established newsroom.

> The static preview in this repository (`scripts/`, `content/`) contains **sample content only** (fictional places, placeholder sources). The full site in `web/` publishes AI-assisted summaries of official sources; see `docs/ARCHITECTURE.md`.
> The name "PlenaryWire" was chosen by the owner (formerly "NewsDesk 24"). No domain, trademark or social handle has been registered.

## Status

| Item | State |
| --- | --- |
| Static site (home, article, topic hubs, corrections, About, optional Disclosure (only when `aiDisclosure` is set), Sources & standards, Contact & ownership) | Built |
| Preview deploy on Cloudflare Pages (`plenarywire-preview`) | Noindex: `X-Robots-Tag`, meta robots and `robots.txt Disallow: /` |
| 30-minute checker (`pipeline/`) | Dry-run / draft-only, stub provider, **no schedule or cron** |

**On hold until separately approved:** buying a domain or any spend, connecting a paid model API, a live 30-minute schedule, publishing real news or allowing indexing, ad-network sign-up, any republishing of Reuters or CC/Open Newswire content (Reuters is link-and-summarise only; CC candidates are not cleared).

## Brand

The publication name, short name, tagline, wordmark and desk name live **only** in `config/brand.json`. `scripts/build.mjs` uses it for the masthead, titles, Open Graph, JSON-LD and disclosure pages, and content files use `{{name}}` / `{{shortName}}` / `{{tagline}}` / `{{desk}}` tokens. To rename, edit that one file and rebuild. (This README, `package.json` and the user agents also carry the name and are updated by hand on a rename.)

## Design

- Self-hosted OFL fonts: Newsreader (text and headlines) and Inter (UI), in `assets/fonts/` with licences. `font-display: optional` plus metric-matched fallbacks, so fonts never cause layout shift.
- Light and dark themes via `prefers-color-scheme`, plus a toggle. `assets/theme.js` is the only script on the site; CSP is `script-src 'self'`.
- Sticky slim header, mobile menu built on `<details>` (works without JS), CSS scroll-driven reading progress bar (hidden where unsupported).
- Image areas are CSS-only abstract placeholders labelled "Sample illustration"; no photos.

## Site

Zero dependencies (Node 20+ standard library).

```sh
npm run build          # -> dist/ (PREVIEW=1 by default; SITE_URL defaults to the preview URL)
npm test               # build + SEO/sample/ad invariants + pipeline unit checks
npm run deploy:preview # wrangler pages deploy dist --project-name plenarywire-preview --branch main
```

- Content lives in `content/articles/*.json`; every article must have `sample: true` in this preview.
- Articles render: what happened, why it matters (Analysis), what's confirmed (Fact), what's alleged or attributed, what's unknown, sources (primary first), published/updated times in UTC, change log, corrections.
- SEO: self-canonicals, `sitemap.xml` (lastmod = real `updatedAt`, never build time), `news-sitemap.xml` scaffold (not submitted), RSS `feed.xml`, NewsArticle JSON-LD that mirrors visible headline/dek/times, author = the PlenaryWire Desk (AI-assisted, an Organization). Real 404 via `404.html`, no SPA fallback.
- Ads: three reserved, labelled, **empty** slots on articles (below lead, article break, desktop sidebar 300×600) plus a home sidebar slot and a home break slot. Fixed dimensions (300×250 mobile, 728×90 desktop inline). No ad network, no scripts.
- CSP: `script-src 'self'` (only `/assets/theme.js`), `font-src 'self'`; no external fonts, scripts or trackers.

## Pipeline (dry run only)

```sh
npm run pipeline:dry-run   # node pipeline/checker.mjs
```

- `pipeline/sources.json` — allowlist. Only `enabled: true` sources are polled. Reuters is present but disabled (no automated access); CC/Open Newswire candidates are disabled (`not-cleared`). Enabling a not-cleared or no-automated-access source makes the run fail closed.
- Conditional requests (ETag / Last-Modified), persisted cursor in `pipeline/state/cursor.json` (gitignored), body hash, dedupe on canonical URL + event fingerprint. Unchanged sources/items stop before any model call.
- Caps: candidates, model calls and tokens per run; no-overlap lock file; bounded retry and per-source exponential backoff; fail closed on invalid config, non-stub provider, or too many failed sources.
- Drafts go to `drafts/` (gitignored) with `status: needs-review`, `publish: false`. Only metadata, a link and a stub are written; source article bodies are not stored. There is no publish code path.
- Providers: `pipeline/providers/index.mjs` exposes `stub` (default) and `noop`. Any other provider name throws.
