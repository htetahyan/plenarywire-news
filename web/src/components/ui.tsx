import type { ReactNode } from "react";
import { brand, LOGO, TOPICS } from "@/lib/config";
import type { Article } from "@/lib/db";
import { fmt, fmtShort, iso, urlOf, variantOf } from "@/lib/format";
import { docType, isBreaking } from "@/lib/kicker";

const svg = { "aria-hidden": true as const, focusable: "false" as const };
export const Icon = {
  search: <svg viewBox="0 0 24 24" width="20" height="20" {...svg}><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  home: <svg viewBox="0 0 24 24" width="22" height="22" {...svg}><path d="M4 11l8-6.5 8 6.5V20h-5.5v-5h-5v5H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>,
  latest: <svg viewBox="0 0 24 24" width="22" height="22" {...svg}><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  sections: <svg viewBox="0 0 24 24" width="22" height="22" {...svg}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>,
  saved: <svg viewBox="0 0 24 24" width="22" height="22" {...svg}><path d="M7 4h10v16l-5-3.5L7 20z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>,
  share: <svg viewBox="0 0 24 24" width="18" height="18" {...svg}><path d="M12 4v11M7.5 8.5L12 4l4.5 4.5M5 13v6h14v-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  bookmark: <svg viewBox="0 0 24 24" width="18" height="18" {...svg}><path className="bm" d="M7 4h10v16l-5-3.5L7 20z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>,
  pause: <><svg className="i-pause" viewBox="0 0 24 24" width="16" height="16" {...svg}><path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg><svg className="i-play" viewBox="0 0 24 24" width="16" height="16" {...svg}><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg></>,
};

/** The mark: a "P" whose bowl transmits two signal arcs. Same geometry as assets/brand/plenarywire-mark.svg. */
export function Mark({ id, size }: { id: string; size?: number }) {
  return <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" className="mark"><MarkShapes id={id} /></svg>;
}
function MarkShapes({ id }: { id: string }) {
  const c = brand.colors;
  return <><defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c.markTop} /><stop offset="1" stopColor={c.markBottom} /></linearGradient></defs>
    <rect width="64" height="64" rx="15" fill={`url(#${id})`} />
    <path d="M21 47V17h11.5a9.5 9.5 0 0 1 0 19H21" fill="none" stroke="#fff" strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M44.8 17.9a15 15 0 0 1 0 17.2M49.3 14.7a20.5 20.5 0 0 1 0 23.6" fill="none" stroke={c.signal} strokeWidth="3.4" strokeLinecap="round" />
    <circle cx="32.5" cy="26.5" r="2.6" fill={c.signal} /></>;
}
/** Full logo (mark + outlined wordmark). The first instance defines #pw-logo; later ones reuse it with <use>. */
export function Logo({ reuse = false, className = "logo" }: { reuse?: boolean; className?: string }) {
  return <svg className={className} viewBox={LOGO.viewBox} aria-hidden="true" focusable="false">
    {reuse ? <use href="#pw-logo" /> : <g id="pw-logo"><MarkShapes id="pw-logo-g" /><path className="logo-ink" d={LOGO.primary} /><path className="logo-accent" d={LOGO.accent} /></g>}
  </svg>;
}

export const Wordmark = () => <><span className="wm-primary">{brand.wordmark.primary}</span>{brand.wordmark.separator === "" ? null : <span className="visually-hidden">{"\u00a0"}</span>}<span className="wm-accent">{brand.wordmark.accent}</span></>;

export const Time = ({ at }: { at: string }) => <time dateTime={iso(at)}>{fmt(at)}</time>;
// Relative-time text is rewritten by app.js after hydration; suppress the expected text difference.
export const RelTime = ({ at }: { at: string }) => <time dateTime={iso(at)} data-rel="" title={fmt(at)} suppressHydrationWarning>{fmtShort(at)}</time>;

export function AdSlot({ id, className = "" }: { id: string; className?: string }) {
  return <aside className={`ad-slot ${className}`} aria-label={`Advertisement (${id.replace(/-/g, " ")})`} data-ad-slot={id} data-ad-state="empty"><span className="ad-label">Advertisement</span><div className="ad-box"></div></aside>;
}

