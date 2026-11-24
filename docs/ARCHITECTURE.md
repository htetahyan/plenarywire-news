# PlenaryWire — architecture (full version)

The full site lives in `web/`. The older static preview (`scripts/build.mjs`, `dist/`, `pipeline/`) is kept untouched at
plenarywire-preview.pages.dev (old: newsdesk-24-preview.pages.dev, now redirects) until the new site is signed off.

```
                ┌────────────── Cloudflare Worker "plenarywire" (free workers.dev) ──────────────┐
 Reader ──────▶ │ worker.ts                                                                   │
                │  ├─ fetch  → OpenNext (Next.js 16 App Router, server components)            │
                │  │           + headers: X-Robots-Tag (INDEXING_ENABLED), CSP, nosniff, etc. │
                │  └─ scheduled (cron */30 * * * *) → src/ingest/run.ts                       │
                │ static assets (.open-next/assets: CSS, fonts, app.js, _next/*)              │
                └───────┬───────────────────────┬──────────────────────────┬─────────────────┘
                        │ D1 "newsdesk-24"*     │ KV (login rate limit)    │ HTTPS
                        ▼                       ▼                          ▼
             articles, article_updates,                        White House RSS, EC Press corner
             sources, source_items, runs, locks                RSS + documents API, Gemini API
```

* D1 databases cannot be renamed, so the database keeps its original name `newsdesk-24`.

## Web app (`web/src/app`)
- All pages are dynamic server components that read D1 on each request, so a story is live the moment a run commits it
  (no ISR cache to invalidate). Pages: `/`, `/latest/`, `/sections/`, `/topics/[key]/`, `/news/[slug]/` (article and
  live-blog), `/search/`, `/saved/`, `/about/`, `/disclosure/` (only when `aiDisclosure` is set), `/standards/`, `/contact/`, `/corrections/`, real 404.
- Machine endpoints: `/latest.json` (feed for the "N new stories" pill), `/search-index.json`, `/sitemap.xml`,
  `/news-sitemap.xml` (last 48 h), `/feed.xml` (RSS), `/robots.txt`.
- Design is the same as the static preview: `assets/site.css`, `assets/theme.js` and fonts are copied in by
  `web/scripts/sync-assets.mjs`; `web/client/app.js` is the preview's `app.js` with sample wording removed and a wait for
  React hydration (`nd:hydrated`, fired by `components/Hydrated.tsx`) so DOM enhancements never race hydration.
- Brand: only `config/brand.json` (copied to `web/src/generated/config.json` at build). Sections: `content/site.json` topics.
- SEO structure: NewsArticle / LiveBlogPosting JSON-LD with `isBasedOn` the official source, canonical tags, OG/Twitter
  tags, sitemaps, RSS. Ad slots are reserved, labelled and empty.

## Ingest + write job (`web/src/ingest`)
1. Lock: a row in `locks` (25-minute TTL) — overlapping runs exit with `lock.busy`.
2. Fail-closed source check: only `sources.enabled=1` with an allowed mode (`official-rewrite` | `facts-only` | `link-and-summarise`); reuters.com and non-https are refused.
   See `docs/SOURCES.md` for the live register. Reuters stays disabled.
3. Discover: conditional GET (ETag / If-Modified-Since). New items go to `source_items` keyed by a SHA-256 of the
   canonical URL; a content hash detects edits; an event fingerprint (headline tokens + day) skips duplicates.
   Items older than 48 h when first seen and EC "Daily News" digests are skipped.
4. Write: up to `MAX_NEW_PER_RUN` (5) per run and `MAX_NEW_PER_DAY` (150) per UTC day. Full official text comes from
   the White House feed's `content:encoded` or the EC documents API. Gemini writes JSON against a response schema
   (headline, 150-160 char meta description, summary, key points, body, section, slug).
5. Validate (`validate.ts`): lengths and fields; every number must appear in the source; every quoted passage must match
   the source verbatim; no 14-word runs copied from the source; no model meta-talk. A meta description outside 150-160
   characters gets one cheap fix-up call. Failures are rejected (2 attempts), never published.
6. Publish: the article row (byline "<brand> Desk", label "Official source",
   source name/link) plus a change-log entry. The run row records counts, model calls, tokens and a JSON log.

## Admin (`/admin/`)
Password from the `ADMIN_PASSWORD` Worker secret; HMAC-signed 12-hour HttpOnly/Secure/SameSite=Strict cookie;
same-origin check on every POST; 8 failed logins per IP per 15 minutes (KV). List, edit (change-log note; notes that
start with "Correction:" appear in the corrections log), publish/unpublish, delete, mark developing (drives the red
banner), editor pick (drives "Editor picks", otherwise "Most recent"), add live updates (turns a story into a live blog),
run ingest now, view sources and run logs.


## Facts-only mode (`web/src/ingest/facts-only.ts`)

Used for NC/ND (and similar) tip outlets such as ProPublica, The Conversation, Democracy Now!, and Global Voices.

**Legal rule we follow:** facts are not copyrightable; the tip outlet’s expression is. We never adapt their wording.

1. **Cheap corroboration check first** (no model): same-event match (title/entity overlap + ±3-day window) against any enabled D1 feed (official or another tip outlet) with a **different publisher**, or an https link on an allowed official host. Syndicated copies (long shared n-grams) are not independent. Prefer 2+ total sources. If none → skip, **0 model tokens**.
2. **Extract** (small Gemini call): bare fact list + cited primary URLs from the tip text. Tip text is used only here.
3. **Confirm**: extract facts from matched tips; keep facts that **agree across sources**. Drop single-source claims and number conflicts (unless the sole source is an official primary). Core conflict with nothing agreed → skip.
4. **Write**: from the **agreed fact list (+ primary text if any)**. NC/ND tip text is never in the writing prompt. Credit: “Reported by X and Y”.
5. **Guards**: copy-guard (8+ words) against **all** tip/outlet texts used; existing number/name/quote guards. Sensitive topics → `held`.
6. **Official rewrite**: when an independent second source on the same event exists, omit number+unit conflicts (no extra model call).

Caps, 48-hour window, and noindex are unchanged. Tip-only “Coverage tip” pages were removed (2026-11-09); those URLs 404.
