/**
 * One-dimensional barcodes: Code 128, EAN-13, EAN-8, UPC-A, Code 39, Interleaved 2 of 5 and ITF-14.
 * Each encoder returns the bars as a string of modules ("1" is a bar, "0" is a space), and `barcodeToSvg` draws them.
 * Keep this file free of React, the DOM and the network.
 */

import { contrastRatio, parseColor, relativeLuminance } from "./color";

export type BarcodeType = "code128" | "ean13" | "ean8" | "upca" | "code39" | "itf" | "itf14";

export class BarcodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BarcodeError";
  }
}

export interface BarcodeSpec {
  id: BarcodeType;
  label: string;
  /** What it is used for and what it accepts. */
  description: string;
  example: string;
}

export const BARCODE_TYPES: BarcodeSpec[] = [
  { id: "code128", label: "Code 128", description: "Any text. The usual choice for shipping labels, inventory and serial numbers.", example: "Toolwright-2024" },
  { id: "ean13", label: "EAN-13", description: "13 digits on retail products worldwide. Type 12 digits and the check digit is added.", example: "400638133393" },
  { id: "upca", label: "UPC-A", description: "12 digits on retail products in North America. Type 11 digits and the check digit is added.", example: "03600029145" },
  { id: "ean8", label: "EAN-8", description: "8 digits for small packages. Type 7 digits and the check digit is added.", example: "9638507" },
  { id: "code39", label: "Code 39", description: "Capital letters, digits and - . $ / + % and space. Common in industry and government.", example: "CODE39-123" },
  { id: "itf", label: "Interleaved 2 of 5", description: "Digits only, in pairs, so an even count. Used on cartons and in warehouses.", example: "12345670" },
  { id: "itf14", label: "ITF-14", description: "14 digits on shipping cartons. Type 13 digits and the check digit is added.", example: "1234567890123" },
];

export const BARCODE_LIMITS = {
  code128: 500,
  code39: 200,
  itf: 200,
} as const;

/* ----------------------------------------------------------------------------------------------- */
/* Check digits                                                                                     */
/* ----------------------------------------------------------------------------------------------- */

/**
 * The GS1 check digit shared by EAN-13, EAN-8, UPC-A and ITF-14: starting from the digit next to the check digit and
 * going left, multiply by 3, 1, 3, 1… add them up, and take what is needed to reach the next multiple of ten.
 */
