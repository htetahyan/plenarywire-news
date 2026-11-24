import type { Env } from "./env";

export const tagSlug = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** Tags = keywords + named people/organisations/places (deduped by slug, max 10). */
export function tagsFor(keywords: string[], entities: { name: string; type: string }[]): { tag: string; name: string }[] {
  const out = new Map<string, string>();
  for (const n of [...entities.filter((e) => ["Person", "Organization", "Place", "Legislation", "Policy", "Event"].includes(e.type)).map((e) => e.name), ...keywords]) {
    const t = tagSlug(n);
    if (t.length >= 3 && !out.has(t)) out.set(t, n);
  }
  return [...out].slice(0, 10).map(([tag, name]) => ({ tag, name }));
}

export async function saveTags(env: Env, articleId: number, keywords: string[], entities: { name: string; type: string }[]) {
  await env.DB.prepare("DELETE FROM article_tags WHERE article_id=?").bind(articleId).run();
  const tags = tagsFor(keywords, entities);
  if (tags.length) await env.DB.batch(tags.map((t) => env.DB.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag, name) VALUES (?, ?, ?)").bind(articleId, t.tag, t.name)));
}
