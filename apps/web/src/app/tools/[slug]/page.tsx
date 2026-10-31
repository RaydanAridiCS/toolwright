import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plate, StatusLine } from "@toolwright/ui";
import { CATEGORY_BY_ID, getTool, relatedTools, tools } from "@toolwright/tools";
import { GUIDES } from "../../../content/guides";
import { FavoriteButton } from "../../../components/favorite-button";
import { JsonLd } from "../../../components/json-ld";
import { Ledger, catalogueNumber } from "../../../components/ledger";
import { NetworkLedger } from "../../../components/network-ledger";
import { ToolLoader } from "../../../components/tool-loader";
import { pageMetadata } from "../../../lib/seo";
import { breadcrumbLd, faqLd, howToLd, toolLd } from "../../../lib/structured-data";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return pageMetadata({
    title: tool.seoTitle ?? `${tool.name}: Free Online Tool`,
    description: tool.seoDescription ?? tool.description,
    path: `/tools/${tool.slug}`,
    image: { path: `/tools/${tool.slug}/opengraph-image`, alt: `${tool.name} on Toolwright: ${tool.tagline}` },
  });
}

const crumb = "hover:bg-marker hover:text-marker-foreground";

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();
  const category = CATEGORY_BY_ID[tool.category];
  const related = relatedTools(tool.slug, 4);
  const next = tool.nextStep ? getTool(tool.nextStep.slug) : undefined;
  const guides = GUIDES.filter((g) => g.tools.includes(tool.slug));

  const structured: Record<string, unknown>[] = [
    toolLd(tool),
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: category.name, path: `/category/${category.id}` },
      { name: tool.name, path: `/tools/${tool.slug}` },
    ]),
  ];
  if (tool.faq?.length) structured.push(faqLd(tool.faq));
  if (tool.howTo?.length) structured.push(howToLd(`How to use ${tool.name}`, tool.howTo));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd data={structured} />

      <nav aria-label="Breadcrumb" className="label-plate flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link href="/tools" className={crumb}>
          Tools
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/category/${category.id}`} className={crumb}>
          {category.name}
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page" className="text-foreground">
          {tool.name}
        </span>
      </nav>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="min-w-0 max-w-4xl">
          <h1 className="font-display text-[clamp(2.4rem,5.6vw,4.6rem)] font-extrabold leading-[0.95] tracking-[-0.028em]">{tool.name}</h1>
          <p className="mt-5 max-w-[62ch] text-lg leading-relaxed">{tool.answer ?? tool.description}</p>
        </div>
        <FavoriteButton slug={tool.slug} name={tool.name} withLabel />
      </header>

      <Plate
        aria-label={tool.name}
        label={`Tool ${catalogueNumber(tool.slug)} · ${category.name}`}
        className="mt-10"
        footer={
          <StatusLine>
            <NetworkLedger />
            <span>Runs on this device</span>
            <span>Works offline once opened</span>
          </StatusLine>
        }
      >
        <ToolLoader slug={tool.slug} />
        <noscript>
          <p className="p-4 text-sm">This tool needs JavaScript to run in your browser. Nothing is sent to a server.</p>
        </noscript>
      </Plate>

      <div className="mt-20">
        <div className="flex max-w-3xl flex-col gap-16">
          {tool.howTo?.length ? (
            <section aria-labelledby="how-to">
              <h2 id="how-to" className="font-display text-3xl font-extrabold tracking-tight">
                How to use {tool.name}
              </h2>
              <ol className="mt-6 border-t border-foreground">
                {tool.howTo.map((step, i) => (
                  <li key={step} className="flex items-baseline gap-5 border-b border-border py-4">
                    <span aria-hidden className="font-display text-5xl font-extrabold leading-none tabular-nums text-primary">
                      {i + 1}
                    </span>
                    <span className="text-lg">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {tool.faq?.length ? (
            <section aria-labelledby="faq">
              <h2 id="faq" className="font-display text-3xl font-extrabold tracking-tight">
                Frequently asked questions
              </h2>
              <div className="mt-6 border-t border-foreground">
                {tool.faq.map((f) => (
                  <details key={f.question} className="group border-b border-border py-4">
                    <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 text-lg font-semibold hover:bg-marker hover:text-marker-foreground [&::-webkit-details-marker]:hidden">
                      {f.question}
                      <span aria-hidden className="font-mono text-xl font-medium">
                        <span className="group-open:hidden">+</span>
                        <span className="hidden group-open:inline">–</span>
                      </span>
                    </summary>
                    <p className="mt-3 max-w-[62ch] text-muted-foreground">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          {guides.length > 0 ? (
            <section aria-labelledby="guides">
              <h2 id="guides" className="font-display text-3xl font-extrabold tracking-tight">
                Guides
              </h2>
              <ul className="mt-4 border-t border-foreground">
                {guides.map((g) => (
                  <li key={g.slug} className="border-b border-border py-3">
                    <Link href={`/guides/${g.slug}`} className="text-lg font-semibold underline decoration-2 underline-offset-4 hover:bg-marker hover:text-marker-foreground">
                      {g.h1}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {next && tool.nextStep ? (
            <section aria-labelledby="next-step">
              <h2 id="next-step" className="font-display text-3xl font-extrabold tracking-tight">
                Next step
              </h2>
              <p className="mt-4 max-w-[62ch] border-t border-foreground pt-4 text-lg">
                {tool.nextStep.text}{" "}
                <Link href={`/tools/${next.slug}`} className="font-semibold underline decoration-2 underline-offset-4 hover:bg-marker hover:text-marker-foreground">
                  Open {next.name}
                </Link>
                .
              </p>
            </section>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related" className="mt-20">
          <h2 id="related" className="mb-5 font-display text-3xl font-extrabold tracking-tight">
            Related tools
          </h2>
          <Ledger tools={related} sequential={false} compact showCategory={false} />
        </section>
      ) : null}
    </div>
  );
}
