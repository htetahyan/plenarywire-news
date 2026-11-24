import type { ReactNode } from "react";
import Chrome from "./Chrome";
import { brand } from "@/lib/config";
import { Time } from "./ui";

export const PAGES_UPDATED = "2026-11-10T01:00:00Z";

export default function StaticPage({ title, path, children, updated = PAGES_UPDATED }: { title: string; path: string; children: ReactNode; updated?: string }) {
  return <Chrome current={path}>
    <div className="wrap"><article className="prose"><p className="eyebrow">{brand.name}</p><h1>{title}</h1>{children}<p className="meta">Page last updated <Time at={updated} /></p></article></div>
  </Chrome>;
}
