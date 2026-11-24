import ContactLine from "@/components/ContactLine";
import StaticPage from "@/components/StaticPage";
import { Time } from "@/components/ui";
import { brand } from "@/lib/config";
import { env } from "@/lib/env";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `Corrections — ${brand.name}`, description: `Corrections policy and recorded material corrections for ${brand.name}.`, path: "/corrections/" });
}

export default async function Corrections() {
  const { results } = await env().DB.prepare("SELECT slug, headline, changelog FROM articles WHERE status='published' AND changelog LIKE '%Correction:%' ORDER BY updated_at DESC LIMIT 200").all<{ slug: string; headline: string; changelog: string }>();
  const all = results.flatMap((r) => (JSON.parse(r.changelog || "[]") as { at: string; note: string }[]).filter((c) => c.note.startsWith("Correction:")).map((c) => ({ ...c, r }))).sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
  return <StaticPage title="Corrections" path="/corrections/">
    <h2>Policy</h2>
    <p>We correct material factual errors and misleading statements, ordinarily on the affected story with a dated explanation of the change. New developments are labelled as updates. Minor spelling or formatting changes that do not affect meaning may not receive a correction note. Where material is removed for legal, safety or privacy reasons, we explain the change where lawful and appropriate without repeating harmful information.</p>
    <p>If you are materially affected by a report, you may request a correction or submit a relevant response through Contact. Include the article URL, disputed passage, your explanation and supporting information. We consider relevant replies fairly and may publish a proportionate response or clarification; a request does not guarantee publication of every submitted statement. Serious safety, privacy and reputational concerns receive priority. If dissatisfied, reply with additional grounds and ask for further review.</p>
    <ContactLine forWhat="correction requests" />

    <h2>Recorded material corrections</h2>
    <p>Material corrections logged with a dated “Correction:” note on a published story appear below, newest first. The list is not a guarantee that every edit appears here.</p>
    {all.length ? <ol className="corr-log">{all.map((c, i) => <li key={i}><Time at={c.at} /> — <a href={`/news/${c.r.slug}/`}>{c.r.headline}</a><br />{c.note.replace(/^Correction:\s*/, "")}</li>)}</ol> : <p>No recorded material corrections yet.</p>}
  </StaticPage>;
}
