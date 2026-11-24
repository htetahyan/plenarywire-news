import { redirect } from "next/navigation";
import AdminShell, { adminMeta } from "@/components/AdminShell";
import { isAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { fmt } from "@/lib/format";

export const metadata = adminMeta;
type P = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Runs({ searchParams }: P) {
  if (!(await isAdmin())) redirect("/admin/");
  const sp = await searchParams;
  const db = env().DB;
  const { results } = await db.prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 50").all<Record<string, string | number>>();
  const { results: srcs } = await db.prepare("SELECT id, enabled, last_checked_at, last_status, consecutive_failures FROM sources").all<Record<string, string | number>>();
  return <AdminShell authed>
    <h1>Runs</h1>
    {sp.run && <p className="adm-ok" role="status">Run {sp.run} finished: {sp.status}.</p>}
    <h2>Sources</h2>
    <table className="adm-table"><thead><tr><th>Source</th><th>Enabled</th><th>Last checked</th><th>HTTP</th><th>Failures</th></tr></thead><tbody>{srcs.map((s) => <tr key={s.id}><td>{s.id}</td><td>{s.enabled ? "yes" : "no"}</td><td>{s.last_checked_at ? fmt(String(s.last_checked_at)) : "never"}</td><td>{s.last_status}</td><td>{s.consecutive_failures}</td></tr>)}</tbody></table>
    <h2>Recent runs</h2>
    <table className="adm-table"><thead><tr><th>#</th><th>Started</th><th>Trigger</th><th>Status</th><th>New items</th><th>Written</th><th>Rejected</th><th>Model calls</th><th>Tokens in/out</th></tr></thead><tbody>
      {results.map((r) => <tr key={r.id}><td>{r.id}</td><td>{fmt(String(r.started_at))}</td><td>{r.trigger}</td><td>{r.status}</td><td>{r.items_new}</td><td>{r.articles_written}</td><td>{r.rejected}</td><td>{r.model_calls}</td><td>{r.tokens_in}/{r.tokens_out}</td></tr>)}
    </tbody></table>
    {results.slice(0, 5).map((r) => <details key={r.id}><summary>Log for run {r.id}</summary><pre className="adm-log">{(JSON.parse(String(r.log || "[]")) as Record<string, unknown>[]).map((l) => JSON.stringify(l)).join("\n")}</pre></details>)}
  </AdminShell>;
}
