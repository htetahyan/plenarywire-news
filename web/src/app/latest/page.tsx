import Chrome from "@/components/Chrome";
import { AdSlot, EmptyState, FeedItem, FilterChips, PicksBox } from "@/components/ui";
import { brand } from "@/lib/config";
import { listArticles } from "@/lib/db";
import { pageMeta } from "@/lib/meta";
import { JsonLd } from "@/lib/jsonld";
import { breadcrumb, collection } from "@/lib/seo";

export function generateMetadata() {
  return pageMeta({ title: `Latest — ${brand.name}`, description: `The latest stories from ${brand.name}, newest first: summaries of official US, EU and world sources, each linked to the original.`, path: "/latest/" });
}

export default async function Latest() {
  const all = await listArticles({ limit: 100 });
  const picks = all.filter((a) => a.editorPick);
  return <Chrome current="/latest/" tab="latest">
    <JsonLd data={[collection(`Latest — ${brand.name}`, "/latest/", "The latest stories, newest first.", all), breadcrumb([["Home", "/"], ["Latest", "/latest/"]])]} />
    <div className="wrap">
      <div className="with-sidebar">
        <section className="primary" data-feed="" aria-labelledby="latest-title">
          <header className="page-head"><p className="eyebrow">Live feed</p><h1 id="latest-title">Latest</h1><p className="feed-note">Newest first. Relative times are worked out in your browser from each story&apos;s published and updated times.</p></header>
          <FilterChips scope="the feed" />
          <p className="visually-hidden" role="status" aria-live="polite" data-filter-status=""></p>
          {!all.length && <EmptyState />}
          <ol className="feed feed-full" data-feed-list="">{all.slice(0, 4).map((a) => <FeedItem key={a.slug} a={a} h={2} />)}</ol>
          <AdSlot id="feed-break" className="ad-inline" />
          <ol className="feed feed-full" data-feed-list="" data-feed-continued="" start={5}>{all.slice(4).map((a) => <FeedItem key={a.slug} a={a} h={2} />)}</ol>
          <p className="feed-empty" data-feed-empty="" hidden>No stories in this section yet. <a href="/sections/">Browse all sections</a>.</p>
        </section>
        <div className="sidebar"><AdSlot id="latest-sidebar" className="ad-sidebar ad-300x600" />{all.length > 0 && <PicksBox picks={picks} recent={all.slice(0, 5)} />}</div>
      </div>
    </div>
  </Chrome>;
}
