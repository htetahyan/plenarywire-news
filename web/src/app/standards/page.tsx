import StaticPage from "@/components/StaticPage";
import { brand } from "@/lib/config";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `Editorial standards — ${brand.name}`, description: `${brand.name} sourcing, corroboration, attribution, sensitive-topic review, images and corrections.`, path: "/standards/" });
}

export default function Standards() {
  const B = brand.name;
  return <StaticPage title="Editorial standards" path="/standards/">
    <p>These are the rules {B} follows when choosing sources and deciding what to publish.</p>

    <h2>Labels</h2>
    <ul>
      <li><strong>Official source</strong> — the story is based on an official release, linked at the end of the article.</li>
      <li><strong>Reporting credit</strong> — the story drew on a tip from another outlet; that outlet is credited. We do not adapt its wording, headlines or structure.</li>
      <li><strong>Story type</strong> — the kind of document (statement, speech, press release, remarks). <strong>Breaking</strong> appears only on stories published within 90 minutes of the source and under three hours old.</li>
      <li><strong>Live blog</strong> — a developing story with timestamped updates, newest first.</li>
    </ul>

    <h2>Sourcing</h2>
    <ul>
      <li>We only use sources on an approved list of official feeds and a small set of tip outlets used as leads under the rules below.</li>
      <li>Official statements prove what an official said, not that it is true. They are attributed.</li>
      <li>Primary documents come first: filings, rulings, official records and published texts.</li>
      <li>We represent views fairly, without false balance.</li>
      <li>Times are given with an explicit time zone (UTC on this site).</li>
    </ul>

    <h2>Restricted tip outlets</h2>
    <ul>
      <li>Some outlets publish under licences that do not authorise adaptations (for example no-derivatives or noncommercial terms). Credit and a link do not replace permission.</li>
      <li>Those outlets are used as <strong>leads only</strong>. We keep neutral factual notes. We do not carry over distinctive phrasing, expressive headlines, sentence order, analysis, translated prose, exclusive quotes or photos from them.</li>
      <li>We publish from those leads only when core facts are confirmed by a lawfully reusable primary record we can link, or by another cleared independent outlet — not a syndicated copy of the same wire.</li>
      <li>Facts that conflict across sources, or that appear in only one non-official source, are dropped.</li>
    </ul>

    <h2>Attribution and credit</h2>
    <ul>
      <li>Every story links the source we relied on. Licence credits for OGL, Creative Commons and public-domain material appear in the Source box where applicable.</li>
      <li>When another outlet is credited as a tip, the article carries a reporting credit with a link. Prefer “Reporting credit” wording where first-to-report priority is not verified.</li>
      <li>Quotes are taken from primary documents whose reuse is permitted, not from restricted outlets’ copy.</li>
    </ul>

    <h2>Sensitive topics</h2>
    <p>Stories about elections, armed conflict, terrorism, immigration enforcement, or allegations or charges against people are held for human review before publication.</p>

    <h2>Images</h2>
    <p>Photographs have individual credit and rights information on the article or linked credit details. Check that information before reusing an image. A source website’s general licence may not cover third-party material, identifiable people, logos or other protected elements. Where an image is adapted, its credit identifies changes and any applicable adaptation licence. Agency photos (AP, Getty, Reuters and similar) are not used. When no cleared photo exists we show a branded card. More: <a href="/copyright/">Copyright &amp; licensing</a>.</p>

    <h2>Corrections</h2>
    <p>See the <a href="/corrections/">corrections policy and log</a>.</p>
  </StaticPage>;
}
