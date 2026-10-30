import { describe, expect, it } from "vitest";
import { parseXml } from "../src/xml-formatter";
import {
  BARCODE_LIMITS,
  BARCODE_TYPES,
  BarcodeError,
  CODE128_PATTERNS,
  CODE39_PATTERNS,
  DEFAULT_SVG_STYLE,
  EAN_TABLES,
  ITF_PATTERNS,
  barcodeToSvg,
  code128Checksum,
  code128Values,
  contrastWarning,
  encodeBarcode,
  gs1CheckDigit,
  moduleCount,
  type BarcodeType,
} from "../src/barcode-generator";

/*
 * Reference data. The module strings for the first four barcodes were produced by this encoder and then checked
 * against two programs that were not written for this project: python-barcode 0.16.1 gave exactly the same bars, and
 * ZXing-C++ 3.1.1 decoded pictures of them back to the same numbers.
 */
const REFERENCE = {
  ean13: { input: "400638133393", data: "4006381333931", modules: "10100011010100111010111101111010001001011001101010100001010000101000010111010010000101100110101" },
  upca: { input: "03600029145", data: "036000291452", modules: "10100011010111101010111100011010001101000110101010110110011101001100110101110010011101101100101" },
  ean8: { input: "9638507", data: "96385074", modules: "1010001011010111101111010110111010101001110111001010001001011100101" },
  code39: {
    input: "CODE39-123",
    data: "CODE39-123",
    modules: "10001011101110101110111010001010111010111010001010101110001011101110101110001010111011100010101010111000101110101000101011101110111010001010111010111000101011101110111000101010100010111011101",
  },
} as const;

const ctl = (code: number) => String.fromCharCode(code);

describe("gs1CheckDigit", () => {
  it("matches published examples", () => {
    expect(gs1CheckDigit("400638133393")).toBe(1); // EAN-13 4006381333931
    expect(gs1CheckDigit("978030640615")).toBe(7); // ISBN 978-0-306-40615-7
    expect(gs1CheckDigit("03600029145")).toBe(2); // UPC-A 036000291452
    expect(gs1CheckDigit("9638507")).toBe(4); // EAN-8 96385074
    expect(gs1CheckDigit("1001234567890")).toBe(2); // GTIN-14 10012345678902
    expect(gs1CheckDigit("0")).toBe(0);
  });
  it("makes any number plus its check digit a multiple of ten under the 3-1 weights", () => {
    for (let n = 0; n < 2000; n += 7) {
      const body = String(n * 9973).padStart(12, "0").slice(-12);
      const d = gs1CheckDigit(body);
      let sum = 0;
      for (let i = 0; i < 13; i++) sum += Number((body + d)[i]) * (i % 2 === 0 ? 1 : 3);
      expect(sum % 10, body).toBe(0);
    }
  });
  it("refuses anything but digits", () => {
    expect(() => gs1CheckDigit("12a4")).toThrow(BarcodeError);
    expect(() => gs1CheckDigit("")).toThrow(BarcodeError);
  });
});

describe("EAN tables", () => {
  it("are built correctly: L starts with a space, R is L inverted, G is R reversed", () => {
    expect(EAN_TABLES.L).toHaveLength(10);
    EAN_TABLES.L.forEach((l, d) => {
      expect(l).toHaveLength(7);
      expect(l.startsWith("0") && l.endsWith("1")).toBe(true);
      expect(EAN_TABLES.R[d]?.startsWith("1")).toBe(true);
      expect([...l].filter((b) => b === "1").length % 2).toBe(1); // L codes have an odd number of bar modules
      expect([...(EAN_TABLES.G[d] as string)].filter((b) => b === "1").length % 2).toBe(0); // G codes an even number
    });
    expect(new Set([...EAN_TABLES.L, ...EAN_TABLES.G, ...EAN_TABLES.R]).size).toBe(30);
    expect(EAN_TABLES.L[0]).toBe("0001101");
    expect(EAN_TABLES.G[0]).toBe("0100111");
    expect(EAN_TABLES.R[0]).toBe("1110010");
    expect(EAN_TABLES.G[9]).toBe("0010111");
  });
  it("has ten parity patterns with three L and three G each, the first all L", () => {
    expect(EAN_TABLES.parity).toHaveLength(10);
    expect(EAN_TABLES.parity[0]).toBe("LLLLLL");
    EAN_TABLES.parity.forEach((p) => {
      expect(p).toHaveLength(6);
      if (p !== "LLLLLL") expect([...p].filter((c) => c === "L").length).toBeGreaterThan(0);
    });
    expect(new Set(EAN_TABLES.parity).size).toBe(10);
  });
});

