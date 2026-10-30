import { describe, expect, it } from "vitest";
import { ICO_SIZES, PNG_ICONS, buildIco, headSnippet, isPngBytes, normalizeBasePath, squareLayout, webManifest } from "../src/favicon-generator";

/** Smallest thing that passes the PNG signature check. The ICO writer never decodes the pixels. */
const fakePng = (extra = 4) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: extra }, (_, i) => i + 1)]);

describe("icon sizes", () => {
  it("covers the standard files", () => {
    expect(PNG_ICONS.map((i) => `${i.file}:${i.size}`)).toEqual([
      "favicon-16x16.png:16",
      "favicon-32x32.png:32",
      "apple-touch-icon.png:180",
      "android-chrome-192x192.png:192",
      "android-chrome-512x512.png:512",
    ]);
    expect(PNG_ICONS.find((i) => i.file === "apple-touch-icon.png")?.opaque).toBe(true);
    expect(ICO_SIZES).toEqual([16, 32, 48]);
  });
});

describe("buildIco", () => {
  it("writes a valid ICONDIR with correct offsets and sizes", () => {
    const a = fakePng(4);
    const b = fakePng(10);
    const ico = buildIco([
      { size: 16, png: a },
      { size: 48, png: b },
    ]);
    const view = new DataView(ico.buffer);
    expect([view.getUint16(0, true), view.getUint16(2, true), view.getUint16(4, true)]).toEqual([0, 1, 2]);

    const first = 6;
    expect([ico[first], ico[first + 1]]).toEqual([16, 16]);
    expect(view.getUint16(first + 4, true)).toBe(1);
    expect(view.getUint16(first + 6, true)).toBe(32);
    expect(view.getUint32(first + 8, true)).toBe(a.length);
    expect(view.getUint32(first + 12, true)).toBe(6 + 32);

    const second = 6 + 16;
    expect([ico[second], ico[second + 1]]).toEqual([48, 48]);
    expect(view.getUint32(second + 8, true)).toBe(b.length);
    expect(view.getUint32(second + 12, true)).toBe(6 + 32 + a.length);

    expect(Array.from(ico.slice(6 + 32, 6 + 32 + a.length))).toEqual(Array.from(a));
    expect(Array.from(ico.slice(6 + 32 + a.length))).toEqual(Array.from(b));
    expect(ico.length).toBe(6 + 32 + a.length + b.length);
  });

  it("stores 256 as zero, as the format requires", () => {
    const ico = buildIco([{ size: 256, png: fakePng() }]);
    expect([ico[6], ico[7]]).toEqual([0, 0]);
  });

  it("rejects sizes the format cannot hold, non-PNG data and empty input", () => {
    expect(() => buildIco([{ size: 512, png: fakePng() }])).toThrow(/512 is not allowed/);
    expect(() => buildIco([{ size: 0, png: fakePng() }])).toThrow(/not allowed/);
    expect(() => buildIco([{ size: 16.5, png: fakePng() }])).toThrow(/not allowed/);
    expect(() => buildIco([{ size: 16, png: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]) }])).toThrow(/PNG data/);
    expect(() => buildIco([])).toThrow(/at least one image/);
  });

  it("recognises PNG data", () => {
    expect(isPngBytes(fakePng())).toBe(true);
    expect(isPngBytes(new Uint8Array(0))).toBe(false);
    expect(isPngBytes(new Uint8Array([0x89, 0x50]))).toBe(false);
  });
});

describe("squareLayout", () => {
  it("fits a wide image inside the square, centred", () => {
    const l = squareLayout(200, 100, 64, "contain", 0);
    expect(l).toMatchObject({ x: 0, y: 16, width: 64, height: 32 });
  });

  it("fills the square and crops a wide image with cover", () => {
    const l = squareLayout(200, 100, 64, "cover", 0);
    expect(l).toMatchObject({ x: -32, y: 0, width: 128, height: 64 });
    expect(l.clip).toEqual({ x: 0, y: 0, size: 64 });
  });

  it("keeps padding on every side", () => {
    const l = squareLayout(100, 100, 100, "contain", 10);
    expect(l).toMatchObject({ x: 10, y: 10, width: 80, height: 80 });
    expect(l.clip).toEqual({ x: 10, y: 10, size: 80 });
  });

  it("upscales small images and clamps silly padding", () => {
    expect(squareLayout(16, 16, 512, "contain", 0).width).toBe(512);
    expect(squareLayout(100, 100, 100, "contain", 90).width).toBeCloseTo(20); // clamped to 40% per side
    expect(squareLayout(100, 100, 100, "contain", -5).width).toBe(100);
    expect(squareLayout(100, 100, 100, "contain", NaN).width).toBe(100);
  });

  it("explains an image with no size", () => {
    expect(() => squareLayout(0, 100, 64, "contain", 0)).toThrow(/no size/);
    expect(() => squareLayout(100, NaN, 64, "contain", 0)).toThrow(/no size/);
  });
});

describe("normalizeBasePath", () => {
  it("gives a folder path with slashes at both ends", () => {
    expect(normalizeBasePath(undefined)).toBe("/");
    expect(normalizeBasePath("")).toBe("/");
    expect(normalizeBasePath("/")).toBe("/");
    expect(normalizeBasePath("assets/icons")).toBe("/assets/icons/");
    expect(normalizeBasePath(" //assets//")).toBe("/assets/");
  });

  it("refuses characters that would break the HTML", () => {
    expect(() => normalizeBasePath('/a"b')).toThrow(/cannot contain/);
    expect(() => normalizeBasePath("/a b")).toThrow(/cannot contain/);
    expect(() => normalizeBasePath("/a<b")).toThrow(/cannot contain/);
  });
});

describe("headSnippet", () => {
  it("links every file in the pack", () => {
    expect(headSnippet()).toBe(
      [
        '<link rel="icon" href="/favicon.ico" sizes="any">',
        '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
        '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<link rel="manifest" href="/site.webmanifest">',
      ].join("\n"),
    );
  });

  it("adds the SVG link, theme colour and folder when asked", () => {
    const s = headSnippet({ svg: true, themeColor: "#0B6B55", basePath: "img" });
    expect(s).toContain('<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">');
    expect(s).toContain('<meta name="theme-color" content="#0b6b55">');
    expect(s).toContain('href="/img/favicon.ico"');
  });

  it("rejects a bad colour", () => {
    expect(() => headSnippet({ themeColor: "green" })).toThrow(/six-digit colour/);
    expect(() => headSnippet({ themeColor: "#fff" })).toThrow(/six-digit colour/);
  });
});

describe("webManifest", () => {
  it("lists the Android icons", () => {
    const m = JSON.parse(webManifest());
    expect(m.icons).toEqual([
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ]);
    expect(m.name).toBeUndefined();
    expect(m.display).toBe("standalone");
  });

  it("includes names and colours only when given", () => {
    const m = JSON.parse(webManifest({ name: "  Toolwright Workshop Ledger ", themeColor: "#0b6b55", backgroundColor: "#ffffff", basePath: "/icons" }));
    expect(m.name).toBe("Toolwright Workshop Ledger");
    expect(m.short_name).toBe("Toolwright W");
    expect(m.theme_color).toBe("#0b6b55");
    expect(m.background_color).toBe("#ffffff");
    expect(m.icons[0].src).toBe("/icons/android-chrome-192x192.png");
  });

  it("escapes awkward names safely", () => {
    const m = JSON.parse(webManifest({ name: 'My "App" 😀\n' }));
    expect(m.name).toBe('My "App" 😀');
  });
});
