import { notFound, redirect } from "next/navigation";
import AdminShell, { adminMeta } from "@/components/AdminShell";
import { isAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { rowToArticle } from "@/lib/db";
import { TOPICS } from "@/lib/config";
import { urlOf } from "@/lib/format";

export const metadata = adminMeta;
type P = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function Edit({ params, searchParams }: P) {
  if (!(await isAdmin())) redirect("/admin/");
  const { id } = await params; const sp = await searchParams;
  const r = await env().DB.prepare("SELECT * FROM articles WHERE id=?").bind(parseInt(id, 10)).first();
  if (!r) notFound();
  const a = rowToArticle(r);
  const act = (action: string, label: string, danger = false) => <form method="post" action="/api/admin/article/"><input type="hidden" name="id" value={a.id} /><input type="hidden" name="action" value={action} /><button type="submit" className={danger ? "danger" : ""}>{label}</button></form>;
  return <AdminShell authed>
    <h1>Edit article</h1>
    {sp.msg && <p className="adm-ok" role="status">Done: {sp.msg}.</p>}
    {sp.error && <p className="adm-err" role="alert">Every field is required.</p>}
    <p>Status: <strong>{a.status}</strong> · <a href={urlOf(a)}>View</a> · Source: <a href={a.source.url} rel="nofollow noopener">{a.source.title}</a> ({a.source.publisher}) · Model: {a.model}</p>
    <div className="adm-bar">{a.status === "held" ? <>{act("publish", "Approve & publish")}{act("reject", "Reject", true)}</> : a.status === "published" ? act("unpublish", "Unpublish") : act("publish", "Publish")}{act("toggle-developing", a.developing ? "Clear developing" : "Mark developing")}{act("toggle-pick", a.editorPick ? "Remove editor pick" : "Make editor pick")}{act("delete", "Delete", true)}</div>
    <form method="post" action="/api/admin/article/" className="adm-form">
      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="action" value="save" />
      <label htmlFor="headline">Headline</label><input id="headline" name="headline" defaultValue={a.headline} required />
      <label htmlFor="meta">Meta description (150-160 characters)</label><textarea id="meta" name="meta" rows={2} defaultValue={a.metaDescription} required />
      <label htmlFor="summary">Summary</label><textarea id="summary" name="summary" rows={2} defaultValue={a.summary} required />
      <label htmlFor="section">Section</label><select id="section" name="section" defaultValue={a.section}>{Object.entries(TOPICS).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}</select>
      <label htmlFor="keyPoints">Key points (one per line)</label><textarea id="keyPoints" name="keyPoints" rows={5} defaultValue={a.keyPoints.join("\n")} required />
      <label htmlFor="body">Body (blank line between paragraphs)</label><textarea id="body" name="body" rows={14} defaultValue={a.body.join("\n\n")} required />
      <label htmlFor="note">Change-log note (start with &quot;Correction:&quot; to list it in the corrections log)</label><input id="note" name="note" placeholder="Edited by an editor." />
      <button type="submit">Save changes</button>
    </form>
    <h2>Add a live update</h2>
    <p>Adding an update turns the story into a live blog with timestamped entries.</p>
    <form method="post" action="/api/admin/article/" className="adm-form">
      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="action" value="add-update" />
      <label htmlFor="updTitle">Update title</label><input id="updTitle" name="updTitle" required />
      <label htmlFor="updBody">Update text (blank line between paragraphs)</label><textarea id="updBody" name="updBody" rows={5} required />
      <button type="submit">Add update</button>
    </form>
  </AdminShell>;
}
