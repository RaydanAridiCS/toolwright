import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, CATEGORY_BY_ID, CATEGORY_CONTENT, isCategoryId, toolsByCategory } from "@toolwright/tools";
import { JsonLd } from "../../../components/json-ld";
import { Ledger } from "../../../components/ledger";
import { pageMetadata } from "../../../lib/seo";
import { breadcrumbLd, categoryLd } from "../../../lib/structured-data";

interface Props {
  params: Promise<{ category: string }>;
}

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!isCategoryId(category)) return {};
  const content = CATEGORY_CONTENT[category];
  return pageMetadata({ title: content.seoTitle, description: content.seoDescription, path: `/category/${category}` });
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  if (!isCategoryId(category)) notFound();
  const c = CATEGORY_BY_ID[category];
  const content = CATEGORY_CONTENT[category];
  const list = toolsByCategory(category);
  const drawerNo = String(CATEGORIES.findIndex((x) => x.id === c.id) + 1).padStart(2, "0");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd
        data={[
          categoryLd(c, list),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Tools", path: "/tools" },
            { name: c.name, path: `/category/${c.id}` },
          ]),
        ]}
      />
      <nav aria-label="Breadcrumb" className="label-plate flex items-center gap-2">
        <Link href="/tools" className="hover:bg-marker hover:text-marker-foreground">
          Tools
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page" className="text-foreground">
          {c.name}
        </span>
      </nav>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-6 border-b-2 border-foreground pb-8">
        <div>
          <p className="label-plate mb-3">Drawer {drawerNo}</p>
          <h1 className="font-display text-[clamp(2.2rem,5.2vw,4.4rem)] font-extrabold leading-[0.95] tracking-[-0.03em]">{content.h1}</h1>
          <div className="mt-6 flex max-w-[62ch] flex-col gap-4 text-lg leading-relaxed">
            {content.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
        <p className="font-display text-[clamp(4rem,10vw,8rem)] font-extrabold leading-none tabular-nums text-primary" aria-label={`${list.length} tools`}>
          {String(list.length).padStart(2, "0")}
        </p>
      </header>

      <h2 className="mt-10 font-display text-3xl font-extrabold tracking-tight">
        The {list.length} tools in {c.name}
      </h2>
      <Ledger tools={list} sequential={false} glyphs className="mt-5" />

      <nav aria-label="Other drawers" className="mt-16">
        <h2 className="label-plate mb-3 text-foreground">Other drawers</h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t border-foreground pt-4">
          {CATEGORIES.filter((x) => x.id !== c.id).map((x) => (
            <li key={x.id}>
              <Link href={`/category/${x.id}`} className="font-display text-xl font-bold hover:bg-marker hover:text-marker-foreground">
                {x.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
