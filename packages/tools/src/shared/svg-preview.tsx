"use client";

import { useEffect, useMemo, useState } from "react";
import { fixSvg } from "@toolwright/core/svg-tools";
import { cn } from "@toolwright/ui";

export type Backdrop = "white" | "dark" | "transparent";

export const BACKDROP_COLOR: Record<Backdrop, string | undefined> = { white: "#ffffff", dark: "#1b1a15", transparent: undefined };

export const BACKDROPS: { value: Backdrop; label: string }[] = [
  { value: "white", label: "White" },
  { value: "dark", label: "Dark" },
  { value: "transparent", label: "Transparent" },
];

/** An object URL for a blob that is revoked when the blob changes or the component goes away. */
export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob || typeof URL.createObjectURL !== "function") return setUrl(null);
    const made = URL.createObjectURL(blob);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [blob]);
  return url;
}

/**
 * Shows an SVG as a picture. It goes through an <img>, which cannot run script, so even an untrusted file is safe to look at.
 * A missing xmlns is added so the browser draws it.
 */
export function SvgPreview({ svg, backdrop = "white", label, className, maxHeight = 320 }: { svg: string; backdrop?: Backdrop; label: string; className?: string; maxHeight?: number }) {
  const prepared = useMemo(() => {
    try {
      return fixSvg(svg).svg;
    } catch {
      return null;
    }
  }, [svg]);
  const blob = useMemo(() => (prepared ? new Blob([prepared], { type: "image/svg+xml" }) : null), [prepared]);
  const url = useObjectUrl(blob);
  return (
    <div className={cn("grid min-h-32 place-items-center overflow-auto border border-border p-3", className)} style={{ backgroundColor: BACKDROP_COLOR[backdrop] ?? "transparent" }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a blob URL made in this tab
        <img src={url} alt={label} className="block max-w-full object-contain" style={{ maxHeight, minWidth: 48 }} />
      ) : (
        <p className="text-sm text-muted-foreground">{svg.trim() ? "This SVG cannot be previewed yet." : "Your picture appears here."}</p>
      )}
    </div>
  );
}

/** Turn an SVG string into a PNG blob at the given scale, in the browser. */
export async function svgToPngBlob(svg: string, width: number, height: number, background?: string): Promise<Blob> {
  const blobUrl = URL.createObjectURL(new Blob([fixSvg(svg).svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.src = blobUrl;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot make PNG pictures.");
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("The PNG could not be made.");
    return png;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
