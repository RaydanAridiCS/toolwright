import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { PDFArray, PDFDocument, PDFRawStream, PDFStream, decodePDFRawStream, degrees } from "pdf-lib";
import { scanContent } from "../src/pdf-compress";
import {
  displaySize,
  displayToUser,
  hasTransparency,
  inkBounds,
  inkFromScan,
  looksDigitallySigned,
  pagesFromSpec,
  readPageGeometry,
  signPdf,
  userToDisplay,
  type PageGeometry,
} from "../src/pdf-sign";

/** A real PNG (RGBA, all one colour) of the given size, built with node's zlib. */
function makePng(width: number, height: number, rgba = [0, 0, 0, 255]): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Uint8Array) => {
    let c = 0xffffffff;
    for (const b of buf) c = (crcTable[(c ^ b) & 0xff] as number) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set([...type].map((c) => c.charCodeAt(0)), 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
    return out;
  };
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8);
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set(rgba, y * (width * 4 + 1) + 1 + x * 4);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", new Uint8Array(deflateSync(raw))), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function makePdf(turns: (0 | 90 | 180 | 270)[], size: [number, number] = [612, 792], crop?: [number, number, number, number]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const turn of turns) {
    const page = doc.addPage(size);
    page.setRotation(degrees(turn));
    if (crop) page.setCropBox(...crop);
  }
  return doc.save();
}

/** Where the picture really ended up, as a reader sees it, found by replaying the page's drawing instructions. */
async function shownPlacement(bytes: Uint8Array, pageIndex: number) {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(pageIndex);
  const box = page.getCropBox();
  const g: PageGeometry = { x0: box.x, y0: box.y, x1: box.x + box.width, y1: box.y + box.height, rotate: ((page.getRotation().angle % 360) as PageGeometry["rotate"]) };
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? Array.from({ length: contents.size() }, (_, i) => doc.context.lookup(contents.get(i))) : [contents];
  const text = streams.map((s) => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString("latin1")).join("\n");
  let matrix: number[] | null = null;
  scanContent(text, [1, 0, 0, 1, 0, 0], { onDo: (_n, ctm) => (matrix = [...ctm]) });
  expect(matrix).not.toBeNull();
  const [a, b, c, d, e, f] = matrix as unknown as number[];
  // The picture is a unit square: (0,0) bottom-left, (1,0) bottom-right, (0,1) top-left, as the picture is drawn.
  const toShown = (px: number, py: number) => userToDisplay(g, (a as number) * px + (c as number) * py + (e as number), (b as number) * px + (d as number) * py + (f as number));
  return { bottomLeft: toShown(0, 0), bottomRight: toShown(1, 0), topLeft: toShown(0, 1), geometry: g };
}

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 3);

describe("page geometry", () => {
  it("reports the displayed size, swapping for turned pages", () => {
    expect(displaySize({ x0: 0, y0: 0, x1: 612, y1: 792, rotate: 0 })).toEqual({ width: 612, height: 792 });
    expect(displaySize({ x0: 0, y0: 0, x1: 612, y1: 792, rotate: 90 })).toEqual({ width: 792, height: 612 });
    expect(displaySize({ x0: 10, y0: 20, x1: 110, y1: 220, rotate: 270 })).toEqual({ width: 200, height: 100 });
  });

  it("maps corners of the shown page to the right corners of the unturned page", () => {
    const g = (rotate: PageGeometry["rotate"]): PageGeometry => ({ x0: 0, y0: 0, x1: 600, y1: 800, rotate });
    // Top-left as shown:
    expect(displayToUser(g(0), 0, 0)).toEqual({ x: 0, y: 800 });
    expect(displayToUser(g(90), 0, 0)).toEqual({ x: 0, y: 0 });
    expect(displayToUser(g(180), 0, 0)).toEqual({ x: 600, y: 0 });
    expect(displayToUser(g(270), 0, 0)).toEqual({ x: 600, y: 800 });
  });

  it("converts back and forth without loss, with an offset crop box", () => {
    for (const rotate of [0, 90, 180, 270] as const) {
      const g: PageGeometry = { x0: 37, y0: 11, x1: 437, y1: 611, rotate };
      const back = userToDisplay(g, displayToUser(g, 123.5, 77.25).x, displayToUser(g, 123.5, 77.25).y);
      near(back.u, 123.5);
      near(back.v, 77.25);
    }
  });

  it("reads geometry from a real PDF, including the crop box and the turn", async () => {
    const bytes = await makePdf([0, 90, 180, 270], [612, 792], [20, 30, 500, 700]);
    const geometry = await readPageGeometry(bytes);
    expect(geometry.map((g) => g.rotate)).toEqual([0, 90, 180, 270]);
    expect(geometry[0]).toMatchObject({ x0: 20, y0: 30, x1: 520, y1: 730 });
  });
});

