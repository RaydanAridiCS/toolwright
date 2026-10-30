export const SITE = {
  name: "Toolwright",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://toolwright.com").replace(/\/$/, ""),
  tagline: "Free, open-source tools that never see your data.",
  description:
    "Toolwright is a free, open-source toolbox of 70+ online tools for developers, designers and everyone else: format JSON, merge PDFs, compress images, generate passwords and more. Everything runs in your browser, so your files and text never leave your device.",
  repo: process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/RaydanAridiCS/toolwright",
  license: "MIT",
  author: { name: "raydan.dev", url: "https://raydan.dev" },
} as const;

export function absoluteUrl(path = "/"): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