export function gs1CheckDigit(digits: string): number {
  if (!/^[0-9]+$/.test(digits)) throw new BarcodeError("Check digits are worked out from digits only.");
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - 1 - i;
    sum += Number(digits[i]) * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** Accepts the digits without the check digit (and adds it) or with it (and checks it). */
function withCheckDigit(input: string, bodyLength: number, name: string): { data: string; added: boolean } {
  if (!/^[0-9]*$/.test(input)) throw new BarcodeError(`${name} uses digits only (0 to 9).`);
  if (input.length === bodyLength) return { data: input + gs1CheckDigit(input), added: true };
  if (input.length === bodyLength + 1) {
    const expected = gs1CheckDigit(input.slice(0, bodyLength));
    if (Number(input[bodyLength]) !== expected) {
      throw new BarcodeError(`The check digit is wrong. For ${input.slice(0, bodyLength)} it should be ${expected}, but the last digit is ${input[bodyLength]}. Remove the last digit to have it added for you.`);
    }
    return { data: input, added: false };
  }
  throw new BarcodeError(`${name} needs ${bodyLength} digits (the check digit is added) or ${bodyLength + 1} digits (with the check digit). You typed ${input.length}.`);
}

/* ----------------------------------------------------------------------------------------------- */
/* EAN-13, UPC-A and EAN-8                                                                          */
/* ----------------------------------------------------------------------------------------------- */

const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
// The G set is the R set read backwards; the R set is the L set with bars and spaces swapped.
const EAN_R = EAN_L.map((p) => [...p].map((b) => (b === "1" ? "0" : "1")).join(""));
const EAN_G = EAN_R.map((p) => [...p].reverse().join(""));
/** Which set (L or G) the six left digits use, chosen by the first digit. */
const EAN13_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export const EAN_TABLES = { L: EAN_L, G: EAN_G, R: EAN_R, parity: EAN13_PARITY } as const;

export interface BarcodeLabel {
  text: string;
  /** Module range the text is centred under. May lie in the quiet zone (negative or past the end). */
  from: number;
  to: number;
}

export interface Barcode {
  type: BarcodeType;
  /** What is encoded, including any check digit. */
  data: string;
  /** "1" for a bar module, "0" for a space module. */
  modules: string;
  /** Modules of blank space needed on each side for scanners to find the code. */
  quiet: { left: number; right: number };
  /** Text printed under the bars. */
  labels: BarcodeLabel[];
  /** Bar ranges (start, end exclusive) that reach down into the text area, as the guard bars of EAN and UPC do. */
  guards: [number, number][];
  /** Plain-language notes about what was changed or added. */
  notes: string[];
}

function eanLike(type: "ean13" | "upca" | "ean8", input: string): Barcode {
  const notes: string[] = [];
  if (type === "ean8") {
    const { data, added } = withCheckDigit(input, 7, "EAN-8");
    if (added) notes.push(`The check digit ${data[7]} was added.`);
    const left = [...data.slice(0, 4)].map((d) => EAN_L[Number(d)]).join("");
    const right = [...data.slice(4)].map((d) => EAN_R[Number(d)]).join("");
    const modules = `101${left}01010${right}101`;
    return {
      type,
      data,
      modules,
      quiet: { left: 7, right: 7 },
      labels: [
        { text: data.slice(0, 4), from: 3, to: 31 },
        { text: data.slice(4), from: 36, to: 64 },
      ],
      guards: [
        [0, 3],
        [31, 36],
        [64, 67],
      ],
      notes,
    };
  }

  // UPC-A is EAN-13 with a leading zero, drawn with the first and last digits outside the bars.
  const ean13 = type === "ean13";
  const { data, added } = ean13 ? withCheckDigit(input, 12, "EAN-13") : withCheckDigit(input, 11, "UPC-A");
  if (added) notes.push(`The check digit ${data[data.length - 1]} was added.`);
  const full = ean13 ? data : `0${data}`;
  const parity = EAN13_PARITY[Number(full[0])] as string;
  let left = "";
  for (let i = 0; i < 6; i++) left += (parity[i] === "L" ? EAN_L : EAN_G)[Number(full[1 + i])];
  let right = "";
  for (let i = 0; i < 6; i++) right += EAN_R[Number(full[7 + i])];
  const modules = `101${left}01010${right}101`;
  const guards: [number, number][] = [
    [0, 3],
    [45, 50],
    [92, 95],
  ];
  if (ean13) {
    return {
      type,
      data,
      modules,
      quiet: { left: 11, right: 7 },
      labels: [
        { text: full[0] as string, from: -9, to: -1 },
        { text: full.slice(1, 7), from: 3, to: 45 },
        { text: full.slice(7), from: 50, to: 92 },
      ],
      guards,
      notes,
    };
  }
  return {
    type,
    data,
    modules,
    quiet: { left: 9, right: 9 },
    labels: [
      { text: data[0] as string, from: -9, to: -1 },
      { text: data.slice(1, 6), from: 10, to: 45 },
      { text: data.slice(6, 11), from: 50, to: 85 },
      { text: data[11] as string, from: 96, to: 104 },
    ],
    // UPC-A also lets the first and last bar groups (the digits at either end) hang down.
    guards: [...guards, [3, 10], [85, 92]],
    notes,
  };
}

/* ----------------------------------------------------------------------------------------------- */
/* Code 128                                                                                         */
/* ----------------------------------------------------------------------------------------------- */

/** Widths of bar, space, bar, space, bar, space for symbols 0 to 105, then the stop pattern (7 elements) at 106. */
export const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

const START_A = 103;
const START_B = 104;
const START_C = 105;
const STOP = 106;
const CODE_A = 101; // in set B or C: switch to A
const CODE_B = 100; // in set A or C: switch to B
const CODE_C = 99; // in set A or B: switch to C
const SHIFT = 98; // in set A or B: the next character only comes from the other of the two

type Subset = "A" | "B" | "C";

const isDigit = (code: number) => code >= 48 && code <= 57;

function valueIn(subset: "A" | "B", code: number): number | null {
  if (subset === "A") return code <= 95 ? (code < 32 ? code + 64 : code - 32) : null;
  return code >= 32 && code <= 127 ? code - 32 : null;
}

/**
 * The shortest list of Code 128 symbol values (start code, data, check symbol) for a text, found by dynamic programming
 * over "which subset am I in" at each position. When two answers are equally short, set A is preferred over B over C
 * at the start, which keeps the textbook example PJJ123C identical to the one in the standard's explanation.
 */
export function code128Values(text: string): number[] {
  const n = text.length;
  if (n === 0) throw new BarcodeError("Enter the text to encode.");
  const codes: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    if (c > 127) {
      throw new BarcodeError(`Code 128 holds plain ASCII characters only (codes 0 to 127). "${text[i]}" at position ${i + 1} is outside that range. Use a QR code for other characters.`);
    }
    codes.push(c);
  }
  const INF = 1e9;
  const subsets: Subset[] = ["A", "B", "C"];
  const at = { A: 0, B: 1, C: 2 } as const;
  const pairAt = (i: number) => i + 1 < n && isDigit(codes[i] as number) && isDigit(codes[i + 1] as number);

  // best[i][s]: fewest symbols to encode codes[i..] when already in subset s.
  const best: number[][] = Array.from({ length: n + 3 }, () => [INF, INF, INF]);
  best[n] = [0, 0, 0];

  type Direct = { cost: number; kind: "emit" | "pair" | "shift" | "none" };
  /** The cheapest way to consume the next character (or digit pair) without changing subset first. */
  const direct = (i: number, s: Subset): Direct => {
    const c = codes[i] as number;
    if (s === "C") return pairAt(i) ? { cost: 1 + (best[i + 2] as number[])[at.C]!, kind: "pair" } : { cost: INF, kind: "none" };
    if (valueIn(s, c) !== null) return { cost: 1 + (best[i + 1] as number[])[at[s]]!, kind: "emit" };
    // Not in this subset: one character can be shifted in from the other of A and B.
    const other: "A" | "B" = s === "A" ? "B" : "A";
    if (valueIn(other, c) !== null) return { cost: 2 + (best[i + 1] as number[])[at[s]]!, kind: "shift" };
    return { cost: INF, kind: "none" };
  };

  type Step = { switchTo?: Subset; kind: "emit" | "pair" | "shift" | "none" };
  const choice: Step[][] = Array.from({ length: n }, () => [{ kind: "none" }, { kind: "none" }, { kind: "none" }]);
  for (let i = n - 1; i >= 0; i--) {
    const here: Record<Subset, Direct> = { A: direct(i, "A"), B: direct(i, "B"), C: direct(i, "C") };
    for (const s of subsets) {
      let cost = here[s].cost;
      let step: Step = { kind: here[s].kind };
      // A switch costs one symbol. Chains of switches are never shorter than a single one.
      for (const t of subsets) {
        if (t !== s && 1 + here[t].cost < cost) {
          cost = 1 + here[t].cost;
          step = { switchTo: t, kind: here[t].kind };
        }
      }
      (best[i] as number[])[at[s]] = cost;
      (choice[i] as Step[])[at[s]] = step;
    }
  }

  // The start code names the first subset, so no switch is needed there. Ties prefer A, then B, then C.
  let start: Subset = "A";
  for (const s of subsets) if (direct(0, s).cost < direct(0, start).cost) start = s;
  if (direct(0, start).cost >= INF) throw new BarcodeError("This text cannot be written as Code 128.");

  const values: number[] = [start === "A" ? START_A : start === "B" ? START_B : START_C];
  let i = 0;
  let current: Subset = start;
  // First step uses the direct move in the start subset; later steps follow the table.
  let first = true;
  while (i < n) {
    const step: Step = first ? { kind: direct(0, start).kind } : ((choice[i] as Step[])[at[current]] as Step);
    first = false;
    if (step.switchTo) {
      values.push(step.switchTo === "A" ? CODE_A : step.switchTo === "B" ? CODE_B : CODE_C);
      current = step.switchTo;
    }
    const c = codes[i] as number;
    if (step.kind === "pair") {
      values.push(Number(text.slice(i, i + 2)));
      i += 2;
    } else if (step.kind === "shift") {
      const other: "A" | "B" = current === "A" ? "B" : "A";
      values.push(SHIFT, valueIn(other, c) as number);
      i++;
    } else if (step.kind === "emit") {
      values.push(valueIn(current as "A" | "B", c) as number);
      i++;
    } else {
      throw new BarcodeError("This text cannot be written as Code 128.");
    }
  }
  values.push(code128Checksum(values));
  return values;
}

