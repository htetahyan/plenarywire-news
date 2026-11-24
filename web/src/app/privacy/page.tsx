import ContactLine from "@/components/ContactLine";
import StaticPage from "@/components/StaticPage";
import { brand, LEGAL, legalEffectiveLabel } from "@/lib/config";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `Privacy Policy — ${brand.name}`, description: `How ${brand.name} handles personal data: hosting, cookies, logs, editors and people named in coverage.`, path: "/privacy/" });
}

export default function Privacy() {
  const B = brand.name;
  const eff = legalEffectiveLabel();
  return <StaticPage title="Privacy Policy" path="/privacy/">
    {eff ? <p>Effective as of {eff}.</p> : null}
    <p>This policy describes what {B} collects and uses. We describe only practices that exist in the product today. We do not run advertising networks or third-party analytics trackers on the public site.</p>

    <h2>Who we are</h2>
    <p>{B} operates this website{LEGAL.controllerName ? <> (data controller: {LEGAL.controllerName})</> : null}. For privacy requests, use the contact details on <a href="/contact/">Contact</a>{LEGAL.complaintOwner ? <> (handled by {LEGAL.complaintOwner})</> : null}.</p>

    <h2>Who this policy covers</h2>
    <p>This policy covers visitors, authorised editors, people who contact us, and people whose personal information appears in our news coverage and related records. The latter may include names, roles, statements, images and information from public records or other identified sources.</p>

    <h2>Purposes and lawful bases</h2>
    <p>Where European or UK data protection law applies, we use necessary request and security information for our legitimate interests in operating a reliable website, preventing abuse and protecting access. We use correspondence to answer enquiries, investigate complaints and handle rights requests; our basis is our legitimate interest in handling those matters, or compliance with a legal obligation where applicable. We assess these interests against individuals’ rights.</p>
    <p>Personal information in news coverage and related editorial records is used to publish accurate reporting of public matters. Applicable journalistic and freedom-of-expression provisions may apply depending on the law of the place of publication and the particular processing; they do not automatically cover visitor logs, emails or administration. Special-category or criminal-offence data (for example political opinions or allegations) is processed only where an applicable condition or exception allows it.</p>

    <h2>Hosting and processors</h2>
    <p>We use hosting, storage, security, email and technical processing providers as necessary for the purposes described in this policy. Categories include:</p>
    <ul>
      <li><strong>Infrastructure and security</strong> — Cloudflare (Workers, D1, KV, R2, Images and related edge services) processes requests and may process IP addresses, request metadata and security signals.</li>
      <li><strong>Technical processing of source text</strong> — public source documents and related text used to prepare coverage may be processed by an external technical processing provider acting on our instructions. That processing concerns material we select for editorial use; it is not used to profile readers from cookies or saved lists.</li>
      {LEGAL.mailboxProvider ? <li><strong>Email</strong> — {LEGAL.mailboxProvider}.</li> : <li><strong>Email</strong> — when a public contact address is published, the mailbox provider will be named here.</li>}
    </ul>
    <p>Where a provider processes data on our instructions, it acts under applicable data-processing terms; providers may also have separate responsibilities for processing they determine themselves.</p>

    <h2>What we collect</h2>
    <h3>Public visitors</h3>
    <ul>
      <li><strong>Server and edge logs.</strong> Request data (for example IP address, user agent, URL including search query strings when you submit the search form, timing and status) may be logged by the platform for security, reliability and abuse prevention. We do not sell this data.</li>
      <li><strong>Browser storage.</strong> After you choose a theme, <code>theme</code> remembers that choice. When you save a story, <code>saved-stories</code> stores its title, page address, identifier, topic and save time on this device. These records are not synchronised to our servers.</li>
      <li><strong>No public account.</strong> There is no reader login, newsletter signup form or comment system on the public site at present.</li>
    </ul>
    <h3>Admin area (editors only)</h3>
    <ul>
      <li><strong>Session cookie <code>nd_admin</code>.</strong> Set after successful login; HttpOnly; Secure; SameSite=Strict; Path=/; lasts up to 12 hours or until sign-out. It holds a signed expiry, not your password. While present it is sent on requests to this site’s paths, including public pages.</li>
      <li><strong>Failed-login counters.</strong> Keyed by IP address in Cloudflare KV; expire 15 minutes after the most recent failed attempt.</li>
    </ul>

    <h2>Search</h2>
    <p>Search suggestions are matched in your browser. If you submit the search-page form, your search terms appear in the page URL and may be included in infrastructure request records. Do not enter sensitive personal information into search.</p>

    <h2>Emails you send us</h2>
    <p>When you contact us, we process your address, message, attachments and necessary correspondence records to handle the matter. We may disclose relevant details where necessary to investigate it, obtain professional advice or meet legal obligations. We minimise unnecessary disclosure.</p>

    <h2>Cookies and similar storage</h2>
    <p>Details are on the <a href="/cookies/">Cookie Policy</a>.</p>

    <h2>Fonts and embeds</h2>
    <p>Fonts (Newsreader and Inter) are self-hosted. We do not load Google Fonts or similar third-party font CDNs. We do not embed third-party comment widgets, social share trackers or ad iframes on article pages.</p>

    <h2>Retention</h2>
    <ul>
      <li>Failed-login counters expire 15 minutes after the most recent failed attempt.</li>
      <li>The admin cookie expires after 12 hours or is removed on sign-out.</li>
      <li>Theme preferences and saved-article records remain on your device until removed, cleared or deleted by your browser.</li>
      <li>We keep correspondence and complaint records for as long as necessary to resolve the matter and meet applicable legal or dispute-related requirements, assessed by the nature of the request, whether it remains open, applicable limitation periods and any legal hold.</li>
      <li>Published articles and correction notes are kept as part of the public record unless we unpublish or remove them.</li>
    </ul>

    <h2>International transfers</h2>
    <p>Personal information may be processed outside your country by our service providers. Where European or UK law requires safeguards for a restricted transfer, we use the applicable adequacy decision or contractual safeguards. You may request information about those safeguards through Contact, including a copy where applicable, subject to necessary redactions.</p>

    <h2>Your rights</h2>
    <p>Subject to applicable law and its exceptions, you may request access, correction or deletion of personal information, restriction of processing, portability where available, or object to processing based on legitimate interests. Where we rely on consent, you may withdraw it without affecting earlier lawful processing. We may ask for information reasonably necessary to verify a request, but do not require unnecessary identity documents. We do not need to create identification records solely to identify anonymous visitors.</p>
    <p>We respond within the period required by the law applying to your request and explain any lawful extension or refusal. Under European and UK data protection law, the usual response period is one month. You may complain to the relevant data protection authority, including the UK Information Commissioner’s Office or an appropriate EU supervisory authority, where those laws apply.</p>
    <p>If you have a concern about our handling of personal information, you may complain through Contact. Where UK complaint-handling requirements apply, we acknowledge a privacy complaint within 30 days, take appropriate steps to investigate and respond without undue delay, provide appropriate progress information and communicate the outcome. This does not prevent you from complaining to the relevant regulator.</p>
    <p>We do not sell personal information or share it for cross-context behavioural advertising. We do not discriminate against people for exercising applicable privacy rights. California rights and procedures apply where the CCPA covers the processing.</p>
    <ContactLine forWhat="privacy requests" />

    <h2>Children</h2>
    <p>The site is intended for a general news audience, not specifically for children. Technical request information may be processed when anyone visits. If you believe a child has supplied personal information that requires special handling, contact us.</p>

    <h2>Changes</h2>
    <p>We may update this policy. The effective date above will change when we do. Changes do not retrospectively authorise a new purpose that requires consent.</p>
  </StaticPage>;
}