describe("signPdf: the signature lands where it was placed", () => {
  const png = makePng(200, 100);

  for (const turn of [0, 90, 180, 270] as const) {
    it(`upright and in the right place on a page turned ${turn}°`, async () => {
      const bytes = await makePdf([turn]);
      const out = await signPdf(bytes, { image: png, placements: [{ page: 0, left: 100, top: 150, width: 120 }] });
      const { bottomLeft, bottomRight, topLeft } = await shownPlacement(out, 0);
      // 120 wide, and 60 tall because the picture is 2:1. Corners as a reader sees them:
      near(topLeft.u, 100);
      near(topLeft.v, 150);
      near(bottomLeft.u, 100);
      near(bottomLeft.v, 210);
      near(bottomRight.u, 220);
      near(bottomRight.v, 210);
    });
  }

  it("works with an offset crop box on a turned page", async () => {
    const bytes = await makePdf([90, 270], [612, 792], [50, 40, 450, 690]);
    const out = await signPdf(bytes, { image: png, placements: [{ page: 0, left: 10, top: 20, width: 80 }, { page: 1, left: 300, top: 400, width: 100 }] });
    const first = await shownPlacement(out, 0);
    near(first.topLeft.u, 10);
    near(first.topLeft.v, 20);
    near(first.bottomRight.u, 90);
    near(first.bottomRight.v, 20 + 40);
    const second = await shownPlacement(out, 1);
    near(second.topLeft.u, 300);
    near(second.topLeft.v, 400);
    near(second.bottomRight.u, 400);
  });

  it("signs several pages, and keeps the page count and the rest of the file", async () => {
    const bytes = await makePdf([0, 0, 0]);
    const out = await signPdf(bytes, { image: png, placements: [0, 2].map((page) => ({ page, left: 50, top: 600, width: 150 })), caption: "Signed 2026-03-15" });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    const hasImage = (i: number) => {
      const res = doc.getPage(i).node.Resources();
      return !!res?.toString().includes("/XObject");
    };
    expect([hasImage(0), hasImage(1), hasImage(2)]).toEqual([true, false, true]);
  });

  it("prints the caption under the picture", async () => {
    const out = await signPdf(await makePdf([0]), { image: png, placements: [{ page: 0, left: 50, top: 100, width: 100 }], caption: "Date: 2026-03-15" });
    const doc = await PDFDocument.load(out);
    const page = doc.getPage(0);
    const contents = page.node.Contents() as PDFStream | PDFArray;
    const streams = contents instanceof PDFArray ? Array.from({ length: contents.size() }, (_, i) => doc.context.lookup(contents.get(i))) : [contents];
    const text = streams.map((s) => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString("latin1")).join("\n");
    expect(text).toContain(Buffer.from("Date: 2026-03-15").toString("hex").toUpperCase());
  });

  it("explains each kind of mistake", async () => {
    const bytes = await makePdf([0]);
    await expect(signPdf(bytes, { image: png, placements: [] })).rejects.toThrow(/Choose where/);
    await expect(signPdf(bytes, { image: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), placements: [{ page: 0, left: 0, top: 0, width: 10 }] })).rejects.toThrow(/not a PNG/);
    await expect(signPdf(bytes, { image: png, placements: [{ page: 3, left: 0, top: 0, width: 10 }] })).rejects.toThrow(/Page 4 does not exist/);
    await expect(signPdf(bytes, { image: png, placements: [{ page: 0, left: 0, top: 0, width: 0 }] })).rejects.toThrow(/position and a size/);
    await expect(signPdf(bytes, { image: png, placements: [{ page: 0, left: 5000, top: 0, width: 50 }] })).rejects.toThrow(/outside page 1/);
    await expect(signPdf(bytes, { image: png, placements: [{ page: 0, left: 0, top: 0, width: 50 }], caption: "日本語" })).rejects.toThrow(/caption/);
    await expect(signPdf(new Uint8Array([1, 2, 3, 4, 5]), { image: png, placements: [{ page: 0, left: 0, top: 0, width: 10 }] })).rejects.toThrow(/could not be read/);
  });

  it("allows a signature that hangs a little over the edge", async () => {
    const out = await signPdf(await makePdf([0]), { image: png, placements: [{ page: 0, left: 560, top: 740, width: 100 }] });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });
});

