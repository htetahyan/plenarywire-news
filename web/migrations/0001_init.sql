-- PlenaryWire (formerly NewsDesk 24): articles, sources, source items (dedupe), run logs, lock.
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  publisher TEXT NOT NULL,
  default_section TEXT NOT NULL,
  mode TEXT NOT NULL,                -- 'official-rewrite' | 'link-and-summarise'
  enabled INTEGER NOT NULL DEFAULT 0,
  etag TEXT,
  last_modified TEXT,
  last_checked_at TEXT,
  last_status INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);

-- Every feed item we have seen. url_hash is the dedupe key; content_hash detects edits.
CREATE TABLE source_items (
  url_hash TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TEXT,
  content_hash TEXT,
  fingerprint TEXT,
  payload TEXT,                     -- JSON: feed summary + full official text captured at discovery
  status TEXT NOT NULL DEFAULT 'pending', -- pending | written | skipped | failed | rejected
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  article_id INTEGER,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_items_status ON source_items(status, first_seen_at);
CREATE INDEX idx_items_fp ON source_items(fingerprint);

CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  section TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'article',  -- article | liveblog | brief
  status TEXT NOT NULL DEFAULT 'published', -- published | unpublished
  headline TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_points TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  body TEXT NOT NULL DEFAULT '[]',         -- JSON array of paragraphs
  source_name TEXT NOT NULL,
  source_publisher TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_published_at TEXT,
  label TEXT NOT NULL DEFAULT 'AI-assisted summary of official sources',
  developing INTEGER NOT NULL DEFAULT 0,
  editor_pick INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  changelog TEXT NOT NULL DEFAULT '[]'     -- JSON array of {at, note}
);
CREATE INDEX idx_articles_status_updated ON articles(status, updated_at DESC);
CREATE INDEX idx_articles_section ON articles(section, status, updated_at DESC);

-- Live-blog entries (timestamped updates), newest first when rendered.
CREATE TABLE article_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_updates_article ON article_updates(article_id, at DESC);

CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger TEXT NOT NULL,                -- cron | admin | manual
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- running | ok | partial | skipped | error
  feeds_checked INTEGER NOT NULL DEFAULT 0,
  feeds_not_modified INTEGER NOT NULL DEFAULT 0,
  items_new INTEGER NOT NULL DEFAULT 0,
  articles_written INTEGER NOT NULL DEFAULT 0,
  rejected INTEGER NOT NULL DEFAULT 0,
  model_calls INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  log TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_runs_started ON runs(started_at DESC);

CREATE TABLE locks (
  name TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

INSERT INTO sources (id, name, url, publisher, default_section, mode, enabled) VALUES
 ('whitehouse-news', 'The White House — News', 'https://www.whitehouse.gov/news/feed/', 'The White House', 'us-politics', 'official-rewrite', 1),
 ('ec-presscorner', 'European Commission — Press corner', 'https://ec.europa.eu/commission/presscorner/api/rss?language=en', 'European Commission', 'eu-politics', 'official-rewrite', 1);
