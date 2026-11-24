import { notFound } from "next/navigation";
import Chrome from "@/components/Chrome";
import { AdSlot, Card } from "@/components/ui";
import { brand, TOPICS } from "@/lib/config";
import { listArticles } from "@/lib/db";
import { pageMeta } from "@/lib/meta";
import { JsonLd } from "@/lib/jsonld";
import { breadcrumb, collection, sectionCrumb } from "@/lib/seo";

type P = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: P) {
  const { key } = await params;
  const t = TOPICS[key];
  if (!t) return {};
  return pageMeta({ title: `${t.name} — ${brand.name}`, description: `${t.name} coverage from ${brand.name}: ${t.description}`, path: `/topics/${key}/` });
}

export default async function Topic({ params }: P) {
  const { key } = await params;
  const t = TOPICS[key];
  if (!t) notFound();
  const list = await listArticles({ section: key, limit: 60 });
  const [first, ...more] = list;
  return <Chrome current={`/topics/${key}/`} tab="sections">
    <JsonLd data={[collection(`${t.name} — ${brand.name}`, `/topics/${key}/`, t.description, list), breadcrumb([["Home", "/"], ["Sections", "/sections/"], sectionCrumb(key)])]} />
    <div className="wrap">
      <header className="page-head"><p className="eyebrow">Section</p><h1>{t.name}</h1><p className="lede">{t.description}</p></header>
      {first ? <><div className="topic-lead"><Card a={first} size="lg" heading={2} /></div>
        <div className="top-grid">{more.slice(0, 8).map((a) => <Card key={a.slug} a={a} />)}</div>
        {more.length > 8 && <><AdSlot id="topic-break" className="ad-inline" /><div className="top-grid">{more.slice(8).map((a) => <Card key={a.slug} a={a} />)}</div></>}
      </> : <p className="empty">No stories in this section yet. The desk checks official sources every 30 minutes.</p>}
    </div>
  </Chrome>;
}
