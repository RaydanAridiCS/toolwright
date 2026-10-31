import type { Metadata } from "next";
import { pageMetadata } from "../../lib/seo";
import Link from "next/link";
import { tools } from "@toolwright/tools";
import { ProsePage } from "../../components/prose-page";
import { SITE } from "../../lib/site";

export const metadata: Metadata = pageMetadata({ title: "About: Free, Open-Source, Private Tools", description: "Toolwright is a free, open-source, community-built collection of private online tools. Learn why it exists and how it works.", path: "/about" });

export default function AboutPage() {
  return (
    <ProsePage kicker="About" title="About Toolwright" intro="A wright is a maker. Toolwright is a workshop for making everyday online tools that respect the people using them.">
      <h2>Why this exists</h2>
      <p>
        Ask a search engine for a PDF merger, an image compressor or a JSON formatter and most results want you to upload your files to a server you know nothing about, wrap them in ads, or sign you up for a trial. For the sensitive stuff (contracts, ID scans, API payloads, passwords) that is a bad trade.
      </p>
      <p>
        Modern browsers are powerful enough to do all of this work locally. Toolwright is a collection of {tools.length} tools built on that idea: <strong>do the work on your device, and make that verifiable</strong>.
      </p>

      <h2>Principles</h2>
      <ul>
        <li>
          <strong>Private by construction.</strong> No uploads. A strict Content Security Policy stops pages from calling third parties. <Link href="/privacy">See how to check</Link>.
        </li>
        <li>
          <strong>Free, without catches.</strong> No accounts, watermarks, file-size limits or daily quotas.
        </li>
        <li>
          <strong>Open source.</strong> MIT licensed. If a tool is wrong, you can fix it; if one is missing, you can add it.
        </li>
        <li>
          <strong>Honest.</strong> Tools tell you what they can&rsquo;t do. For example, the image compressor says plainly that PNG is lossless, and the cipher tools say they offer no real security.
        </li>
        <li>
          <strong>Accessible and fast.</strong> Keyboard-friendly, screen-reader labelled, light and dark themes, and small enough to load quickly.
        </li>
      </ul>

      <h2>How it&rsquo;s built</h2>
      <p>
        Toolwright is a TypeScript monorepo: a Next.js site, a framework-free <code>core</code> package that holds each tool&rsquo;s logic (with a large automated test suite), a shared UI kit, and a small database package used only by the tool request board. Each tool is a single folder with a metadata file and a component, so adding one takes minutes.
      </p>

      <h2>Get involved</h2>
      <ul>
        <li>
          <Link href="/requests">Request a tool</Link> or vote for ideas you want.
        </li>
        <li>
          <Link href="/contribute">Contribute a tool</Link> or fix a bug.
        </li>
        <li>
          Star or fork the project on{" "}
          <a href={SITE.repo} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          .
        </li>
      </ul>
    </ProsePage>
  );
}
