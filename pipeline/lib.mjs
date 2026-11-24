import { createHash } from 'node:crypto';

const TRACKING = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|cmpid$)/i;

export function canonicalUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    u.protocol = 'https:';
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return null;
  }
}

const STOP = new Set('a an the of to in on for and or by with at from as is are was be this that its it into over after before about new says said statement press release readout'.split(' '));

// Event fingerprint: normalised headline tokens (sorted, de-duplicated) + UTC publication day.
export function eventFingerprint(title, pubDate) {
  const tokens = [...new Set(String(title).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((t) => t && !STOP.has(t)))].sort();
  const d = pubDate ? new Date(pubDate) : null;
  const day = d && !isNaN(d) ? d.toISOString().slice(0, 10) : 'nodate';
  return sha256(`${tokens.join(' ')}|${day}`).slice(0, 24);
}

export function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

function decode(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, '&')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
}

export function stripHtml(s) {
  return decode(String(s)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Minimal RSS 2.0 / Atom parser (no dependencies). Returns metadata only.
export function parseFeed(xml, maxItems = 50) {
  const items = [];
  const rss = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of rss) {
    items.push({ title: stripHtml(tag(b, 'title')), link: tag(b, 'link') || tag(b, 'guid'), guid: tag(b, 'guid'), pubDate: tag(b, 'pubDate') || tag(b, 'dc:date'), summary: stripHtml(tag(b, 'description')) });
  }
  if (!rss.length) {
    for (const b of xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || []) {
      const lm = b.match(/<link[^>]*href="([^"]+)"/i);
      items.push({ title: stripHtml(tag(b, 'title')), link: lm ? decode(lm[1]) : '', guid: tag(b, 'id'), pubDate: tag(b, 'updated') || tag(b, 'published'), summary: stripHtml(tag(b, 'summary')) });
    }
  }
  return items.filter((i) => i.title && i.link).slice(0, maxItems);
}

export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 70) || 'item';
}

export const estimateTokens = (s) => Math.ceil(String(s).length / 4);
