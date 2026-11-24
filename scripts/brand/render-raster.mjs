// Renders the raster brand assets (favicons, app icons, default OG image, topic fallback cards)
// from the SVG logo with headless Chromium. Usage: node scripts/brand/render-raster.mjs [playwright module dir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pwDir = process.argv[2] || '/tmp/pw/node_modules/playwright';
const { chromium } = await import(pathToFileURL(path.join(pwDir, 'index.mjs')).href);
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/brand.json'), 'utf8'));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const C = brand.colors;
const OUT = path.join(ROOT, 'assets/brand');
fs.mkdirSync(path.join(OUT, 'cards'), { recursive: true });
const markSvg = fs.readFileSync(path.join(OUT, 'plenarywire-mark.svg'), 'utf8');
const logoDark = fs.readFileSync(path.join(OUT, 'plenarywire-logo-dark.svg'), 'utf8');
const font = (f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'assets/fonts', f)).toString('base64')})`;
const css = `@font-face{font-family:N;src:${font('newsreader-latin-wght.woff2')};font-weight:200 800}@font-face{font-family:I;src:${font('inter-latin-wght.woff2')};font-weight:100 900}
*{margin:0;box-sizing:border-box}html,body{background:transparent}`;
// Signal-arc field used as the background motif of the OG image and topic cards.
const arcs = (cx, cy, n, step, color, op) => Array.from({ length: n }, (_, i) => { const r = step * (i + 1); const a = 0.62; const x = cx + r * Math.cos(a), y1 = cy - r * Math.sin(a), y2 = cy + r * Math.sin(a); return `<path d="M${x.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-opacity="${(op * (1 - i / (n + 1))).toFixed(3)}" stroke-width="${Math.max(3, 14 - i * 1.4)}" stroke-linecap="round"/>`; }).join('');
const panel = (w, h, inner) => `<div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;background:radial-gradient(120% 140% at 0% 0%, ${C.markTop} 0%, ${C.markBottom} 55%, #0a1440 100%);font-family:I;color:#fff">
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0">${arcs(w * 0.78, h * 0.5, 7, Math.max(w, h) * 0.075, C.signal, 0.55)}<circle cx="${w * 0.78}" cy="${h * 0.5}" r="${Math.max(w, h) * 0.018}" fill="${C.signal}"/></svg>${inner}</div>`;
const shots = [];
const add = (file, w, h, html, omitBackground = false) => shots.push({ file, w, h, html, omitBackground });
// Icons: full-bleed tile for apple-touch (iOS masks it), rounded tile with transparency elsewhere.
const tile = (size, rounded) => `<div style="width:${size}px;height:${size}px">${markSvg.replace('<svg ', `<svg width="${size}" height="${size}" `).replace(rounded ? 'rx="15"' : 'rx="15"', rounded ? 'rx="15"' : 'rx="0"')}</div>`;
for (const s of [16, 32, 48]) add(`favicon-${s}.png`, s, s, tile(s, true), true);
add('apple-touch-icon.png', 180, 180, tile(180, false));
add('icon-192.png', 192, 192, tile(192, true), true);
add('icon-512.png', 512, 512, tile(512, true), true);
add('icon-maskable-512.png', 512, 512, `<div style="width:512px;height:512px;background:${C.markBottom};display:grid;place-items:center">${markSvg.replace('<svg ', '<svg width="380" height="380" ').replace('rx="15"', 'rx="0"')}</div>`);
// Publisher logo for structured data (Google: rectangular, ~600x60 max).
add('publisher-logo-600x60.png', 600, 60, `<div style="width:600px;height:60px;display:flex;align-items:center">${fs.readFileSync(path.join(OUT, 'plenarywire-logo-light.svg'), 'utf8').replace('<svg ', '<svg height="56" ')}</div>`, true);
add('og-default.jpg', 1200, 630, panel(1200, 630, `<div style="position:absolute;left:84px;top:200px">${logoDark.replace('<svg ', '<svg height="112" ')}<p style="margin-top:34px;font:500 38px/1.25 I;color:#dfe6ff;letter-spacing:-.01em">${brand.tagline}</p><p style="margin-top:22px;font:600 22px/1 I;color:${C.signal};letter-spacing:.14em;text-transform:uppercase">Official sources, linked and checked</p></div>`));
const ratios = { 'og': [1200, 630], '16x9': [1200, 675], '4x3': [1200, 900], '1x1': [1200, 1200] };
// Same layout as the in-page placeholder: logo top-left (~9% of height), caps kicker, large left-aligned headline.
const cardPanel = (w, h, inner) => `<div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;background:radial-gradient(120% 140% at 0% 0%, #2448d0 0%, ${C.markBottom} 55%, #0a1440 100%);font-family:I;color:#fff">
<svg width="${Math.round(w * 0.34)}" viewBox="0 0 160 90" style="position:absolute;top:0;right:0">${[10, 18, 26].map((r, i) => `<path d="M${(132 + r * Math.cos(0.62)).toFixed(1)} ${(30 - r * Math.sin(0.62)).toFixed(1)}A${r} ${r} 0 0 1 ${(132 + r * Math.cos(0.62)).toFixed(1)} ${(30 + r * Math.sin(0.62)).toFixed(1)}" fill="none" stroke="#ffc46b" stroke-opacity="${(0.42 - i * 0.1).toFixed(2)}" stroke-width="${(2 - i * 0.3).toFixed(1)}" stroke-linecap="round"/>`).join('')}<circle cx="132" cy="30" r="2.2" fill="#ffc46b" fill-opacity=".6"/></svg>${inner}</div>`;
for (const [k, t] of Object.entries(site.topics)) for (const [r, [w, h]] of Object.entries(ratios)) {
  const pad = Math.round(w * 0.06), logoH = Math.round(Math.max(h * 0.09, 56)), kick = r === '1x1' || r === '4x3' ? 34 : 28, head = r === '1x1' ? 92 : r === '4x3' ? 80 : 70;
  add(`cards/${k}-${r}.jpg`, w, h, cardPanel(w, h, `<div style="position:absolute;inset:${Math.round(pad * 0.92)}px ${pad}px ${pad}px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start">${logoDark.replace('<svg ', `<svg height="${logoH}" `)}<div style="width:100%"><p style="font:800 ${kick}px/1 I;letter-spacing:.09em;text-transform:uppercase;color:#ffc46b">${t.name.replace('&', '&amp;')}</p><p style="margin-top:${Math.round(kick * 0.7)}px;font:700 ${head}px/1.1 N;letter-spacing:-.015em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">Official-source ${t.name.replace('&', '&amp;')} news, checked against the original release</p></div></div>`));
}
const b = await chromium.launch();
for (const s of shots) {
  const p = await b.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${s.html}</body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(OUT, s.file), omitBackground: s.omitBackground, ...(s.file.endsWith('.jpg') ? { type: 'jpeg', quality: 86 } : {}), clip: { x: 0, y: 0, width: s.w, height: s.h } });
  await p.close();
}
await b.close();
// favicon.ico with PNG-encoded 16/32/48 entries (supported by every current browser).
const imgs = [16, 32, 48].map((s) => ({ s, d: fs.readFileSync(path.join(OUT, `favicon-${s}.png`)) }));
const head = Buffer.alloc(6 + 16 * imgs.length); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
let off = head.length; imgs.forEach(({ s, d }, i) => { const o = 6 + 16 * i; head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3); head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(d.length, o + 8); head.writeUInt32LE(off, o + 12); off += d.length; });
fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([head, ...imgs.map((x) => x.d)]));
for (const s of [16, 48]) fs.rmSync(path.join(OUT, `favicon-${s}.png`));
fs.copyFileSync(path.join(OUT, 'plenarywire-mark.svg'), path.join(OUT, 'favicon.svg'));
fs.writeFileSync(path.join(OUT, 'site.webmanifest'), JSON.stringify({ name: brand.name, short_name: brand.name, description: brand.tagline, start_url: '/', scope: '/', display: 'standalone', background_color: brand.themeColorLight, theme_color: brand.manifestThemeColor, icons: [{ src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }, { src: '/brand/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }, null, 2) + '\n');
console.log(`rendered ${shots.length} rasters + favicon.ico + site.webmanifest`);
