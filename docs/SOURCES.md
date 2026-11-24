# PlenaryWire source register

Checked **2026-11-09**; politics feeds extended **2026-11-10** (Asia/Dubai). Every enabled source must appear here with licence/terms basis. Feeds that return 403 to our honest UA (`PlenaryWire-bot/1.0`) are rejected — we never spoof a browser UA. Image policy: only explicit reusable licences; otherwise branded placeholder. Never AP/Getty/Reuters/AFP.

Modes: `official-rewrite` (Gemini rewrite of primary official text) · `facts-only` (for NC/ND tip outlets: extract bare facts → corroborate with a primary/official source → write original text from the primary only; never adapt the tip outlet’s wording). Tip-only pages were removed 2026-11-09.

## Enabled

| id | Publisher | Feed | Section | Mode | Licence / terms | Terms URL |
| --- | --- | --- | --- | --- | --- | --- |
| whitehouse-news | The White House | whitehouse.gov/news/feed | us-politics | rewrite | US gov work, PD (17 USC 105) | https://www.whitehouse.gov/copyright/ |
| ec-presscorner | European Commission | presscorner RSS | eu-politics | rewrite | Decision 2011/833/EU, CC BY 4.0 | https://commission.europa.eu/legal-notice_en |
| fed-press | Federal Reserve | press_all.xml | economy-policy | rewrite | PD unless noted; cite the Board | https://www.federalreserve.gov/disclaimer.htm |
| ecb-press | ECB | rss/press.html | economy-policy | rewrite | Free use if accurate + ECB cited; PR only | https://www.ecb.europa.eu/services/disclaimer/html/index.en.html |
| ftc-press | FTC | press-release.xml | tech | rewrite | US gov PD; “Source: FTC” | https://www.ftc.gov/policy-notices/website-policy |
| nist-news | NIST | news rss | tech | rewrite | Public information; credits requested | https://www.nist.gov/oism/copyrights |
| nasa-news | NASA | news-release feed | tech | rewrite | Generally not copyrighted; acknowledge NASA | https://www.nasa.gov/nasa-brand-center/images-and-media/ |
| eu-digital | EC digital strategy | digital-strategy rss | tech | rewrite | CC BY 4.0 | https://digital-strategy.ec.europa.eu/en/pages/legal-notice |
| uk-fcdo | UK FCDO | GOV.UK Atom (org=FCDO) | world | rewrite | OGL v3.0 (text); logos/crests/3rd-party photos excluded | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| uk-pmo | UK Prime Minister’s Office | GOV.UK Atom (org=PMO) | world | rewrite | OGL v3.0 (text) | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| dod-news | US Department of Defense | ArticleCS RSS (ContentType=1) | world | rewrite | US gov PD (17 USC 105); DVIDS/3rd-party photos → placeholder | https://www.defense.gov/ (federal works) |
| doj-press | US DOJ | /news/rss?type=press_release | us-politics | rewrite | PD unless noted (legalpolicies); seals not reusable. **Usually held** for charges/allegations | https://www.justice.gov/legalpolicies |
| fr-presdocu | Federal Register | PRESDOCU API RSS | us-politics | rewrite | US gov PD | https://www.federalregister.gov/reader-aids/government-policy-and-ofr-procedures/copyright-status |
| propublica | ProPublica | feeds.propublica.org/propublica/main | world | **facts-only** | CC BY-NC-ND — tip/link only | https://creativecommons.org/licenses/by-nc-nd/3.0/ |
| conversation | The Conversation | articles.atom | world | **facts-only** | CC BY-ND 4.0: no derivatives of their text; corroborate + write from primary | https://theconversation.com/us/republishing-guidelines |
| globalvoices | Global Voices | /feed/ | world | **facts-only** | CC BY 3.0: still corroborate + write from primary; images separate | https://globalvoices.org/about/global-voices-attribution-policy/ |
| democracynow | Democracy Now! | democracynow.rss | world | **facts-only** | CC BY-NC-ND: never adapt their text; corroborate + write from primary | https://creativecommons.org/licenses/by-nc-nd/3.0/ |
| uk-cabinet-office | UK Cabinet Office | GOV.UK Atom | world | rewrite | OGL v3.0 | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| uk-hmt | HM Treasury | GOV.UK Atom | economy-policy | rewrite | OGL v3.0 | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| uk-home-office | UK Home Office | GOV.UK Atom | world | rewrite | OGL v3.0; immigration/charges usually held | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| uk-mod | UK MoD | GOV.UK Atom | world | rewrite | OGL v3.0; conflict items held | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| uk-dbt | UK DBT | GOV.UK Atom | economy-policy | rewrite | OGL v3.0 | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| uk-dsit | UK DSIT | GOV.UK Atom | tech | rewrite | OGL v3.0 | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| whitehouse-actions | The White House | presidential-actions/feed | us-politics | rewrite | US gov PD (17 USC 105) | https://www.whitehouse.gov/copyright/ |


