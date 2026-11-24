-- Cheap "nothing changed" check for feeds that ignore conditional GET, and an index for the daily cap count.
ALTER TABLE sources ADD COLUMN body_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
