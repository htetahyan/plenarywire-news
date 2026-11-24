import type { ReactNode } from "react";
import { brand, DISCLOSURE, TOPICS } from "@/lib/config";
import { listArticles, type Article } from "@/lib/db";
import { indexingEnabled } from "@/lib/env";
import { urlOf } from "@/lib/format";
import { Icon, Logo } from "./ui";
import Hydrated from "./Hydrated";
import { JsonLd } from "@/lib/jsonld";
import { siteGraph } from "@/lib/seo";

const NAV: [string, string][] = [...Object.entries(TOPICS).map(([k, t]) => [`/topics/${k}/`, t.name] as [string, string]), ["/latest/", "Latest"], ["/corrections/", "Corrections"], ["/about/", "About"]];
const NAV_DESKTOP: [string, string][] = [["/latest/", "Latest"], ...Object.entries(TOPICS).map(([k, t]) => [`/topics/${k}/`, t.short || t.name] as [string, string]), ["/about/", "About"]];
const TABS: [string, string, keyof typeof Icon][] = [["/", "Home", "home"], ["/latest/", "Latest", "latest"], ["/sections/", "Sections", "sections"], ["/search/", "Search", "search"], ["/saved/", "Saved", "saved"]];

function LiveStrip({ items, developing }: { items: Article[]; developing?: Article }) {
  if (!items.length) return null;
  return <section className="live-strip" aria-label="Developing story and latest headlines">
    {developing && <div className="dev-banner" role="note"><div className="wrap dev-inner"><span className="dev-tag"><span className="dot" aria-hidden="true"></span>Developing</span><a className="dev-link" href={urlOf(developing)}>{developing.headline}</a></div></div>}
    <section className="ticker" aria-label="Latest headlines">
      <div className="wrap ticker-inner">
        <span className="ticker-label">Latest</span>
        <div className="ticker-viewport"><ul className="ticker-track">{items.map((a) => <li key={a.slug}><a href={urlOf(a)}>{a.headline}</a></li>)}</ul><ul className="ticker-track ticker-dup" aria-hidden="true">{items.map((a) => <li key={a.slug}><a href={urlOf(a)} tabIndex={-1}>{a.headline}</a></li>)}</ul></div>
        <button className="ticker-btn js-only" type="button" data-ticker-toggle="" aria-pressed="false" aria-label="Pause headline ticker" suppressHydrationWarning>{Icon.pause}</button>
      </div>
    </section>
  </section>;
}

export default async function Chrome({ children, current = "", tab = "", article = false }: { children: ReactNode; current?: string; tab?: string; article?: boolean }) {
  const latest = await listArticles({ limit: 8 });
  const developing = latest.find((a) => a.developing);
  const preview = !indexingEnabled();
  return <>
    <JsonLd data={siteGraph()} />
    <a className="skip" href="#main">Skip to content</a>
    {preview && <section aria-label="Preview notice"><div className="preview-strip" role="note">Preview — this website currently asks search engines not to index its pages. It remains publicly accessible. {brand.name} is in development.</div></section>}
    <header className="site-header">
      <div className="wrap header-inner">
        <a className="wordmark" href="/"><Logo /><span className="visually-hidden">{brand.name} — home</span></a>
        <nav className="nav-desktop" aria-label="Sections"><ul>{NAV_DESKTOP.map(([h, l]) => <li key={h}><a href={h} aria-current={h === current ? "page" : undefined}>{l}</a></li>)}</ul></nav>
        <div className="header-tools">
          <a className="tool-btn search-btn" href="/search/" data-search-open="" aria-label="Search">{Icon.search}<span className="tool-text">Search</span></a>
          <button className="tool-btn theme-toggle js-only" type="button" data-theme-toggle="" aria-label="Switch colour theme" suppressHydrationWarning><span className="ti ti-sun" aria-hidden="true"></span><span className="ti ti-moon" aria-hidden="true"></span></button>
          <details className="nav-mobile">
            <summary className="tool-btn" aria-label="Open section menu"><span className="burger" aria-hidden="true"></span></summary>
            <nav className="nav-mobile-panel" aria-label="Sections (menu)"><ul><li><a href="/" aria-current={current === "/" ? "page" : undefined}>Home</a></li>{NAV.map(([h, l]) => <li key={h}><a href={h} aria-current={h === current ? "page" : undefined}>{l}</a></li>)}<li><a href="/standards/">Editorial standards</a></li><li><a href="/contact/">Contact</a></li></ul></nav>
          </details>
        </div>
      </div>
    </header>
    <LiveStrip items={latest} developing={developing} />
    {article && <div className="progress" aria-hidden="true"></div>}
    <main id="main">{children}</main>
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <p className="wordmark wordmark-footer" aria-hidden="true"><Logo reuse /></p>
          <p className="footer-tag">{brand.tagline}</p>
        </div>
        <nav aria-label="Publication"><ul className="footer-links">
          <li><a href="/about/">About</a></li>
          <li><a href="/standards/">Editorial standards</a></li>
          <li><a href="/corrections/">Corrections</a></li>
          <li><a href="/contact/">Contact</a></li>
          <li><a href="/sections/">All sections</a></li>
          <li><a href="/feed.xml">RSS</a></li>
        </ul></nav>
        <nav aria-label="Legal"><ul className="footer-links">
          <li><a href="/terms/">Terms of Use</a></li>
          <li><a href="/privacy/">Privacy</a></li>
          <li><a href="/cookies/">Cookies</a></li>
          <li><a href="/copyright/">Copyright &amp; licensing</a></li>
          <li><a href="/accessibility/">Accessibility</a></li>
        </ul></nav>
        <p className="footer-legal">© {new Date().getUTCFullYear()} {brand.name} (in development). An independent publication. Stories are based on official sources, each linked to the original.{DISCLOSURE ? ` ${DISCLOSURE}` : ""}</p>
      </div>
    </footer>
    <nav className="tabbar" aria-label="Primary">
      <ul>{TABS.map(([h, l, k]) => <li key={k}><a href={h} aria-current={k === tab ? "page" : undefined} {...(k === "search" ? { "data-search-open": "" } : {})}>{Icon[k]}<span>{l}</span></a></li>)}</ul>
    </nav>
    <div className="new-pill-wrap"><button className="new-pill" type="button" data-new-pill="" hidden suppressHydrationWarning></button></div>
    <div className="toast" role="status" aria-live="polite" data-toast=""></div>
    <dialog className="search-dialog" aria-labelledby="search-title" data-search-dialog="">
      <div className="search-panel">
        <div className="search-head">
          <h2 id="search-title" className="visually-hidden">Search {brand.name}</h2>
          {Icon.search}
          <label className="visually-hidden" htmlFor="search-input">Search stories</label>
          <input id="search-input" type="search" placeholder="Search stories" autoComplete="off" spellCheck={false} data-search-input="" aria-describedby="search-status" aria-controls="search-results" />
          <button className="esc-btn" type="button" data-search-close="" aria-label="Close search">Esc</button>
        </div>
        <p id="search-status" className="search-status" role="status" aria-live="polite"></p>
        <ul id="search-results" className="search-results" data-search-results=""></ul>
      </div>
    </dialog>
    <Hydrated />
  </>;
}
