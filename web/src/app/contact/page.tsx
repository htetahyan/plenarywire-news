import ContactLine from "@/components/ContactLine";
import StaticPage from "@/components/StaticPage";
import { brand, LEGAL, legalEffectiveLabel } from "@/lib/config";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `Contact — ${brand.name}`, description: `How to reach ${brand.name} for corrections, copyright, privacy or accessibility requests.`, path: "/contact/" });
}

export default function Contact() {
  const B = brand.name;
  const eff = legalEffectiveLabel();
  return <StaticPage title="Contact" path="/contact/">
    <p>{B} is an independent publication. We do not accept funding from political parties or campaigns.</p>
    {LEGAL.controllerName ? <p>Data controller: {LEGAL.controllerName}.</p> : null}
    {LEGAL.complaintOwner ? <p>Complaint and privacy requests are handled by {LEGAL.complaintOwner}.</p> : null}
    <h2>Reach us</h2>
    <ContactLine />
    {LEGAL.mailboxProvider ? <p>Email is handled through {LEGAL.mailboxProvider}.</p> : null}
    {LEGAL.siteUrl ? <p>Site: <a href={LEGAL.siteUrl}>{LEGAL.siteUrl.replace(/^https?:\/\//, "")}</a></p> : null}
    <p>For corrections, a right of reply, copyright concerns, privacy requests or accessibility problems, use the email address on this page when it is published. Include the relevant page URL and enough detail for us to understand your request. Identify urgent safety, privacy or legal concerns in the subject line. Please do not send passwords or unnecessary identity documents.</p>
    <h2>Corrections</h2>
    <p>See the <a href="/corrections/">corrections</a> page for policy and the recorded corrections log.</p>
    <h2>Copyright and other rights</h2>
    <p>See <a href="/copyright/">Copyright &amp; licensing</a>.</p>
    <h2>Privacy</h2>
    <p>See the <a href="/privacy/">Privacy Policy</a>.</p>
    {eff ? <p className="meta">Contact details on this page apply as of {eff}.</p> : null}
  </StaticPage>;
}
