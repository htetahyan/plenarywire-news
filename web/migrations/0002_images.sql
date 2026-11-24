-- Licensed lead images. articles.image holds the chosen image as JSON:
-- {key, src, credit, licence, licenceUrl, sourcePage, alt, kind, w, h}; NULL means "use the branded topic card".
ALTER TABLE articles ADD COLUMN image TEXT;

-- One row per source image cached to R2 (webp variants under img/<key>/), reused across articles.
CREATE TABLE images (
  key TEXT PRIMARY KEY,          -- sha256(src) prefix
  src TEXT NOT NULL,             -- original image URL
  credit TEXT NOT NULL,          -- e.g. "© European Union", "Official White House Photo by …"
  licence TEXT NOT NULL,         -- e.g. "CC BY 4.0", "Public domain"
  licence_url TEXT NOT NULL,
  source_page TEXT NOT NULL,     -- page where the image and its licence were found
  alt TEXT NOT NULL,
  kind TEXT NOT NULL,            -- ec-global | ec-portrait | wh-figure | commons
  width INTEGER, height INTEGER, -- original size
  variants TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
