import AdminShell, { adminMeta } from "@/components/AdminShell";
import { isAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { fmt } from "@/lib/format";
import { TOPICS } from "@/lib/config";

export const metadata = adminMeta;
type P = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Admin({ searchParams }: P) {
  const sp = await searchParams;
  if (!(await isAdmin())) {
    return <AdminShell authed={false}>
      <h1>Sign in</h1>
      {sp.error === "wrong" && <p className="adm-err" role="alert">Wrong password.</p>}
      {sp.error === "locked" && <p className="adm-err" role="alert">Too many attempts. Try again in 15 minutes.</p>}
      <form method="post" action="/api/admin/login/" className="adm-form"><label htmlFor="pw">Admin password</label><input id="pw" name="password" type="password" autoComplete="current-password" required /><button type="submit">Sign in</button></form>
    </AdminShell>;
  }
  const db = env().DB;
  const { results } = await db.prepare("SELECT id, slug, section, status, headline, source_publisher, developing, editor_pick, updated_at FROM articles ORDER BY CASE status WHEN 'held' THEN 0 ELSE 1 END, updated_at DESC LIMIT 300").all<Record<string, string | number>>();
  const heldN = results.filter((r) => r.status === "held").length;
  const pending = await db.prepare("SELECT status, COUNT(*) AS n FROM source_items GROUP BY status").all<{ status: string; n: number }>();
  return <AdminShell authed>
    <h1>Articles</h1>
    {sp.msg && <p className="adm-ok" role="status">Done: {sp.msg}.</p>}
    <div className="adm-bar"><form method="post" action="/api/admin/run/"><button type="submit">Run ingest now</button></form>
      <p>Source items: {pending.results.map((r) => `${r.status} ${r.n}`).join(" · ") || "none yet"}{heldN ? ` · held articles ${heldN}` : ""}</p></div>
    <table className="adm-table"><thead><tr><th>Updated (UTC)</th><th>Headline</th><th>Section</th><th>Status</th><th>Flags</th></tr></thead><tbody>
      {results.map((r) => <tr key={r.id} style={r.status === "held" ? { background: "#fff4e5" } : undefined}><td>{fmt(String(r.updated_at))}</td><td><a href={`/admin/edit/${r.id}/`}>{r.headline}</a><br /><small>{r.source_publisher}</small></td><td>{TOPICS[String(r.section)]?.short}</td><td><strong>{r.status}</strong></td><td>{r.developing ? "Developing " : ""}{r.editor_pick ? "Pick" : ""}{r.status === "held" ? " Needs review" : ""}</td></tr>)}
    </tbody></table>
    {!results.length && <p>No articles yet.</p>}
  </AdminShell>;
}
