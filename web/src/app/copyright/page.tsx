import ContactLine from "@/components/ContactLine";
import StaticPage from "@/components/StaticPage";
import { brand, legalEffectiveLabel } from "@/lib/config";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `Copyright & licensing — ${brand.name}`, description: `How ${brand.name} credits OGL, CC BY and public-domain sources, and how to report a copyright concern.`, path: "/copyright/" });
}

export default function Copyright() {
  const B = brand.name;
  const eff = legalEffectiveLabel();
  return <StaticPage title="Copyright & licensing" path="/copyright/">
    {eff ? <p>Effective as of {eff}.</p> : null}
    <p>This page explains how {B} treats rights in its own material, how we credit third-party material, and how to report a concern.</p>

    <h2>Our material</h2>
    <p>We reserve the rights we hold in the site’s original protectable content, design and branding. This does not claim exclusive rights in facts, public-domain material or rights belonging to others. Third-party material is governed by its identified licence or other applicable rights. Nothing here restricts reuse permitted by law or by an applicable open licence. For permission beyond those rights in material we control, use Contact.</p>

    <h2>Credit and permission</h2>
    <p>Credit and a link do not replace permission. Third-party material remains subject to its applicable rights and licence conditions. No-derivatives licences do not authorise publication of adaptations, and noncommercial licences do not authorise commercial uses. Other uses require permission or an applicable legal exception.</p>

    <h2>Open Government Licence (OGL)</h2>
    <p>Where material is reused under the Open Government Licence v3.0, its credit includes or links to the attribution required by the information provider. If none is specified, the credit states: “Contains public sector information licensed under the Open Government Licence v3.0.” The licence name links to the licence.</p>

    <h2>Creative Commons</h2>
    <p>Creative Commons material is identified by its applicable licence and source. Credits retain the supplied creator and required notices, link to the source and licence where practicable, and identify changes and any supplied earlier modification notices. A work’s title is included where available. Third-party licences apply only to the material identified, not automatically to the whole website. Reuse does not imply official status, sponsorship or endorsement.</p>

    <h2>US federal government works</h2>
    <p>Material identified as a US federal government work is generally not protected by copyright under US law when created by a federal officer or employee in official duties, subject to applicable exceptions. Not everything on a government website falls within that rule, and protection may differ outside the United States. Individual credits and rights notices apply. Privacy, publicity, trademark and official-seal restrictions may still apply. {B} is not an official government publication, and source credits or images do not imply sponsorship or endorsement. Government seals and logos are not licensed for use as {B} branding.</p>

    <h2>Restricted tip outlets</h2>
    <p>Some outlets we monitor publish under licences that do not allow us to adapt their wording. For those, we use them as leads only. We do not copy or adapt their prose, headlines or structure. See <a href="/standards/">Editorial standards</a>.</p>

    <h2>Images</h2>
    <p>Photographs have individual credit and rights information on the article or linked credit details. Check that information before reusing an image. A source website’s general licence may not cover third-party material, identifiable people, logos or other protected elements. Where an image is adapted, its credit identifies changes and any applicable adaptation licence. Linking to a source does not grant additional reuse rights. Agency photos (AP, Getty, Reuters and similar) are not used. When no cleared image exists we show a branded placeholder.</p>

    <h2>Fonts</h2>
    <p>Site fonts (Newsreader and Inter) are self-hosted under the SIL Open Font Licence. Licence files ship with the font files.</p>

    <h2>Report a copyright concern</h2>
    <p>To report a copyright concern, use Contact and identify the copyrighted work, the exact location of the material complained of, the rights you hold or represent, your contact details, and why you believe the use is not authorised by the rights holder, its agent or the law. Include your physical or electronic signature. State that you have a good-faith belief in the complaint, that the information is accurate, and, under penalty of perjury where making a formal US copyright notice, that you are authorised to act for the owner of the exclusive right concerned.</p>
    <p>We review sufficiently detailed reports promptly and may request further information, restrict access while investigating, remove material or explain why no change is appropriate. Adding a credit does not resolve an unauthorised use. If you disagree with our response, reply with supporting information for further review. This process does not limit legal rights or remedies.</p>
    <ContactLine forWhat="copyright concerns" />

    <h2>Other rights notices</h2>
    <p>You may also report content you believe unlawfully affects privacy, reputation or other rights. Identify the exact URL and passage, explain the concern and applicable grounds, provide relevant evidence and tell us how to contact you. We assess the report and the rights of those affected, take appropriate action where needed, and communicate the outcome where reasonably possible. You may ask us to reconsider with additional information.</p>

    <h2>Related pages</h2>
    <p><a href="/standards/">Editorial standards</a> · <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms of Use</a> · <a href="/contact/">Contact</a></p>
  </StaticPage>;
}
