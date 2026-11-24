import Chrome from "@/components/Chrome";
import { AdSlot, Card, EmptyState, FeedItem, FilterChips, Kicker, Media, PicksBox, Time, topicName } from "@/components/ui";
import { brand, SITE_DESCRIPTION, TOPICS } from "@/lib/config";
import { listArticles, type Article } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { JsonLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/meta";
import { collection } from "@/lib/seo";
import { urlOf } from "@/lib/format";

export function generateMetadata() {
  return pageMeta({ title: `${brand.name} — ${brand.tagline}`, description: SITE_DESCRIPTION, path: "/" });
}

function Rail({ k, list }: { k: string; list: Article[] }) {
  if (!list.length) return null;
  return <section className="rail" aria-labelledby={`rail-${k}`}><div className="rail-head"><h2 id={`rail-${k}`} className="section-title">{topicName(k)}</h2><a className="rail-more" href={`/topics/${k}/`}>All {topicName(k)} <span aria-hidden="true">→</span></a></div><div className="rail-track">{list.slice(0, 3).map((a) => <Card key={a.slug} a={a} size="sm" />)}</div></section>;
}

export default async function Home() {
  const all = await listArticles({ limit: 60 });
  const [lead, ...rest] = all;
  const top = rest.slice(0, 4);
  const picks = all.filter((a) => a.editorPick);
  const base = siteUrl();
  return <Chrome current="/" tab="home">
    <JsonLd data={collection(`${brand.name} — ${brand.tagline}`, "/", SITE_DESCRIPTION, all)} />
    <div className="wrap">
      <h1 className="visually-hidden">{brand.name} — latest US, EU and world politics</h1>
      {!lead ? <EmptyState /> : <>
        <section className="hero hero-lead" aria-labelledby="hero-title">
          <div className="hero-media-wrap"><a className="hero-media" href={urlOf(lead)} tabIndex={-1} aria-hidden="true"><Media a={lead} priority credit="none" sizes="(min-width: 900px) 58vw, 100vw" /></a>{lead.image && <p className="credit">{lead.image.credit} · {lead.image.licence}</p>}</div>
          <div className="hero-body">
            <p className="eyebrow">Lead story</p>
            <Kicker a={lead} ago />
            <h2 id="hero-title" className="hero-title"><a href={urlOf(lead)}>{lead.headline}</a></h2>
            <p className="hero-dek">{lead.summary}</p>
            <p className="meta">Updated <Time at={lead.updatedAt} /> · Source: {lead.source.publisher}</p>
          </div>
        </section>
        <div className="with-sidebar home-top">
          <div className="primary">
            {top.length > 0 && <section aria-labelledby="top-h"><h2 id="top-h" className="section-title">Top stories</h2><div className="top-grid carousel">{top.map((a) => <Card key={a.slug} a={a} />)}</div></section>}
            <section className="latest-rail" aria-labelledby="latest-h" data-feed="">
              <div className="rail-head"><h2 id="latest-h" className="section-title">Latest</h2><a className="rail-more" href="/latest/">All latest <span aria-hidden="true">→</span></a></div>
              <FilterChips scope="latest stories" />
              <p className="visually-hidden" role="status" aria-live="polite" data-filter-status=""></p>
              <ol className="feed" data-feed-list="" data-feed-limit="6">{all.slice(0, 6).map((a) => <FeedItem key={a.slug} a={a} dek={false} />)}</ol>
              <p className="feed-empty" data-feed-empty="" hidden>No stories in this section yet. <a href="/sections/">Browse all sections</a>.</p>
            </section>
          </div>
          <div className="sidebar"><AdSlot id="home-sidebar" className="ad-sidebar ad-300x250" />
            <section className="side-box"><h2>How we work</h2><p>Every story is based on an official source, checked against that source and linked to the original.</p><p><a href="/standards/">Sources &amp; standards</a> · <a href="/about/">About</a></p></section>
          </div>
        </div>
        <AdSlot id="home-break" className="ad-inline" />
        {Object.keys(TOPICS).filter((k) => ["us-politics", "eu-politics", "world"].includes(k)).map((k) => <Rail key={k} k={k} list={all.filter((a) => a.section === k && a.slug !== lead.slug)} />)}
        <div className="home-bottom"><PicksBox picks={picks} recent={all.slice(0, 5)} /></div>
      </>}
    </div>
  </Chrome>;
}
