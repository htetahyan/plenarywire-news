-- More official sources (World/Economy/Tech), each with its reuse licence; per-source daily fair share.
ALTER TABLE sources ADD COLUMN licence_url TEXT;
ALTER TABLE sources ADD COLUMN licence_note TEXT;
ALTER TABLE sources ADD COLUMN max_per_day INTEGER NOT NULL DEFAULT 30;
CREATE INDEX IF NOT EXISTS idx_items_source_status ON source_items(source_id, status, updated_at);

UPDATE sources SET licence_url='https://www.whitehouse.gov/copyright/', licence_note='US government work, public domain (17 U.S.C. 105); third-party photos excluded' WHERE id='whitehouse-news';
UPDATE sources SET licence_url='https://commission.europa.eu/legal-notice_en', licence_note='Commission reuse policy (Decision 2011/833/EU), CC BY 4.0: credit + changes indicated' WHERE id='ec-presscorner';

INSERT OR IGNORE INTO sources (id, name, url, publisher, default_section, mode, enabled, licence_url, licence_note, max_per_day) VALUES
 ('fed-press', 'Federal Reserve Board — Press releases', 'https://www.federalreserve.gov/feeds/press_all.xml', 'Federal Reserve Board', 'economy-policy', 'official-rewrite', 1,
  'https://www.federalreserve.gov/disclaimer.htm', 'Public domain unless otherwise indicated; cite the Board as the source. Enforcement/bank-application notices skipped', 12),
 ('ecb-press', 'European Central Bank — Press releases', 'https://www.ecb.europa.eu/rss/press.html', 'European Central Bank', 'economy-policy', 'official-rewrite', 1,
  'https://www.ecb.europa.eu/services/disclaimer/html/index.en.html', 'Free use if accurate and the ECB is cited as source; authored papers and interviews excluded (press releases only)', 12),
 ('ftc-press', 'Federal Trade Commission — Press releases', 'https://www.ftc.gov/feeds/press-release.xml', 'Federal Trade Commission', 'tech', 'official-rewrite', 1,
  'https://www.ftc.gov/policy-notices/website-policy', 'US government work, public domain (17 U.S.C. 105); attribution "Source: FTC"; no endorsement implied', 12),
 ('nist-news', 'NIST — News', 'https://www.nist.gov/news-events/news/rss.xml', 'National Institute of Standards and Technology', 'tech', 'official-rewrite', 1,
  'https://www.nist.gov/oism/copyrights', 'Public information, may be distributed; credits requested; material marked copyrighted excluded', 12),
 ('nasa-news', 'NASA — News releases', 'https://www.nasa.gov/news-release/feed/', 'NASA', 'tech', 'official-rewrite', 1,
  'https://www.nasa.gov/nasa-brand-center/images-and-media/', 'NASA content generally not copyrighted; acknowledge NASA; third-party images and APOD skipped', 12),
 ('eu-digital', 'European Commission — Shaping Europe''s digital future (news)', 'https://digital-strategy.ec.europa.eu/en/rss.xml', 'European Commission', 'tech', 'official-rewrite', 1,
  'https://digital-strategy.ec.europa.eu/en/pages/legal-notice', 'Commission reuse policy, CC BY 4.0: credit + changes indicated', 12);
