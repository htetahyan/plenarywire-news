import StaticPage from "@/components/StaticPage";
import { brand, legalEffectiveLabel } from "@/lib/config";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `Cookie Policy — ${brand.name}`, description: `Cookies and browser storage used by ${brand.name}: admin session, theme and saved stories.`, path: "/cookies/" });
}

export default function Cookies() {
  const B = brand.name;
  const eff = legalEffectiveLabel();
  return <StaticPage title="Cookie Policy" path="/cookies/">
    {eff ? <p>Effective as of {eff}.</p> : null}
    <p>Cookies and browser storage are both subject to privacy rules. The public site does not use advertising or analytics cookies.</p>

    <h2>Cookies we set</h2>
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>Duration</th></tr></thead>
      <tbody>
        <tr>
          <td><code>nd_admin</code></td>
          <td>First-party, HttpOnly, Secure, SameSite=Strict, Path=/</td>
          <td>Supports authorised editor authentication after successful sign-in. Sent to this site’s paths while present. Public readers do not need it.</td>
          <td>Up to 12 hours, or until sign-out</td>
        </tr>
      </tbody>
    </table>
    <p>If you never visit <code>/admin/</code>, this cookie is not set.</p>

    <h2>Browser storage</h2>
    <p>After you choose a theme, <code>theme</code> remembers that choice. When you save a story, <code>saved-stories</code> stores its title, page address, identifier, topic and save time on this device. These records are not synchronised to our servers. You can remove individual saved stories or clear the site’s browser data. Browser storage may also be deleted by your browser.</p>

    <h2>Cloudflare</h2>
    <p>Because the site is served through Cloudflare, Cloudflare may set or read cookies or similar signals for security and performance under its own settings. We will list additional names, providers, purposes and durations here when we confirm them in production. Anonymous page views in ordinary use do not currently set first-party analytics cookies.</p>

    <h2>How to control cookies and storage</h2>
    <p>You can block or delete cookies in your browser settings. Blocking the admin cookie keeps you signed out of the editor. Theme and saved lists can be cleared with site data.</p>

    <h2>More</h2>
    <p>See the <a href="/privacy/">Privacy Policy</a> and <a href="/contact/">Contact</a>.</p>
  </StaticPage>;
}
