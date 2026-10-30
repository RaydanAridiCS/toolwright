#!/usr/bin/env node
/**
 * Generates the animated GIFs in packages/core/tests/fixtures/gif/ with sharp (libvips), which is a different encoder
 * from the one the tool uses, so the decoder is tested against files it did not write. The output is committed.
 *
 *   node scripts/make-gif-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "core", "tests", "fixtures", "gif");
mkdirSync(out, { recursive: true });

const W = 40;
const H = 30;

/** One frame of raw RGBA: a background colour with a square of another colour at (x, y). */
function frame(bg, square, x, y, size = 10) {
  const buf = Buffer.alloc(W * H * 4);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const inside = square && px >= x && px < x + size && py >= y && py < y + size;
      const c = inside ? square : bg;
      buf.set(c, (py * W + px) * 4);
    }
  }
  return buf;
}

async function gif(frames, delays, name, options = {}) {
  const stacked = Buffer.concat(frames);
  const bytes = await sharp(stacked, { raw: { width: W, height: H * frames.length, channels: 4, pageHeight: H } })
    .gif({ delay: delays, loop: 0, effort: 1, ...options })
    .toBuffer();
  writeFileSync(join(out, name), bytes);
  console.log(`${name}: ${bytes.length} bytes, ${frames.length} frames`);
}

const RED = [255, 0, 0, 255];
const GREEN = [0, 200, 0, 255];
const BLUE = [0, 0, 255, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

// Three full-frame colours with different delays.
await gif([frame(RED), frame(GREEN), frame(BLUE)], [100, 200, 300], "solid-3.gif");

// A square moving over a white background: later frames change only a small area.
await gif([frame(WHITE, RED, 2, 2), frame(WHITE, RED, 12, 8), frame(WHITE, RED, 24, 16), frame(WHITE, RED, 28, 18)], [80, 80, 80, 80], "moving-square.gif");

// Transparency: a square on a see-through background, so frames must be cleared between steps.
await gif([frame(CLEAR, BLUE, 2, 2), frame(CLEAR, BLUE, 20, 10), frame(CLEAR, GREEN, 28, 18)], [100, 100, 100], "transparent-square.gif");
