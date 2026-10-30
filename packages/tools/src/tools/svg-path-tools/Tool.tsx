"use client";

import { useMemo, useState } from "react";
import { Alert, CopyButton, Field, Panel, Select, Stat, StatGrid, Textarea, Toggle } from "@toolwright/ui";
import {
  multiply,
  parsePath,
  pathInfo,
  reversePath,
  rotateMatrix,
  scaleMatrix,
  serializePath,
  toAbsolute,
  toCurves,
  toRelative,
  transformPath,
  translateMatrix,
  type PathSegment,
} from "@toolwright/core/svg-path";
import { NumberField, num } from "../../shared/number-field";
import { SvgPreview } from "../../shared/svg-preview";
import { errorMessage } from "../../shared/format";

type Operation = "none" | "absolute" | "relative" | "curves" | "reverse" | "transform";

const OPERATIONS: { value: Operation; label: string }[] = [
  { value: "none", label: "Just tidy and show details" },
  { value: "absolute", label: "Make all commands absolute (capital letters)" },
  { value: "relative", label: "Make all commands relative (small letters)" },
  { value: "curves", label: "Simplify to M, L, C and Z only (arcs and shorthands become curves)" },
  { value: "reverse", label: "Reverse the direction" },
  { value: "transform", label: "Move, scale or rotate" },
];

const SAMPLE = "M10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80 L 180 120 A 20 20 0 0 1 140 120 Z";

/** Accept a bare path, or markup that has d="…" in it. */
function extractPath(input: string): string {
  const match = /\bd\s*=\s*("([^"]*)"|'([^']*)')/.exec(input);
  return (match ? (match[2] ?? match[3] ?? "") : input).trim();
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

export default function Tool() {
  const [text, setText] = useState("");
  const [operation, setOperation] = useState<Operation>("none");
  const [precision, setPrecision] = useState("3");
  const [minify, setMinify] = useState(false);
  const [dx, setDx] = useState("0");
  const [dy, setDy] = useState("0");
  const [scale, setScale] = useState("1");
  const [angle, setAngle] = useState("0");
  const [stroke, setStroke] = useState(true);

  const result = useMemo(() => {
    const d = extractPath(text);
    if (!d) return null;
    try {
      let segs: PathSegment[] = parsePath(d);
      switch (operation) {
        case "absolute":
          segs = toAbsolute(segs);
          break;
        case "relative":
          segs = toRelative(segs);
          break;
        case "curves":
          segs = toCurves(segs);
          break;
        case "reverse":
          segs = reversePath(segs);
          break;
        case "transform": {
          const before = pathInfo(segs).bounds;
          const cx = before ? before.x + before.width / 2 : 0;
          const cy = before ? before.y + before.height / 2 : 0;
          // Rotate and scale around the centre of the drawing, then move.
          let m = translateMatrix(-cx, -cy);
          m = multiply(m, scaleMatrix(num(scale) || 1));
          m = multiply(m, rotateMatrix(num(angle)));
          m = multiply(m, translateMatrix(cx + num(dx), cy + num(dy)));
          segs = transformPath(segs, m);
          break;
        }
      }
      const output = serializePath(segs, { precision: Math.min(8, Math.max(0, Math.round(num(precision)))), minify });
      const info = pathInfo(segs);
      return { output, info, error: null as string | null };
    } catch (err) {
      return { output: "", info: null, error: errorMessage(err, "This path could not be read.") };
    }
  }, [text, operation, precision, minify, dx, dy, scale, angle]);

  const preview = useMemo(() => {
    const b = result?.info?.bounds;
    if (!result?.output || !b) return "";
    const pad = Math.max(b.width, b.height) * 0.08 + 1;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(b.x - pad)} ${fmt(b.y - pad)} ${fmt(b.width + pad * 2)} ${fmt(b.height + pad * 2)}"><path d="${result.output}" fill="${stroke ? "none" : "#1d6b57"}" stroke="#1d6b57" stroke-width="${fmt(Math.max(b.width, b.height) / 60)}" stroke-linejoin="round"/></svg>`;
  }, [result, stroke]);

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Path data"
        actions={
          <button type="button" className="text-sm font-semibold underline underline-offset-4" onClick={() => setText(SAMPLE)}>
            Sample
          </button>
        }
      >
        <Textarea aria-label="Path data" rows={5} className="font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder='M10 10 L 90 10 L 50 80 Z   (or paste a whole <path d="…"> tag)' spellCheck={false} />
      </Panel>

      <div className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="What to do" className="sm:col-span-2">
          {(id) => (
            <Select id={id} value={operation} onChange={(e) => setOperation(e.target.value as Operation)}>
              {OPERATIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <NumberField label="Decimal places" value={precision} onChange={setPrecision} min={0} max={8} step={1} />
        <Toggle label="Shortest possible text" checked={minify} onCheckedChange={setMinify} hint="Drops spaces that are not needed." />
        {operation === "transform" ? (
          <>
            <NumberField label="Move right" value={dx} onChange={setDx} />
            <NumberField label="Move down" value={dy} onChange={setDy} />
            <NumberField label="Scale" value={scale} onChange={setScale} hint="2 doubles the size." />
            <NumberField label="Rotate" value={angle} onChange={setAngle} suffix="°" hint="Around the centre." />
          </>
        ) : null}
      </div>

      {result?.error ? <Alert tone="error">{result.error}</Alert> : null}

      {result && !result.error ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Result" actions={<CopyButton text={result.output} label="Copy" />}>
              <Textarea aria-label="Result path data" readOnly rows={8} className="font-mono" value={result.output} spellCheck={false} />
            </Panel>
            <Panel title="Preview" actions={<Toggle label="Outline only" checked={stroke} onCheckedChange={setStroke} />}>
              <SvgPreview svg={preview} label="The path" />
            </Panel>
          </div>
          {result.info ? (
            <StatGrid>
              <Stat label="Commands" value={String(result.info.commands)} />
              <Stat label="Subpaths" value={String(result.info.subpaths)} />
              <Stat label="Length" value={fmt(result.info.length)} />
              <Stat label="Bounding box" value={result.info.bounds ? `${fmt(result.info.bounds.width)} × ${fmt(result.info.bounds.height)}` : "none"} />
            </StatGrid>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
