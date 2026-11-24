import { sameOrigin, sessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  if (!(await sameOrigin(req))) return new Response("Forbidden", { status: 403 });
  return new Response(null, { status: 303, headers: { location: "/admin/", "set-cookie": sessionCookie("", 0) } });
}
