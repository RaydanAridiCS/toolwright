"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Undo2 } from "lucide-react";
import { Alert, Button, Field, FileDropzone, Input, SegmentedControl, Select, Toggle } from "@toolwright/ui";
import { hasTransparency, inkBounds, inkFromScan, type Ink } from "@toolwright/core/pdf-sign";

/** A finished signature: a PNG with a transparent background, trimmed to the ink. */
export interface Signature {
  png: Uint8Array;
  /** Object URL for showing it. Revoked by the maker when it is replaced. */
  url: string;
  width: number;
  height: number;
}

type Mode = "draw" | "type" | "upload";

const INKS: { id: string; label: string; ink: Ink; css: string }[] = [
  { id: "black", label: "Black", ink: { r: 17, g: 17, b: 17 }, css: "#111111" },
  { id: "blue", label: "Blue", ink: { r: 26, g: 58, b: 143 }, css: "#1a3a8f" },
  { id: "green", label: "Green", ink: { r: 11, g: 107, b: 85 }, css: "#0b6b55" },
];

/** Handwriting-style fonts that exist on common systems. The first one installed is used. */
const FONTS: { id: string; label: string; css: string }[] = [
  { id: "script", label: "Flowing script", css: '"Segoe Script", "Snell Roundhand", "Brush Script MT", "Lucida Handwriting", cursive' },
  { id: "casual", label: "Casual hand", css: '"Bradley Hand", "Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive' },
  { id: "serif", label: "Italic serif", css: 'Georgia, "Times New Roman", serif' },
];

const W = 1200;
const H = 400;

function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(async (blob) => (blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error("The signature could not be saved."))), "image/png"),
  );
}

/** Crop a canvas to its ink (plus a little air) and make a Signature from it. Null when the canvas is blank. */
async function exportSignature(source: HTMLCanvasElement): Promise<Signature | null> {
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const data = context.getImageData(0, 0, source.width, source.height);
  const bounds = inkBounds(data.data, source.width, source.height, 6);
  if (!bounds) return null;
  const out = document.createElement("canvas");
  out.width = bounds.width;
  out.height = bounds.height;
  out.getContext("2d")?.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
  const png = await canvasToPng(out);
  return { png, url: URL.createObjectURL(new Blob([png as BlobPart], { type: "image/png" })), width: bounds.width, height: bounds.height };
}