/** (start value + each data symbol times its position) modulo 103. */
export function code128Checksum(valuesWithoutCheck: readonly number[]): number {
  let sum = valuesWithoutCheck[0] as number;
  for (let i = 1; i < valuesWithoutCheck.length; i++) sum += (valuesWithoutCheck[i] as number) * i;
  return sum % 103;
}

function patternToModules(pattern: string, startsWithBar = true): string {
  let out = "";
  let bar = startsWithBar;
  for (const w of pattern) {
    out += (bar ? "1" : "0").repeat(Number(w));
    bar = !bar;
  }
  return out;
}

function code128(input: string): Barcode {
  if (input.length > BARCODE_LIMITS.code128) throw new BarcodeError(`That is ${input.length} characters. Code 128 here is limited to ${BARCODE_LIMITS.code128}; a long code is also hard to scan.`);
  const values = code128Values(input);
  const modules = [...values, STOP].map((v) => patternToModules(CODE128_PATTERNS[v] as string)).join("");
  const printable = [...input].every((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127);
  const notes: string[] = [];
  if (!printable) notes.push("The text has control characters, so the printed line below the bars is left out.");
  if (input.length > 40) notes.push("Long Code 128 codes are wide and hard to scan. Consider a QR code.");
  return {
    type: "code128",
    data: input,
    modules,
    quiet: { left: 10, right: 10 },
    labels: printable ? [{ text: input, from: 0, to: modules.length }] : [],
    guards: [],
    notes,
  };
}

/* ----------------------------------------------------------------------------------------------- */
/* Code 39                                                                                          */
/* ----------------------------------------------------------------------------------------------- */

/** n = narrow, w = wide; the nine elements alternate bar, space, bar… starting with a bar. */
export const CODE39_PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw",
  "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn",
  F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn",
  P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn",
  Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
  $: "nwnwnwnnn", "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn",
};