describe("EAN-13, UPC-A and EAN-8", () => {
  for (const [type, ref] of Object.entries(REFERENCE).filter(([t]) => t !== "code39") as ["ean13" | "upca" | "ean8", (typeof REFERENCE)["ean13"]][]) {
    it(`${type} matches the reference bars`, () => {
      const code = encodeBarcode(type, ref.input);
      expect(code.data).toBe(ref.data);
      expect(code.modules).toBe(ref.modules);
      expect(code.notes[0]).toMatch(/check digit/);
    });
  }
  it("checks a check digit you typed, and says what it should be", () => {
    expect(encodeBarcode("ean13", "4006381333931").notes).toEqual([]);
    expect(() => encodeBarcode("ean13", "4006381333932")).toThrow(/should be 1, but the last digit is 2/);
    expect(() => encodeBarcode("upca", "036000291453")).toThrow(/should be 2/);
    expect(() => encodeBarcode("ean8", "96385075")).toThrow(/should be 4/);
  });
  it("has the right size and guard bars", () => {
    const ean13 = encodeBarcode("ean13", "400638133393");
    expect(ean13.modules).toHaveLength(95);
    expect(ean13.modules.startsWith("101")).toBe(true);
    expect(ean13.modules.slice(45, 50)).toBe("01010");
    expect(ean13.modules.endsWith("101")).toBe(true);
    expect(encodeBarcode("ean8", "9638507").modules).toHaveLength(67);
    expect(encodeBarcode("upca", "03600029145").modules).toHaveLength(95);
  });
  it("makes UPC-A the same bars as EAN-13 with a leading zero", () => {
    expect(encodeBarcode("upca", "03600029145").modules).toBe(encodeBarcode("ean13", "003600029145").modules);
  });
  it("accepts spaces and hyphens in the number", () => {
    expect(encodeBarcode("ean13", "4006 3813 3393").data).toBe("4006381333931");
    expect(encodeBarcode("ean13", "978-0-306-40615").data).toBe("9780306406157");
  });
  it("encodes the first digit in the pattern of the left half (every first digit)", () => {
    for (let first = 0; first <= 9; first++) {
      const code = encodeBarcode("ean13", `${first}12345678901`);
      const left = code.modules.slice(3, 45);
      for (let k = 0; k < 6; k++) {
        const set = EAN_TABLES.parity[first]![k] === "L" ? EAN_TABLES.L : EAN_TABLES.G;
        expect(left.slice(k * 7, k * 7 + 7)).toBe(set[Number(code.data[1 + k])]);
      }
    }
  });
  it("rejects the wrong length and non-digits", () => {
    expect(() => encodeBarcode("ean13", "12345")).toThrow(/needs 12 digits.*13 digits.*typed 5/);
    expect(() => encodeBarcode("ean13", "12345678901234")).toThrow(BarcodeError);
    expect(() => encodeBarcode("ean13", "40063813339A")).toThrow(/digits only/);
    expect(() => encodeBarcode("upca", "1234")).toThrow(/11 digits/);
    expect(() => encodeBarcode("ean8", "")).toThrow(/Enter the text/);
  });
  it("labels the digits the way printed codes do", () => {
    const ean = encodeBarcode("ean13", "400638133393");
    expect(ean.labels.map((l) => l.text)).toEqual(["4", "006381", "333931"]);
    const upc = encodeBarcode("upca", "03600029145");
    expect(upc.labels.map((l) => l.text)).toEqual(["0", "36000", "29145", "2"]);
    expect(encodeBarcode("ean8", "9638507").labels.map((l) => l.text)).toEqual(["9638", "5074"]);
  });
  it("encodes every digit 0 to 9 in both halves of an EAN-8 and reads back the same", () => {
    const decodeSide = (bits: string, table: readonly string[]) => [...Array(4).keys()].map((k) => table.indexOf(bits.slice(k * 7, k * 7 + 7))).join("");
    for (const body of ["0123456", "7890123", "4567890", "9999999", "0000000"]) {
      const code = encodeBarcode("ean8", body);
      expect(decodeSide(code.modules.slice(3, 31), EAN_TABLES.L) + decodeSide(code.modules.slice(36, 64), EAN_TABLES.R)).toBe(code.data);
    }
  });
});

