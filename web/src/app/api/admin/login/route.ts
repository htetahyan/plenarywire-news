import { checkPassword, loginAllowed, makeSession, noteLoginFailure, sameOrigin, sessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  if (!(await sameOrigin(req))) return new Response("Forbidden", { status: 403 });
  const ip = req.headers.get("cf-connecting-ip") || "unknown";
  if (!(await loginAllowed(ip))) return Response.redirect(new URL("/admin/?error=locked", req.url), 303);
  const form = await req.formData();
  const ok = await checkPassword(String(form.get("password") || ""));
  if (!ok) {
    await noteLoginFailure(ip);
    return new Response(null, { status: 303, headers: { location: "/admin/?error=wrong" } });
  }
  return new Response(null, { status: 303, headers: { location: "/admin/", "set-cookie": sessionCookie(await makeSession()) } });
}