const CODE39_ORDER = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";
const WIDE = 3;

function widthsToModules(widths: string, wide: number): string {
  let out = "";
  let bar = true;
  for (const w of widths) {
    out += (bar ? "1" : "0").repeat(w === "w" ? wide : 1);
    bar = !bar;
  }
  return out;
}

function code39(input: string, check: boolean): Barcode {
  const notes: string[] = [];
  if (input.length > BARCODE_LIMITS.code39) throw new BarcodeError(`That is ${input.length} characters. Code 39 here is limited to ${BARCODE_LIMITS.code39}.`);
  let text = input;
  if (/[a-z]/.test(text)) {
    text = text.toUpperCase();
    notes.push("Code 39 has no lower-case letters, so the text was made upper case.");
  }
  for (const ch of text) {
    if (ch === "*") throw new BarcodeError('The * is the start and stop mark of Code 39 and cannot be part of the text.');
    if (!(ch in CODE39_PATTERNS)) {
      throw new BarcodeError(`"${ch}" cannot be written in Code 39. It holds capital letters, digits, space and - . $ / + % only. Use Code 128 for other characters.`);
    }
  }
  let data = text;
  if (check) {
    let sum = 0;
    for (const ch of text) sum += CODE39_ORDER.indexOf(ch);
    const mark = CODE39_ORDER[sum % 43] as string;
    data = text + mark;
    notes.push(`The check character "${mark === " " ? "space" : mark}" (modulo 43) was added.`);
  }
  const symbols = `*${data}*`;
  // Characters are separated by one narrow space.
  const modules = [...symbols].map((ch) => widthsToModules(CODE39_PATTERNS[ch] as string, WIDE)).join("0");
  return {
    type: "code39",
    data,
    modules,
    quiet: { left: 10, right: 10 },
    labels: [{ text: `*${data}*`, from: 0, to: modules.length }],
    guards: [],
    notes,
  };
}

/* ----------------------------------------------------------------------------------------------- */
/* Interleaved 2 of 5 and ITF-14                                                                    */
/* ----------------------------------------------------------------------------------------------- */

/** Narrow/wide widths for digits 0 to 9: exactly two of the five are wide. */
export const ITF_PATTERNS = ["nnwwn", "wnnnw", "nwnnw", "wwnnn", "nnwnw", "wnwnn", "nwwnn", "nnnww", "wnnwn", "nwnwn"] as const;

function itfModules(digits: string): string {
  let out = "1010"; // start: narrow bar, narrow space, narrow bar, narrow space
  for (let i = 0; i < digits.length; i += 2) {
    const bars = ITF_PATTERNS[Number(digits[i])] as string;
    const spaces = ITF_PATTERNS[Number(digits[i + 1])] as string;
    for (let k = 0; k < 5; k++) {
      out += "1".repeat(bars[k] === "w" ? WIDE : 1);
      out += "0".repeat(spaces[k] === "w" ? WIDE : 1);
    }
  }
  return out + "11101"; // stop: wide bar, narrow space, narrow bar
}