const ARCS = <svg className="ph-arcs" viewBox="0 0 160 90" preserveAspectRatio="xMaxYMin meet" aria-hidden="true" focusable="false">
  {[10, 18, 26].map((r, i) => <path key={r} d={`M${(132 + r * Math.cos(0.62)).toFixed(1)} ${(30 - r * Math.sin(0.62)).toFixed(1)}A${r} ${r} 0 0 1 ${(132 + r * Math.cos(0.62)).toFixed(1)} ${(30 + r * Math.sin(0.62)).toFixed(1)}`} fill="none" stroke="currentColor" strokeOpacity={0.42 - i * 0.1} strokeWidth={2 - i * 0.3} strokeLinecap="round" />)}
  <circle cx="132" cy="30" r="2.2" fill="currentColor" fillOpacity="0.6" /></svg>;

/** Branded placeholder used whenever no cleared photo exists: logo + section kicker + short headline, theme colours, 16:9. */
export function Placeholder({ a, labelled = false }: { a: Pick<Article, "section" | "headline">; labelled?: boolean }) {
  const t = topicName(a.section);
  return <div className="ph" {...(labelled ? { role: "img", "aria-label": `${brand.name} story card: ${t}. ${a.headline}` } : { "aria-hidden": true })}>
    <div className="ph-in">{ARCS}<Logo reuse className="logo ph-logo" />
      <span className="ph-text"><span className="ph-kicker">{t}</span><span className="ph-title">{a.headline}</span></span></div>
  </div>;
}

