import { isAdmin, sameOrigin } from "@/lib/auth";
import { env } from "@/lib/env";
import { runPipeline } from "@/ingest/run";

export async function POST(req: Request) {
  if (!(await sameOrigin(req)) || !(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const r = await runPipeline(env(), "admin");
  return new Response(null, { status: 303, headers: { location: `/admin/runs/?run=${r.runId ?? ""}&status=${r.status}` } });
}
