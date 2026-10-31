import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { OG_SIZE } from "./seo";

// Satori can read WOFF (not WOFF2). Loaded at build time; the routes that use this are statically generated.
const fontFile = (weight: 700 | 800) =>
  readFileSync(path.join(process.cwd(), "../../node_modules/@fontsource/bricolage-grotesque/files", `bricolage-grotesque-latin-${weight}-normal.woff`));

const PAPER = "#f4f0e6";
const INK = "#1b1a15";
const MUTED = "#5b574a";
const GREEN = "#0b6b55";
const MARKER = "#d8ec4e";

interface OgCardProps {
  /** Large headline: the tool or page name. */
  name: string;
  /** One readable line under it. */
  tagline: string;
  /** Small caption at the top right, for example "TOOL 027 · PDF". */
  caption: string;
}

/** Headline size by length, so a long guide title still sits on two lines instead of pushing the card's text off it. */
function nameSize(name: string): number {
  if (name.length <= 26) return 100;
  if (name.length <= 44) return 84;
  if (name.length <= 56) return 68;
  return 56;
}

/**
 * One or two readable lines for the tagline. Over the limit it stops at the last whole sentence that fits, and only
 * when there is none does it cut at a word with an ellipsis, so it never runs off the card.
 */
export function shortLine(text: string, max = 118): string {
  const clean = text.split(/[ \t\r\n]+/).join(" ").trim();
  if (clean.length <= max) return clean;
  const window = clean.slice(0, max);
  const sentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
  if (sentenceEnd >= 40) return window.slice(0, sentenceEnd + 1);
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1))}…`;
}

/** The 1200x630 social card: a printed plate with a marker bar under the name. */
export function renderOgCard({ name, tagline, caption }: OgCardProps) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, padding: 36, fontFamily: "Bricolage" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", border: `3px solid ${INK}`, padding: "44px 56px", background: "#fbf9f3" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <svg width="48" height="48" viewBox="0 0 32 32">
                <path fill={INK} fillRule="evenodd" d="M2 2h28v25H2zM11 2h10v11H11zM16 17a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z" />
                <rect x="2" y="28.5" width="28" height="3" fill={MARKER} />
              </svg>
              <div style={{ fontSize: 34, fontWeight: 800, color: INK, letterSpacing: -1 }}>Toolwright</div>
            </div>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: MUTED, letterSpacing: 3 }}>{caption}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: nameSize(name), fontWeight: 800, color: INK, lineHeight: 0.98, letterSpacing: -3 }}>{name}</div>
            <div style={{ width: 280, height: 16, background: MARKER, marginTop: 14, marginBottom: 26 }} />
            <div style={{ fontSize: tagline.length > 100 ? 29 : 34, fontWeight: 700, color: MUTED, lineHeight: 1.3, maxWidth: 940 }}>{tagline}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, fontWeight: 700, letterSpacing: 2, color: INK, borderTop: `2px solid ${INK}`, paddingTop: 22 }}>
            <div style={{ width: 16, height: 16, background: GREEN, border: `2px solid ${INK}` }} />
            RUNS ON YOUR DEVICE · NO UPLOAD · NO SIGN-UP
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Bricolage", data: fontFile(700), weight: 700, style: "normal" },
        { name: "Bricolage", data: fontFile(800), weight: 800, style: "normal" },
      ],
    },
  );
}
