import Link from "next/link";
import { Search } from "lucide-react";
import { Kbd, cn } from "@toolwright/ui";
import { tools } from "@toolwright/tools";
import { SITE } from "../lib/site";
import { Logo } from "./logo";
import { SearchButton } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";
import { MobileMenu } from "./mobile-menu";

export const NAV_LINKS = [
  { href: "/tools", label: "Tools", note: String(tools.length) },
  { href: "/guides", label: "Guides" },
  { href: "/requests", label: "Requests" },
  { href: "/privacy", label: "Privacy" },
  { href: "/contribute", label: "Contribute" },
] as const;

const navLink = "px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-marker hover:text-marker-foreground";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Toolwright home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="ml-8 hidden items-center md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={navLink}>
              {l.label}
              {"note" in l ? <sup className="ml-1 font-mono text-[10px] font-medium text-muted-foreground">{l.note}</sup> : null}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <SearchButton className="hidden h-10 w-72 items-center gap-2 border border-foreground/55 bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-foreground lg:flex">
            <Search aria-hidden className="size-4" />
            <span className="flex-1 text-left">Search the catalogue</span>
            <Kbd>Ctrl K</Kbd>
          </SearchButton>
          <SearchButton label="Search tools" className="inline-flex size-9 items-center justify-center text-foreground hover:bg-marker hover:text-marker-foreground lg:hidden">
            <Search aria-hidden className="size-[18px]" />
          </SearchButton>
          <a href={SITE.repo} target="_blank" rel="noopener noreferrer" className={cn(navLink, "hidden sm:inline-block")}>
            GitHub<span aria-hidden> ↗</span>
          </a>
          <ThemeToggle />
          <MobileMenu links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
