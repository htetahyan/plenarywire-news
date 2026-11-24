#!/usr/bin/env node
// Connects the Gemini key without ever printing it.
//   GEMINI_API_KEY=... node scripts/connect-gemini.mjs   (reads the key from the environment only)
// 1) tries Vertex AI express mode, then the Gemini API, for each candidate model;
// 2) writes the working endpoint/model into wrangler.jsonc vars;
// 3) stores the key as the GEMINI_API_KEY Worker secret via stdin (never as an argument).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const key = (process.env.GEMINI_API_KEY || process.env.VERTEX_GEMINI_API_KEY || '').trim();
if (!key) { console.error('No key in GEMINI_API_KEY / VERTEX_GEMINI_API_KEY'); process.exit(2); }
const red = (s) => String(s).split(key).join('[redacted]');
const models = ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-flash-latest'];
const eps = { 'vertex-express': (m) => `https://aiplatform.googleapis.com/v1/publishers/google/models/${m}:generateContent`, 'gemini-api': (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent` };
let found = null;
for (const [ep, u] of Object.entries(eps)) {
  for (const m of models) {
    const r = await fetch(u(m), { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with OK' }] }], generationConfig: { maxOutputTokens: 5, thinkingConfig: { thinkingBudget: 0 } } }) });
    const t = await r.text(); let msg = '';
    try { const j = JSON.parse(t); msg = j.error ? `${j.error.status}: ${String(j.error.message).slice(0, 120)}` : 'ok'; } catch { msg = t.slice(0, 80); }
    console.log(`${ep} ${m} -> HTTP ${r.status} ${red(msg)}`);
    if (r.ok) { found = { ep, m }; break; }
  }
  if (found) break;
}
if (!found) { console.error('Key did not work on either endpoint.'); process.exit(1); }
const cfg = 'wrangler.jsonc';
let s = fs.readFileSync(cfg, 'utf8');
s = s.replace(/"GEMINI_MODEL": "[^"]*"/, `"GEMINI_MODEL": "${found.m}"`).replace(/"GEMINI_ENDPOINT": "[^"]*"/, `"GEMINI_ENDPOINT": "${found.ep}"`);
fs.writeFileSync(cfg, s);
const put = spawnSync('npx', ['wrangler', 'secret', 'put', 'GEMINI_API_KEY'], { input: key, encoding: 'utf8', env: process.env });
console.log(red((put.stdout || '').split('\n').filter((l) => /Success|error|✘/i.test(l)).join('\n')), red(put.stderr || '').slice(0, 300));
console.log(`Using ${found.ep} with ${found.m}. Now deploy: npx wrangler deploy`);
process.exit(put.status || 0);
