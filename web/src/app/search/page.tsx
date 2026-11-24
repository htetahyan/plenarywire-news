import Chrome from "@/components/Chrome";
import { FeedItem } from "@/components/ui";
import { brand } from "@/lib/config";
import { listArticles } from "@/lib/db";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `Search — ${brand.name}`, description: `Search stories on ${brand.name}.`, path: "/search/", noindex: true });
}

export default async function Search() {
  const all = await listArticles({ limit: 100 });
  return <Chrome current="/search/" tab="search">
    <div className="wrap"><header className="page-head"><p className="eyebrow">Find</p><h1>Search</h1></header>
      <form className="search-form" action="/search/" method="get" role="search" data-search-page=""><label htmlFor="q" className="visually-hidden">Search stories</label><input id="q" name="q" type="search" placeholder="Search stories" autoComplete="off" /><button type="submit">Search</button></form>
      <p className="search-hint" data-search-hint="" suppressHydrationWarning>Instant search needs JavaScript. The latest stories are listed below.</p>
      <ol className="feed search-page-results" data-search-page-results="">{all.map((a) => <FeedItem key={a.slug} a={a} dek={false} h={2} />)}</ol></div>
  </Chrome>;
}
