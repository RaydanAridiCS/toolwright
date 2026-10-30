/** Pure helpers for the Favicon Generator: icon sizes, the .ico container, layout maths, and the HTML/manifest text. */

export interface PngIcon {
  file: string;
  size: number;
  /** Fill transparent pixels with the background colour (iOS shows transparency as black). */
  opaque?: boolean;
}

/** The PNG files in the pack. */
export const PNG_ICONS: PngIcon[] = [
  { file: "favicon-16x16.png", size: 16 },
  { file: "favicon-32x32.png", size: 32 },
  { file: "apple-touch-icon.png", size: 180, opaque: true },
  { file: "android-chrome-192x192.png", size: 192 },
  { file: "android-chrome-512x512.png", size: 512 },
];

/** Sizes packed into favicon.ico. */
export const ICO_SIZES = [16, 32, 48];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export const isPngBytes = (bytes: Uint8Array) => bytes.length > 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b);

/**
 * Pack PNG images into a single .ico file. Every browser from the last decade reads PNG data inside ICO.
 * Each image is at most 256 pixels square.
 */
export function buildIco(images: { size: number; png: Uint8Array }[]): Uint8Array {
  if (images.length === 0) throw new Error("An .ico file needs at least one image.");
  if (images.length > 0xffff) throw new Error("Too many images for one .ico file.");
  for (const { size, png } of images) {
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error(`Icon size ${size} is not allowed in an .ico file. Use 1 to 256 pixels.`);
    if (!isPngBytes(png)) throw new Error("Every image in an .ico file must be PNG data.");
  }
  const headerSize = 6 + 16 * images.length;
  const total = headerSize + images.reduce((sum, i) => sum + i.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, images.length, true);
  let offset = headerSize;
  images.forEach(({ size, png }, i) => {
    const at = 6 + 16 * i;
    out[at] = size === 256 ? 0 : size; // width (0 means 256)
    out[at + 1] = size === 256 ? 0 : size; // height
    out[at + 2] = 0; // palette colours
    out[at + 3] = 0; // reserved
    view.setUint16(at + 4, 1, true); // colour planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, png.length, true);
    view.setUint32(at + 12, offset, true);
    out.set(png, offset);
    offset += png.length;
  });
  return out;
}

export type IconFit = "contain" | "cover";

export interface SquareLayout {
  /** Where to draw the source on the square canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Area to clip to (the padded square), so "cover" crops instead of spilling into the padding. */
  clip: { x: number; y: number; size: number };
}

/**
 * Work out how to place a source image on a square icon.
 * `contain` shows the whole image; `cover` fills the square and crops the overflow.
 * `paddingPercent` keeps that much empty space on every side.
 */
export function squareLayout(sourceWidth: number, sourceHeight: number, size: number, fit: IconFit, paddingPercent: number): SquareLayout {
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) throw new Error("This image has no size, so it cannot be scaled. Try a PNG or JPG version.");
  const pad = Math.min(Math.max(Number.isFinite(paddingPercent) ? paddingPercent : 0, 0), 40);
  const inner = size * (1 - (2 * pad) / 100);
  const margin = (size - inner) / 2;
  const scale = fit === "cover" ? Math.max(inner / sourceWidth, inner / sourceHeight) : Math.min(inner / sourceWidth, inner / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (size - width) / 2, y: (size - height) / 2, width, height, clip: { x: margin, y: margin, size: inner } };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function checkColor(value: string | undefined, label: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!HEX.test(value)) throw new Error(`${label} should be a six-digit colour like #0b6b55.`);
  return value.toLowerCase();
}

/** Make a folder path such as `/assets/icons/`: leading and trailing slash, nothing else surprising. */
export function normalizeBasePath(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed === "/") return "/";
  if (/[\s"'<>\\?#]/.test(trimmed)) throw new Error("The folder cannot contain spaces, quotes, < > \\ ? or #. Use a path like /assets/icons/.");
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface PackOptions {
  /** Folder on the site where the files will live. Default `/`. */
  basePath?: string;
  /** Adds the colour to the <meta name="theme-color"> tag and the manifest. */
  themeColor?: string;
  /** Include a `favicon.svg` link (only when the original was an SVG). */
  svg?: boolean;
}

/** The `<head>` tags that wire the pack up. */
export function headSnippet(options: PackOptions = {}): string {
  const base = escapeAttr(normalizeBasePath(options.basePath));
  const theme = checkColor(options.themeColor, "The theme colour");
  const lines = [`<link rel="icon" href="${base}favicon.ico" sizes="any">`];
  if (options.svg) lines.push(`<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">`);
  lines.push(
    `<link rel="icon" type="image/png" sizes="32x32" href="${base}favicon-32x32.png">`,
    `<link rel="icon" type="image/png" sizes="16x16" href="${base}favicon-16x16.png">`,
    `<link rel="apple-touch-icon" href="${base}apple-touch-icon.png">`,
    `<link rel="manifest" href="${base}site.webmanifest">`,
  );
  if (theme) lines.push(`<meta name="theme-color" content="${theme}">`);
  return lines.join("\n");
}

export interface ManifestOptions extends PackOptions {
  /** Shown when the site is installed. Left out of the manifest when blank. */
  name?: string;
  backgroundColor?: string;
}

/** A web app manifest that points at the Android/Chrome icons. */
export function webManifest(options: ManifestOptions = {}): string {
  const base = normalizeBasePath(options.basePath);
  const name = options.name?.trim();
  const theme = checkColor(options.themeColor, "The theme colour");
  const background = checkColor(options.backgroundColor, "The background colour");
  const manifest: Record<string, unknown> = {};
  if (name) {
    manifest.name = name;
    manifest.short_name = name.length > 12 ? name.slice(0, 12).trimEnd() : name;
  }
  manifest.icons = PNG_ICONS.filter((i) => i.file.startsWith("android-chrome")).map((i) => ({ src: `${base}${i.file}`, sizes: `${i.size}x${i.size}`, type: "image/png" }));
  if (theme) manifest.theme_color = theme;
  if (background) manifest.background_color = background;
  manifest.display = "standalone";
  return JSON.stringify(manifest, null, 2);
}
