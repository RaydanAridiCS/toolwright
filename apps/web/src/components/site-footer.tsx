import Link from "next/link";
import { categoriesWithCounts, tools } from "@toolwright/tools";
import { SITE } from "../lib/site";
import { Logo } from "./logo";
import { NetworkLedger } from "./network-ledger";
import { Ruler } from "./ruler";

const PROJECT_LINKS = [
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "How privacy works" },
  { href: "/requests", label: "Request a tool" },
  { href: "/contribute", label: "Contribute" },
] as const;

const link = "hover:bg-marker hover:text-marker-foreground";

export function SiteFooter() {
  const categories = categoriesWithCounts();
  return (
    <footer className="mt-28 border-t border-foreground">
      <Ruler label={`${tools.length} tools`} className="-mt-px" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="max-w-md">
          <Logo />
          <p className="mt-5 font-display text-2xl font-bold leading-tight">Tools for ordinary jobs, kept honest.</p>
          <p className="mt-3 text-sm text-muted-foreground">Everything runs on your device. No accounts, no uploads, no tracking scripts. Open source under the {SITE.license} license.</p>
          <p className="mt-6">
            <NetworkLedger showSameOrigin />
          </p>
        </div>

        <nav aria-label="Tool categories">
          <h2 className="label-plate text-foreground">Catalogue</h2>
          <ul className="mt-4 flex flex-col text-sm">
            {categories.map((c) => (
              <li key={c.id} className="border-b border-border">
                <Link href={`/category/${c.id}`} className={`flex items-baseline justify-between py-2 ${link}`}>
                  {c.name}
                  <span className="font-mono text-xs text-muted-foreground">{String(c.count).padStart(2, "0")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Project">
          <h2 className="label-plate text-foreground">Project</h2>
          <ul className="mt-4 flex flex-col text-sm">
            {PROJECT_LINKS.map((l) => (
              <li key={l.href} className="border-b border-border">
                <Link href={l.href} className={`block py-2 ${link}`}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="border-b border-border">
              <a href={SITE.repo} target="_blank" rel="noopener noreferrer" className={`block py-2 ${link}`}>
                Source on GitHub <span aria-hidden>↗</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="label-plate mx-auto max-w-7xl px-4 py-5 normal-case tracking-normal sm:px-6">
          © {new Date().getFullYear()} Toolwright. Developed and maintained by{" "}
          <a href={SITE.author.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline decoration-2 underline-offset-4 hover:bg-marker hover:text-marker-foreground">
            {SITE.author.name}
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
