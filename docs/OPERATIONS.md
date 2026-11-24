# PlenaryWire — operations

Live (preview, noindex): https://plenarywire.htetahyan.workers.dev — Worker `plenarywire`, D1 `newsdesk-24` (D1 databases cannot be renamed; the old name is kept). The old worker `newsdesk-24` is a redirect with no cron.

## Run / deploy
```bash
cd web
export CLOUDFLARE_ACCOUNT_ID=ffcd0f2772dcc28bd96cc6ed0d53c1fe WRANGLER_CACHE_DIR=/tmp/kvc/.wcache
npm ci
npm test                                  # ingest unit tests (validator, feed parsing)
npx wrangler d1 migrations apply newsdesk-24 --remote   # after adding a file in web/migrations/
npm run cf:build && npx wrangler versions upload && npx wrangler versions deploy … && npx wrangler triggers deploy
npx wrangler deployments list             # history;  npx wrangler tail  # live logs (cron runs log JSON lines)
```
Local: `npx wrangler d1 migrations apply newsdesk-24 --local`, optionally
`npx wrangler d1 execute newsdesk-24 --local --file tests/fixtures.sql` (TEST FIXTURES, local only), then
`npm run cf:build && npx wrangler dev`.

## Secrets (never in files, args or git)
- `GEMINI_API_KEY` — run `node scripts/connect-gemini.mjs` with `GEMINI_API_KEY` in the environment: it finds a working endpoint/model, updates `wrangler.jsonc` and stores the secret via stdin. Then deploy.
- `ADMIN_PASSWORD` — stored the same way; the only copy on the box is `.secrets/admin-password.txt` (chmod 600, gitignored).
Without `GEMINI_API_KEY` the cron still discovers items, but leaves them `pending` and writes nothing.

## Settings (`web/wrangler.jsonc` → `vars`)
| var | default | meaning |
| --- | --- | --- |
| `INDEXING_ENABLED` | `"false"` | the single indexing switch |
| `PIPELINE_ENABLED` | `"false"` (paused until domain) | must be `"true"` for any cron/admin/manual run to fetch or write |
| `GEMINI_ENDPOINT` | `vertex-express` | `vertex-express` (aiplatform.googleapis.com) or `gemini-api` (generativelanguage.googleapis.com) |
| `GEMINI_MODEL` | `gemini-3.5-flash` | model id (the key is a Vertex AI express key; gemini-2.5-* are not available to it, and the Gemini API is disabled on its project) |
| `MAX_NEW_PER_RUN` / `MAX_NEW_PER_DAY` | 5 / 150 | caps |
| `SITE_URL` | workers.dev URL | canonical/sitemap base |

### Pause / resume automatic news generation (domain gate)

**Current state (Nov 2026):** automatic generation is **OFF** until a domain is bought.

- `web/wrangler.jsonc` → `triggers.crons` is `[]` (no Cloudflare cron registered on `plenarywire`).
- `PIPELINE_ENABLED` is `"false"`: `runPipeline` returns immediately; the Worker `scheduled` handler also no-ops
  before any feed fetch or model call.
- The old worker `newsdesk-24` has **no cron** (redirect only). Verify anytime with:
  `GET /accounts/.../workers/scripts/plenarywire/schedules` and `.../newsdesk-24/schedules` (both should be `[]`).
- Site and `/admin` stay up. Admin "Run now" is gated by `PIPELINE_ENABLED` and will skip while paused.
- Do **not** re-enable until Htet has a domain and explicitly asks.