function itf(input: string, type: "itf" | "itf14"): Barcode {
  const notes: string[] = [];
  let data = input;
  if (type === "itf14") {
    const r = withCheckDigit(input, 13, "ITF-14");
    data = r.data;
    if (r.added) notes.push(`The check digit ${data[13]} was added.`);
  } else {
    if (!/^[0-9]+$/.test(input)) throw new BarcodeError("Interleaved 2 of 5 uses digits only (0 to 9).");
    if (input.length > BARCODE_LIMITS.itf) throw new BarcodeError(`That is ${input.length} digits. This tool allows up to ${BARCODE_LIMITS.itf}.`);
    if (input.length % 2 === 1) {
      data = `0${input}`;
      notes.push("Digits are encoded in pairs, so a 0 was put in front to make the count even.");
    }
  }
  if (data.length < 6) notes.push("Many scanners ignore Interleaved 2 of 5 codes shorter than 6 digits. Use Code 128 for short values.");
  const modules = itfModules(data);
  return {
    type,
    data,
    modules,
    quiet: { left: 10, right: 10 },
    labels: [{ text: data, from: 0, to: modules.length }],
    guards: [],
    notes,
  };
}

/* ----------------------------------------------------------------------------------------------- */
/* Putting it together                                                                              */
/* ----------------------------------------------------------------------------------------------- */

export interface EncodeOptions {
  /** Add a modulo-43 check character to Code 39. */
  code39Check?: boolean;
}

/** Encodes text as a barcode. Throws a `BarcodeError` with a plain-language reason when the text does not fit the type. */
export function encodeBarcode(type: BarcodeType, input: string, options: EncodeOptions = {}): Barcode {
  if (typeof input !== "string") throw new BarcodeError("Enter the text to encode.");
  // Leading and trailing spaces are almost always an accident; Code 128 and Code 39 can still hold inner spaces.
  const text = type === "code128" || type === "code39" ? input.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "") : input.replace(/[\s-]/g, "");
  if (text === "") throw new BarcodeError("Enter the text or number to encode.");
  switch (type) {
    case "code128":
      return code128(text);
    case "ean13":
    case "upca":
    case "ean8":
      return eanLike(type, text);
    case "code39":
      return code39(text, options.code39Check === true);
    case "itf":
    case "itf14":
      return itf(text, type);
    default:
      throw new BarcodeError(`Unknown barcode type "${String(type)}".`);
  }
}

/* ----------------------------------------------------------------------------------------------- */
/* Drawing                                                                                          */
/* ----------------------------------------------------------------------------------------------- */

export interface SvgStyle {
  /** Width of the narrowest bar, in pixels. */
  moduleWidth: number;
  /** Height of the bars, in pixels. */
  barHeight: number;
  /** Quiet zone in modules on each side; never less than the type needs. */
  quietZone: number;
  showText: boolean;
  foreground: string;
  background: string;
  fontSize: number;
}

export const DEFAULT_SVG_STYLE: SvgStyle = { moduleWidth: 2, barHeight: 80, quietZone: 10, showText: true, foreground: "#000000", background: "#ffffff", fontSize: 14 };

export const SVG_LIMITS = { moduleWidth: { min: 0.5, max: 12 }, barHeight: { min: 10, max: 600 }, quietZone: { min: 0, max: 40 }, fontSize: { min: 8, max: 48 } } as const;

const COLOUR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const clamp = (n: number, min: number, max: number, fallback: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback);

// Control characters cannot be written in XML at all (not even as references), so they are shown as a middle dot.
// eslint-disable-next-line no-control-regex
const xml = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "·").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const num = (n: number) => String(Math.round(n * 1000) / 1000);

export interface DrawnBarcode {
  svg: string;
  width: number;
  height: number;
}

