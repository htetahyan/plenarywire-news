import ContactLine from "@/components/ContactLine";
import StaticPage from "@/components/StaticPage";
import { brand, legalEffectiveLabel } from "@/lib/config";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `Accessibility — ${brand.name}`, description: `Accessibility statement for ${brand.name}: WCAG 2.2 AA target, known limits and how to report barriers.`, path: "/accessibility/" });
}

export default function Accessibility() {
  const B = brand.name;
  const eff = legalEffectiveLabel();
  return <StaticPage title="Accessibility statement" path="/accessibility/">
    {eff ? <p>Effective as of {eff}.</p> : null}
    <p>{B} aims to make its website usable by as many people as possible. We design for readable type, clear structure, keyboard use and sufficient contrast in both light and dark themes.</p>

    <h2>Target</h2>
    <p>Our accessibility target is WCAG 2.2 Level AA. We have not completed a comprehensive conformance evaluation and do not claim that every page meets every criterion. Linked third-party sites and documents may have accessibility limitations; this does not affect our responsibility for content and controls on our own pages.</p>

    <h2>What we do</h2>
    <ul>
      <li>Semantic headings, landmarks and a “skip to content” link.</li>
      <li>Text alternatives for meaningful images; decorative images marked appropriately where we control the markup.</li>
      <li>Focus styles and controls that work with a keyboard.</li>
      <li>Self-hosted fonts with <code>font-display: optional</code> and metric-matched fallbacks to reduce layout shift.</li>
      <li>A theme toggle that respects a saved preference and system preference.</li>
      <li>A pause control for the headline ticker where that UI is shown.</li>
    </ul>

    <h2>Known limits</h2>
    <ul>
      <li>Live headline tickers and reading-progress UI are progressive enhancements; core content remains available without them.</li>
      <li>Some older articles or admin screens may lag behind the latest public-page patterns.</li>
      <li>Linked third-party documents inherit the accessibility of the remote site.</li>
    </ul>

    <h2>Reporting a barrier</h2>
    <p>To report a barrier or request information in an accessible format, use Contact. Include the page URL, what you were trying to do and, if available, your browser or assistive technology. We assess reports even when we cannot immediately reproduce the issue, may ask for further details and will explain available next steps.</p>
    <ContactLine forWhat="accessibility" />
  </StaticPage>;
}
