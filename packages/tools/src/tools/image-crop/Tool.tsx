"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { FlipHorizontal2, FlipVertical2, Loader2, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { Alert, Button, DownloadButton, Field, FileDropzone, FileListItem, Input, Panel, ResultSlab, SegmentedControl, Select, Stat, StatGrid, Toggle, formatFileSize, useDebounced } from "@toolwright/ui";
import {
  ANGLE_RANGE,
  ASPECTS,
  NO_TURN,
  aspectRatio,
  checkSize,
  clampRect,
  describeSize,
  fullRect,
  isNoTurn,
  moveRect,
  normalizeTurn,
  parseAspect,
  rectForAspect,
  rectWithoutCorners,
  resizeRect,
  turnedSize,
  type AspectId,
  type Handle,
  type Rect,
  type Turn,
} from "@toolwright/core/image-crop";
import { NumberField, num } from "../../shared/number-field";
import { loadImage, outputName, type LoadedImage, type OutputFormat } from "../../shared/image";
import { drawTurned, renderCropped } from "../../shared/image-crop-render";
import { errorMessage } from "../../shared/format";

type FormatChoice = "same" | OutputFormat;

const HANDLES: { id: Handle; className: string; cursor: string }[] = [
  { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { id: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "ns-resize" },
  { id: "ne", className: "left-full top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { id: "e", className: "left-full top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { id: "se", className: "left-full top-full -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { id: "s", className: "left-1/2 top-full -translate-x-1/2 -translate-y-1/2", cursor: "ns-resize" },
  { id: "sw", className: "left-0 top-full -translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { id: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

function sameFormat(file: File): OutputFormat {
  return file.type === "image/jpeg" || file.type === "image/webp" || file.type === "image/png" ? file.type : "image/png";
}

interface Drag {
  mode: "move" | Handle;
  startX: number;
  startY: number;
  rect: Rect;
  /** Picture pixels per screen pixel. */
  perPixel: number;
}

interface Output {
  blob: Blob;
  name: string;
  width: number;
  height: number;
  fellBack: boolean;
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [turn, setTurn] = useState<Turn>(NO_TURN);
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, width: 1, height: 1 });
  const [aspect, setAspect] = useState<AspectId>("free");
  const [customAspect, setCustomAspect] = useState("16:10");

  const [format, setFormat] = useState<FormatChoice>("same");
  const [quality, setQuality] = useState(90);
  const [fillCorners, setFillCorners] = useState(false);
  const [fillColour, setFillColour] = useState("#ffffff");

  const [output, setOutput] = useState<Output | null>(null);
  const [rendering, setRendering] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const loadToken = useRef(0);

  const size = useMemo(() => (image ? { width: image.width, height: image.height } : { width: 1, height: 1 }), [image]);
  const turned = useMemo(() => turnedSize(size, turn), [size, turn]);
  const ratio = aspectRatio(aspect, turned, customAspect);
  const customBad = aspect === "custom" && parseAspect(customAspect) === null;

  useEffect(() => () => image?.dispose(), [image]);

  /* ---------------------------------- opening a picture ---------------------------------- */

  async function open(next: File) {
    const token = ++loadToken.current;
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadImage(next);
      if (token !== loadToken.current) return loaded.dispose();
      const check = checkSize({ width: loaded.width, height: loaded.height });
      if (check.refuse) {
        loaded.dispose();
        throw new Error(check.refuse);
      }
      setFile(next);
      setImage(loaded);
      setTurn(NO_TURN);
      setAspect("free");
      setCrop(fullRect({ width: loaded.width, height: loaded.height }));
      setOutput(null);
    } catch (err) {
      if (token === loadToken.current) setError(errorMessage(err, "This picture could not be opened."));
    } finally {
      if (token === loadToken.current) setLoading(false);
    }
  }

  function close() {
    loadToken.current++;
    setFile(null);
    setImage(null);
    setOutput(null);
    setError(null);
    setTurn(NO_TURN);
    setAspect("free");
  }

  /* ---------------------------------- turning ---------------------------------- */

  function applyTurn(next: Partial<Turn>) {
    const nextTurn = normalizeTurn({ ...turn, ...next });
    setTurn(nextTurn);
    // A new turn changes the picture's shape, so the box starts again from the whole picture (or the chosen shape).
    const nextSize = turnedSize(size, nextTurn);
    setCrop(rectForAspect(nextSize, aspectRatio(aspect, nextSize, customAspect)));
  }

  const rotate = (by: 1 | -1) => applyTurn({ quarters: (((turn.quarters + by) % 4) + 4) % 4 as Turn["quarters"] });

  function chooseAspect(next: AspectId) {
    setAspect(next);
    setCrop(rectForAspect(turned, aspectRatio(next, turned, customAspect), crop));
  }

  /* ---------------------------------- drawing the preview ---------------------------------- */

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    try {
      drawTurned(canvasRef.current, image, turn);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [image, turn]);

  /* ---------------------------------- saving ---------------------------------- */

  const wanted = useDebounced({ turn, crop, format, quality, fillCorners, fillColour }, 400);

  useEffect(() => {
    if (!image || !file) return;
    const outSize = { width: wanted.crop.width, height: wanted.crop.height };
    const check = checkSize(outSize, "result");
    if (check.refuse) {
      setOutput(null);
      setError(check.refuse);
      return;
    }
    let cancelled = false;
    setRendering(true);
    (async () => {
      try {
        const type: OutputFormat = wanted.format === "same" ? sameFormat(file) : wanted.format;
        const result = await renderCropped(image, wanted.turn, wanted.crop, {
          type,
          quality: wanted.quality / 100,
          background: wanted.fillCorners || type === "image/jpeg" ? wanted.fillColour : null,
        });
        if (cancelled) return;
        setError(null);
        setOutput({ blob: result.blob, name: outputName(file.name, result.blob.type, "-cropped"), width: result.width, height: result.height, fellBack: result.fellBack });
      } catch (err) {
        if (!cancelled) {
          setOutput(null);
          setError(errorMessage(err));
        }
      } finally {
        // Also reached when this run was replaced, so the "Saving…" state never sticks.
        setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [image, file, wanted]);

  /* ---------------------------------- the box: mouse, touch and keyboard ---------------------------------- */

  function perPixel(): number {
    const el = canvasRef.current;
    const shown = el?.getBoundingClientRect().width ?? 0;
    return shown > 0 ? turned.width / shown : 1;
  }

  function begin(mode: Drag["mode"], e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, rect: crop, perPixel: perPixel() };
  }

  function dragTo(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) * d.perPixel;
    const dy = (e.clientY - d.startY) * d.perPixel;
    setCrop(d.mode === "move" ? moveRect(d.rect, dx, dy, turned) : resizeRect(d.rect, d.mode, dx, dy, turned, ratio, Math.max(8, Math.round(8 * d.perPixel))));
  }

  function end(e: ReactPointerEvent<HTMLElement>) {
    if (drag.current && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  }

  function onBoxKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.altKey ? 1 : e.ctrlKey || e.metaKey ? 50 : 10;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const delta = move[e.key];
    if (!delta) return;
    e.preventDefault();
    setCrop(e.shiftKey ? resizeRect(crop, "se", delta[0], delta[1], turned, ratio, 1) : moveRect(crop, delta[0], delta[1], turned));
  }

  /* ---------------------------------- typed numbers ---------------------------------- */

  function setField(field: keyof Rect, text: string) {
    const value = num(text);
    if (!Number.isFinite(value)) return;
    if (field === "width" && ratio) setCrop(clampRect({ ...crop, width: value, height: value / ratio }, turned));
    else if (field === "height" && ratio) setCrop(clampRect({ ...crop, height: value, width: value * ratio }, turned));
    else setCrop(clampRect({ ...crop, [field]: value }, turned));
  }

  const lossy = (format === "same" ? file && sameFormat(file) : format) !== "image/png";
  const unchanged = isNoTurn(turn) && crop.x === 0 && crop.y === 0 && crop.width === turned.width && crop.height === turned.height;
  const sizeCheck = checkSize(turned);

  if (!file || !image) {
    return (
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          label={loading ? "Opening picture…" : "Drop a picture here, or click to browse"}
          hint="JPG, PNG or WebP. Your picture is processed in this tab and never uploaded."
          disabled={loading}
          onReject={setError}
          onFiles={([f]) => f && void open(f)}
        />
        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>
    );
  }

  const pct = (n: number, of: number) => `${(n / of) * 100}%`;

  return (
    <div className="flex flex-col gap-6">
      <ul>
        <FileListItem name={file.name} size={file.size} detail={`${image.width} × ${image.height} px`} onRemove={close} />
      </ul>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {sizeCheck.warn ? <Alert tone="warning">{sizeCheck.warn}</Alert> : null}

      <Panel title="Turn" actions={<Button size="sm" variant="ghost" onClick={() => applyTurn(NO_TURN)} disabled={isNoTurn(turn)}><Undo2 aria-hidden />Reset turn</Button>}>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => rotate(-1)}><RotateCcw aria-hidden />Turn left</Button>
          <Button variant="outline" size="sm" onClick={() => rotate(1)}><RotateCw aria-hidden />Turn right</Button>
          <Button variant="outline" size="sm" aria-pressed={turn.flipH} onClick={() => applyTurn({ flipH: !turn.flipH })}><FlipHorizontal2 aria-hidden />Flip left-right</Button>
          <Button variant="outline" size="sm" aria-pressed={turn.flipV} onClick={() => applyTurn({ flipV: !turn.flipV })}><FlipVertical2 aria-hidden />Flip top-bottom</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label={`Straighten (${turn.angle > 0 ? "+" : ""}${turn.angle}°)`} hint="Tilt the picture to level a crooked horizon. Empty corners can be filled or cropped away.">
            {(id) => (
              <input
                id={id}
                type="range"
                min={ANGLE_RANGE.min}
                max={ANGLE_RANGE.max}
                step={0.5}
                value={turn.angle}
                onChange={(e) => applyTurn({ angle: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            )}
          </Field>
          <Button variant="outline" size="sm" disabled={turn.angle === 0} onClick={() => setCrop(rectWithoutCorners(size, turn))}>
            Remove empty corners
          </Button>
        </div>
      </Panel>

      <Panel title="Crop">
        <div className="flex flex-col gap-3">
          <SegmentedControl<AspectId> label="Shape of the box" value={aspect} onValueChange={chooseAspect} options={ASPECTS.map((a) => ({ value: a.id, label: a.label }))} />
          {aspect === "custom" ? (
            <Field label="Custom shape" hint={customBad ? "Write it as 16:10 or as a number such as 1.6." : "Width to height, for example 16:10."}>
              {(id) => (
                <Input
                  id={id}
                  value={customAspect}
                  mono
                  aria-invalid={customBad || undefined}
                  onChange={(e) => {
                    setCustomAspect(e.target.value);
                    const r = parseAspect(e.target.value);
                    if (r) setCrop(rectForAspect(turned, r, crop));
                  }}
                  className="max-w-40"
                />
              )}
            </Field>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField label="Crop left" suffix="px" value={String(crop.x)} onChange={(v) => setField("x", v)} min={0} step={1} />
          <NumberField label="Crop top" suffix="px" value={String(crop.y)} onChange={(v) => setField("y", v)} min={0} step={1} />
          <NumberField label="Crop width" suffix="px" value={String(crop.width)} onChange={(v) => setField("width", v)} min={1} step={1} />
          <NumberField label="Crop height" suffix="px" value={String(crop.height)} onChange={(v) => setField("height", v)} min={1} step={1} />
        </div>

        <div className="flex justify-center overflow-hidden border border-border bg-muted p-3">
          <div className="relative inline-block max-w-full touch-none select-none">
            <canvas ref={canvasRef} role="img" aria-label="The picture as it will be cut" className="block h-auto max-h-[70vh] max-w-full" />
            {/* Four dark bands cover everything outside the box. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bg-foreground/55" style={{ height: pct(crop.y, turned.height) }} />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 bg-foreground/55" style={{ height: pct(turned.height - crop.y - crop.height, turned.height) }} />
            <div aria-hidden className="pointer-events-none absolute left-0 bg-foreground/55" style={{ top: pct(crop.y, turned.height), height: pct(crop.height, turned.height), width: pct(crop.x, turned.width) }} />
            <div aria-hidden className="pointer-events-none absolute right-0 bg-foreground/55" style={{ top: pct(crop.y, turned.height), height: pct(crop.height, turned.height), width: pct(turned.width - crop.x - crop.width, turned.width) }} />
            <div
              role="group"
              aria-label="Crop box"
              aria-describedby="crop-box-help"
              tabIndex={0}
              onKeyDown={onBoxKey}
              onPointerDown={(e) => begin("move", e)}
              onPointerMove={dragTo}
              onPointerUp={end}
              onPointerCancel={end}
              className="absolute cursor-move border-2 border-card outline outline-1 outline-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
              style={{ left: pct(crop.x, turned.width), top: pct(crop.y, turned.height), width: pct(crop.width, turned.width), height: pct(crop.height, turned.height) }}
            >
              {HANDLES.map((h) => (
                <span
                  key={h.id}
                  aria-hidden
                  onPointerDown={(e) => begin(h.id, e)}
                  onPointerMove={dragTo}
                  onPointerUp={end}
                  onPointerCancel={end}
                  className={`absolute size-4 border border-foreground bg-card ${h.className}`}
                  style={{ cursor: h.cursor }}
                />
              ))}
            </div>
          </div>
        </div>
        <p id="crop-box-help" className="text-xs text-muted-foreground">
          Drag the box to move it and the squares on its edge to resize it. With the box focused, the arrow keys move it by 10 pixels (Alt for 1, Ctrl for 50) and Shift with the arrows resizes it.
        </p>
      </Panel>

      <Panel title="Save">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Format">
            {(id) => (
              <Select id={id} value={format} onChange={(e) => setFormat(e.target.value as FormatChoice)}>
                <option value="same">Same as the original</option>
                <option value="image/png">PNG (lossless)</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </Select>
            )}
          </Field>
          {lossy ? (
            <Field label={`Quality (${quality})`}>
              {(id) => <input id={id} type="range" min={40} max={100} step={1} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-primary" />}
            </Field>
          ) : null}
          <div className="flex flex-col gap-2">
            <Toggle label="Fill empty areas with a colour" checked={fillCorners} onCheckedChange={setFillCorners} hint="Otherwise they stay transparent (white in a JPEG)." />
            {fillCorners || format === "image/jpeg" || (format === "same" && file.type === "image/jpeg") ? (
              <Input type="color" aria-label="Colour for empty areas" value={fillColour} onChange={(e) => setFillColour(e.target.value)} className="h-9 w-20 p-1" />
            ) : null}
          </div>
        </div>
        {lossy ? <p className="text-xs text-muted-foreground">JPEG and WebP are saved again, which loses a little detail. Use PNG to keep every pixel.</p> : null}
      </Panel>

      {output ? (
        <div className="flex flex-col gap-3" aria-busy={rendering}>
          <ResultSlab label="Result" value={describeSize(output)} valueTestId="crop-result-size" />
          <StatGrid>
            <Stat label="Original" value={`${image.width} × ${image.height}`} />
            <Stat label="File size" value={formatFileSize(output.blob.size)} />
            <Stat label="Format" value={output.blob.type.replace("image/", "").toUpperCase()} />
          </StatGrid>
          {output.fellBack ? <Alert tone="warning">This browser could not save that format, so the picture was saved as {output.blob.type.replace("image/", "").toUpperCase()}.</Alert> : null}
          {unchanged ? <Alert tone="info">Nothing is cropped or turned yet. The saved picture is a fresh copy of the original without its camera and location data.</Alert> : null}
          <div className="flex flex-wrap items-center gap-2">
            <DownloadButton data={output.blob} filename={output.name} mime={output.blob.type} label="Download" variant="primary" size="md" />
            {rendering ? <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-4 animate-spin" />Saving…</span> : null}
          </div>
        </div>
      ) : rendering ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-4 animate-spin" />Saving…</p>
      ) : null}
    </div>
  );
}
