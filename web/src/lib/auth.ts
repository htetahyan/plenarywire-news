import { cookies, headers } from "next/headers";
import { env, type Env } from "./env";

const COOKIE = "nd_admin";
const TTL_S = 12 * 3600;

async function hmac(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function checkPassword(given: string, e: Env = env()) {
  const real = e.ADMIN_PASSWORD;
  if (!real || real.length < 16) return false; // fail closed if the secret is missing or weak
  const [x, y] = await Promise.all([hmac("cmp", given), hmac("cmp", real)]);
  return safeEqual(x, y);
}

export async function makeSession(e: Env = env()) {
  const exp = String(Math.floor(Date.now() / 1000) + TTL_S);
  return `${exp}.${await hmac(e.ADMIN_PASSWORD!, `session:${exp}`)}`;
}

export async function isAdmin(e: Env = env()) {
  if (!e.ADMIN_PASSWORD) return false;
  const v = (await cookies()).get(COOKIE)?.value || "";
  const [exp, sig] = v.split(".");
  if (!exp || !sig || +exp < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(e.ADMIN_PASSWORD, `session:${exp}`));
}

export const sessionCookie = (value: string, maxAge = TTL_S) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

/** Same-origin check for admin POSTs (with SameSite=Strict cookies this blocks CSRF). */
export async function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = (await headers()).get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

/** Login rate limit: 8 failed attempts per IP per 15 minutes (KV). */
export async function loginAllowed(ip: string, e: Env = env()) {
  const k = `login-fail:${ip}`;
  const n = parseInt((await e.KV.get(k)) || "0", 10);
  return n < 8;
}
export async function noteLoginFailure(ip: string, e: Env = env()) {
  const k = `login-fail:${ip}`;
  const n = parseInt((await e.KV.get(k)) || "0", 10);
  await e.KV.put(k, String(n + 1), { expirationTtl: 900 });
}
