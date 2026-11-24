import Chrome from "@/components/Chrome";
import { brand } from "@/lib/config";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `Saved for later — ${brand.name}`, description: "Stories you saved in this browser.", path: "/saved/", noindex: true });
}

export default function Saved() {
  return <Chrome current="/saved/" tab="saved">
    <div className="wrap"><header className="page-head"><p className="eyebrow">Your list</p><h1>Saved for later</h1><p className="lede">Saved stories are kept only in this browser (localStorage). Nothing is sent to {brand.name}.</p></header>
      <div className="saved-wrap"><p className="saved-empty" data-saved-empty="" suppressHydrationWarning>Saving stories needs JavaScript. Use the bookmark button on any story to save it here.</p><ol className="feed" data-saved-list=""></ol></div></div>
  </Chrome>;
}
