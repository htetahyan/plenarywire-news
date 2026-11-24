import { notFound } from "next/navigation";
import StaticPage from "@/components/StaticPage";
import { brand, DISCLOSURE } from "@/lib/config";
import { pageMeta } from "@/lib/meta";

// This page exists only when config/brand.json `aiDisclosure` is set; otherwise it is a real 404.
export function generateMetadata() {
  if (!DISCLOSURE) return {};
  return pageMeta({ title: `Disclosure — ${brand.name}`, description: DISCLOSURE.slice(0, 160), path: "/disclosure/" });
}

export default function Disclosure() {
  if (!DISCLOSURE) notFound();
  return <StaticPage title="Disclosure" path="/disclosure/"><p>{DISCLOSURE}</p></StaticPage>;
}
