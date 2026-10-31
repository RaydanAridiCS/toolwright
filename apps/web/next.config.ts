import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * The privacy promise is enforced by the browser, not just by us: pages may only talk to their own origin,
 * so tool code physically cannot send your input to a third party.
 */
const csp = [
  "default-src 'self'",
  // Next.js injects small inline scripts/styles; dev mode additionally needs eval for React Refresh.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://toolwright.com");
// The preferred host is the one in SITE.url (the apex). The "www." form of it is redirected there for good.
const wwwHost = siteUrl.hostname.startsWith("www.") ? null : `www.${siteUrl.hostname}`;

const config: NextConfig = {
  // Only the container build sets this: it emits a minimal self-contained server (see /Dockerfile).
  // Regular `next build` / `next start` (and the e2e tests) are unaffected.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const, outputFileTracingRoot: path.join(process.cwd(), "../..") } : {}),
  // Caps build parallelism so memory-constrained builders (containers, small CI runners) don't run out of RAM.
  ...(process.env.NEXT_BUILD_CPUS ? { experimental: { cpus: Math.max(1, Number(process.env.NEXT_BUILD_CPUS) || 1) } } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@toolwright/core", "@toolwright/db", "@toolwright/tools", "@toolwright/ui"],
  serverExternalPackages: ["postgres"],
  async redirects() {
    if (isDev || !wwwHost) return [];
    return [{ source: "/:path*", has: [{ type: "host", value: wwwHost }], destination: `${siteUrl.origin}/:path*`, permanent: true }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The request-board API is not for search engines.
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // PDF.js files are copied from the npm package and are not content-hashed, so cache them for a day, not forever.
      { source: "/pdfjs/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
      // The offline fallback page should never show up in search results.
      { source: "/offline.html", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      // The service worker must always be revalidated so updates roll out.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default config;
