"use client";

import { useEffect, useState } from "react";
import { Alert, CopyButton, Field, FileDropzone, FileListItem, Input, Panel, SegmentedControl, Textarea, Toggle } from "@toolwright/ui";
import { ICO_SIZES, PNG_ICONS, buildIco, headSnippet, webManifest, type IconFit } from "@toolwright/core/favicon-generator";
import { loadImage, renderSquareIcon } from "../../shared/image";
import { NumberField, num } from "../../shared/number-field";
import { createZip } from "../../shared/zip";
import { DownloadResult, JobError, RunButton, useJob } from "../../shared/pdf-ui";

interface Pack {
  zip: Uint8Array;
  files: number;
  snippet: string;
  previews: { file: string; size: number; png: Uint8Array }[];
}

const isSvg = (file: File) => file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
const encoder = new TextEncoder();

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fit, setFit] = useState<IconFit>("contain");
  const [padding, setPadding] = useState("0");
  const [appleBackground, setAppleBackground] = useState("#ffffff");
  const [useTheme, setUseTheme] = useState(false);
  const [themeColor, setThemeColor] = useState("#0b6b55");
  const [name, setName] = useState("");
  const [basePath, setBasePath] = useState("/");
  const job = useJob<Pack>();

  const choose = async (picked: File) => {
    job.reset();
    setError(null);
    try {
      const image = await loadImage(picked);
      setDims({ width: image.width, height: image.height });
      image.dispose();
      setFile(picked);
    } catch (err) {
      setFile(null);
      setDims(null);
      setError(err instanceof Error ? err.message : "This image could not be read.");
    }
  };

  const build = async (): Promise<Pack> => {
    if (!file) throw new Error("Choose an image first.");
    const image = await loadImage(file);
    try {
      const pad = Math.max(0, num(padding) || 0);
      const render = (size: number, opaque: boolean) => renderSquareIcon(image, size, { fit, padding: pad, background: opaque ? appleBackground : null });

      const previews: Pack["previews"] = [];
      for (const icon of PNG_ICONS) previews.push({ file: icon.file, size: icon.size, png: await render(icon.size, Boolean(icon.opaque)) });

      const icoImages: { size: number; png: Uint8Array }[] = [];
      for (const size of ICO_SIZES) {
        const reuse = previews.find((p) => p.size === size && !PNG_ICONS.find((i) => i.file === p.file)?.opaque);
        icoImages.push({ size, png: reuse?.png ?? (await render(size, false)) });
      }

      const svg = isSvg(file);
      const options = { basePath, themeColor: useTheme ? themeColor : undefined, svg };
      const snippet = headSnippet(options);
      const entries = [
        { name: "favicon.ico", data: buildIco(icoImages) },
        ...previews.map((p) => ({ name: p.file, data: p.png })),
        { name: "site.webmanifest", data: encoder.encode(webManifest({ ...options, name, backgroundColor: appleBackground })) },
        { name: "head-snippet.html", data: encoder.encode(`${snippet}\n`) },
      ];
      if (svg) entries.push({ name: "favicon.svg", data: new Uint8Array(await file.arrayBuffer()) });
      return { zip: createZip(entries), files: entries.length, snippet, previews };
    } finally {
      image.dispose();
    }
  };

  const small = dims && Math.min(dims.width, dims.height) < 512;

  return (
    <div className="flex flex-col gap-5">
      {file ? (
        <ul>
          <FileListItem
            name={file.name}
            size={file.size}
            detail={dims ? `${dims.width} × ${dims.height} px` : undefined}
            onRemove={() => (setFile(null), setDims(null), job.reset())}
          />
        </ul>
      ) : (
        <FileDropzone
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg"
          label="Drop your logo here, or click to browse"
          hint="PNG, JPG, WebP, GIF or SVG. A square image of 512 px or more works best. Your image never leaves your device."
          onReject={setError}
          onFiles={([f]) => f && choose(f)}
        />
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {small ? <Alert tone="info">This image is {dims.width} × {dims.height} px. The larger icons will be enlarged and may look soft.</Alert> : null}

      {file ? (
        <>
          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">If the image is not square</span>
              <SegmentedControl
                label="If the image is not square"
                value={fit}
                onValueChange={(v) => (setFit(v), job.reset())}
                options={[
                  { value: "contain", label: "Fit inside" },
                  { value: "cover", label: "Fill and crop" },
                ]}
              />
            </div>
            <NumberField label="Padding" value={padding} onChange={(v) => (setPadding(v), job.reset())} min={0} max={40} suffix="%" hint="Empty space kept around the image." />
            <Field label="Background for the iOS icon" hint="iOS shows transparent areas as black, so this icon gets a solid background.">
              {(id) => <input id={id} type="color" value={appleBackground} onChange={(e) => (setAppleBackground(e.target.value), job.reset())} className="h-10 w-full cursor-pointer rounded-lg border border-border bg-card p-1" />}
            </Field>
            <div className="flex flex-col gap-2">
              <Toggle label="Add a theme colour" checked={useTheme} onCheckedChange={(v) => (setUseTheme(v), job.reset())} hint="Tints the browser toolbar on some phones." />
              {useTheme ? <input aria-label="Theme colour" type="color" value={themeColor} onChange={(e) => (setThemeColor(e.target.value), job.reset())} className="h-10 w-full cursor-pointer rounded-lg border border-border bg-card p-1" /> : null}
            </div>
            <Field label="Site name (optional)" hint="Used in the web app manifest.">
              {(id) => <Input id={id} value={name} maxLength={60} onChange={(e) => (setName(e.target.value), job.reset())} />}
            </Field>
            <Field label="Folder on your site" hint="Where you will upload the files. Use / for the top level.">
              {(id) => <Input id={id} mono value={basePath} onChange={(e) => (setBasePath(e.target.value), job.reset())} />}
            </Field>
          </div>

          <RunButton busy={job.busy} onClick={() => job.run(build)}>
            Create favicon pack
          </RunButton>
        </>
      ) : null}

      <JobError error={job.error} />

      {job.result ? (
        <>
          <DownloadResult data={job.result.zip} filename="favicons.zip" mime="application/zip" note={`${job.result.files} files`} />
          <ul aria-label="Preview of the generated icons" className="flex flex-wrap items-end gap-5 border border-border bg-card p-4">
            {job.result.previews.map((p) => (
              <li key={p.file} className="flex flex-col items-center gap-1.5">
                <PreviewImage png={p.png} size={p.size} />
                <span className="font-mono text-xs text-muted-foreground">{p.size} px</span>
              </li>
            ))}
          </ul>
          <Panel title="Add this to your page’s <head>" actions={<CopyButton text={job.result.snippet} label="Copy" />}>
            <Textarea aria-label="HTML to paste into the head of your pages" readOnly rows={Math.min(10, job.result.snippet.split("\n").length + 1)} value={job.result.snippet} className="bg-muted/40" />
          </Panel>
          <p className="text-sm text-muted-foreground">Upload the files from the ZIP to the folder you chose, then paste the tags above. The ZIP also contains this snippet as head-snippet.html.</p>
        </>
      ) : null}
    </div>
  );
}

/** Shows a generated PNG, releasing its object URL when it is replaced or removed. */
function PreviewImage({ png, size }: { png: Uint8Array; size: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(new Blob([png as BlobPart], { type: "image/png" }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [png]);
  const shown = Math.min(size, 96);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={`${size} pixel icon`} width={shown} height={shown} className="border border-border bg-muted" style={{ imageRendering: size < 48 ? "pixelated" : "auto" }} /> : <span style={{ width: shown, height: shown }} />;
}
