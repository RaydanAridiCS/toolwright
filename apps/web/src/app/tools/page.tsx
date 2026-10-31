import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES, tools, toolsByCategory } from "@toolwright/tools";
import { JsonLd } from "../../components/json-ld";
import { Ledger } from "../../components/ledger";
import { ToolBrowser } from "../../components/tool-browser";
import { pageMetadata } from "../../lib/seo";
import { breadcrumbLd, itemListLd } from "../../lib/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "All Free Online Tools: PDF, Image, Developer",
  description: `Browse all ${tools.length} free tools that run in your browser: PDF, image, developer, text, color and calculator tools. No upload, no sign-up.`,
  path: "/tools",
});

/**
 * The catalogue as plain, server-rendered HTML. It is what a crawler (or a visitor without JavaScript) sees,
 * and what shows while the interactive browser below loads, so it keeps the same shape: one block per drawer.
 */
function StaticCatalogue() {
  return (
    <div>
      {/* Same outer shape as ToolBrowser (search bar, then rail and list) so nothing jumps when it takes over. */}
      <div aria-hidden className="h-16 border-b-2 border-foreground" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-14">
        <div aria-hidden className="hidden lg:block" />
        <div className="flex flex-col gap-14">
      {CATEGORIES.map((c) => {
        const list = toolsByCategory(c.id);
        return (
          <section key={c.id} aria-labelledby={`drawer-${c.id}`}>
            <h2 id={`drawer-${c.id}`} className="font-display text-3xl font-extrabold tracking-tight">
              <Link href={`/category/${c.id}`} className="hover:bg-marker hover:text-marker-foreground">
                {c.name}
              </Link>{" "}
              <span className="font-mono text-base font-medium text-muted-foreground">{list.length}</span>
            </h2>
            <p className="mt-1 text-muted-foreground">{c.description}</p>
            <Ledger tools={list} sequential={false} compact showCategory={false} className="mt-4" />
          </section>
        );
      })}
        </div>
      </div>
    </div>
  );
}

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd
        data={[
          itemListLd("All Toolwright tools", "/tools", tools.map((t) => ({ name: t.name, path: `/tools/${t.slug}` }))),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Tools", path: "/tools" },
          ]),
        ]}
      />
      <p className="label-plate mb-3">The catalogue</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.028em]">All {tools.length} tools</h1>
      <p className="mt-4 max-w-xl text-lg">Free tools for PDFs, images, code and text. Everything runs on your device, so nothing is uploaded. Search, open a drawer, or star the ones you use most.</p>
      <div className="mt-10">
        {/* useSearchParams requires a Suspense boundary for static rendering; the fallback is the full catalogue. */}
        <Suspense fallback={<StaticCatalogue />}>
          <ToolBrowser />
        </Suspense>
      </div>
    </div>
  );
}
