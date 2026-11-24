import type { Metadata } from "next";
import { brand } from "./config";
import { indexingEnabled, siteUrl } from "./env";

export type MetaImage = { url: string; width: number; height: number; alt: string };
export const DEFAULT_OG: MetaImage = { url: brand.logo.og, width: 1200, height: 630, alt: `${brand.name} — ${brand.tagline}` };

export function pageMeta({ title, description, path, type = "website", noindex = false, publishedAt, updatedAt, section, image = DEFAULT_OG, keywords = [] }: { keywords?: string[]; title: string; description: string; path: string; type?: "website" | "article"; noindex?: boolean; publishedAt?: string; updatedAt?: string; section?: string; image?: MetaImage }): Metadata {
  const base = siteUrl();
  const index = indexingEnabled() && !noindex;
  return {
    title, description,
    metadataBase: new URL(base),
    alternates: { canonical: path, languages: { en: path, "x-default": path }, types: { "application/rss+xml": [{ url: "/feed.xml", title: brand.name }] } },
    // noindex stays on until INDEXING_ENABLED=true; max-image-preview:large is declared either way.
    robots: index ? { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } : { index: false, follow: false, "max-image-preview": "large" },
    ...(keywords.length ? { keywords, other: { news_keywords: keywords.join(", ") } } : {}),
    openGraph: { siteName: brand.name, type, title, description, url: path, locale: "en", images: [image], ...(type === "article" ? { publishedTime: publishedAt, modifiedTime: updatedAt, section } : {}) },
    twitter: { card: "summary_large_image", title, description, images: [{ url: image.url, alt: image.alt }] },
    applicationName: brand.shortName,
  };
}
