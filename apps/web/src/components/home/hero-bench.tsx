"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plate, SegmentedControl, StatusLine } from "@toolwright/ui";
import { NetworkLedger } from "../network-ledger";
import { ToolLoader } from "../tool-loader";

const TABS = [
  { id: "merge-pdf", label: "Merge PDF", full: "Merge PDF" },
  { id: "compress-pdf", label: "Compress PDF", full: "Compress PDF" },
  { id: "pdf-organizer", label: "Organize pages", full: "PDF Page Organizer" },
  { id: "images-to-pdf", label: "Images to PDF", full: "Images to PDF" },
  { id: "image-compressor", label: "Compress images", full: "Image Compressor" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * The Bench: the real tools, running on this page. Each tab is the same component as the full tool page, loaded on demand
 * (only after the page has settled, and only for tabs you open), with the network ledger underneath to show that
 * nothing goes anywhere. Tabs you have used stay mounted, so a file you dropped is still there when you come back.
 */
export function HeroBench() {
  const [tab, setTab] = useState<TabId>("merge-pdf");
  const [opened, setOpened] = useState<ReadonlySet<TabId>>(new Set());
  const [ready, setReady] = useState(false);
  const current = TABS.find((t) => t.id === tab)!;

  // Keep the first paint light: the tool code arrives once the browser is idle.
  useEffect(() => {
    const start = () => setReady(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(start, 200);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (ready) setOpened((previous) => (previous.has(tab) ? previous : new Set(previous).add(tab)));
  }, [ready, tab]);

  return (
    <Plate
      label="The bench · live"
      className="rise"
      footer={
        <StatusLine>
          <NetworkLedger link={false} />
          <span>Drop a file. Watch the counter.</span>
        </StatusLine>
      }
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl label="Try a tool" value={tab} onValueChange={setTab} options={TABS.map((t) => ({ value: t.id, label: t.label }))} />

        <div className="min-h-44">
          {TABS.map((t) =>
            opened.has(t.id) ? (
              <div key={t.id} hidden={t.id !== tab}>
                <ToolLoader slug={t.id} track={false} />
              </div>
            ) : null,
          )}
          {opened.has(tab) ? null : (
            <div className="skeleton h-72 w-full" role="status" aria-label="Loading tool" />
          )}
        </div>

        <Link href={`/tools/${current.id}`} className="self-start text-sm font-semibold underline decoration-2 underline-offset-4 hover:bg-marker hover:text-marker-foreground">
          Open the full {current.full} page →
        </Link>
      </div>
    </Plate>
  );
}