**To re-enable after a domain is ready (needs Htet's approval):**

1. Set `SITE_URL` to the real domain (and later `INDEXING_ENABLED` when ready to index).
2. Set `PIPELINE_ENABLED` to `"true"` in `wrangler.jsonc`.
3. Set `triggers.crons` back to `["*/30 * * * *"]` (or another agreed schedule).
4. `npm run cf:build`, upload/deploy the Worker version, then `npx wrangler triggers deploy`.
5. Confirm schedules API returns the cron, and a dry admin run (or one manual run) behaves as expected.

**To pause again quickly:** set `PIPELINE_ENABLED` to `"false"` and/or `triggers.crons` to `[]`, deploy version + `wrangler triggers deploy`.

## Flip indexing on later (needs Htet's approval)
1. Set `INDEXING_ENABLED` to `"true"` (and `SITE_URL` to the real domain once one is approved) in `wrangler.jsonc`, deploy.
2. That removes `X-Robots-Tag`, switches `<meta name="robots">` to index, follow, and serves a robots.txt that allows
   crawling (except /admin, /api, /search, /saved) and lists both sitemaps. /admin and /api stay noindex regardless.
3. Then submit `/sitemap.xml` and `/news-sitemap.xml` in Search Console.

## Rename the brand
Edit `config/brand.json` (name, shortName, tagline, wordmark, deskName, theme colours) and deploy. Everything — titles,
wordmark, bylines ("<name> Desk"), JSON-LD, RSS, admin — reads from it. Update the Worker name and
`SITE_URL` only if the URL should change too.

## Disclosure text (one flag, off by default)
All public pages currently carry **no AI-related wording** (no chips, notes, byline suffix or footer text).
To publish a disclosure, set `"aiDisclosure": "<your text>"` in `config/brand.json` and redeploy both builds.
Empty string (the default) = hidden everywhere. When set, the same text appears as a note on every article, at the
end of the footer legal line, and on `/disclosure/` (which returns 404 while the flag is empty; it is added to
`sitemap.xml` only when set). `node scripts/check.mjs` fails if AI wording appears in `dist/` while the flag is empty.

## Cost controls in the 30-minute job (efficiency pass, Nov 2026)
- **Feeds:** conditional GET (`If-None-Match` / `If-Modified-Since`); when a server ignores it (EC press corner), the
  feed body hash (`sources.body_hash`, migration 0004) is compared and an unchanged feed is not parsed. New items are
  looked up in one indexed `IN (...)` query per feed. Full source pages are fetched only for items that passed dedupe
  and are inside the per-run cap.
- **Gemini:** one call per article (thinking off, `thinkingBudget: 0`) returns the article plus SEO fields
  (alternative headline, keywords, entities). The input is trimmed (`trimForModel`: contact/share boilerplate dropped,
  whole paragraphs up to ~1,500 words) and the prompt is short; field rules live once in the response schema.
- **Repairs:** meta length, headline casing/clauses, summary length, caps, section and slug are fixed locally
  (`src/ingest/draft.ts`). A second call happens only when a factual guard fails (numbers, quotes, copying, names),
  at most once. There is no separate meta-description call any more.
- **Images:** looked up once, right after the article is written; the R2 copy is reused by source URL hash and an
  article that already has an image is never re-processed.
- **D1:** the daily-cap count uses `idx_articles_published` (range on `published_at`); runs log `item.drafted` lines with
  per-article tokens, calls and local fixes.

## Sources (official feeds, licence recorded per source)
Each row in `sources` carries `licence_url` and `licence_note` (migration 0005) and has scope rules in
`web/src/ingest/sources.ts`. Enabled (Nov 2026):

| id | Publisher | Default section | Licence | Scope rule |
| --- | --- | --- | --- | --- |
| whitehouse-news | The White House | US politics | US gov work, public domain | full text from feed |
| ec-presscorner | European Commission | EU politics | CC BY 4.0 (Decision 2011/833/EU) | documents API |
| fed-press | Federal Reserve Board | Economy | public domain unless noted; cite the Board | enforcement / bank-application notices skipped |
| ecb-press | European Central Bank | Economy | free use, ECB cited as source, accurate | press releases only (`/press/pr/`); interviews, speeches, authored papers skipped |
| ftc-press | FTC | Tech | US gov work, public domain; "Source: FTC" | all press releases |
| nist-news | NIST | Tech | public information; credits requested | all news |
| nasa-news | NASA | Tech | not copyrighted; acknowledge NASA | APOD skipped; images only when the caption credit is NASA itself |
| eu-digital | European Commission (digital strategy) | Tech | CC BY 4.0 | same-story duplicates of press-corner releases skipped |

Full accepted/rejected register (with licence URLs and the 2026-11-09 check date): `docs/SOURCES.md`.
World sources added Nov 2026: UK FCDO + PMO (OGL v3), DoD news (PD), DOJ press (PD, usually held),
Federal Register PRESDOCU (PD), plus facts-only ProPublica / Conversation / Global Voices / Democracy Now! (NC/ND → extract/corroborate/write from primary; tip pages removed).
Rejected highlights: State / EEAS / EP / Council of the EU 403; Canada.ca news commercial clearance needed; NATO Fair Use only; Australia feeds unreachable.

Fair share: candidates are capped per source (`MAX_PER_SOURCE_PER_RUN`, default 2), then **section-balanced**
(`pickSectionBalanced` in `web/src/ingest/fair-select.ts`) so US/EU/World/Economy/Tech each get a slot
before one busy tech feed can fill the whole run. Official-rewrite is preferred over facts-only inside a section.
At most `MAX_PER_SOURCE_PER_RUN` (default 2) per source per run and
`sources.max_per_day` (default 12 for the new sources) per source per day, inside the global 5/run and 150/day caps.
The section is picked by topic inside the single Gemini call (central banks → Economy, digital/space/science → Tech,
foreign affairs → World), falling back to the source's default section. Items first seen more than 48 h after
publication are skipped, so new sources fill up from their next releases rather than by backfilling.

## Caching
worker.ts keeps a 30-second in-memory copy of anonymous public GET responses per isolate (header `x-nd-cache: hit`).
This keeps CPU per request near 0 ms on the free plan. New or edited stories can take up to 30 s to appear;
admins (with the session cookie) always see fresh pages.

## Costs and limits (free plan; no paid Cloudflare plan is used)
- Workers free: 100,000 requests/day, 10 ms CPU per request, 3 MB compressed script (this build is about 1.05 MB gzip).
- D1 free: 5 M rows read/day, 100 k rows written/day, 5 GB. A page view reads about 70-100 rows, so roughly 50 k page
  views/day before the read limit. Each run writes a few dozen rows.
- KV free: 100 k reads / 1 k writes per day (only failed admin logins write).
- Cron triggers: included. 48 runs/day.
- Gemini (billed by Google to the key's project, not Cloudflare). Measured on the first 6 articles (gemini-3.5-flash, thinking
  off): 15.0 k input + 5.2 k output tokens in 12 calls, i.e. about 2.5 k in / 0.9 k out per article including repairs.
  The estimate below used gemini-2.5-flash list prices; check current gemini-3.5-flash pricing on Vertex AI. gemini-2.5-flash list prices are about $0.30/M input and $2.50/M output,
  so about $0.004 per article: roughly $0.10-0.20/day at the White House + EC volume, about $0.60/day at the 150 cap.
  Runs with no new items make no model calls.
- R2 is enabled on the account but not used: the sources have no images we are licensed to reuse, so stories use the
  CSS illustrations.

## Brand assets, images and SEO (added Nov 2026)

- **Logo**: `assets/brand/` (mark, full logo light/dark/auto, favicons, app icons, `site.webmanifest`, `og-default.jpg`, `publisher-logo-600x60.png`, section cards `cards/<section>-{16x9,4x3,1x1}.jpg`). Rebuild with `python3 scripts/brand/build-logo.py` (needs fonttools + brotli) then `node scripts/brand/render-raster.mjs` (Playwright). Colours live in `config/brand.json` → `colors`.
- **Images**: `web/src/ingest/images.ts`. Only EC images (© European Union, CC BY 4.0), captioned "Official White House Photo" images (public domain), and Commons files listed in `config/image-registry.json` whose licence the Commons API reports as PD/CC0/CC BY/CC BY-SA at use time. Agency credits (AP, Getty, Reuters, AFP, …) are always rejected. Crops (16x9 1200/640, 4x3, 1x1) are made with the Images binding (free plan, 5,000 unique transformations/month; over the limit it fails, it never bills) and stored in R2 bucket `plenarywire-images`, served at `/img/<key>/<variant>.webp`. No cleared image → branded placeholder (logo + section + headline) and the section card for OG/JSON-LD.
- **Backfill** (admin session required, POST): `/api/admin/images/` (6 articles per call) and `/api/admin/seo/` (keywords, entities, alternative headline; 5 per call, 1 model call each).
- **SEO**: keywords/entities are dropped unless they appear in the source text. Tag pages at `/tags/<slug>/`. noindex stays until `INDEXING_ENABLED=true`; `max-image-preview:large` is always declared.
