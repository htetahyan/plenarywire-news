// Structured data helpers (schema.org). Everything here describes what is on the page; nothing is invented.
import { brand, TOPICS } from "./config";
import type { Article } from "./db";
import { siteUrl } from "./env";
import { iso, urlOf } from "./format";

export const orgId = () => `${siteUrl()}/#organization`;
export const siteId = () => `${siteUrl()}/#website`;

export function siteGraph() {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": siteId(), name: brand.name, alternateName: brand.shortName, url: base + "/", inLanguage: "en", publisher: { "@id": orgId() },
        potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${base}/search/?q={search_term_string}` }, "query-input": "required name=search_term_string" } },
      { "@type": "NewsMediaOrganization", "@id": orgId(), name: brand.name, url: base + "/", sameAs: [],
        logo: { "@type": "ImageObject", url: base + brand.logo.publisher, width: 600, height: 60 },
        image: { "@type": "ImageObject", url: base + brand.logo.png512, width: 512, height: 512 },
        ethicsPolicy: base + "/standards/", correctionsPolicy: base + "/corrections/", masthead: base + "/about/", actionableFeedbackPolicy: base + "/contact/" },
    ],
  };
}

export function breadcrumb(items: [string, string][]) {
  const base = siteUrl();
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: base + path })) };
}

export function collection(name: string, path: string, description: string, list: Article[]) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org", "@type": "CollectionPage", name, url: base + path, description, inLanguage: "en", isPartOf: { "@id": siteId() },
    mainEntity: { "@type": "ItemList", numberOfItems: Math.min(list.length, 30), itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: list.slice(0, 30).map((a, i) => ({ "@type": "ListItem", position: i + 1, url: base + urlOf(a), name: a.headline })) },
  };
}

export const sectionCrumb = (key: string): [string, string] => [TOPICS[key]?.name ?? key, `/topics/${key}/`];
export const wordCount = (a: Article) => [a.summary, ...a.keyPoints, ...a.body, ...a.updates.flatMap((u) => [u.title, ...u.body])].join(" ").split(/\s+/).filter(Boolean).length;
export const isoOf = iso;
