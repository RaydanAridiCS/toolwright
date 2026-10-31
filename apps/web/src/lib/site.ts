export const SITE = {
  name: "Toolwright",
  /** The preferred host. www.toolwright.com redirects here (see next.config.ts). */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://toolwright.com").replace(/\/$/, ""),
  tagline: "Free, open-source tools that never see your data.",
  /** Home page title, brand last. */
  homeTitle: "Free Online PDF, Image and Developer Tools | Toolwright",
  /** Home page meta description, 150-160 characters. */
  metaDescription: "Free online tools for PDFs, images, code and text, such as compress PDF, merge PDF and JSON formatter. No upload, no sign-up: files stay on your device.",
  description:
    "Toolwright is a free, open-source toolbox of online tools for PDFs, images, developers and text: compress and merge PDFs, shrink images, format JSON, generate passwords and more. Everything runs in your browser, so your files and text never leave your device.",
  repo: process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/RaydanAridiCS/toolwright",
  license: "MIT",
  author: { name: "raydan.dev", url: "https://raydan.dev" },
} as const;

export function absoluteUrl(path = "/"): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
