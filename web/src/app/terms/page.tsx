import StaticPage from "@/components/StaticPage";
import { brand, LEGAL, legalEffectiveLabel } from "@/lib/config";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `Terms of Use — ${brand.name}`, description: `Terms of Use for ${brand.name}: acceptable use, intellectual property, disclaimers and liability.`, path: "/terms/" });
}

export default function Terms() {
  const B = brand.name;
  const eff = legalEffectiveLabel();
  return <StaticPage title="Terms of Use" path="/terms/">
    {eff ? <p>Effective as of {eff}.</p> : null}
    <p>These Terms govern your use of the {B} website and its feeds. By using the site you agree to them. If you do not agree, do not use the site.</p>

    <h2>What this site is</h2>
    <p>{B} publishes news and related pages for general information. Content may change, be corrected or be removed. The public site does not currently provide reader accounts, comments or uploads. Contacting us does not automatically grant a blanket right to publish your private correspondence.</p>
    <p>This website currently asks search engines not to index its pages. It remains publicly accessible.</p>

    <h2>Acceptable use</h2>
    <ul>
      <li>Use the site lawfully. Do not attempt to disrupt, overload, scrape in a way that harms the service, bypass access controls, or probe the admin area without authorisation.</li>
      <li>Do not use our content to misrepresent {B} as endorsing a product, party or campaign.</li>
      <li>Do not republish material we control as your own without permission, except as allowed by law or by a licence we state on a page.</li>
    </ul>

    <h2>Intellectual property</h2>
    <p>We reserve the rights we hold in the site’s original protectable content, design and branding. This does not claim exclusive rights in facts, public-domain material or rights belonging to others. Third-party material is governed by its identified licence or other applicable rights. Nothing in these Terms restricts reuse permitted by law or by an applicable open licence. Linked source material remains subject to its applicable rights and public-domain status. For permission beyond those rights in material we control, use <a href="/contact/">Contact</a>. See also <a href="/copyright/">Copyright &amp; licensing</a>.</p>

    <h2>Links to third parties</h2>
    <p>Articles and pages link to government sites, other newsrooms and documents we do not control. Those sites have their own terms and privacy practices. A link is not an endorsement.</p>

    <h2>No professional advice</h2>
    <p>Content is provided for general information and is not legal, financial, investment, medical or other professional advice. Check authoritative sources and obtain qualified advice for decisions requiring it.</p>

    <h2>No warranty</h2>
    <p>To the extent permitted by applicable law, we do not warrant that the site will always be available or that its content is complete, current or free from error. Official sources can be wrong or incomplete; we attribute what they said.</p>

    <h2>Limitation of liability</h2>
    <p>We do not exclude or limit liability for fraud, death or personal injury caused by negligence, or any other liability or statutory rights that cannot lawfully be excluded or limited. Any otherwise permitted limitation applies only to the extent it is lawful and fair in the circumstances.</p>

    <h2>Service changes and suspension</h2>
    <p>You may stop using the site at any time. We may restrict access where reasonably necessary to protect security, prevent unlawful use, comply with law or maintain the service, and may change or discontinue site features. Restrictions do not remove rights that have already arisen under applicable law.</p>

    <h2>Changes</h2>
    <p>Changes to these Terms take effect on the stated effective date. We will give appropriate notice of material changes. Changes do not retrospectively remove rights or liabilities that have already arisen. Continued use after a change means you accept the updated Terms where that is lawful.</p>

    <h2>Severability</h2>
    <p>If a provision is unlawful or unenforceable, it is limited or severed only as necessary, and the remaining provisions continue to apply. Failure to enforce a provision does not by itself waive it.</p>

    {LEGAL.governingLaw ? <>
      <h2>Governing law</h2>
      <p>These Terms are governed by the laws of {LEGAL.governingLaw}, without regard to conflict-of-law rules, except where mandatory consumer protections say otherwise.</p>
    </> : null}

    <h2>Contact</h2>
    <p>Questions about these Terms: see <a href="/contact/">Contact</a>.</p>
  </StaticPage>;
}
