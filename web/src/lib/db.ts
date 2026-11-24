import { env, type Env } from "./env";
import type { SourceLicence } from "./licence-credit";

export type ArticleImage = { key: string; credit: string; licence: string; licenceUrl: string; sourcePage: string; alt: string; kind: string; w: number; h: number };
export type Update = { id: number; at: string; title: string; body: string[] };
export type Article = {
  id: number; slug: string; section: string; type: "article" | "liveblog" | "brief"; status: string;
  headline: string; metaDescription: string; summary: string; keyPoints: string[]; body: string[];
  source: { name: string; publisher: string; url: string; title: string; publishedAt: string | null };
  label: string; developing: boolean; editorPick: boolean; model: string | null;
  publishedAt: string; updatedAt: string; changelog: { at: string; note: string }[]; updates: Update[];
  image: ArticleImage | null;
  altHeadline: string | null; keywords: string[]; entities: { name: string; type: string }[];
};

const j = <T,>(s: unknown, d: T): T => { try { return s ? (JSON.parse(String(s)) as T) : d; } catch { return d; } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToArticle(r: any, updates: Update[] = []): Article {
  return {
    id: r.id, slug: r.slug, section: r.section, type: r.type, status: r.status,
    headline: r.headline, metaDescription: r.meta_description, summary: r.summary,
    keyPoints: j(r.key_points, []), body: j(r.body, []),
    source: { name: r.source_name, publisher: r.source_publisher, url: r.source_url, title: r.source_title, publishedAt: r.source_published_at },
    label: r.label, developing: !!r.developing, editorPick: !!r.editor_pick, model: r.model,
    publishedAt: r.published_at, updatedAt: r.updated_at, changelog: j(r.changelog, []), updates,
    image: j<ArticleImage | null>(r.image, null),
    altHeadline: r.alt_headline ?? null, keywords: j(r.keywords, []), entities: j(r.entities, []),
  };
}

const LIST_COLS = "id, slug, section, type, status, headline, meta_description, summary, key_points, '[]' AS body, source_name, source_publisher, source_url, source_title, source_published_at, label, developing, editor_pick, model, published_at, updated_at, '[]' AS changelog, image, alt_headline, keywords, entities";

export async function listArticles(opts: { section?: string; limit?: number; offset?: number } = {}, e: Env = env()): Promise<Article[]> {
  const limit = Math.min(opts.limit ?? 50, 200), offset = opts.offset ?? 0;
  const q = opts.section
    ? e.DB.prepare(`SELECT ${LIST_COLS} FROM articles WHERE status='published' AND section=? ORDER BY updated_at DESC LIMIT ? OFFSET ?`).bind(opts.section, limit, offset)
    : e.DB.prepare(`SELECT ${LIST_COLS} FROM articles WHERE status='published' ORDER BY updated_at DESC LIMIT ? OFFSET ?`).bind(limit, offset);
  const { results } = await q.all();
  return results.map((r) => rowToArticle(r));
}

export async function getArticle(slug: string, e: Env = env()): Promise<Article | null> {
  const r = await e.DB.prepare("SELECT * FROM articles WHERE slug=? AND status='published'").bind(slug).first();
  if (!r) return null;
  const { results } = await e.DB.prepare("SELECT id, at, title, body FROM article_updates WHERE article_id=? ORDER BY at DESC").bind(r.id).all();
  return rowToArticle(r, results.map((u) => ({ id: u.id as number, at: u.at as string, title: u.title as string, body: j(u.body, [] as string[]) })));
}

export async function sectionCounts(e: Env = env()): Promise<Record<string, number>> {
  const { results } = await e.DB.prepare("SELECT section, COUNT(*) AS n FROM articles WHERE status='published' GROUP BY section").all();
  return Object.fromEntries(results.map((r) => [r.section as string, r.n as number]));
}

export async function listByTag(tag: string, e: Env = env()): Promise<{ name: string | null; list: Article[] }> {
  const { results } = await e.DB.prepare(`SELECT ${LIST_COLS.split(", ").map((c) => (c.includes(" AS ") ? c : "a." + c)).join(", ")}, t.name AS tag_name FROM article_tags t JOIN articles a ON a.id=t.article_id WHERE t.tag=? AND a.status='published' ORDER BY a.updated_at DESC LIMIT 100`).bind(tag).all();
  return { name: (results[0]?.tag_name as string) ?? null, list: results.map((r) => rowToArticle(r)) };
}

export async function tagsOf(articleId: number, e: Env = env()): Promise<{ tag: string; name: string; n: number }[]> {
  const { results } = await e.DB.prepare("SELECT t.tag, t.name, (SELECT COUNT(*) FROM article_tags x WHERE x.tag=t.tag) AS n FROM article_tags t WHERE t.article_id=? ORDER BY n DESC, t.name").bind(articleId).all<{ tag: string; name: string; n: number }>();
  return results;
}


/** Licence row for the feed that produced this article (for Source-box credits). */
export async function getArticleSourceLicence(articleId: number, e: Env = env()): Promise<SourceLicence | null> {
  const r = await e.DB.prepare(
    `SELECT s.id AS source_id, s.licence_url, s.licence_note, s.publisher, s.mode
     FROM source_items si JOIN sources s ON s.id=si.source_id
     WHERE si.article_id=? ORDER BY si.updated_at DESC LIMIT 1`,
  ).bind(articleId).first<{ source_id: string; licence_url: string | null; licence_note: string | null; publisher: string; mode: string }>();
  if (!r) return null;
  return { sourceId: r.source_id, licenceUrl: r.licence_url, licenceNote: r.licence_note, publisher: r.publisher, mode: r.mode };
}
