import Chrome from "@/components/Chrome";
import { brand, TOPICS } from "@/lib/config";
import { sectionCounts } from "@/lib/db";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `Sections — ${brand.name}`, description: `All ${brand.name} sections: US politics, EU politics, world, economy and tech policy.`, path: "/sections/" });
}

export default async function Sections() {
  const counts = await sectionCounts();
  return <Chrome current="/sections/" tab="sections">
    <div className="wrap"><header className="page-head"><p className="eyebrow">Browse</p><h1>Sections</h1></header>
      <ul className="section-grid">{Object.entries(TOPICS).map(([k, t]) => <li key={k}><a href={`/topics/${k}/`}><strong>{t.name}</strong><span>{t.description}</span><span className="count">{counts[k] || 0} {(counts[k] || 0) === 1 ? "story" : "stories"}</span></a></li>)}
        <li><a href="/latest/"><strong>Latest</strong><span>Every story, newest first.</span></a></li><li><a href="/corrections/"><strong>Corrections</strong><span>Every correction, dated.</span></a></li></ul></div>
  </Chrome>;
}
