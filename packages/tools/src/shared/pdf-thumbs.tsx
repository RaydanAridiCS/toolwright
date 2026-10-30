"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { createThumbnailer, type PageThumbnailer } from "./pdf-raster";

/** Draws each page once, on demand, and keeps the picture as an object URL until the store is closed. */
class ThumbStore {
  private readonly urls = new Map<number, Promise<string>>();

  constructor(private readonly thumbnailer: PageThumbnailer) {}

  get(pageIndex: number): Promise<string> {
    let url = this.urls.get(pageIndex);
    if (!url) {
      url = this.thumbnailer.render(pageIndex).then((blob) => URL.createObjectURL(blob));
      this.urls.set(pageIndex, url);
    }
    return url;
  }

  dispose() {
    this.thumbnailer.dispose();
    for (const url of this.urls.values()) url.then((u) => URL.revokeObjectURL(u), () => undefined);
    this.urls.clear();
  }
}

/**
 * Page previews for one PDF. PDF.js is loaded when this mounts (that is, once a file has been dropped), the pictures
 * are drawn only for rows that scroll into view, and everything is released on unmount.
 */
export function useThumbnails(file: File) {
  const [store, setStore] = useState<ThumbStore | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let made: ThumbStore | null = null;
    createThumbnailer(file).then(
      (thumbnailer) => {
        made = new ThumbStore(thumbnailer);
        if (cancelled) made.dispose();
        else setStore(made);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
      made?.dispose();
      setStore(null);
    };
  }, [file]);

  return { store, failed };
}

export type { ThumbStore };

/** A 64px square holding a page picture, or the page icon until (or unless) the picture is ready. Decorative: the row names the page. */
export function PageThumb({ store, pageIndex, turn }: { store: ThumbStore | null; pageIndex: number; turn: number }) {
  const box = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    let live = true;
    const load = () => {
      store.get(pageIndex).then(
        (u) => live && setUrl(u),
        () => undefined,
      );
    };
    const element = box.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        live = false;
      };
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [store, pageIndex]);

  return (
    <span ref={box} aria-hidden className="grid size-16 shrink-0 place-items-center overflow-hidden border border-border bg-muted">
      {url && store ? (
        // eslint-disable-next-line @next/next/no-img-element -- a blob URL made in this tab; next/image cannot optimise it
        <img src={url} alt="" className="max-h-full max-w-full object-contain transition-transform" style={{ transform: `rotate(${turn}deg)` }} />
      ) : (
        <FileText className="size-5 text-muted-foreground transition-transform" style={{ transform: `rotate(${turn}deg)` }} />
      )}
    </span>
  );
}
