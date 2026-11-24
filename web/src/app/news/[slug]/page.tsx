import { notFound } from "next/navigation";
import Chrome from "@/components/Chrome";
import { AdSlot, Card, Icon, Kicker, Media, RelTime, SaveBtn, Time, topicName } from "@/components/ui";
import { brand, BYLINE, DISCLOSURE } from "@/lib/config";
import { sourceTypeLabel, textLicenceCredit } from "@/lib/licence-credit";
import { getArticle, getArticleSourceLicence, listArticles, tagsOf, type Article } from "@/lib/db";
import { breadcrumb, orgId, sectionCrumb, wordCount } from "@/lib/seo";
import { siteUrl } from "@/lib/env";
import { iso, urlOf } from "@/lib/format";
import { JsonLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/meta";

type P = { params: Promise<{ slug: string }> };

/** Image URLs for meta + JSON-LD: the licensed photo crops, or the branded section card (same 3 ratios). */
function imagesOf(a: Article) {
  const base = siteUrl();
  const r = a.image ? (k: string) => `${base}/img/${a.image!.key}/${k}.webp` : (k: string) => `${base}/brand/cards/${a.section}-${k}.jpg`;
  const alt = a.image ? a.image.alt : `${brand.name} — ${topicName(a.section)}`;
  return { ld: [r("1x1"), r("4x3"), r("16x9")], og: a.image ? { url: r("16x9"), width: 1200, height: 675, alt } : { url: `${base}/brand/cards/${a.section}-og.jpg`, width: 1200, height: 630, alt } };
}

export async function generateMetadata({ params }: P) {
  const a = await getArticle((await params).slug);
  if (!a) return {};
  return pageMeta({ title: `${a.headline} — ${brand.name}`, description: a.metaDescription, path: urlOf(a), type: "article", publishedAt: iso(a.publishedAt), updatedAt: iso(a.updatedAt), section: topicName(a.section), image: imagesOf(a).og, keywords: a.keywords });
}

/** Links the first mention of up to three tags to their tag pages (internal links from the source's own names). */
function linkify(text: string, tags: { tag: string; name: string }[], used: Set<string>, key: string): React.ReactNode {
  for (const t of tags) {
    if (used.size >= 3 || used.has(t.tag) || t.name.length < 4) continue;
    const i = text.indexOf(t.name);
    if (i < 0) continue;
    used.add(t.tag);
    return <>{text.slice(0, i)}<a href={`/tags/${t.tag}/`} className="tag-link">{t.name}</a>{linkify(text.slice(i + t.name.length), tags, used, key + "r")}</>;
  }
  return text;
}

function Body({ a, tags }: { a: Article; tags: { tag: string; name: string }[] }) {
  const out: React.ReactNode[] = [];
  const used = new Set<string>();
  a.body.forEach((p, i) => {
    out.push(<p key={`p${i}`}>{linkify(p, tags, used, `p${i}`)}</p>);
    if (i === 1 && a.body.length >= 4 && a.keyPoints[0]) out.push(<aside key="pq" className="pullquote" aria-hidden="true"><p>{a.keyPoints[0]}</p></aside>);
    if (i === 2 && a.body.length >= 4) out.push(<AdSlot key="ad" id="article-break" className="ad-inline" />);
  });
  return <>{out}</>;
}

export default async function ArticlePage({ params }: P) {
  const a = await getArticle((await params).slug);
  if (!a) notFound();
  const srcLic = await getArticleSourceLicence(a.id);
  const srcType = sourceTypeLabel(srcLic);
  const licCredit = textLicenceCredit(srcLic);
  const live = a.type === "liveblog" && a.updates.length > 0;
  const pool = await listArticles({ limit: 30 });
  const others = pool.filter((x) => x.slug !== a.slug);
  const sameSection = others.filter((x) => x.section === a.section);
  // Read next: the newest story from another section if there is one (widens the reader's path), else the newest other story.
  const readNext = others.find((x) => x.section !== a.section) ?? others[0];
  const moreIn = sameSection.filter((x) => x.slug !== readNext?.slug).slice(0, 4);
  const url = siteUrl() + urlOf(a);
  const tags = await tagsOf(a.id);
  const ENT: Record<string, string> = { Person: "Person", Organization: "Organization", Place: "Place", Event: "Event", Legislation: "Legislation", Policy: "Thing" };
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org", "@type": live ? "LiveBlogPosting" : "NewsArticle", "@id": url + "#article",
    headline: a.headline.slice(0, 110), ...(a.altHeadline ? { alternativeHeadline: a.altHeadline } : {}), description: a.metaDescription, image: imagesOf(a).ld,
    ...(a.image ? { thumbnailUrl: `${siteUrl()}/img/${a.image.key}/16x9-640.webp` } : {}),
    keywords: a.keywords.join(", ") || undefined, wordCount: wordCount(a),
    ...(a.entities.length ? { mentions: a.entities.map((e) => ({ "@type": ENT[e.type] || "Thing", name: e.name })) } : {}),
    datePublished: iso(a.publishedAt), dateModified: iso(a.updatedAt),
    author: { "@type": "Organization", name: BYLINE, url: siteUrl() + "/about/" },
    publisher: { "@type": "NewsMediaOrganization", "@id": orgId(), name: brand.name, url: siteUrl() + "/", logo: { "@type": "ImageObject", url: siteUrl() + brand.logo.publisher, width: 600, height: 60 } },
    mainEntityOfPage: { "@type": "WebPage", "@id": url }, url, articleSection: topicName(a.section), isAccessibleForFree: true, inLanguage: "en",
    isBasedOn: { "@type": "CreativeWork", name: a.source.title, url: a.source.url, publisher: { "@type": "Organization", name: a.source.publisher } },
    citation: [{ "@type": "CreativeWork", name: a.source.title, url: a.source.url }],
  };
  if (live) { ld.coverageStartTime = iso(a.publishedAt); ld.liveBlogUpdate = a.updates.map((u) => ({ "@type": "BlogPosting", headline: u.title, datePublished: iso(u.at), url: `${url}#update-${u.id}`, articleBody: u.body.join(" ") })); }

  return <Chrome current={`/topics/${a.section}/`} article>
    <JsonLd data={[ld, breadcrumb([["Home", "/"], sectionCrumb(a.section), [a.headline, urlOf(a)]])]} />
    <div className="wrap with-sidebar article-layout">
      <article className={`story primary${live ? " story-live" : ""}`} aria-labelledby="headline">
        {DISCLOSURE && <div className="sample-notice" role="note">{DISCLOSURE}</div>}
        <header className="story-head">
          <Kicker a={a} />
          <h1 id="headline">{a.headline}</h1>
          <p className="dek">{a.summary}</p>
          <div className="byline-row">
            <span className="avatar" aria-hidden="true">{brand.shortName}</span>
            <div className="byline-text"><p className="byline">By {BYLINE}</p>
              <p className="meta">Published <Time at={a.publishedAt} /> · Updated <Time at={a.updatedAt} /></p></div>
            <div className="story-actions"><button className="icon-btn js-only" type="button" data-share="" data-url={url} data-title={a.headline} aria-label="Share this story">{Icon.share}</button><SaveBtn a={a} /></div>
          </div>
        </header>
        <div className="story-media"><Media a={a} priority credit="full" labelled sizes="(min-width: 900px) 720px, 100vw" /></div>
        <section className="key-points" aria-labelledby="h-key"><h2 id="h-key">Key points</h2><ul>{a.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul></section>
        <AdSlot id="below-lead" className="ad-inline" />
        <div className="story-body">
          {live && <section aria-labelledby="h-updates" className="lb"><h2 id="h-updates">Updates <span className="lb-order">newest first</span></h2>
            <ol className="lb-list">{a.updates.map((u) => <li key={u.id} className="lb-update" id={`update-${u.id}`}><article aria-labelledby={`t-${u.id}`}>
              <p className="lb-time"><RelTime at={u.at} /><a className="lb-anchor" href={`#update-${u.id}`} aria-label="Link to this update">#</a></p>
              <h3 id={`t-${u.id}`}>{u.title}</h3>{u.body.map((p, i) => <p key={i}>{p}</p>)}</article></li>)}</ol></section>}
          <section aria-labelledby="h-what"><h2 id="h-what">{live ? "Background" : "What happened"}</h2><Body a={a} tags={tags} /></section>
          <section aria-labelledby="h-src" className="box"><h2 id="h-src">Source</h2><ol className="sources"><li><span className="src-type">{srcType}</span> <a href={a.source.url} rel="nofollow noopener">{a.source.title}</a> <span className="src-pub">{a.source.publisher}{a.source.publishedAt ? <> · <Time at={a.source.publishedAt} /></> : null}</span></li></ol>
            {srcType === "Official source"
              ? <p className="meta">Linked source material remains subject to its applicable rights and public-domain status. Read the original for the full text.</p>
              : <p className="meta">Linked material remains subject to its applicable rights and licence conditions. Credit and a link do not replace permission.</p>}
            {licCredit ? <p className="meta">{licCredit.href ? <>{licCredit.text} {licCredit.href ? <a href={licCredit.href} rel="license nofollow noopener">Licence</a> : null}</> : licCredit.text}</p> : null}
            </section>
          {tags.length > 0 && <nav aria-labelledby="h-tags" className="tags"><h2 id="h-tags" className="visually-hidden">Topics in this story</h2><ul>{tags.map((t) => <li key={t.tag}><a href={`/tags/${t.tag}/`}>{t.name}</a></li>)}</ul></nav>}
          <section aria-labelledby="h-log" className="box"><h2 id="h-log">Change log</h2><ol className="changelog">{a.changelog.map((c, i) => <li key={i}><Time at={c.at} /> — {c.note}</li>)}</ol></section>
        </div>
      </article>
      <div className="sidebar"><AdSlot id="sidebar" className="ad-sidebar ad-300x600" /></div>
    </div>
    {readNext && <section className="wrap read-next" aria-labelledby="h-next"><h2 id="h-next" className="section-title">Read next</h2><Card a={readNext} size="lg" /></section>}
    {moreIn.length > 0 && <section className="wrap related" aria-labelledby="h-more"><div className="rail-head"><h2 id="h-more" className="section-title">More in {topicName(a.section)}</h2><a className="rail-more" href={`/topics/${a.section}/`}>All {topicName(a.section)} <span aria-hidden="true">→</span></a></div><div className="top-grid related-grid">{moreIn.map((r) => <Card key={r.slug} a={r} size="sm" />)}</div></section>}
  </Chrome>;
}
