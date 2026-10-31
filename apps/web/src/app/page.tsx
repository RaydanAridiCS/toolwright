import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Kbd, buttonClasses } from "@toolwright/ui";
import { categoriesWithCounts, popularTools, tools } from "@toolwright/tools";
import { FaqList } from "../components/faq-list";
import { JsonLd } from "../components/json-ld";
import { HeroBench } from "../components/home/hero-bench";
import { ProofLog } from "../components/home/proof-log";
import { Ticket } from "../components/home/ticket";
import { Ledger } from "../components/ledger";
import { Ruler } from "../components/ruler";
import { YourTools } from "../components/your-tools";
import { HOME_FAQ } from "../lib/home-faq";
import { pageMetadata } from "../lib/seo";
import { SITE } from "../lib/site";
import { faqLd, organizationLd, websiteLd } from "../lib/structured-data";

export const metadata: Metadata = {
  ...pageMetadata({ title: SITE.homeTitle, description: SITE.metaDescription, path: "/", ogTitle: SITE.homeTitle, image: { path: "/opengraph-image", alt: "Toolwright: free, private online tools that run in your browser" } }),
  title: { absolute: SITE.homeTitle },
};

const STEPS = [
  { title: "Open the developer tools.", body: "Press F12 (or Ctrl/Cmd + Shift + I) and click the Network tab." },
  { title: "Use any tool.", body: "Drop in a file, paste some text, press the buttons." },
  { title: "Watch nothing happen.", body: "No request carries your data. Switch to airplane mode and keep working." },
] as const;

const h2 = "font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl";

export default function HomePage() {
  const categories = categoriesWithCounts();
  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd(), faqLd(HOME_FAQ)]} />
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-16 lg:grid lg:grid-cols-12 lg:items-start lg:gap-14">
        <div className="lg:col-span-7">
          <h1 className="font-display text-[clamp(2.9rem,8.2vw,7rem)] font-extrabold leading-[0.9] tracking-[-0.03em]">
            <span className="rise block" style={{ "--i": 0 } as React.CSSProperties}>
              Do the job.
            </span>
            <span className="rise block" style={{ "--i": 1 } as React.CSSProperties}>
              <span className="marker">Keep the data.</span>
            </span>
          </h1>
          <p className="rise mt-8 max-w-[34rem] text-lg leading-relaxed sm:text-xl" style={{ "--i": 3 } as React.CSSProperties}>
            {tools.length} free everyday tools for PDFs, images, code and text: compress or merge a PDF, shrink images, format JSON. They run on your device, so nothing is uploaded and there is nothing to sign up for.
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-x-8 gap-y-4" style={{ "--i": 4 } as React.CSSProperties}>
            <Link href="/tools" className={buttonClasses("primary", "lg")}>
              Open the toolbox <ArrowRight aria-hidden />
            </Link>
            <a href="#proof" className="text-[15px] font-semibold underline decoration-2 underline-offset-[6px] hover:bg-marker hover:text-marker-foreground">
              How we prove it
            </a>
          </div>
          <p className="label-plate mt-8 hidden items-center gap-2 lg:flex">
            Press <Kbd>/</Kbd> to search the catalogue
          </p>
        </div>
        <div className="mt-14 lg:col-span-5 lg:mt-0">
          <HeroBench />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Ruler label={`${tools.length} tools`} />
      </div>

      <YourTools />

      <section id="toolbox" aria-labelledby="toolbox-title" className="mx-auto mt-20 max-w-7xl px-4 sm:mt-28 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-plate mb-3">01 — Most reached for</p>
            <h2 id="toolbox-title" className={h2}>
              The toolbox
            </h2>
          </div>
          <Link href="/tools" className="text-sm font-semibold underline decoration-2 underline-offset-4 hover:bg-marker hover:text-marker-foreground">
            All {tools.length} tools →
          </Link>
        </div>
        <Ledger tools={popularTools(14)} glyphs />
      </section>

      <section id="drawers" aria-labelledby="drawers-title" className="mx-auto mt-20 max-w-7xl px-4 sm:mt-28 sm:px-6">
        <p className="label-plate mb-3">02 — Everything else</p>
        <h2 id="drawers-title" className={h2}>
          Drawers
        </h2>
        <ul className="mt-8 grid border-t border-foreground md:grid-cols-2 md:gap-x-14">
          {categories.map((c, i) => (
            <li key={c.id} className="ledger-row border-b border-border">
              <div className="relative flex items-center gap-4 px-2 py-5">
                <span className="label-plate ledger-muted w-8 shrink-0 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <div className="ledger-shift min-w-0 flex-1">
                  <h3 className="font-display text-3xl font-extrabold leading-none tracking-tight">
                    <Link href={`/category/${c.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                      {c.name}
                    </Link>
                  </h3>
                  <p className="ledger-muted mt-1.5 text-sm text-muted-foreground">{c.description}</p>
                </div>
                <span className="ledger-muted font-display text-3xl font-extrabold tabular-nums text-muted-foreground" aria-label={`${c.count} tools`}>
                  {String(c.count).padStart(2, "0")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="proof" aria-labelledby="proof-title" className="mx-auto mt-20 max-w-7xl scroll-mt-24 px-4 sm:mt-28 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <p className="label-plate mb-3">03 — Proof</p>
            <h2 id="proof-title" className={h2}>
              Don&rsquo;t take our word for it.
            </h2>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">Most free tools say they respect your privacy. Here is how to see for yourself in a minute, no trust required.</p>
            <ol className="mt-8 border-t border-foreground">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-5 border-b border-border py-4">
                  <span className="font-display text-4xl font-extrabold leading-none tabular-nums text-primary">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-semibold">{s.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm">
              <Link href="/privacy" className="font-semibold underline decoration-2 underline-offset-4 hover:bg-marker hover:text-marker-foreground">
                The full privacy model →
              </Link>
            </p>
          </div>
          <div className="min-w-0 lg:pt-10">
            <ProofLog />
          </div>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="mx-auto mt-20 max-w-7xl px-4 sm:mt-28 sm:px-6">
        <p className="label-plate mb-3">04 — Questions</p>
        <h2 id="faq-title" className={h2}>
          Common questions
        </h2>
        <div className="mt-8 max-w-3xl">
          <FaqList items={HOME_FAQ} />
        </div>
      </section>

      <section aria-label="Request a tool" className="mx-auto mt-20 max-w-7xl px-4 sm:mt-28 sm:px-6">
        <Ticket nextNumber={tools.length + 1} />
      </section>
    </>
  );
}
