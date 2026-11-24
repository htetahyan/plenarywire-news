// Copies the shared design assets and brand/site config from the repo root into the app,
// so config/brand.json and assets/ stay the single source of truth for both sites.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(WEB, '..');
const out = path.join(WEB, 'public/assets');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
for (const f of ['site.css', 'theme.js']) fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(out, f));
fs.copyFileSync(path.join(WEB, 'client/app.js'), path.join(out, 'app.js'));
fs.copyFileSync(path.join(WEB, 'client/admin.css'), path.join(out, 'admin.css'));
for (const f of fs.readdirSync(path.join(ROOT, 'assets/fonts'))) fs.copyFileSync(path.join(ROOT, 'assets/fonts', f), path.join(out, 'fonts', f));
fs.cpSync(path.join(ROOT, 'assets/brand'), path.join(WEB, 'public/brand'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'assets/brand/favicon.ico'), path.join(WEB, 'public/favicon.ico'));
const gen = path.join(WEB, 'src/generated');
fs.mkdirSync(gen, { recursive: true });
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/brand.json'), 'utf8'));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const tok = (s) => s.replace(/\{\{name\}\}/g, brand.name);
fs.copyFileSync(path.join(ROOT, 'config/image-registry.json'), path.join(gen, 'image-registry.json'));
const logo = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/logo-paths.json'), 'utf8'));
const contactEmail = (brand.contactEmail || site.contact || '').trim();
const contactNote = site.contactNote || '';
fs.writeFileSync(path.join(gen, 'config.json'), JSON.stringify({
  brand, logo, topics: site.topics,
  contact: contactEmail, contactNote,
  siteUrl: (brand.siteUrl || '').trim(),
  legalEffectiveDate: brand.legalEffectiveDate || '',
  governingLaw: (brand.governingLaw || '').trim(),
  controllerName: (brand.controllerName || '').trim(),
  mailboxProvider: (brand.mailboxProvider || '').trim(),
  complaintOwner: (brand.complaintOwner || '').trim(),
  description: tok(site.description).replace(/ This preview contains sample content only\./, ''),
}, null, 2));
console.log(`synced assets + config (brand=${brand.name})`);
