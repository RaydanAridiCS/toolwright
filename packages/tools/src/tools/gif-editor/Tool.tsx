"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Play } from "lucide-react";
import { Alert, Button, DownloadButton, Field, FileDropzone, formatFileSize, Panel, ResultSlab, Select, Stat, StatGrid, Toggle, baseName, downloadBlob } from "@toolwright/ui";
import { NumberField, num } from "../../shared/number-field";
import { useObjectUrl } from "../../shared/svg-preview";
import { GifAborted, GifSession, type EditSettings, type GifInfo } from "../../shared/gif-client";
import { createZip } from "../../shared/zip";
import { RunProgress } from "../../shared/pdf-ui";
import { errorMessage } from "../../shared/format";

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 2)} s`;

export default function Tool() {
  const session = useRef<GifSession | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<GifInfo | null>(null);
  const [result, setResult] = useState<{ blob: Blob; info: GifInfo } | null>(null);
  const [busy, setBusy] = useState<"edit" | "split" | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("1");
  const [keepEvery, setKeepEvery] = useState("1");
  const [order, setOrder] = useState<EditSettings["order"]>("normal");
  const [timing, setTiming] = useState<"keep" | "speed" | "fixed">("keep");
  const [speed, setSpeed] = useState("1");
  const [fixed, setFixed] = useState("100");
  const [rotate, setRotate] = useState<EditSettings["rotate"]>(0);
  const [flip, setFlip] = useState<EditSettings["flip"]>("none");
  const [width, setWidth] = useState("");
  const [loopForever, setLoopForever] = useState(true);
  const [loops, setLoops] = useState("1");
  const [colors, setColors] = useState("256");
  const [optimize, setOptimize] = useState(true);

  useEffect(() => {
    const s = new GifSession();
    session.current = s;
    return () => s.dispose();
  }, []);

  const originalUrl = useObjectUrl(file);
  const resultUrl = useObjectUrl(result?.blob ?? null);

  const settings = useMemo<EditSettings>(
    () => ({
      from: Math.round(num(from)),
      to: Math.round(num(to)),
      keepEvery: Math.max(1, Math.round(num(keepEvery))),
      order,
      speed: timing === "speed" ? num(speed) : 1,
      fixedDelayMs: timing === "fixed" ? num(fixed) : null,
      rotate,
      flip,
      width: width.trim() ? Math.round(num(width)) : null,
      loop: loopForever ? 0 : Math.max(1, Math.round(num(loops))),
      maxColors: Math.min(256, Math.max(2, Math.round(num(colors)))),
      optimize,
    }),
    [from, to, keepEvery, order, timing, speed, fixed, rotate, flip, width, loopForever, loops, colors, optimize],
  );

  // Any change to the settings makes the old result stale.
  useEffect(() => setResult(null), [settings]);

  const load = async (next: File) => {
    setError(null);
    setResult(null);
    setInfo(null);
    setFile(next);
    try {
      const loaded = await session.current!.load(next);
      setInfo(loaded);
      setFrom("1");
      setTo(String(loaded.frames));
      setWidth("");
    } catch (err) {
      if (err instanceof GifAborted) return;
      setFile(null);
      setError(errorMessage(err, "This GIF could not be read."));
    }
  };

  const run = async () => {
    setBusy("edit");
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      const out = await session.current!.edit(settings, (done, total) => setProgress({ done, total }));
      setResult({ blob: new Blob([out.bytes as BlobPart], { type: "image/gif" }), info: out.info });
    } catch (err) {
      if (!(err instanceof GifAborted)) setError(errorMessage(err, "The GIF could not be saved."));
    } finally {
      setBusy(null);
    }
  };

  const split = async () => {
    setBusy("split");
    setError(null);
    try {
      const all = await session.current!.frames();
      const canvas = document.createElement("canvas");
      canvas.width = all.width;
      canvas.height = all.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser cannot make PNG pictures.");
      const entries = [];
      const pad = String(all.frames.length).length;
      for (let i = 0; i < all.frames.length; i++) {
        ctx.putImageData(new ImageData(new Uint8ClampedArray(all.frames[i]!.pixels), all.width, all.height), 0, 0);
        const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!png) throw new Error("A frame could not be turned into a PNG.");
        entries.push({ name: `frame-${String(i + 1).padStart(pad, "0")}.png`, data: new Uint8Array(await png.arrayBuffer()) });
      }
      downloadBlob(createZip(entries), `${file ? baseName(file.name) : "gif"}-frames.zip`, "application/zip");
    } catch (err) {
      if (!(err instanceof GifAborted)) setError(errorMessage(err, "The frames could not be saved."));
    } finally {
      setBusy(null);
    }
  };

  const cancel = () => {
    void session.current?.cancel();
    setBusy(null);
  };

  const outName = file ? `${baseName(file.name)}-edited.gif` : "edited.gif";

  return (
    <div className="flex flex-col gap-5">
      <FileDropzone accept="image/gif" label="Drop an animated GIF here, or click to browse" hint="It is edited in this tab and never uploaded." maxSizeMB={100} onReject={setError} onFiles={([f]) => f && load(f)} />
      {error ? <Alert tone="error">{error}</Alert> : null}

      {file && !info && !error ? <p className="text-sm text-muted-foreground">Reading the GIF…</p> : null}

      {info && originalUrl ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title={`Original · ${formatFileSize(file!.size)}`}>
              <div className="grid min-h-48 place-items-center border border-border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL made in this tab */}
                <img src={originalUrl} alt="The original GIF" className="block max-h-80 max-w-full object-contain" />
              </div>
            </Panel>
            <Panel title={result ? `Result · ${formatFileSize(result.blob.size)}` : "Result"}>
              <div className="grid min-h-48 place-items-center border border-border bg-white p-3">
                {resultUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a blob URL made in this tab
                  <img src={resultUrl} alt="The edited GIF" className="block max-h-80 max-w-full object-contain" />
                ) : (
                  <p className="text-sm text-muted-foreground">Press Apply to see the result.</p>
                )}
              </div>
            </Panel>
          </div>

          <StatGrid>
            <Stat label="Size" value={`${info.width} × ${info.height}`} />
            <Stat label="Frames" value={String(info.frames)} />
            <Stat label="Length" value={seconds(info.durationMs)} />
            <Stat label="Plays" value={info.loop === 0 ? "forever" : `${info.loop} ${info.loop === 1 ? "time" : "times"}`} />
          </StatGrid>

          <div className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="First frame" value={from} onChange={setFrom} min={1} max={info.frames} step={1} />
            <NumberField label="Last frame" value={to} onChange={setTo} min={1} max={info.frames} step={1} />
            <NumberField label="Keep one frame in every" value={keepEvery} onChange={setKeepEvery} min={1} step={1} hint="2 halves the frames and keeps the timing." />
            <Field label="Order">
              {(id) => (
                <Select id={id} value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
                  <option value="normal">Normal</option>
                  <option value="reverse">Reverse</option>
                  <option value="boomerang">Forward, then back</option>
                </Select>
              )}
            </Field>
            <Field label="Timing">
              {(id) => (
                <Select id={id} value={timing} onChange={(e) => setTiming(e.target.value as typeof timing)}>
                  <option value="keep">Keep as it is</option>
                  <option value="speed">Change the speed</option>
                  <option value="fixed">Same delay for every frame</option>
                </Select>
              )}
            </Field>
            {timing === "speed" ? <NumberField label="Speed" value={speed} onChange={setSpeed} min={0.1} step={0.25} suffix="×" hint="2 is twice as fast." /> : null}
            {timing === "fixed" ? <NumberField label="Delay per frame" value={fixed} onChange={setFixed} min={20} step={10} suffix="ms" hint="At least 20 ms." /> : null}
            <Field label="Rotate">
              {(id) => (
                <Select id={id} value={String(rotate)} onChange={(e) => setRotate(Number(e.target.value) as typeof rotate)}>
                  <option value="0">No rotation</option>
                  <option value="90">90° clockwise</option>
                  <option value="180">180°</option>
                  <option value="270">90° anticlockwise</option>
                </Select>
              )}
            </Field>
            <Field label="Flip">
              {(id) => (
                <Select id={id} value={flip} onChange={(e) => setFlip(e.target.value as typeof flip)}>
                  <option value="none">Do not flip</option>
                  <option value="horizontal">Left to right</option>
                  <option value="vertical">Top to bottom</option>
                </Select>
              )}
            </Field>
            <NumberField label="New width" value={width} onChange={setWidth} min={1} max={4000} step={1} suffix="px" placeholder={String(info.width)} hint="Height follows the shape." />
            <Toggle label="Play forever" checked={loopForever} onCheckedChange={setLoopForever} />
            {!loopForever ? <NumberField label="Play this many times" value={loops} onChange={setLoops} min={1} step={1} /> : null}
            <NumberField label="Colours" value={colors} onChange={setColors} min={2} max={256} step={1} hint="Fewer colours make a smaller file." />
            <Toggle label="Optimize" checked={optimize} onCheckedChange={setOptimize} hint="Stores only what changes between frames." />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled={busy !== null} onClick={run}>
              <Play /> {busy === "edit" ? "Working…" : "Apply"}
            </Button>
            <Button variant="ghost" disabled={busy !== null} onClick={split}>
              <Archive /> {busy === "split" ? "Splitting…" : "Save every frame as PNG (ZIP)"}
            </Button>
            {busy ? (
              <Button variant="ghost" onClick={cancel}>
                Cancel
              </Button>
            ) : null}
          </div>
          {busy === "edit" && progress.total > 0 ? <RunProgress label="Frame" done={progress.done} total={progress.total} /> : null}

          {result ? (
            <>
              <ResultSlab
                label="New file"
                size="md"
                value={`${formatFileSize(file!.size)} → ${formatFileSize(result.blob.size)}`}
                note={`${result.info.width} × ${result.info.height}, ${result.info.frames} frames, ${seconds(result.info.durationMs)}.${result.blob.size >= file!.size ? " It is not smaller than the original; try fewer colours, a smaller width or fewer frames." : ""}`}
                valueTestId="gif-size"
              />
              <div>
                <DownloadButton data={result.blob} filename={outName} mime="image/gif" label="Download GIF" />
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