/** Draws a barcode as an SVG string made of plain rectangles. Colours must be #rgb or #rrggbb. */
export function barcodeToSvg(barcode: Barcode, style: Partial<SvgStyle> = {}): DrawnBarcode {
  const s = { ...DEFAULT_SVG_STYLE, ...style };
  if (!COLOUR.test(s.foreground) || !COLOUR.test(s.background)) throw new BarcodeError("Colours must be written as #rgb or #rrggbb.");
  const mw = clamp(s.moduleWidth, SVG_LIMITS.moduleWidth.min, SVG_LIMITS.moduleWidth.max, DEFAULT_SVG_STYLE.moduleWidth);
  const barHeight = clamp(s.barHeight, SVG_LIMITS.barHeight.min, SVG_LIMITS.barHeight.max, DEFAULT_SVG_STYLE.barHeight);
  const fontSize = clamp(s.fontSize, SVG_LIMITS.fontSize.min, SVG_LIMITS.fontSize.max, DEFAULT_SVG_STYLE.fontSize);
  const quietLeft = Math.max(barcode.quiet.left, Math.round(clamp(s.quietZone, SVG_LIMITS.quietZone.min, SVG_LIMITS.quietZone.max, DEFAULT_SVG_STYLE.quietZone)));
  const quietRight = Math.max(barcode.quiet.right, Math.round(clamp(s.quietZone, SVG_LIMITS.quietZone.min, SVG_LIMITS.quietZone.max, DEFAULT_SVG_STYLE.quietZone)));
  const text = s.showText && barcode.labels.length > 0;
  const textArea = text ? Math.round(fontSize * 1.5) : 0;
  // Guard bars of EAN and UPC reach down half the text area.
  const guardExtra = text && barcode.guards.length > 0 ? Math.round(textArea * 0.5) : 0;
  const width = (quietLeft + barcode.modules.length + quietRight) * mw;
  const height = barHeight + textArea;

  const inGuard = (m: number) => barcode.guards.some(([a, b]) => m >= a && m < b);
  const rects: string[] = [];
  const modules = barcode.modules;
  for (let i = 0; i < modules.length; ) {
    if (modules[i] !== "1") {
      i++;
      continue;
    }
    // Merge neighbouring bar modules into one rectangle, but split at guard edges so guards can be taller.
    let j = i;
    const guard = inGuard(i);
    while (j < modules.length && modules[j] === "1" && inGuard(j) === guard) j++;
    const x = (quietLeft + i) * mw;
    rects.push(`<rect x="${num(x)}" y="0" width="${num((j - i) * mw)}" height="${num(barHeight + (guard ? guardExtra : 0))}"/>`);
    i = j;
  }

  const labels: string[] = [];
  if (text) {
    const y = barHeight + textArea * 0.5 + fontSize * 0.35 + (guardExtra ? guardExtra * 0.2 : 0);
    // EAN and UPC print each digit centred under its own seven bars; the others print one centred line.
    const perDigit = barcode.guards.length > 0;
    for (const label of barcode.labels) {
      if (perDigit && label.text.length > 1) {
        const cell = (label.to - label.from) / label.text.length;
        [...label.text].forEach((ch, k) => {
          const cx = (quietLeft + label.from + cell * (k + 0.5)) * mw;
          labels.push(`<text x="${num(cx)}" y="${num(y)}" text-anchor="middle" font-size="${num(fontSize)}">${xml(ch)}</text>`);
        });
      } else {
        const cx = (quietLeft + (label.from + label.to) / 2) * mw;
        labels.push(`<text x="${num(cx)}" y="${num(y)}" text-anchor="middle" font-size="${num(fontSize)}">${xml(label.text)}</text>`);
      }
    }
  }

  const description = `${barcode.type} barcode: ${barcode.data}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(height)}" viewBox="0 0 ${num(width)} ${num(height)}" role="img" aria-label="${xml(description)}">` +
    `<title>${xml(description)}</title>` +
    `<rect width="100%" height="100%" fill="${s.background}"/>` +
    `<g fill="${s.foreground}" shape-rendering="crispEdges" transform="translate(0 0)">${rects.join("")}</g>` +
    (labels.length ? `<g fill="${s.foreground}" font-family="ui-monospace, Menlo, Consolas, monospace">${labels.join("")}</g>` : "") +
    `</svg>`;
  return { svg, width, height };
}

/** Number of narrow-bar widths the code is wide, which is what printing size depends on. */
export function moduleCount(barcode: Barcode): number {
  return barcode.modules.length;
}

/** Contrast problems that stop scanners reading a code: a light bar colour, or little difference from the background. */
export function contrastWarning(foreground: string, background: string): string | null {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!COLOUR.test(foreground) || !COLOUR.test(background) || !fg || !bg) return null;
  const ratio = contrastRatio(fg, bg);
  if (relativeLuminance(fg) > relativeLuminance(bg)) return "The bars are lighter than the background. Most scanners need dark bars on a light background.";
  if (ratio < 4) return `The bars and background are too close in brightness (contrast ${ratio.toFixed(1)} to 1). Scanners may not read this. Use dark bars on a light background.`;
  return null;
}
