"use client";

import { useMemo, useState } from "react";
import { Download, Shuffle } from "lucide-react";
import { Alert, Button, CopyButton, downloadBlob, DownloadButton, Field, Input, Panel, SegmentedControl, Textarea, Toggle } from "@toolwright/ui";
import { blobPath, polygonPath, shapeSvg, starPath, wavePaths, type SvgLayer } from "@toolwright/core/svg-shapes";
import { NumberField, num } from "../../shared/number-field";
import { SvgPreview, svgToPngBlob } from "../../shared/svg-preview";
import { errorMessage } from "../../shared/format";

type Kind = "blob" | "wave" | "polygon" | "star";

const KINDS: { value: Kind; label: string }[] = [
  { value: "blob", label: "Blob" },
  { value: "wave", label: "Wave" },
  { value: "polygon", label: "Polygon" },
  { value: "star", label: "Star" },
];

const int = (v: string) => Math.round(num(v));

export default function Tool() {
  const [kind, setKind] = useState<Kind>("blob");
  const [fill, setFill] = useState("#1d6b57");
  const [background, setBackground] = useState("#f4efe3");
  const [useBackground, setUseBackground] = useState(false);
  const [seed, setSeed] = useState("7");
  const [points, setPoints] = useState("8");
  const [randomness, setRandomness] = useState("0.5");
  const [amplitude, setAmplitude] = useState("0.3");
  const [frequency, setFrequency] = useState("2");
  const [layers, setLayers] = useState("3");
  const [flip, setFlip] = useState(false);
  const [sides, setSides] = useState("6");
  const [starPoints, setStarPoints] = useState("5");
  const [inner, setInner] = useState("0.5");
  const [rotation, setRotation] = useState("0");
  const [busy, setBusy] = useState(false);
  const [pngError, setPngError] = useState<string | null>(null);

  const result = useMemo(() => {
    try {
      let width = 400;
      let height = 400;
      let list: SvgLayer[] = [];
      if (kind === "blob") list = [{ d: blobPath({ seed: int(seed), points: int(points), randomness: num(randomness) }), fill }];
      else if (kind === "polygon") list = [{ d: polygonPath({ sides: int(sides), rotation: num(rotation) }), fill }];
      else if (kind === "star") list = [{ d: starPath({ points: int(starPoints), innerRatio: num(inner), rotation: num(rotation) }), fill }];
      else {
        width = 800;
        height = 240;
        const count = Math.min(6, Math.max(1, int(layers)));
        const paths = wavePaths({ width, height, amplitude: num(amplitude), frequency: num(frequency), layers: count, fill: flip ? "top" : "bottom", seed: int(seed) });
        list = paths.map((d, i) => ({ d, fill, opacity: count === 1 ? 1 : 0.35 + (0.65 * (i + 1)) / count }));
      }
      return { svg: shapeSvg(width, height, list, useBackground ? background : undefined), width, height, error: null as string | null };
    } catch (err) {
      return { svg: "", width: 400, height: 400, error: errorMessage(err, "These settings do not make a shape.") };
    }
  }, [kind, fill, background, useBackground, seed, points, randomness, amplitude, frequency, layers, flip, sides, starPoints, inner, rotation]);

  const savePng = async () => {
    setBusy(true);
    setPngError(null);
    try {
      downloadBlob(await svgToPngBlob(result.svg, result.width * 2, result.height * 2), `${kind}.png`, "image/png");
    } catch (err) {
      setPngError(errorMessage(err, "The PNG could not be made."));
    } finally {
      setBusy(false);
    }
  };

  const randomizable = kind === "blob" || kind === "wave";

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl label="Shape" value={kind} onValueChange={setKind} options={KINDS} />

      <div className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        {kind === "blob" ? (
          <>
            <NumberField label="Points" value={points} onChange={setPoints} min={3} max={24} step={1} hint="3 to 24." />
            <NumberField label="Randomness" value={randomness} onChange={setRandomness} min={0} max={1} step={0.05} hint="0 is a circle." />
          </>
        ) : null}
        {kind === "wave" ? (
          <>
            <NumberField label="Height of crests" value={amplitude} onChange={setAmplitude} min={0} max={1} step={0.05} hint="0 to 1." />
            <NumberField label="Waves across" value={frequency} onChange={setFrequency} min={0.25} max={12} step={0.25} />
            <NumberField label="Layers" value={layers} onChange={setLayers} min={1} max={6} step={1} />
            <Toggle label="Fill above the line" checked={flip} onCheckedChange={setFlip} hint="For a wave at the top of a section." />
          </>
        ) : null}
        {kind === "polygon" ? <NumberField label="Sides" value={sides} onChange={setSides} min={3} max={60} step={1} /> : null}
        {kind === "star" ? (
          <>
            <NumberField label="Points" value={starPoints} onChange={setStarPoints} min={3} max={40} step={1} />
            <NumberField label="Inner size" value={inner} onChange={setInner} min={0.05} max={0.95} step={0.05} hint="Smaller is spikier." />
          </>
        ) : null}
        {kind === "polygon" || kind === "star" ? <NumberField label="Rotate" value={rotation} onChange={setRotation} suffix="°" /> : null}
        {randomizable ? (
          <div className="flex items-end gap-2">
            <NumberField label="Seed" value={seed} onChange={setSeed} step={1} hint="The same seed gives the same shape." className="flex-1" />
            <Button variant="ghost" onClick={() => setSeed(String(Math.floor(Math.random() * 100000)))}>
              <Shuffle /> Randomize
            </Button>
          </div>
        ) : null}
        <Field label="Colour">
          {(id) => (
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Colour picker" className="size-9 shrink-0 cursor-pointer border border-border bg-transparent p-0" value={/^#[0-9a-f]{6}$/i.test(fill) ? fill : "#000000"} onChange={(e) => setFill(e.target.value)} />
              <Input id={id} mono value={fill} onChange={(e) => setFill(e.target.value)} />
            </div>
          )}
        </Field>
        <Toggle label="Background" checked={useBackground} onCheckedChange={setUseBackground} />
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
      </div>

      {result.error ? <Alert tone="error">{result.error}</Alert> : null}
      {pngError ? <Alert tone="error">{pngError}</Alert> : null}

      {result.svg ? (
        <>
          <Panel
            title="Preview"
            actions={
              <>
                <CopyButton text={result.svg} label="Copy SVG" />
                <DownloadButton data={result.svg} filename={`${kind}.svg`} mime="image/svg+xml" label="Download SVG" />
                <Button size="sm" variant="ghost" disabled={busy} onClick={savePng}>
                  <Download /> {busy ? "Making PNG…" : "PNG"}
                </Button>
              </>
            }
          >
            <SvgPreview svg={result.svg} label={`A generated ${kind}`} maxHeight={360} className="min-h-72" />
          </Panel>
          <Panel title="SVG code">
            <Textarea aria-label="SVG code" readOnly rows={6} className="font-mono" value={result.svg} spellCheck={false} />
          </Panel>
        </>
      ) : null}
    </div>
  );
}
