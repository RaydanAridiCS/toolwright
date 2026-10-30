"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Alert, Button, Field, Input, Panel, ResultSlab, Select, Stat, StatGrid, Toggle, downloadBlob } from "@toolwright/ui";
import {
  BARCODE_TYPES,
  DEFAULT_SVG_STYLE,
  SVG_LIMITS,
  barcodeToSvg,
  contrastWarning,
  encodeBarcode,
  moduleCount,
  type BarcodeType,
} from "@toolwright/core/barcode-generator";
import { NumberField, num } from "../../shared/number-field";
import { SvgPreview, svgToPngBlob } from "../../shared/svg-preview";
import { errorMessage } from "../../shared/format";

const exampleOf = (type: BarcodeType) => BARCODE_TYPES.find((t) => t.id === type)?.example ?? "";

/** A file name made of the data, safe on every system. */
function fileStem(type: BarcodeType, data: string): string {
  const clean = data.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `barcode-${type}${clean ? `-${clean}` : ""}`;
}

export default function Tool() {
  const [type, setType] = useState<BarcodeType>("code128");
  const [text, setText] = useState(exampleOf("code128"));
  const [showText, setShowText] = useState(true);
  const [code39Check, setCode39Check] = useState(false);
  const [moduleWidth, setModuleWidth] = useState(String(DEFAULT_SVG_STYLE.moduleWidth));
  const [barHeight, setBarHeight] = useState(String(DEFAULT_SVG_STYLE.barHeight));
  const [margin, setMargin] = useState(String(DEFAULT_SVG_STYLE.quietZone));
  const [foreground, setForeground] = useState(DEFAULT_SVG_STYLE.foreground);
  const [background, setBackground] = useState(DEFAULT_SVG_STYLE.background);
  const [pngScale, setPngScale] = useState("2");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const spec = BARCODE_TYPES.find((t) => t.id === type)!;

  const result = useMemo(() => {
    try {
      const barcode = encodeBarcode(type, text, { code39Check });
      const style = {
        moduleWidth: num(moduleWidth),
        barHeight: num(barHeight),
        quietZone: num(margin),
        showText,
        foreground,
        background,
      };
      return { ok: true as const, barcode, drawn: barcodeToSvg(barcode, style) };
    } catch (err) {
      return { ok: false as const, error: errorMessage(err) };
    }
  }, [type, text, code39Check, moduleWidth, barHeight, margin, showText, foreground, background]);

  function chooseType(next: BarcodeType) {
    // Keep what the person typed, but swap the example text for the new type's example.
    if (text.trim() === "" || text === exampleOf(type)) setText(exampleOf(next));
    setType(next);
    setDownloadError(null);
  }

  async function downloadPng() {
    if (!result.ok) return;
    setDownloadError(null);
    try {
      const scale = Math.min(8, Math.max(1, Number(pngScale) || 2));
      const blob = await svgToPngBlob(result.drawn.svg, result.drawn.width * scale, result.drawn.height * scale, background);
      downloadBlob(blob, `${fileStem(type, result.barcode.data)}.png`, "image/png");
    } catch (err) {
      setDownloadError(errorMessage(err, "The PNG could not be made."));
    }
  }

  const warning = contrastWarning(foreground, background);

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Barcode">
        <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
          <Field label="Type">
            {(id) => (
              <Select id={id} value={type} onChange={(e) => chooseType(e.target.value as BarcodeType)}>
                {BARCODE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Text or number" hint={spec.description}>
            {(id) => <Input id={id} mono value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoComplete="off" />}
          </Field>
        </div>
        {type === "code39" ? <Toggle label="Add a check character (modulo 43)" checked={code39Check} onCheckedChange={setCode39Check} hint="Optional. Only turn it on if the scanner or system expects it." /> : null}
      </Panel>

      {!result.ok && text.trim() ? <Alert tone="error">{result.error}</Alert> : null}

      {result.ok ? (
        <>
          <ResultSlab label="Encoded" value={result.barcode.data} valueTestId="barcode-data" size="md" note={`${spec.label} · ${moduleCount(result.barcode)} modules wide`} />
          {result.barcode.notes.map((note) => (
            <Alert key={note} tone="info">
              {note}
            </Alert>
          ))}
          <SvgPreview svg={result.drawn.svg} label={`Barcode for ${result.barcode.data}`} backdrop="white" maxHeight={260} />
          <StatGrid>
            <Stat label="Picture width" value={`${Math.round(result.drawn.width)} px`} />
            <Stat label="Picture height" value={`${Math.round(result.drawn.height)} px`} />
          </StatGrid>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="md" onClick={() => downloadBlob(result.drawn.svg, `${fileStem(type, result.barcode.data)}.svg`, "image/svg+xml")}>
              <Download aria-hidden />
              Download SVG
            </Button>
            <Button variant="outline" size="md" onClick={() => void downloadPng()}>
              <Download aria-hidden />
              Download PNG
            </Button>
          </div>
          {downloadError ? <Alert tone="error">{downloadError}</Alert> : null}
        </>
      ) : null}

      <Panel title="Size and colour">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField label="Narrowest bar" suffix="px" value={moduleWidth} onChange={setModuleWidth} min={SVG_LIMITS.moduleWidth.min} max={SVG_LIMITS.moduleWidth.max} step={0.5} />
          <NumberField label="Bar height" suffix="px" value={barHeight} onChange={setBarHeight} min={SVG_LIMITS.barHeight.min} max={SVG_LIMITS.barHeight.max} step={5} />
          <NumberField label="Side margin" suffix="bars" value={margin} onChange={setMargin} min={SVG_LIMITS.quietZone.min} max={SVG_LIMITS.quietZone.max} step={1} hint="Blank space each side. A minimum for the type is always kept." />
          <Field label="PNG size">
            {(id) => (
              <Select id={id} value={pngScale} onChange={(e) => setPngScale(e.target.value)}>
                <option value="1">1× (as drawn)</option>
                <option value="2">2×</option>
                <option value="4">4×</option>
              </Select>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <Toggle label="Print the number under the bars" checked={showText} onCheckedChange={setShowText} />
          <Field label="Bar colour">{(id) => <Input id={id} type="color" value={foreground} onChange={(e) => setForeground(e.target.value)} className="h-9 w-20 p-1" />}</Field>
          <Field label="Background colour">{(id) => <Input id={id} type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="h-9 w-20 p-1" />}</Field>
        </div>
        {warning ? <Alert tone="warning">{warning}</Alert> : null}
        <p className="text-xs text-muted-foreground">Print a sample and try it with your real scanner before you print a large run.</p>
      </Panel>
    </div>
  );
}
