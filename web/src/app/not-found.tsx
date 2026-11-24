import Chrome from "@/components/Chrome";
import { brand } from "@/lib/config";

export const metadata = { title: `Page not found — ${brand.name}`, robots: { index: false, follow: false } };

export default function NotFound() {
  return <Chrome>
    <div className="wrap"><article className="prose notfound"><p className="eyebrow">Error 404</p><h1>Page not found</h1><p>There is no page at this address. It may never have existed, or the link may be wrong.</p><p><a href="/">Go to the home page</a>, see the <a href="/latest/">latest stories</a> or <a href="/sections/">browse sections</a>.</p></article></div>
  </Chrome>;
}