## Rejected (2026-11-09 / 2026-11-10)

| Candidate | Why |
| --- | --- |
| White House briefings-statements feed | Overlaps heavily with whitehouse-news; skipped to avoid duplicate events |
| Federal Register EO / proclamation-only RSS | Already covered by fr-presdocu (PRESDOCU) |
| UK No.10 speeches-only Atom | Overlaps uk-pmo; speeches often need heavier human review |
| US Senate general_news RSS | HTTP 403 to honest UA |
| US House press RSS | HTTP 404 |
| Ireland gov.ie news feeds | HTTP 403 to honest UA — licence not relied on while blocked |
| German Bundesregierung / Bundeskanzler EN RSS | HTTP 404 / no working EN feed from this network |
| EC Spokesperson / documents API variants | HTTP 400/404; existing ec-presscorner RSS remains the cleared EC feed |
| Reuters / AP | No reuse licence for automated rewrite; robots/terms bar scraping |
| UN News | Reuse requires notifying the UN first — needs Htet contact |
| Wikinews | Read-only since May 2026 |
| US State Department RSS | HTTP 403 to honest bot UA |
| EEAS press RSS | HTTP 403 |
| European Parliament press RSS | HTTP 403 |
| Council of the EU press RSS | HTTP 403 (legal notice not relied on while feed is blocked) |
| Congress.gov | HTTP 403 / Cloudflare; API needs a free key we do not have |
| SCOTUS opinions RSS | No working feed (404) |
| DHS newsroom RSS | No working feed (404) |
| ICE newsroom | `/rss.xml` is not press releases (videos / MOA node titles); no usable PR feed |
| DoD `/News/.../RSS/` pretty URLs | HTTP 403 (ashx endpoint above works instead) |
| Treasury / OFAC press RSS | Timeout / no response from this network |
| Canada.ca News Atom | Feed works, but canada.ca terms: commercial reproduction needs prior written permission; OGL-Canada covers open data, not these news pages → skip |
| Australia PM / DFAT / ministers.dfat RSS | Feeds 404 or timeout; licence (CC BY 4.0 on pm.gov.au text, photos excluded) OK in principle — revisit when a stable feed answers |
| NATO news | Legal page: Fair Use only, not an open licence; may request removal; archives need written permission for commercial use → skip |
| government.nl news RSS | CC0 texts OK in principle, but RSS endpoints 404 / HTML error page |
| Beehive NZ / government.se / regjeringen.no | Bot challenge / block pages to honest UA |
| GovInfo bills RSS | Works but is bill text dumps, not news — out of editorial scope |

## Human review (`articles.status = held`)

Auto-publish is blocked when title/summary/body match elections, armed conflict, terrorism, allegations/charges against people, or immigration enforcement. DOJ items almost always hold. Approve or Reject in `/admin/edit/<id>/`.


## Facts-only rule (NC/ND tip outlets)

Facts are not copyrightable; the tip outlet’s expression is. For `facts-only` sources we:

1. Cheap-check for corroboration: an official primary **or** ≥1 other independent cleared outlet on the same event (title overlap + ±3 days; not a syndicated copy). Prefer 2+ sources.
2. Only then extract bare facts (small model call) from matched tips.
3. Keep facts that agree; drop conflicts and single-source claims (official-primary-only facts may stay).
4. Write from the **agreed fact list (+ primary text if any)**. Tip NC/ND text never enters the writing call.
5. Credit every outlet: “Reported by X and Y”. Copy-guard against all tip texts used.
6. Sensitive topics still go to `held`.

Tip-only Coverage tip pages were deleted on 2026-11-09 (URLs 404).
