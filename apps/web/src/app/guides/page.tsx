import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../../components/json-ld";
import { GUIDES } from "../../content/guides";
import { pageMetadata } from "../../lib/seo";
import { breadcrumbLd, itemListLd } from "../../lib/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Guides: PDFs, Images, Privacy and Networking",
  description: "Plain guides on compressing and merging PDFs, image formats, EXIF data, checking whether a tool uploads your files and reading CIDR notation.",
  path: "/guides",
});

const date = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd
        data={[
          itemListLd("Toolwright guides", "/guides", GUIDES.map((g) => ({ name: g.h1, path: `/guides/${g.slug}` }))),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Guides", path: "/guides" },
          ]),
        ]}
      />
      <p className="label-plate mb-3">The reading shelf</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.028em]">Guides</h1>
      <p className="mt-4 max-w-xl text-lg">Short, practical answers to questions people ask about PDFs, images and privacy, each linked to the tool that does the job on your device.</p>

      <ol className="mt-10 border-t border-foreground">
        {GUIDES.map((g, i) => (
          <li key={g.slug} className="ledger-row border-b border-border">
            <div className="relative flex items-start gap-4 px-2 py-5 sm:gap-6">
              <span className="label-plate ledger-muted w-8 shrink-0 pt-2 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div className="ledger-shift min-w-0 flex-1">
                <h2 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-[28px]">
                  <Link href={`/guides/${g.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                    {g.h1}
                  </Link>
                </h2>
                <p className="ledger-muted mt-1 max-w-[66ch] text-muted-foreground">{g.seoDescription}</p>
                <p className="label-plate ledger-muted mt-2 normal-case tracking-normal">Updated {date(g.updated)}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="policy" className="mt-16 max-w-3xl">
        <h2 id="policy" className="font-display text-2xl font-extrabold tracking-tight">
          How these guides are written
        </h2>
        <p className="mt-3 text-muted-foreground">
          Guides are written by the Toolwright team. Every statement about a tool is checked against what the tool does, including its limits. The date on a guide is the date of its last real edit. If you find a mistake, please{" "}
          <Link href="/contribute" className="underline decoration-2 underline-offset-4 hover:bg-marker hover:text-marker-foreground">
            tell us on GitHub
          </Link>{" "}
          and we will correct it.
        </p>
      </section>
    </div>
  );
}