describe("looksDigitallySigned", () => {
  it("finds a ByteRange entry, and not in ordinary files", async () => {
    expect(looksDigitallySigned(await makePdf([0]))).toBe(false);
    const fake = new TextEncoder().encode("%PDF-1.7\n<< /Type /Sig /ByteRange [0 100 200 300] >>");
    expect(looksDigitallySigned(fake)).toBe(true);
    expect(looksDigitallySigned(new Uint8Array())).toBe(false);
  });
});

describe("picture helpers", () => {
  const pixels = (w: number, h: number, set: [number, number, number][] = []) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (const [x, y, a] of set) data[(y * w + x) * 4 + 3] = a;
    return data;
  };

  it("finds the bounds of the ink, with padding, and reports a blank picture", () => {
    const data = pixels(10, 8, [[3, 2, 255], [6, 5, 200]]);
    expect(inkBounds(data, 10, 8)).toEqual({ x: 3, y: 2, width: 4, height: 4 });
    expect(inkBounds(data, 10, 8, 2)).toEqual({ x: 1, y: 0, width: 8, height: 8 });
    expect(inkBounds(pixels(4, 4), 4, 4)).toBeNull();
    expect(inkBounds(pixels(4, 4, [[1, 1, 5]]), 4, 4)).toBeNull(); // too faint to count
  });

  it("turns dark pixels on paper into ink: dark is opaque, white is transparent, in the chosen colour", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 160, 160, 160, 255]);
    inkFromScan(data, { r: 10, g: 20, b: 200 });
    expect([...data.slice(0, 4)]).toEqual([10, 20, 200, 255]);
    expect(data[7]).toBe(0);
    expect(data[11]).toBeGreaterThan(60);
    expect(data[11]).toBeLessThan(200);
    expect([...data.slice(8, 11)]).toEqual([10, 20, 200]);
  });

  it("keeps transparent pixels transparent when tinting", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0]);
    inkFromScan(data, { r: 1, g: 2, b: 3 });
    expect(data[3]).toBe(0);
  });

  it("detects transparency", () => {
    expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]))).toBe(false);
    expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 0]))).toBe(true);
  });
});

describe("pagesFromSpec", () => {
  it("reads numbers and ranges into sorted, unique zero-based pages", () => {
    expect(pagesFromSpec("3, 1-2, 2", 5)).toEqual([0, 1, 2]);
    expect(pagesFromSpec("5-4", 5)).toEqual([3, 4]);
    expect(pagesFromSpec(" 2 ", 2)).toEqual([1]);
  });

  it("explains bad input", () => {
    expect(() => pagesFromSpec("", 5)).toThrow(/at least one page/);
    expect(() => pagesFromSpec("abc", 5)).toThrow(/not a page or a range/);
    expect(() => pagesFromSpec("6", 5)).toThrow(/Page 6 is out of range \(this PDF has 5 pages\)/);
    expect(() => pagesFromSpec("0", 5)).toThrow(/out of range/);
  });
});
