import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "../../lib/seo";
import { RequestBoard } from "../../components/request-board";

export const metadata: Metadata = pageMetadata({ title: "Request a Tool", description: "Suggest the next Toolwright tool and vote on ideas from the community. No account needed.", path: "/requests" });

export default function RequestsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="label-plate mb-3">The request board</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.028em]">Request a tool</h1>
      <p className="mt-4 max-w-xl text-lg">
        Tell us what to build next. The most-voted ideas get built first, and anyone can build one:{" "}
        <Link href="/contribute" className="font-semibold underline underline-offset-4">
          here is how
        </Link>
        .
      </p>
      <div className="mt-12">
        <RequestBoard />
      </div>
    </div>
  );
}
