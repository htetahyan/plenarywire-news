import StaticPage from "@/components/StaticPage";
import { brand } from "@/lib/config";
import { pageMeta } from "@/lib/meta";

export function generateMetadata() {
  return pageMeta({ title: `About ${brand.name} — ${brand.name}`, description: `What ${brand.name} is: an independent news publication covering US and EU politics and selected world news.`, path: "/about/" });
}

export default function About() {
  const B = brand.name;
  return <StaticPage title={`About ${B}`} path="/about/">
    <p>{B} is an independent English-language news publication covering US and EU politics, policy, the economy and technology, with selected world news.</p>
    <p>We are not an established newsroom. We have no staff reporters, bureaus or awards, and we do not claim any. Official statements tell you what a government or institution said, not that it is true. We attribute claims to the bodies that made them. {B} has not chosen a partisan editorial line.</p>
    <p>This website currently asks search engines not to index its pages. It remains publicly accessible. We make no promises about traffic, rankings or advertising.</p>
    <p>Our <a href="/corrections/">corrections</a>, <a href="/copyright/">copyright</a>, <a href="/privacy/">privacy</a>, <a href="/standards/">editorial standards</a> and <a href="/accessibility/">accessibility</a> information is linked from the footer. <a href="/contact/">Contact</a> us with questions.</p>
  </StaticPage>;
}