export function SignatureMaker({ onChange }: { onChange: (signature: Signature | null) => void }) {
  const [mode, setMode] = useState<Mode>("draw");
  const [inkId, setInkId] = useState("black");
  const [name, setName] = useState("");
  const [fontId, setFontId] = useState("script");
  const [removeBg, setRemoveBg] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<HTMLImageElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const drawing = useRef(false);
  const current = useRef<string | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const ink = INKS.find((i) => i.id === inkId) as (typeof INKS)[number];

  // Hand the signature up, and free the previous picture's URL. The callback is read from a ref so that a parent
  // passing a new function on every render does not make this component export the picture again and again.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const publish = useCallback((signature: Signature | null) => {
    if (current.current) URL.revokeObjectURL(current.current);
    current.current = signature?.url ?? null;
    onChangeRef.current(signature);
  }, []);
  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );

  const paint = useCallback(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = ink.css;
    ctx.fillStyle = ink.css;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 7;
    for (const stroke of strokes.current) {
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc((stroke[0] as { x: number }).x, (stroke[0] as { y: number }).y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo((stroke[0] as { x: number; y: number }).x, (stroke[0] as { x: number; y: number }).y);
      for (let i = 1; i < stroke.length - 1; i++) {
        const a = stroke[i] as { x: number; y: number };
        const b = stroke[i + 1] as { x: number; y: number };
        ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      const last = stroke[stroke.length - 1] as { x: number; y: number };
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  }, [ink.css]);

  const commit = useCallback(async () => {
    const el = canvas.current;
    if (!el) return;
    publish(await exportSignature(el));
  }, [publish]);

  // Redraw and re-export when the ink colour changes, or when switching between modes.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    if (mode === "draw") {
      paint();
      setHasInk(strokes.current.length > 0);
      void commit();
    } else if (mode === "type") {
      ctx.clearRect(0, 0, W, H);
      if (name.trim()) {
        const font = FONTS.find((f) => f.id === fontId) as (typeof FONTS)[number];
        ctx.fillStyle = ink.css;
        ctx.textBaseline = "middle";
        let size = 200;
        ctx.font = `${fontId === "serif" ? "italic " : ""}${size}px ${font.css}`;
        const measured = ctx.measureText(name).width;
        if (measured > W - 40) {
          size = Math.floor((size * (W - 40)) / measured);
          ctx.font = `${fontId === "serif" ? "italic " : ""}${size}px ${font.css}`;
        }
        ctx.fillText(name, 20, H / 2);
      }
      void commit();
    } else {
      ctx.clearRect(0, 0, W, H);
      if (uploaded) {
        const scale = Math.min(W / uploaded.naturalWidth, H / uploaded.naturalHeight, 1);
        const w = Math.round(uploaded.naturalWidth * scale);
        const h = Math.round(uploaded.naturalHeight * scale);
        ctx.drawImage(uploaded, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        if (removeBg && !hasTransparency(data.data)) inkFromScan(data.data, ink.ink);
        ctx.clearRect(0, 0, W, H);
        ctx.putImageData(data, 0, 0);
      }
      void commit();
    }
  }, [mode, name, fontId, ink, uploaded, removeBg, paint, commit]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };

  const clear = () => {
    strokes.current = [];
    setHasInk(false);
    paint();
    publish(null);
  };
  const undo = () => {
    strokes.current.pop();
    setHasInk(strokes.current.length > 0);
    paint();
    void commit();
  };

  const loadFile = async (file: File) => {
    setUploadError(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setUploaded(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setUploadError(`${file.name} could not be read as a picture. Use a PNG, JPG or WebP file.`);
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <SegmentedControl
          label="How to make your signature"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "draw", label: "Draw" },
            { value: "type", label: "Type" },
            { value: "upload", label: "Upload a picture" },
          ]}
        />
        <SegmentedControl label="Ink" value={inkId} onValueChange={setInkId} options={INKS.map((i) => ({ value: i.id, label: i.label }))} />
      </div>

      {mode === "type" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ada Lovelace" />}</Field>
          <Field label="Style" hint="Uses handwriting-style fonts installed on your device, so the look varies by device.">
            {(id) => (
              <Select id={id} value={fontId} onChange={(e) => setFontId(e.target.value)}>
                {FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      ) : null}

      {mode === "upload" ? (
        <div className="flex flex-col gap-3">
          <FileDropzone accept="image/png,image/jpeg,image/webp" label="Drop a picture of your signature, or click to browse" hint="A photo of a signature on white paper works. It stays on your device." maxSizeMB={20} onReject={setUploadError} onFiles={([f]) => f && loadFile(f)} />
          <Toggle label="Remove the paper and keep only the ink" checked={removeBg} onCheckedChange={setRemoveBg} hint="Turns dark pixels into ink and light ones transparent. Pictures that already have a transparent background are left as they are." />
          {uploadError ? <Alert tone="error">{uploadError}</Alert> : null}
        </div>
      ) : null}

      <div className="border border-border bg-card p-2">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          aria-label={mode === "draw" ? "Signature pad. Draw with a mouse, finger or pen." : "Signature preview"}
          className={`block h-auto w-full touch-none ${mode === "draw" ? "cursor-crosshair" : ""}`}
          style={{ aspectRatio: `${W} / ${H}` }}
          onPointerDown={(e) => {
            if (mode !== "draw") return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            strokes.current.push([point(e)]);
            paint();
          }}
          onPointerMove={(e) => {
            if (!drawing.current || mode !== "draw") return;
            strokes.current[strokes.current.length - 1]?.push(point(e));
            paint();
          }}
          onPointerUp={() => {
            if (!drawing.current) return;
            drawing.current = false;
            setHasInk(true);
            void commit();
          }}
        />
      </div>

      {mode === "draw" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={undo} disabled={!hasInk}>
            <Undo2 /> Undo last stroke
          </Button>
          <Button size="sm" variant="ghost" onClick={clear} disabled={!hasInk}>
            <Eraser /> Clear
          </Button>
          <p className="text-sm text-muted-foreground">Draw above with a mouse, finger or pen.</p>
        </div>
      ) : null}
    </div>
  );
}
