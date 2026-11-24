import type { ReactNode } from "react";
import type { Viewport } from "next";
import { brand } from "@/lib/config";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover", colorScheme: "light dark",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: brand.themeColorLight }, { media: "(prefers-color-scheme: dark)", color: brand.themeColorDark }],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/assets/fonts/newsreader-latin-wght.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/assets/fonts/inter-latin-wght.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/assets/site.css" precedence="default" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/brand/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />
        <link rel="manifest" href="/brand/site.webmanifest" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/assets/theme.js"></script>
        <script src="/assets/app.js" defer></script>
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
