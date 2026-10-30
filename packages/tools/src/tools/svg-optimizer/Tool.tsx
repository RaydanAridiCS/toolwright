"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Alert, Button, CopyButton, downloadBlob, DownloadButton, FileDropzone, formatFileSize, Panel, ResultSlab, Textarea, Toggle, baseName } from "@toolwright/ui";
import type { OptimizeOptions } from "@toolwright/core/svg-optimize";
import { optimizeInWorker, type OptimizeOutcome } from "../../shared/svg-optimize-client";
import { NumberField, num } from "../../shared/number-field";
import { SvgPreview } from "../../shared/svg-preview";
import { createZip } from "../../shared/zip";
import { errorMessage } from "../../shared/format";

interface Item {
  id: number;
  name: string;
  text: string;
}

type Outcome = OptimizeOutcome;

let nextId = 1;
const SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" width="48.000000mm" height="48.000000mm" viewBox="0 0 48.000000 48.000000" inkscape:version="1.0">
  <title>Target</title>
  <metadata id="metadata5"><work>made by hand</work></metadata>
  <sodipodi:namedview id="base" pagecolor="#ffffff" inkscape:zoom="1"/>
  <g inkscape:label="Layer 1" id="layer1">
    <circle style="fill:#ff0000;fill-opacity:1;stroke:none" cx="24.000000" cy="24.000000" r="20.123456789"/>
    <circle style="fill:#ffffff;fill-opacity:1;stroke:none" cx="24.000000" cy="24.000000" r="13.000000"/>
    <circle style="fill:#ff0000;fill-opacity:1;stroke:none" cx="24.000000" cy="24.000000" r="6.000000"/>
  </g>
