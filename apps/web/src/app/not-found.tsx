import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@toolwright/ui";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
      <p className="font-mono text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">That page isn&rsquo;t in the workshop</h1>
      <p className="mt-3 text-muted-foreground">The link may be old, or the tool may have moved. Try searching, or browse everything we&rsquo;ve built.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/tools" className={buttonClasses("primary", "lg")}>
          Browse all tools
        </Link>
        <Link href="/requests" className={buttonClasses("outline", "lg")}>
          Request a tool
        </Link>
      </div>
    </div>
  );
}
