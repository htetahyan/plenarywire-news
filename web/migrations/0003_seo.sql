-- SEO metadata produced from the source only: alternative headline, keywords, named entities; plus tag index.
ALTER TABLE articles ADD COLUMN alt_headline TEXT;
ALTER TABLE articles ADD COLUMN keywords TEXT NOT NULL DEFAULT '[]';   -- JSON array of strings
ALTER TABLE articles ADD COLUMN entities TEXT NOT NULL DEFAULT '[]';   -- JSON array of {name, type}
CREATE TABLE article_tags (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,           -- slug
  name TEXT NOT NULL,          -- display name
  PRIMARY KEY (article_id, tag)
);
CREATE INDEX idx_tags_tag ON article_tags(tag);