/** Licensed photo (webp crops in R2) with its credit line, or the branded placeholder. Fixed 16:9 box, so CLS is 0. */
export function Media({ a, priority = false, sizes = "(min-width: 900px) 33vw, 100vw", credit = "short", labelled = false }: { a: Article; priority?: boolean; sizes?: string; credit?: "short" | "full" | "none"; labelled?: boolean }) {
  const im = a.image;
  if (!im) return <div className="media"><div className="media-frame"><Placeholder a={a} labelled={labelled} /></div></div>;
  const base = `/img/${im.key}/`;
  return <figure className="media">
    <div className="media-frame"><img src={`${base}16x9.webp`} srcSet={`${base}16x9-640.webp 640w, ${base}16x9.webp 1200w`} sizes={sizes} width={1200} height={675} alt={im.alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding={priority ? "sync" : "async"} /></div>
    {credit === "short" && <figcaption className="credit">{im.credit} · <a href={im.licenceUrl} rel="license nofollow noopener">{im.licence}</a></figcaption>}
    {credit === "full" && <figcaption className="credit" id="image-credit">Photo: {im.credit} · <a href={im.licenceUrl} rel="license nofollow noopener">{im.licence}</a> · <a href={im.sourcePage} rel="nofollow noopener">Source</a>{/CC BY/i.test(im.licence) ? " · Cropped and resized by " + brand.name + (/by-sa/i.test(im.licence) ? "; adapted image under the same ShareAlike licence" : "") : ""}</figcaption>}
  </figure>;
}

export function Illo({ a, className = "" }: { a: Pick<Article, "slug" | "section">; className?: string }) {
  return <div className={`illo illo-${a.section} illo-v${variantOf(a.slug)} ${className}`} role="img" aria-label="Illustration: abstract pattern, not a photo"><span className="illo-tag" aria-hidden="true">Illustration</span></div>;
}

export const topicName = (k: string) => TOPICS[k]?.name ?? k;

export function SaveBtn({ a }: { a: Article }) {
  return <button className="icon-btn js-only" type="button" data-save={a.slug} data-title={a.headline} data-url={urlOf(a)} data-topic={topicName(a.section)} aria-pressed="false" aria-label={`Save for later: ${a.headline}`} suppressHydrationWarning>{Icon.bookmark}</button>;
}

export function Kicker({ a, ago = false }: { a: Article; ago?: boolean }) {
  const t = docType(a.source.url);
  const official = a.label === "Official source" || a.label.startsWith("Official");
  const chip = a.type === "liveblog" ? null
    : a.label === "Reporting credit" ? <span className="chip chip-attributed" title={`Reporting credit: ${a.source.publisher}`}>Reporting credit</span>
    : official ? <span className="chip chip-attributed" title={`Official source: ${t.toLowerCase()} by ${a.source.publisher}`}>{t === "Official source" ? t : `Official ${t.toLowerCase()}`}</span>
    : <span className="chip chip-attributed" title={a.source.publisher}>{a.label || "Source"}</span>;
  return <p className="kicker"><a href={`/topics/${a.section}/`}>{topicName(a.section)}</a>
    {isBreaking(a) && <span className="chip chip-breaking">Breaking</span>}
    {a.type === "liveblog" ? <span className="chip chip-live">Live blog</span> : chip}
    {ago && <span className="ago"><RelTime at={a.updatedAt} /></span>}</p>;
}

const readMins = (a: Article) => Math.max(1, Math.round([a.summary, ...a.keyPoints, ...a.body].join(" ").split(/\s+/).length / 230));

export function Card({ a, size = "md", heading = 3, img = true }: { a: Article; size?: "sm" | "md" | "lg"; heading?: 2 | 3; img?: boolean }) {
  const H = `h${heading}` as "h2" | "h3";
  return <article className={`card card-${size}`} data-topic={a.section}>
    {img && <div className="card-media-wrap"><a className="card-media" href={urlOf(a)} tabIndex={-1} aria-hidden="true"><Media a={a} credit="none" /></a>{a.image && <p className="credit">{a.image.credit} · <a href={a.image.licenceUrl} rel="license nofollow noopener">{a.image.licence}</a></p>}</div>}
    <div className="card-body">
      <Kicker a={a} ago />
      <H className="card-title"><a href={urlOf(a)}>{a.headline}</a></H>
      {size !== "sm" && <p className="card-dek">{a.summary}</p>}
      <p className="meta">Updated <Time at={a.updatedAt} /> · {a.source.publisher}</p>
    </div>
  </article>;
}

export function FeedItem({ a, dek = true, h = 3 }: { a: Article; dek?: boolean; h?: 2 | 3 }) {
  const H = `h${h}` as "h2" | "h3";
  return <li className="feed-item" data-id={a.slug} data-topic={a.section} data-updated={iso(a.updatedAt)}>
    <div className="feed-time"><RelTime at={a.updatedAt} /><span className="badge" data-badge="" data-published={iso(a.publishedAt)} data-updated={iso(a.updatedAt)} suppressHydrationWarning></span></div>
    <div className="feed-body">
      <Kicker a={a} />
      <H className="feed-title"><a href={urlOf(a)}>{a.headline}</a></H>
      {dek && <p className="feed-dek">{a.summary}</p>}
    </div>
    <div className="feed-actions"><SaveBtn a={a} /></div>
  </li>;
}

export function FilterChips({ scope }: { scope: string }) {
  return <nav className="filter-chips" aria-label={`Filter ${scope} by section`} data-filter-scope={scope}>
    <ul><li><a href="/latest/" data-filter="all" aria-current="true">All</a></li>{Object.entries(TOPICS).map(([k, t]) => <li key={k}><a href={`/topics/${k}/`} data-filter={k}>{t.short || t.name}</a></li>)}</ul>
  </nav>;
}

/** Honest replacement for "Most read": editor picks if any are set in /admin, else the most recently updated stories. No view counts. */
export function PicksBox({ picks, recent }: { picks: Article[]; recent: Article[] }) {
  const list = picks.length ? picks : recent;
  const title = picks.length ? "Editor picks" : "Most recent";
  return <section className="most-read" aria-labelledby="mr-h"><h2 id="mr-h" className="section-title">{title}</h2>
    <p className="mr-label">{picks.length ? "Chosen by our editors" : "Newest first"}</p>
    <ol>{list.slice(0, 5).map((a) => <li key={a.slug}><a href={urlOf(a)}>{a.headline}</a></li>)}</ol>
    <p className="mr-note">{picks.length ? "Selected by hand." : "Ordered by update time."} We do not collect or show view counts.</p></section>;
}

export function EmptyState({ children }: { children?: ReactNode }) {
  return <div className="sample-notice" role="note"><strong>No stories yet.</strong> {children ?? <>The desk checks official sources every 30 minutes and new stories appear here as soon as they are written.</>}</div>;
}
