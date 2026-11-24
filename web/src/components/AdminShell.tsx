import type { ReactNode } from "react";
import { brand } from "@/lib/config";

export const adminMeta = { title: `Admin — ${brand.name}`, robots: { index: false, follow: false } };

export default function AdminShell({ children, authed }: { children: ReactNode; authed: boolean }) {
  return <>
    <link rel="stylesheet" href="/assets/admin.css" precedence="default" />
    <header className="adm-head"><div className="adm-wrap"><a href="/admin/" className="adm-brand">{brand.name} · Admin</a>
      {authed && <nav aria-label="Admin"><a href="/admin/">Articles</a><a href="/admin/runs/">Runs</a><a href="/">View site</a>
        <form method="post" action="/api/admin/logout/"><button type="submit">Log out</button></form></nav>}</div></header>
    <main id="main" className="adm-wrap">{children}</main>
  </>;
}
