import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTool } from "@toolwright/tools";
import { FaqList } from "../../../components/faq-list";
import { GuideBlocks } from "../../../components/guide-body";
import { JsonLd } from "../../../components/json-ld";
import { GUIDES, getGuide } from "../../../content/guides";
import { pageMetadata } from "../../../lib/seo";
import { articleLd, breadcrumbLd, faqLd } from "../../../lib/structured-data";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return pageMetadata({ title: guide.seoTitle, description: guide.seoDescription, path: `/guides/${guide.slug}` });
}

const date = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const anchor = (heading: string) => `s-${heading.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const path = `/guides/${guide.slug}`;
  const tools = guide.tools.map((s) => getTool(s)).filter((t) => t !== undefined);

  return (
    <article className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd
        data={[
          articleLd({ title: guide.h1, description: guide.seoDescription, path, published: guide.published, updated: guide.updated }),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Guides", path: "/guides" },
            { name: guide.h1, path },
          ]),
          faqLd(guide.faq),
        ]}
      />
      <nav aria-label="Breadcrumb" className="label-plate flex flex-wrap items-center gap-2">
        <Link href="/guides" className="hover:bg-marker hover:text-marker-foreground">
          Guides
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page" className="text-foreground">
          {guide.seoTitle}
        </span>
      </nav>

      <header className="mt-6 max-w-4xl border-b-2 border-foreground pb-8">
        <h1 className="font-display text-[clamp(2.2rem,5vw,4.2rem)] font-extrabold leading-[0.98] tracking-[-0.028em]">{guide.h1}</h1>
        <p className="mt-6 max-w-[66ch] text-xl leading-relaxed">{guide.answer}</p>
        <p className="label-plate mt-6 normal-case tracking-normal">
          By the Toolwright team · Published <time dateTime={guide.published}>{date(guide.published)}</time> · Updated <time dateTime={guide.updated}>{date(guide.updated)}</time>
        </p>
      </header>

      <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_18rem]">
        <div className="flex max-w-3xl flex-col gap-12">
          {guide.sections.map((section) => (
            <section key={section.heading} aria-labelledby={anchor(section.heading)}>
              <h2 id={anchor(section.heading)} className="font-display text-3xl font-extrabold tracking-tight">
                {section.heading}
              </h2>
              <GuideBlocks blocks={section.blocks} />
            </section>
          ))}

          <section aria-labelledby="guide-faq">
            <h2 id="guide-faq" className="font-display text-3xl font-extrabold tracking-tight">
              Frequently asked questions
            </h2>
            <div className="mt-6">
              <FaqList items={guide.faq} />
            </div>
          </section>
        </div>

        <aside aria-labelledby="guide-tools" className="lg:sticky lg:top-24 lg:self-start">
          <h2 id="guide-tools" className="label-plate text-foreground">
            Tools in this guide
          </h2>
          <ul className="mt-3 border-t border-foreground">
            {tools.map((t) => (
              <li key={t.slug} className="border-b border-border">
                <Link href={`/tools/${t.slug}`} className="block py-3 hover:bg-marker hover:text-marker-foreground">
                  <span className="font-display text-xl font-bold">{t.name}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{t.tagline}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="underline decoration-2 underline-offset-4 hover:bg-marker hover:text-marker-foreground">
              How Toolwright keeps files private
            </Link>
          </p>
        </aside>
      </div>
    </article>
  );
}
