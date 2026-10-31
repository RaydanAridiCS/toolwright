import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { CommandPalette } from "../components/command-palette";
import { ServiceWorkerRegister } from "../components/service-worker";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { THEME_INIT_SCRIPT } from "../components/theme-toggle";
import { SITE } from "../lib/site";
import "./globals.css";

// All three typefaces are served from our own origin (the CSP forbids third-party fonts).
// Paths point at the files shipped by the @fontsource-variable packages and geist.
const display = localFont({
  src: "../../../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2",
  weight: "200 800",
  variable: "--font-display",
  display: "swap",
  adjustFontFallback: "Arial", // size-adjusted fallback so the swap to the real font does not reflow headings
});
const body = localFont({
  src: "../../../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2",
  weight: "400 700",
  variable: "--font-body",
  display: "swap",
  adjustFontFallback: "Arial", // size-adjusted fallback so the swap to the real font does not reflow headings
});
const mono = localFont({
  src: "../../../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  weight: "100 900",
  variable: "--font-mono",
  display: "swap",
  // Preloaded: the breadcrumb and label plates above the fold use it, and a late swap re-wrapped them (layout shift).
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.homeTitle, template: `%s | ${SITE.name}` },
  description: SITE.metaDescription,
  applicationName: SITE.name,
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The default look is light paper whatever the OS says, so the browser UI should match it.
  themeColor: "#f4f0e6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans">
        <a href="#main" className="sr-only z-50 bg-foreground px-4 py-2 text-background focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <CommandPalette />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