</svg>
`;

export default function Tool() {
  // Plain state, not the URL: SVG files are often client work and can be large.
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [precision, setPrecision] = useState("3");
  const [flags, setFlags] = useState({ multipass: true, keepAccessibleText: true, removeDimensions: false, keepIds: false, removeScripts: false, removeRasterImages: false, prettify: false });
  const [outcomes, setOutcomes] = useState<Map<number, Outcome>>(new Map());
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  const options = useMemo<OptimizeOptions>(() => ({ precision: Math.round(num(precision)), ...flags }), [precision, flags]);

  // SVGO (about 800 KB) runs in a worker, and is only fetched once there is something to optimize. A new run replaces an old one.
  useEffect(() => {
    if (items.length === 0) {
      setOutcomes(new Map());
      return;
    }
    let live = true;
    setBusy(true);
    setOutcomes(new Map());
    const task = optimizeInWorker(
      items.map((i) => ({ id: i.id, source: i.text })),
      options,
      (id, outcome) => live && setOutcomes((cur) => new Map(cur).set(id, outcome)),
    );
    task.done.catch((err) => live && setRejected(errorMessage(err))).finally(() => live && setBusy(false));
    return () => {
      live = false;
      task.cancel();
    };
  }, [items, options]);

  const addFiles = async (files: File[]) => {
    setRejected(null);
    const added: Item[] = [];
    for (const file of files) added.push({ id: nextId++, name: file.name, text: await file.text() });
    setItems((cur) => [...cur, ...added]);
    setSelected((cur) => cur ?? added[0]?.id ?? null);
  };
  const addPasted = () => {
    const item = { id: nextId++, name: "pasted.svg", text: SAMPLE };
    setItems((cur) => [...cur, item]);
    setSelected(item.id);
  };

  const current = items.find((i) => i.id === selected) ?? items[0] ?? null;
  const outcome = current ? outcomes.get(current.id) : undefined;
  const done = items.flatMap((i) => {
    const o = outcomes.get(i.id);
    return o && "result" in o ? [{ item: i, result: o.result }] : [];
  });
  const totalBefore = done.reduce((n, d) => n + d.result.before, 0);
  const totalAfter = done.reduce((n, d) => n + d.result.after, 0);
  const outName = (name: string) => `${baseName(name)}.min.svg`;

  const setFlag = (key: keyof typeof flags) => (value: boolean) => setFlags((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex flex-col gap-5">
      <FileDropzone accept=".svg,image/svg+xml" multiple label="Drop SVG files here, or click to browse" hint="One or many. They are optimized in this tab and never uploaded." maxSizeMB={20} onReject={setRejected} onFiles={addFiles} />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" onClick={addPasted}>
          Use a sample
        </Button>
        {items.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => (setItems([]), setSelected(null))}>
            <Trash2 /> Clear all
          </Button>
        ) : null}
      </div>
      {rejected ? <Alert tone="error">{rejected}</Alert> : null}

      <div className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="Decimal places kept" value={precision} onChange={setPrecision} min={0} max={8} step={1} hint="Fewer places are smaller; 3 is safe for icons." />
        <Toggle label="Run several passes" checked={flags.multipass} onCheckedChange={setFlag("multipass")} hint="Squeezes out a little more." />
        <Toggle label="Keep title and description" checked={flags.keepAccessibleText} onCheckedChange={setFlag("keepAccessibleText")} hint="Screen readers use them." />
        <Toggle label="Remove width and height" checked={flags.removeDimensions} onCheckedChange={setFlag("removeDimensions")} hint="The SVG then scales to its container." />
        <Toggle label="Keep ids" checked={flags.keepIds} onCheckedChange={setFlag("keepIds")} hint="Turn on if CSS or scripts use them." />
        <Toggle label="Remove scripts and event handlers" checked={flags.removeScripts} onCheckedChange={setFlag("removeScripts")} />
        <Toggle label="Remove embedded bitmaps" checked={flags.removeRasterImages} onCheckedChange={setFlag("removeRasterImages")} />
        <Toggle label="Pretty-print the result" checked={flags.prettify} onCheckedChange={setFlag("prettify")} hint="Easier to read, but bigger." />
      </div>

      {busy && items.length > 0 && !outcome ? <p className="text-sm text-muted-foreground">Optimizing…</p> : null}

      {done.length > 0 ? (
        <ResultSlab
          label={done.length > 1 ? `${done.length} files, total` : "Result"}
          size="md"
          value={`${formatFileSize(totalBefore)} → ${formatFileSize(totalAfter)}`}
          note={totalBefore > 0 ? `${Math.max(0, Math.round((1 - totalAfter / totalBefore) * 100))}% smaller. A file that cannot be shrunk is returned as it was.` : undefined}
          valueTestId="optimize-total"
        />
      ) : null}

      {items.length > 1 ? (
        <ul aria-label="Files" className="border-t border-border">
          {items.map((item) => {
            const o = outcomes.get(item.id);
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-3 border-b border-border py-2 text-sm">
                <button type="button" className={`min-w-0 flex-1 truncate text-left font-medium underline-offset-4 hover:underline ${item.id === current?.id ? "bg-marker text-marker-foreground" : ""}`} onClick={() => setSelected(item.id)}>
                  {item.name}
                </button>
                <span className="font-mono text-xs text-muted-foreground">{o && "result" in o ? `${formatFileSize(o.result.before)} → ${formatFileSize(o.result.after)}` : o && "error" in o ? "Error" : "…"}</span>
                <Button size="icon" variant="ghost" className="size-8" aria-label={`Remove ${item.name}`} onClick={() => setItems((cur) => cur.filter((x) => x.id !== item.id))}>
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {outcome && "error" in outcome ? <Alert tone="error">{outcome.error}</Alert> : null}

      {current && outcome && "result" in outcome ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title={`Before · ${formatFileSize(outcome.result.before)}`}>
              <SvgPreview svg={current.text} label="The original SVG" />
            </Panel>
            <Panel title={`After · ${formatFileSize(outcome.result.after)}`}>
              <SvgPreview svg={outcome.result.svg} label="The optimized SVG" />
            </Panel>
          </div>
          <Panel
            title={outName(current.name)}
            actions={
              <>
                <CopyButton text={outcome.result.svg} label="Copy" />
                <DownloadButton data={outcome.result.svg} filename={outName(current.name)} mime="image/svg+xml" label="Download" />
              </>
            }
          >
            <Textarea aria-label="Optimized SVG" readOnly rows={10} className="min-h-44 font-mono" value={outcome.result.svg} spellCheck={false} />
          </Panel>
          {done.length > 1 ? (
            <div>
              <Button
                variant="primary"
                onClick={() => {
                  const zip = createZip(done.map((d) => ({ name: outName(d.item.name), data: new TextEncoder().encode(d.result.svg) })));
                  downloadBlob(zip, "optimized-svgs.zip", "application/zip");
                }}
              >
                <Download /> Download all {done.length} as a ZIP
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
