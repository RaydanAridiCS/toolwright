"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Play, Trash2 } from "lucide-react";
import { Alert, Button, DownloadButton, Field, FileDropzone, formatFileSize, Input, Panel, ResultSlab, Select, Toggle } from "@toolwright/ui";
import { NumberField, num } from "../../shared/number-field";
import { useObjectUrl } from "../../shared/svg-preview";
import { GifAborted, GifSession, type GifInfo } from "../../shared/gif-client";
import { RunProgress } from "../../shared/pdf-ui";
import { errorMessage } from "../../shared/format";

interface Picture {
  id: number;
  name: string;
  file: File;
  width: number;
  height: number;
  pixels: ArrayBuffer;
}

/** Pictures are read at most this many pixels on a side; a GIF is never that big anyway. */
const MAX_SIDE = 2000;
let nextId = 1;

async function readPicture(file: File): Promise<Picture> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`“${file.name}” could not be read as a picture.`);
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("This browser cannot read pictures.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return { id: nextId++, name: file.name, file, width, height, pixels: ctx.getImageData(0, 0, width, height).data.buffer.slice(0) as ArrayBuffer };
  } finally {
    bitmap.close();
  }
}

function hexToRgba(hex: string): [number, number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16), 255] : [255, 255, 255, 255];
}

function Thumb({ file, name }: { file: File; name: string }) {
  const url = useObjectUrl(file);
  // eslint-disable-next-line @next/next/no-img-element -- a blob URL made in this tab
  return url ? <img src={url} alt={name} className="size-14 shrink-0 border border-border object-cover" /> : <span className="size-14 shrink-0 border border-border" />;
}