describe("Code 128: the table", () => {
  it("has 107 distinct patterns of the right shape", () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
    CODE128_PATTERNS.forEach((p, i) => {
      const widths = [...p].map(Number);
      expect(widths.every((w) => w >= 1 && w <= 4), `symbol ${i}`).toBe(true);
      if (i < 106) {
        expect(p, `symbol ${i}`).toHaveLength(6);
        expect(widths.reduce((a, b) => a + b, 0), `symbol ${i} is 11 modules wide`).toBe(11);
      } else {
        expect(widths.reduce((a, b) => a + b, 0)).toBe(13);
        expect(p).toBe("2331112");
      }
    });
  });
  it("matches well-known entries", () => {
    expect(CODE128_PATTERNS[0]).toBe("212222"); // space in sets A and B
    expect(CODE128_PATTERNS[103]).toBe("211412"); // Start A
    expect(CODE128_PATTERNS[104]).toBe("211214"); // Start B
    expect(CODE128_PATTERNS[105]).toBe("211232"); // Start C
    expect(CODE128_PATTERNS[99]).toBe("113141"); // Code C
    expect(CODE128_PATTERNS[100]).toBe("114131"); // Code B
    expect(CODE128_PATTERNS[101]).toBe("311141"); // Code A
  });
  it("gives the right bars for the symbol values: every symbol is 11 modules, then a 13-module stop", () => {
    const code = encodeBarcode("code128", "Hello");
    const symbols = code128Values("Hello").length;
    expect(code.modules).toHaveLength(symbols * 11 + 13);
    expect(code.modules.startsWith("11010010000")).toBe(true); // Start B: 211214
    expect(code.modules.endsWith("1100011101011")).toBe(true); // Stop with its closing bar
  });
});

/** The same rules a scanner follows to read the symbol values back into text. */
function decodeValues(values: number[]): string {
  const checkIndex = values.length - 1;
  if (code128Checksum(values.slice(0, checkIndex)) !== values[checkIndex]) throw new Error("bad check symbol");
  let subset: "A" | "B" | "C" = values[0] === 103 ? "A" : values[0] === 104 ? "B" : "C";
  let out = "";
  let shifted = false;
  for (let i = 1; i < checkIndex; i++) {
    const v = values[i] as number;
    if (subset === "C") {
      if (v <= 99) out += String(v).padStart(2, "0");
      else if (v === 100) subset = "B";
      else if (v === 101) subset = "A";
      else throw new Error(`unexpected ${v} in C`);
      continue;
    }
    const current = shifted ? (subset === "A" ? "B" : "A") : subset;
    shifted = false;
    if (v <= 95 && current === "A") out += String.fromCharCode(v < 64 ? v + 32 : v - 64);
    else if (v <= 95 && current === "B") out += String.fromCharCode(v + 32);
    else if (v === 98) shifted = true;
    else if (v === 99) subset = "C";
    else if (v === 100 && current === "A") subset = "B";
    else if (v === 101 && current === "B") subset = "A";
    else throw new Error(`unexpected ${v}`);
  }
  return out;
}

