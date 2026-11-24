import { isAdmin, sameOrigin } from "@/lib/auth";
import { env } from "@/lib/env";
import { SECTION_KEYS } from "@/lib/config";

const lines = (v: FormDataEntryValue | null) => String(v || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

export async function POST(req: Request) {
  if (!(await sameOrigin(req)) || !(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const f = await req.formData();
  const id = parseInt(String(f.get("id")), 10);
  const action = String(f.get("action"));
  const db = env().DB;
  const row = await db.prepare("SELECT id, changelog FROM articles WHERE id=?").bind(id).first<{ id: number; changelog: string }>();
  if (!row) return new Response("Not found", { status: 404 });
  const now = new Date().toISOString();
  const log = JSON.parse(row.changelog || "[]") as { at: string; note: string }[];
  if (action === "delete") {
    await db.batch([db.prepare("DELETE FROM article_updates WHERE article_id=?").bind(id), db.prepare("DELETE FROM articles WHERE id=?").bind(id), db.prepare("UPDATE source_items SET article_id=NULL, status='skipped', last_error='article deleted by editor' WHERE article_id=?").bind(id)]);
    return new Response(null, { status: 303, headers: { location: "/admin/?msg=deleted" } });
  }
  if (action === "unpublish" || action === "publish") {
    const next = action === "publish" ? "published" : "unpublished";
    log.push({ at: now, note: action === "publish" ? "Approved and published by an editor." : "Unpublished by an editor." });
    await db.prepare("UPDATE articles SET status=?, updated_at=?, changelog=? WHERE id=?").bind(next, now, JSON.stringify(log), id).run();
  } else if (action === "reject") {
    log.push({ at: now, note: "Rejected in human review; not published." });
    await db.prepare("UPDATE articles SET status='unpublished', updated_at=?, changelog=? WHERE id=?").bind(now, JSON.stringify(log), id).run();
  } else if (action === "toggle-developing") {
    await db.prepare("UPDATE articles SET developing=1-developing WHERE id=?").bind(id).run();
  } else if (action === "toggle-pick") {
    await db.prepare("UPDATE articles SET editor_pick=1-editor_pick WHERE id=?").bind(id).run();
  } else if (action === "save") {
    const headline = String(f.get("headline") || "").trim();
    const meta = String(f.get("meta") || "").trim();
    const summary = String(f.get("summary") || "").trim();
    const section = String(f.get("section") || "");
    const keyPoints = lines(f.get("keyPoints"));
    const body = String(f.get("body") || "").split(/\r?\n\s*\r?\n/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
    const note = String(f.get("note") || "").trim();
    if (!headline || !meta || !summary || !SECTION_KEYS.includes(section) || !keyPoints.length || !body.length) return new Response(null, { status: 303, headers: { location: `/admin/edit/${id}/?error=invalid` } });
    log.push({ at: now, note: note || "Edited by an editor." });
    await db.prepare("UPDATE articles SET headline=?, meta_description=?, summary=?, section=?, key_points=?, body=?, updated_at=?, changelog=? WHERE id=?")
      .bind(headline, meta, summary, section, JSON.stringify(keyPoints), JSON.stringify(body), now, JSON.stringify(log), id).run();
  } else if (action === "add-update") {
    const title = String(f.get("updTitle") || "").trim();
    const body = String(f.get("updBody") || "").split(/\r?\n\s*\r?\n/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!title || !body.length) return new Response(null, { status: 303, headers: { location: `/admin/edit/${id}/?error=invalid` } });
    log.push({ at: now, note: `Live update added: ${title}` });
    await db.batch([
      db.prepare("INSERT INTO article_updates (article_id, at, title, body) VALUES (?, ?, ?, ?)").bind(id, now, title, JSON.stringify(body)),
      db.prepare("UPDATE articles SET type='liveblog', updated_at=?, changelog=? WHERE id=?").bind(now, JSON.stringify(log), id),
    ]);
  } else return new Response("Bad action", { status: 400 });
  return new Response(null, { status: 303, headers: { location: `/admin/edit/${id}/?msg=${action}` } });
}