export default function Tool() {
  const session = useRef<GifSession | null>(null);
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [width, setWidth] = useState("");
  const [fit, setFit] = useState<"contain" | "cover" | "stretch">("contain");
  const [useBackground, setUseBackground] = useState(true);
  const [background, setBackground] = useState("#ffffff");
  const [delay, setDelay] = useState("200");
  const [loopForever, setLoopForever] = useState(true);
  const [loops, setLoops] = useState("1");
  const [colors, setColors] = useState("256");
  const [optimize, setOptimize] = useState(true);
  const [result, setResult] = useState<{ blob: Blob; info: GifInfo } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = new GifSession();
    session.current = s;
    return () => s.dispose();
  }, []);

  const resultUrl = useObjectUrl(result?.blob ?? null);
  const first = pictures[0];
  const outWidth = Math.max(1, Math.round(num(width) || Math.min(first?.width ?? 480, 480)));
  const outHeight = first ? Math.max(1, Math.round((first.height * outWidth) / first.width)) : 0;

  const signature = useMemo(() => JSON.stringify([pictures.map((p) => p.id), width, fit, useBackground, background, delay, loopForever, loops, colors, optimize]), [pictures, width, fit, useBackground, background, delay, loopForever, loops, colors, optimize]);
  useEffect(() => setResult(null), [signature]);

  const add = async (files: File[]) => {
    setError(null);
    setReading(true);
    try {
      const read: Picture[] = [];
      for (const f of files) read.push(await readPicture(f));
      setPictures((cur) => [...cur, ...read]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setReading(false);
    }
  };

  const move = (index: number, by: -1 | 1) =>
    setPictures((cur) => {
      const next = cur.slice();
      const target = index + by;
      if (target < 0 || target >= next.length) return cur;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const make = async () => {
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      const out = await session.current!.make(
        {
          pictures: pictures.map((p) => ({ width: p.width, height: p.height, pixels: p.pixels })),
          width: outWidth,
          height: outHeight,
          fit,
          background: useBackground ? hexToRgba(background) : [0, 0, 0, 0],
          delayMs: num(delay),
          loop: loopForever ? 0 : Math.max(1, Math.round(num(loops))),
          maxColors: Math.min(256, Math.max(2, Math.round(num(colors)))),
          optimize,
        },
        (done, total) => setProgress({ done, total }),
      );
      setResult({ blob: new Blob([out.bytes as BlobPart], { type: "image/gif" }), info: out.info });
    } catch (err) {
      if (!(err instanceof GifAborted)) setError(errorMessage(err, "The GIF could not be made."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <FileDropzone accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" multiple label="Drop pictures here, or click to browse" hint="PNG, JPG, WebP, GIF or BMP. Each becomes one frame. They are never uploaded." maxSizeMB={25} onReject={setError} onFiles={add} />
      {reading ? <p className="text-sm text-muted-foreground">Reading pictures…</p> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {pictures.length > 0 ? (
        <>
          <Panel
            title={`${pictures.length} ${pictures.length === 1 ? "frame" : "frames"}, shown in this order`}
            actions={
              <Button size="sm" variant="ghost" onClick={() => setPictures([])}>
                Clear all
              </Button>
            }
          >
            <ol aria-label="Frames" className="flex flex-col">
              {pictures.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-border py-2 text-sm">
                  <span className="w-6 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <Thumb file={p.file} name={p.name} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <Button size="icon" variant="ghost" className="size-8" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" aria-label={`Move ${p.name} down`} disabled={i === pictures.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" aria-label={`Remove ${p.name}`} onClick={() => setPictures((cur) => cur.filter((x) => x.id !== p.id))}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ol>
          </Panel>

          <div className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="Width" value={width} onChange={setWidth} min={1} max={2000} step={1} suffix="px" placeholder={String(outWidth)} hint={`The GIF will be ${outWidth} × ${outHeight}.`} />
            <Field label="Pictures of other shapes">
              {(id) => (
                <Select id={id} value={fit} onChange={(e) => setFit(e.target.value as typeof fit)}>
                  <option value="contain">Fit inside, with bars</option>
                  <option value="cover">Fill, and crop the edges</option>
                  <option value="stretch">Stretch</option>
                </Select>
              )}
            </Field>
            <Toggle label="Solid background" checked={useBackground} onCheckedChange={setUseBackground} hint="Off keeps transparent areas transparent." />
            {useBackground ? (
              <Field label="Background colour">
                {(id) => (
                  <div className="flex items-center gap-2">
                    <input type="color" aria-label="Background colour picker" className="size-9 shrink-0 cursor-pointer border border-border bg-transparent p-0" value={/^#[0-9a-f]{6}$/i.test(background) ? background : "#ffffff"} onChange={(e) => setBackground(e.target.value)} />
                    <Input id={id} mono value={background} onChange={(e) => setBackground(e.target.value)} />
                  </div>
                )}
              </Field>
            ) : null}
            <NumberField label="Delay per frame" value={delay} onChange={setDelay} min={20} step={10} suffix="ms" hint="At least 20 ms. 100 ms is 10 frames a second." />
            <Toggle label="Play forever" checked={loopForever} onCheckedChange={setLoopForever} />
            {!loopForever ? <NumberField label="Play this many times" value={loops} onChange={setLoops} min={1} step={1} /> : null}
            <NumberField label="Colours" value={colors} onChange={setColors} min={2} max={256} step={1} hint="Fewer colours make a smaller file." />
            <Toggle label="Optimize" checked={optimize} onCheckedChange={setOptimize} hint="Stores only what changes between frames." />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled={busy || reading} onClick={make}>
              <Play /> {busy ? "Making GIF…" : "Make GIF"}
            </Button>
            {busy ? (
              <Button
                variant="ghost"
                onClick={() => {
                  void session.current?.cancel();
                  setBusy(false);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
          {busy && progress.total > 0 ? <RunProgress label="Frame" done={progress.done} total={progress.total} /> : null}

          {result && resultUrl ? (
            <>
              <ResultSlab label="Your GIF" size="md" value={formatFileSize(result.blob.size)} note={`${result.info.width} × ${result.info.height}, ${result.info.frames} ${result.info.frames === 1 ? "frame" : "frames"}.`} valueTestId="gif-size" />
              <div className="grid min-h-48 place-items-center border border-border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL made in this tab */}
                <img src={resultUrl} alt="The new GIF" className="block max-h-96 max-w-full object-contain" />
              </div>
              <div>
                <DownloadButton data={result.blob} filename="animation.gif" mime="image/gif" label="Download GIF" />
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
