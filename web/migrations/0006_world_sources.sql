-- World + more official US sources; tip-only open newsrooms; hold-for-review is an articles.status value ('held').
INSERT OR IGNORE INTO sources (id, name, url, publisher, default_section, mode, enabled, licence_url, licence_note, max_per_day) VALUES
 ('uk-fcdo', 'UK Foreign, Commonwealth & Development Office — News', 'https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=foreign-commonwealth-development-office', 'UK Government (FCDO)', 'world', 'official-rewrite', 1,
  'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/', 'Open Government Licence v3.0: copy, adapt, publish with attribution. Logos, crests and third-party photos excluded (use placeholder)', 12),
 ('uk-pmo', 'UK Prime Minister''s Office — News', 'https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=prime-ministers-office-10-downing-street', 'UK Government (Prime Minister''s Office)', 'world', 'official-rewrite', 1,
  'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/', 'Open Government Licence v3.0: copy, adapt, publish with attribution. Logos, crests and third-party photos excluded', 12),
 ('dod-news', 'US Department of Defense — News stories', 'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=20', 'US Department of Defense', 'world', 'official-rewrite', 1,
  'https://www.defense.gov/', 'US government work, public domain (17 U.S.C. 105); third-party / DVIDS photos excluded unless clearly a federal work — use placeholder', 12),
 ('doj-press', 'US Department of Justice — Press releases', 'https://www.justice.gov/news/rss?type=press_release', 'US Department of Justice', 'us-politics', 'official-rewrite', 1,
  'https://www.justice.gov/legalpolicies', 'US government work, public domain unless otherwise indicated; DOJ seals not reusable. Most items held for human review (charges/allegations)', 8),
 ('fr-presdocu', 'Federal Register — Presidential documents', 'https://www.federalregister.gov/api/v1/documents.rss?conditions%5Btype%5D%5B%5D=PRESDOCU&order=newest&per_page=20', 'Federal Register', 'us-politics', 'official-rewrite', 1,
  'https://www.federalregister.gov/reader-aids/government-policy-and-ofr-procedures/copyright-status', 'US government work, public domain (17 U.S.C. 105)', 8),
 -- tip-only: NC/ND or systematic-republish limits — headline + link + attribution only, never model-rewrite their text
 ('propublica', 'ProPublica — Top stories (tip only)', 'https://feeds.propublica.org/propublica/main', 'ProPublica', 'world', 'tip-only', 1,
  'https://creativecommons.org/licenses/by-nc-nd/3.0/', 'CC BY-NC-ND: tip/link/attribution only — never republish or rewrite ProPublica text', 3),
 ('conversation', 'The Conversation — Articles (tip only)', 'https://theconversation.com/articles.atom', 'The Conversation', 'world', 'tip-only', 1,
  'https://theconversation.com/us/republishing-guidelines', 'CC BY-ND 4.0: no derivatives; tip/link only (extract+link OK). Do not systematically republish all articles', 3),
 ('globalvoices', 'Global Voices — Feed (tip only)', 'https://globalvoices.org/feed/', 'Global Voices', 'world', 'tip-only', 1,
  'https://globalvoices.org/about/global-voices-attribution-policy/', 'CC BY 3.0 (text may be adapted with attribution); tip-only for now; images need separate rights — use placeholder', 3),
 ('democracynow', 'Democracy Now! — Feed (tip only)', 'https://www.democracynow.org/democracynow.rss', 'Democracy Now!', 'world', 'tip-only', 1,
  'https://creativecommons.org/licenses/by-nc-nd/3.0/', 'CC BY-NC-ND: tip/link/attribution only — never republish or rewrite Democracy Now! text', 3);
