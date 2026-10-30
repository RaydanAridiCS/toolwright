"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, FileText, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { Alert, Badge, Button, baseName } from "@toolwright/ui";
import { organizePages } from "@toolwright/core/pdf";
import { collateDuplexScan, duplicatePage, initialPlan, isUntouched, movePage, planToOps, removePage, reversePlan, turnPage, type PlanPage } from "@toolwright/core/pdf-organizer";
import { DownloadResult, JobError, PdfDrop, PdfSourceCard, RunButton, useJob, usePdfSource, type PdfSource } from "../../shared/pdf-ui";

export default function Tool() {
  const pdf = usePdfSource();
  const source = pdf.source;

  return (
    <div className="flex flex-col gap-5">
      {source ? null : <PdfDrop onFile={pdf.load} onReject={pdf.setError} loading={pdf.loading} />}
      <JobError error={pdf.error} />
      {source ? <Organizer key={`${source.file.name}-${source.file.size}-${source.file.lastModified}`} source={source} onRemove={pdf.clear} /> : null}
    </div>
  );
}

function Organizer({ source, onRemove }: { source: PdfSource; onRemove: () => void }) {
  const total = source.info.pageCount;
  const [plan, setPlan] = useState<PlanPage[]>(() => initialPlan(total));
  const [notice, setNotice] = useState<string | null>(null);
  const job = useJob<Uint8Array>();

  const edit = (next: (current: PlanPage[]) => PlanPage[]) => {
    setNotice(null);
    job.reset();
    setPlan(next);
  };
  const collate = () => {
    try {
      // Computed here, not inside the state updater, so a thrown error can be caught.
      const collated = collateDuplexScan(plan);
      edit(() => collated);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not collate these pages.");
    }
  };

  const untouched = isUntouched(plan, total);
  const removed = Math.max(0, total - new Set(plan.map((p) => p.source)).size);

  return (
    <>
      <PdfSourceCard source={source} onRemove={onRemove} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Button variant="outline" size="sm" disabled={plan.length < 2} onClick={() => edit(reversePlan)}>
          Reverse order
        </Button>
        <Button variant="outline" size="sm" disabled={plan.length < 2} onClick={collate}>
          Collate double-sided scan
        </Button>
        <Button variant="ghost" size="sm" disabled={untouched} onClick={() => edit(() => initialPlan(total))}>
          Start over
        </Button>
        <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
          {plan.length} page{plan.length === 1 ? "" : "s"} in the new file{removed ? ` · ${removed} of the original left out` : ""}
        </p>
      </div>
      {notice ? <Alert tone="error">{notice}</Alert> : null}

      <ol aria-label="Pages of the new file" className="border-t border-border">
        {plan.map((page, i) => {
          const size = source.info.pages[page.source];
          const label = `page ${page.source + 1}, now at position ${i + 1}`;
          return (
            <li key={page.id} className="flex items-center gap-3 border-b border-border py-2">
              <span className="w-8 shrink-0 text-right font-mono text-sm text-muted-foreground" aria-hidden>
                {i + 1}
              </span>
              <span aria-hidden className="grid size-9 shrink-0 place-items-center border border-border bg-muted">
                <FileText className="size-5 text-muted-foreground transition-transform" style={{ transform: `rotate(${page.turn}deg)` }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  Page {page.source + 1}
                  {page.turn ? (
                    <Badge tone="accent" className="ml-2 align-middle">
                      Turned {page.turn}°
                    </Badge>
                  ) : null}
                </p>
                {size ? <p className="font-mono text-xs text-muted-foreground">{Math.round(size.width)} × {Math.round(size.height)} pt</p> : null}
              </div>
              <div className="flex shrink-0 items-center">
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => edit((p) => movePage(p, i, i - 1))}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${label} down`} disabled={i === plan.length - 1} onClick={() => edit((p) => movePage(p, i, i + 1))}>
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Turn ${label} counter-clockwise`} onClick={() => edit((p) => turnPage(p, i, -1))}>
                  <RotateCcw />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Turn ${label} clockwise`} onClick={() => edit((p) => turnPage(p, i, 1))}>
                  <RotateCw />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Duplicate ${label}`} onClick={() => edit((p) => duplicatePage(p, i))}>
                  <Copy />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove ${label}`} disabled={plan.length === 1} onClick={() => edit((p) => removePage(p, i))}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      <RunButton busy={job.busy} disabled={untouched} onClick={() => job.run(() => organizePages(source.bytes, planToOps(plan)))}>
        Create PDF
      </RunButton>
      {untouched ? <p className="-mt-3 text-sm text-muted-foreground">Make a change above to create a new file.</p> : null}

      <JobError error={job.error} />
      {job.result ? <DownloadResult data={job.result} filename={`${baseName(source.file.name)}-organized.pdf`} note={`${plan.length} page${plan.length === 1 ? "" : "s"}`} /> : null}
    </>
  );
}