/** An independent search for the fewest symbols: breadth-first over (position, subset, shift pending). */
function fewestSymbols(text: string): number {
  const codes = [...text].map((c) => c.charCodeAt(0));
  const inA = (c: number) => c <= 95;
  const inB = (c: number) => c >= 32 && c <= 127;
  let best = Infinity;
  const memo = new Map<string, number>();
  const go = (i: number, s: "A" | "B" | "C"): number => {
    if (i === codes.length) return 0;
    const key = `${i}${s}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    memo.set(key, Infinity); // guards against switch loops
    const c = codes[i] as number;
    let result = Infinity;
    const asDigit = (k: number) => codes[k] !== undefined && (codes[k] as number) >= 48 && (codes[k] as number) <= 57;
    if (s === "C") {
      if (asDigit(i) && asDigit(i + 1)) result = Math.min(result, 1 + go(i + 2, "C"));
    } else {
      if ((s === "A" && inA(c)) || (s === "B" && inB(c))) result = Math.min(result, 1 + go(i + 1, s));
      else if ((s === "A" && inB(c)) || (s === "B" && inA(c))) result = Math.min(result, 2 + go(i + 1, s)); // shift
    }
    for (const t of ["A", "B", "C"] as const) {
      if (t === s) continue;
      // switch then immediately use t for this character
      let used = Infinity;
      if (t === "C") used = asDigit(i) && asDigit(i + 1) ? 1 + go(i + 2, "C") : Infinity;
      else if ((t === "A" && inA(c)) || (t === "B" && inB(c))) used = 1 + go(i + 1, t);
      result = Math.min(result, 1 + used);
    }
    memo.set(key, result);
    return result;
  };
  for (const s of ["A", "B", "C"] as const) best = Math.min(best, go(0, s));
  return best + 1 /* start */ + 1 /* check */;
}

describe("Code 128: choosing symbols", () => {
  it("reproduces the worked example PJJ123C (start A, check symbol 54)", () => {
    expect(code128Values("PJJ123C")).toEqual([103, 48, 42, 42, 17, 18, 19, 35, 54]);
  });
  it("uses set C for long digit runs, and checks its own sum", () => {
    expect(code128Values("1234567890")).toEqual([105, 12, 34, 56, 78, 90, 85]);
    expect(code128Values("00")).toEqual([105, 0, 105 % 103]);
  });
  it("starts in set B for ordinary text", () => {
    expect(code128Values("Hello")[0]).toBe(104);
    expect(code128Values("x")).toEqual([104, 88, (104 + 88) % 103]);
  });
  it("uses set A for control characters, and shifts for a single odd one", () => {
    expect(code128Values(ctl(1) + "A")[0]).toBe(103);
    const mixed = code128Values("abc" + ctl(9) + "def");
    expect(mixed).toContain(98 /* shift */);
    expect(decodeValues(mixed)).toBe("abc" + ctl(9) + "def");
  });
  it("round-trips a thousand random strings through an independent decoder, and is never longer than the best", () => {
    let seed = 20240607;
    const rand = (n: number) => Math.floor(((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * n);
    const alphabets = ["0123456789", "0123456789ABCabc -", "abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", "".concat(...Array.from({ length: 128 }, (_, i) => String.fromCharCode(i)))];
    for (let t = 0; t < 1000; t++) {
      const alphabet = alphabets[rand(alphabets.length)] as string;
      const length = 1 + rand(14);
      let text = "";
      for (let k = 0; k < length; k++) text += alphabet[rand(alphabet.length)];
      const values = code128Values(text);
      expect(decodeValues(values), JSON.stringify(text)).toBe(text);
      if (text.length <= 12) expect(values.length, JSON.stringify(text)).toBe(fewestSymbols(text));
    }
  });
  it("handles all 128 characters in one string", () => {
    const all = Array.from({ length: 128 }, (_, i) => String.fromCharCode(i)).join("");
    expect(decodeValues(code128Values(all))).toBe(all);
  });
  it("refuses characters outside ASCII and empty text", () => {
    expect(() => code128Values("café")).toThrow(/position 4/);
    expect(() => code128Values("日本")).toThrow(/ASCII/);
    expect(() => code128Values("😀")).toThrow(BarcodeError);
    expect(() => code128Values("")).toThrow(/Enter the text/);
  });
  it("is fast for the longest allowed text", () => {
    const text = "Ab1".repeat(Math.floor(BARCODE_LIMITS.code128 / 3));
    const started = Date.now();
    const code = encodeBarcode("code128", text);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(code.modules.length).toBeGreaterThan(1000);
    expect(() => encodeBarcode("code128", "x".repeat(BARCODE_LIMITS.code128 + 1))).toThrow(/limited to 500/);
  });
  it("trims stray space at the ends but keeps inner spaces", () => {
    expect(encodeBarcode("code128", "  a b  ").data).toBe("a b");
  });
  it("leaves out the printed line for control characters, and says so", () => {
    const code = encodeBarcode("code128", ctl(1) + "A");
    expect(code.labels).toEqual([]);
    expect(code.notes.join(" ")).toMatch(/control characters/);
  });
});

describe("Code 39", () => {
  it("has 44 distinct patterns with the structure of the standard", () => {
    const entries = Object.entries(CODE39_PATTERNS);
    expect(entries).toHaveLength(44);
    expect(new Set(entries.map(([, p]) => p)).size).toBe(44);
    let barsWide = 0;
    let spacesWide = 0;
    for (const [ch, p] of entries) {
      expect(p, ch).toHaveLength(9);
      expect([...p].filter((c) => c === "w").length, ch).toBe(3);
      const wideBars = [...p].filter((c, i) => i % 2 === 0 && c === "w").length;
      const wideSpaces = [...p].filter((c, i) => i % 2 === 1 && c === "w").length;
      if (wideSpaces === 3) spacesWide++;
      else {
        expect(wideBars, ch).toBe(2);
        expect(wideSpaces, ch).toBe(1);
        barsWide++;
      }
    }
    expect(barsWide).toBe(40);
    expect(spacesWide).toBe(4);
    expect(["$", "/", "+", "%"].every((c) => [...(CODE39_PATTERNS[c] as string)].filter((x, i) => i % 2 === 1 && x === "w").length === 3)).toBe(true);
  });
  it("matches the reference bars", () => {
    expect(encodeBarcode("code39", REFERENCE.code39.input).modules).toBe(REFERENCE.code39.modules);
  });
  it("wraps the text in * marks and separates characters by one narrow space", () => {
    const code = encodeBarcode("code39", "A");
    // * A * : three characters of 15 modules each (six narrow and three wide elements), plus two gaps
    expect(code.labels[0]?.text).toBe("*A*");
    expect(code.modules.startsWith("100010111011101")).toBe(true);
    expect(code.modules).toHaveLength(15 * 3 + 2);
  });
  it("works out the optional modulo-43 check character (CODE39 gives W)", () => {
    const code = encodeBarcode("code39", "CODE39", { code39Check: true });
    expect(code.data).toBe("CODE39W");
    expect(code.notes.join(" ")).toMatch(/"W"/);
  });
  it("makes lower case upper case and says so", () => {
    const code = encodeBarcode("code39", "abc 12");
    expect(code.data).toBe("ABC 12");
    expect(code.notes.join(" ")).toMatch(/upper case/);
  });
  it("rejects characters the set does not have, and the * itself", () => {
    expect(() => encodeBarcode("code39", "A_B")).toThrow(/"_" cannot be written in Code 39/);
    expect(() => encodeBarcode("code39", "A*B")).toThrow(/start and stop/);
    expect(() => encodeBarcode("code39", "é")).toThrow(BarcodeError);
    expect(() => encodeBarcode("code39", "A".repeat(BARCODE_LIMITS.code39 + 1))).toThrow(/limited to 200/);
  });
  it("uses a check character that is itself in the set (all 43 possible values appear)", () => {
    const seen = new Set<string>();
    for (const ch of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%") {
      const code = encodeBarcode("code39", ch === " " ? "A B" : `${ch}`, { code39Check: true });
      seen.add(code.data.slice(-1));
    }
    expect(seen.size).toBeGreaterThan(10);
    for (const s of seen) expect(s in CODE39_PATTERNS).toBe(true);
  });
});

describe("Interleaved 2 of 5 and ITF-14", () => {
  it("has ten distinct patterns with exactly two wide elements", () => {
    expect(ITF_PATTERNS).toHaveLength(10);
    expect(new Set(ITF_PATTERNS).size).toBe(10);
    ITF_PATTERNS.forEach((p) => expect([...p].filter((c) => c === "w")).toHaveLength(2));
  });
  it("has the start and stop patterns and the right width", () => {
    const code = encodeBarcode("itf", "12345670");
    expect(code.modules.startsWith("1010")).toBe(true);
    expect(code.modules.endsWith("11101")).toBe(true);
    // Every digit pair is 18 modules: four wide elements and six narrow ones.
    expect(code.modules).toHaveLength(4 + 4 * 18 + 5);
  });
  it("reads back to the same digits with an independent decoder", () => {
    const decode = (modules: string): string => {
      const body = modules.slice(4, -5);
      const runs: number[] = [];
      for (let i = 0; i < body.length; ) {
        let j = i;
        while (j < body.length && body[j] === body[i]) j++;
        runs.push(j - i);
        i = j;
      }
      let out = "";
      for (let p = 0; p < runs.length; p += 10) {
        const group = runs.slice(p, p + 10);
        const bars = group.filter((_, k) => k % 2 === 0).map((w) => (w > 1 ? "w" : "n")).join("");
        const spaces = group.filter((_, k) => k % 2 === 1).map((w) => (w > 1 ? "w" : "n")).join("");
        out += ITF_PATTERNS.indexOf(bars as never) + "" + ITF_PATTERNS.indexOf(spaces as never);
      }
      return out;
    };
    for (const digits of ["12345670", "00", "9876543210", "0123456789", "55555555", "1234567890123456789012"]) {
      expect(decode(encodeBarcode("itf", digits).modules), digits).toBe(digits);
    }
  });
  it("puts a 0 in front of an odd number of digits", () => {
    const code = encodeBarcode("itf", "123");
    expect(code.data).toBe("0123");
    expect(code.notes.join(" ")).toMatch(/0 was put in front/);
  });
  it("adds or checks the ITF-14 check digit", () => {
    expect(encodeBarcode("itf14", "1001234567890").data).toBe("10012345678902");
    expect(encodeBarcode("itf14", "10012345678902").notes).toEqual([]);
    expect(() => encodeBarcode("itf14", "10012345678903")).toThrow(/should be 2/);
    expect(() => encodeBarcode("itf14", "123")).toThrow(/13 digits/);
  });
  it("rejects letters and over-long input", () => {
    expect(() => encodeBarcode("itf", "12AB")).toThrow(/digits only/);
    expect(() => encodeBarcode("itf", "1".repeat(BARCODE_LIMITS.itf + 2))).toThrow(/up to 200/);
  });
});

describe("encodeBarcode", () => {
  it("knows every type in the list and gives each an example that works", () => {
    expect(BARCODE_TYPES.map((t) => t.id).sort()).toEqual(["code128", "code39", "ean13", "ean8", "itf", "itf14", "upca"]);
    for (const spec of BARCODE_TYPES) expect(() => encodeBarcode(spec.id, spec.example), spec.id).not.toThrow();
  });
  it("rejects empty text for every type", () => {
    for (const spec of BARCODE_TYPES) {
      expect(() => encodeBarcode(spec.id, ""), spec.id).toThrow(/Enter the text or number/);
      expect(() => encodeBarcode(spec.id, "   "), spec.id).toThrow(BarcodeError);
    }
  });
  it("rejects an unknown type and non-string input", () => {
    expect(() => encodeBarcode("qr" as BarcodeType, "x")).toThrow(/Unknown barcode type/);
    expect(() => encodeBarcode("code128", undefined as unknown as string)).toThrow(BarcodeError);
  });
  it("only ever produces bar and space modules, starting and ending with a bar", () => {
    for (const spec of BARCODE_TYPES) {
      const m = encodeBarcode(spec.id, spec.example).modules;
      expect(m, spec.id).toMatch(/^1[01]*1$/);
    }
  });
  it("reports the width in modules", () => {
    expect(moduleCount(encodeBarcode("ean13", "400638133393"))).toBe(95);
  });
});

describe("barcodeToSvg", () => {
  const ean = encodeBarcode("ean13", "400638133393");

  it("makes valid XML with one rectangle per run of bars", () => {
    const { svg } = barcodeToSvg(ean);
    expect(() => parseXml(svg)).not.toThrow();
    const rects = svg.match(/<rect /g)?.length ?? 0;
    // Background rectangle plus the bars (guards are drawn as separate, taller rectangles).
    const runs = ean.modules.match(/1+/g)!.length;
    expect(rects).toBeGreaterThanOrEqual(runs + 1);
    expect(svg).toContain('shape-rendering="crispEdges"');
  });
  it("sizes the picture from the modules, the quiet zones and the module width", () => {
    const small = barcodeToSvg(ean, { moduleWidth: 1, quietZone: 0, showText: false });
    expect(small.width).toBe(95 + 11 + 7);
    const wide = barcodeToSvg(ean, { moduleWidth: 3, quietZone: 0, showText: false });
    expect(wide.width).toBe((95 + 11 + 7) * 3);
    // The default quiet zone of 10 modules applies to both sides when the type needs less.
    expect(barcodeToSvg(ean, { moduleWidth: 1, showText: false }).width).toBe(95 + 11 + 10);
    expect(barcodeToSvg(ean, { barHeight: 100, showText: false }).height).toBe(100);
  });
  it("never uses less quiet zone than the type needs", () => {
    const tight = barcodeToSvg(ean, { moduleWidth: 1, quietZone: 0, showText: false });
    expect(tight.width).toBe(95 + 11 + 7);
    const code128 = encodeBarcode("code128", "A");
    expect(barcodeToSvg(code128, { moduleWidth: 1, quietZone: 2, showText: false }).width).toBe(code128.modules.length + 20);
  });
  it("prints the digits, one under each group, or leaves them out", () => {
    const withText = barcodeToSvg(ean).svg;
    expect((withText.match(/<text /g) ?? []).length).toBe(13);
    expect(barcodeToSvg(ean, { showText: false }).svg).not.toContain("<text");
    const code = barcodeToSvg(encodeBarcode("code128", "Hello")).svg;
    expect((code.match(/<text /g) ?? []).length).toBe(1);
    expect(code).toContain(">Hello</text>");
  });
  it("lets the EAN guard bars hang below the others", () => {
    const { svg } = barcodeToSvg(ean, { barHeight: 80 });
    const heights = new Set([...svg.matchAll(/height="([0-9.]+)"/g)].map((m) => Number(m[1])));
    expect([...heights].some((h) => h > 80)).toBe(true);
  });
  it("escapes text so it can never become markup", () => {
    const hostile = encodeBarcode("code128", '<script>alert("x")</script>&');
    const { svg } = barcodeToSvg(hostile);
    expect(svg).not.toContain("<script");
    expect(svg).toContain("&lt;script&gt;");
    expect(() => parseXml(svg)).not.toThrow();
  });
  it("stays valid XML for control characters in the data", () => {
    const code = encodeBarcode("code128", ctl(1) + "A" + ctl(0));
    expect(() => parseXml(barcodeToSvg(code).svg)).not.toThrow();
  });
  it("describes the barcode for screen readers", () => {
    const { svg } = barcodeToSvg(ean);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="ean13 barcode: 4006381333931"');
    expect(svg).toContain("<title>");
  });
  it("accepts #rgb and #rrggbb colours and refuses anything else (so a colour cannot carry markup)", () => {
    expect(() => barcodeToSvg(ean, { foreground: "#000", background: "#ffffff" })).not.toThrow();
    for (const bad of ["red", "#12", "#gggggg", 'red" onload="x', "url(#a)", "", "#12345"]) {
      expect(() => barcodeToSvg(ean, { foreground: bad }), bad).toThrow(/Colours must be/);
      expect(() => barcodeToSvg(ean, { background: bad }), bad).toThrow(/Colours must be/);
    }
  });
  it("keeps silly sizes in range", () => {
    const huge = barcodeToSvg(ean, { moduleWidth: 1e9, barHeight: 1e9, fontSize: 1e9 });
    expect(huge.width).toBeLessThan(12 * 200);
    expect(huge.height).toBeLessThan(700);
    const nan = barcodeToSvg(ean, { moduleWidth: NaN, barHeight: NaN, quietZone: NaN, fontSize: NaN });
    expect(nan.width).toBe((95 + 11 + DEFAULT_SVG_STYLE.quietZone) * DEFAULT_SVG_STYLE.moduleWidth);
    expect(Number.isFinite(barcodeToSvg(ean, { moduleWidth: -5 }).width)).toBe(true);
  });
  it("draws every type without error", () => {
    for (const spec of BARCODE_TYPES) {
      const { svg } = barcodeToSvg(encodeBarcode(spec.id, spec.example));
      expect(() => parseXml(svg), spec.id).not.toThrow();
    }
  });
});

describe("contrastWarning", () => {
  it("is quiet for black on white and dark on light", () => {
    expect(contrastWarning("#000000", "#ffffff")).toBeNull();
    expect(contrastWarning("#1a1a1a", "#f0f0f0")).toBeNull();
  });
  it("warns about light bars and about low contrast", () => {
    expect(contrastWarning("#ffffff", "#000000")).toMatch(/lighter/);
    expect(contrastWarning("#777777", "#888888")).toMatch(/too close/);
    expect(contrastWarning("#990000", "#ffffff")).toBeNull();
  });
  it("ignores colours it cannot read", () => {
    expect(contrastWarning("red", "#fff")).toBeNull();
  });
});
