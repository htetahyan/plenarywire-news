import { notFound } from "next/navigation";
import Chrome from "@/components/Chrome";
import { Card } from "@/components/ui";
import { brand } from "@/lib/config";
import { listByTag } from "@/lib/db";
import { JsonLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/meta";
import { breadcrumb, collection } from "@/lib/seo";
import { tagSlug } from "@/lib/tags";

type P = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: P) {
  const { tag } = await params;
  const { name, list } = await listByTag(tagSlug(tag));
  if (!name) return {};
  return pageMeta({ title: `${name} — ${brand.name}`, description: `${list.length} ${list.length === 1 ? "story" : "stories"} on ${name} from ${brand.name}: summaries of official US and EU sources, each linked to the original.`.slice(0, 160), path: `/tags/${tag}/`, keywords: [name] });
}

export default async function Tag({ params }: P) {
  const { tag } = await params;
  if (tag !== tagSlug(tag)) notFound();
  const { name, list } = await listByTag(tag);
  if (!name || !list.length) notFound();
  return <Chrome current="" tab="sections">
    <JsonLd data={[collection(`${name} — ${brand.name}`, `/tags/${tag}/`, `Stories tagged ${name}.`, list), breadcrumb([["Home", "/"], ["Topics", "/sections/"], [name, `/tags/${tag}/`]])]} />
    <div className="wrap">
      <header className="page-head"><p className="eyebrow">Topic</p><h1>{name}</h1><p className="lede">{list.length} {list.length === 1 ? "story" : "stories"}, newest first.</p></header>
      <div className="top-grid">{list.map((a) => <Card key={a.slug} a={a} />)}</div>
    </div>
  </Chrome>;
}
