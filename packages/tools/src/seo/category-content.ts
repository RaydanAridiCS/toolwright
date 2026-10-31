import type { CategoryId } from "../define";

/**
 * Search-facing copy for each category landing page. These pages aim at head terms such as "free pdf tools".
 * `intro` is 100-200 words in total, written for people (and answer engines) who have not seen the tools yet.
 */
export interface CategoryContent {
  /** Page H1. */
  h1: string;
  /** Title without the brand, 25-47 characters. */
  seoTitle: string;
  /** Meta description, 110-160 characters. */
  seoDescription: string;
  /** Paragraphs shown under the H1. */
  intro: string[];
}

export const CATEGORY_CONTENT: Record<CategoryId, CategoryContent> = {
  pdf: {
    h1: "Free PDF tools that run in your browser",
    seoTitle: "Free PDF Tools: Merge, Split, Compress, Sign",
    seoDescription: "Free online PDF tools: merge, split, compress, rotate, sign and convert PDFs. No upload, no sign-up, no watermark. Files stay on your device.",
    intro: [
      "These PDF tools do the everyday jobs: merge several files into one, split a PDF into parts, pull out or delete pages, rotate sideways scans, compress a large file, add page numbers or a watermark, sign a document, and turn pages into pictures or text.",
      "Everything runs in your browser. Your PDF is read from your disk into the page's memory, changed there and saved back to your disk, so nothing is uploaded, you do not sign up, and the results carry no watermark of ours.",
      "Because the work happens on your device, very large files are limited by your device's memory, and a few jobs have honest limits that each tool page spells out: Compress PDF cannot make a file bigger, PDF to Text cannot read a scan, and Sign PDF adds a visible signature, not a certified digital one.",
    ],
  },
  image: {
    h1: "Free online image tools with no upload",
    seoTitle: "Free Online Image Tools: Compress, Resize, Crop",
    seoDescription: "Free image tools that run in your browser: compress, resize, crop, convert, strip EXIF data and edit GIFs. No upload and no sign-up.",
    intro: [
      "This drawer covers the common picture jobs: compress JPG, PNG and WebP files, resize photos, crop and straighten them, convert between formats, read or remove the hidden EXIF data, turn a picture into Base64 or SVG, convert SVG to PNG, and make or edit animated GIFs.",
      "Your pictures are opened by your own browser and processed in the page, so they are never uploaded. There is no account, and nothing is added to the result. You can check this in your browser's Network tab while you work.",
      "A few things are worth knowing. JPG and WebP are lossy, so each save at a lower quality loses some detail. PNG is lossless, so it only gets smaller if you resize or switch format. And limits such as the largest picture a browser can draw depend on your device, so very large images can be refused.",
    ],
  },
  developer: {
    h1: "Free developer tools that never see your code",
    seoTitle: "Free Developer Tools: Format, Decode, Test",
    seoDescription: "Free online developer tools: JSON formatter, JWT decoder, regex tester, subnet calculator, cURL converter and more. Runs in your browser.",
    intro: [
      "Format and validate JSON, YAML, XML, SQL and GraphQL. Decode a JWT, test a regular expression or a JSONPath, explain a cron schedule or a set of HTTP headers, convert between cURL and fetch, work out subnets, generate TypeScript from JSON, and sanitize SVG or turn it into React components and data URIs.",
      "These are the tools people paste real work into: tokens, queries, configuration, headers. That is why they run in your browser and send nothing anywhere. The page can only talk to its own origin, which the browser enforces, and you can confirm it in the Network tab.",
      "Each tool says what it does not do. The XML formatter checks well-formedness, not schema validity. The JWT decoder verifies HMAC signatures, not RSA ones. The regex tester uses the JavaScript engine, so other flavors can differ in the details.",
    ],
  },
  text: {
    h1: "Free online text tools",
    seoTitle: "Free Online Text Tools: Count, Clean, Compare",
    seoDescription: "Free text tools: word counter, case converter, text diff, find and replace, sort lines and more. They run in your browser, so your text stays private.",
    intro: [
      "Count words and characters, change text case, compare two versions of a document, find and replace in bulk, sort and deduplicate lists, clean up stray spaces and line breaks, reverse text, make URL slugs, check readability and turn HTML into Markdown.",
      "Text is often private: drafts, contracts, customer lists, code. These tools process it in your browser and never send it anywhere, so you can paste what you would not paste into a form on a website you do not know.",
      "They are plain tools for plain jobs, with sensible defaults so they work the moment you paste. Where a result is only a guide, such as a readability score, the tool page says so.",
    ],
  },
  data: {
    h1: "Free data converters for JSON, YAML and CSV",
    seoTitle: "Free Data Converters: JSON, YAML and CSV",
    seoDescription: "Convert JSON to CSV, CSV to JSON, JSON to YAML, YAML to JSON, change CSV delimiters and make Markdown tables. Free, in your browser.",
    intro: [
      "Move data between the formats you actually meet: JSON to CSV and back, JSON to YAML and back, CSV to TSV or from a semicolon-separated export to commas, and spreadsheet cells to a Markdown table.",
      "The conversion runs in your browser, so a configuration file with secrets in it, or a customer export, stays on your device. Quoting is kept intact, and each tool reports an error you can act on when the input is not valid.",
      "Converting between formats can lose information, because the formats do not hold the same things. CSV has no nesting, so nested JSON is flattened into dotted column names, and YAML comments do not survive a trip through JSON. The tool pages say what happens.",
    ],
  },
  encoding: {
    h1: "Free encoders, decoders and hash generators",
    seoTitle: "Free Encoders and Hash Generators Online",
    seoDescription: "Base64, URL and HTML entity encoding, MD5 and SHA-256 hashes, Unicode escapes, hex and binary. Free, and everything runs in your browser.",
    intro: [
      "Encode and decode Base64 and URLs, escape and unescape HTML entities, strings and Unicode, turn text into hex or binary, compute MD5, SHA-1, SHA-256 and other hashes of text or files, and try classic puzzle ciphers such as ROT13 and Morse code.",
      "Encoding is not encryption. Base64, percent-encoding and the ciphers here hide nothing from anyone who wants to read the data, and MD5 and SHA-1 are not suitable for protecting passwords. The tool pages say when a result is only a representation.",
      "Hashes of files are computed in your browser, so a file never has to be uploaded to check its checksum.",
    ],
  },
  design: {
    h1: "Free color, SVG and QR code tools",
    seoTitle: "Free Color, SVG and QR Code Tools Online",
    seoDescription: "Convert colors, check WCAG contrast, build palettes, make QR codes and favicons, and edit, optimize and recolor SVG. Free, in your browser.",
    intro: [
      "Convert colors between HEX, RGB, HSL and OKLCH, pick colors from an image, check WCAG contrast, build a color scale from one base color, make QR codes and a favicon pack, and work with SVG: edit, optimize, recolor, transform paths and generate shapes.",
      "Your images and SVG files are processed in your browser and are never uploaded. QR codes are static, so they never expire and nothing redirects through a tracking service.",
      "A contrast ratio tells you whether text is legible against its background, but it does not replace testing with real users. The tools show you the numbers and what they mean.",
    ],
  },
  generators: {
    h1: "Free generators: passwords, UUIDs, barcodes and text",
    seoTitle: "Free Generators: Passwords, UUIDs, Barcodes",
    seoDescription: "Generate strong passwords, UUIDs, ULIDs, barcodes and lorem ipsum text. Free, and everything is made in your browser with no sign-up.",
    intro: [
      "Make a strong random password or passphrase, generate UUIDs, ULIDs and NanoIDs in bulk, create Code 128, EAN and UPC barcodes as SVG or PNG, or produce placeholder text for a layout.",
      "Everything is generated on your device. Passwords and identifiers use your browser's cryptographic random number generator, and nothing you generate is sent or stored, so a password never leaves the page you made it on.",
      "A few honest notes: a barcode generator can draw any valid-looking number, but real product numbers come from GS1, and the strength of a generated password is shown as entropy in bits, so you can judge it yourself.",
    ],
  },
  calculators: {
    h1: "Free online calculators and converters",
    seoTitle: "Free Online Calculators and Converters",
    seoDescription: "Free calculators: loan, mortgage, percentage, date, BMI, tip, unit converter, time zone converter and more. Calculated in your browser.",
    intro: [
      "Work out a loan payment or what home you can afford, compound interest, a percentage, the days between two dates, a tip, a BMI, a unit price or an hourly rate. Convert units, time zones, number bases and Roman numerals, and spell numbers out in words.",
      "The numbers are calculated in your browser and are not stored or sent. Where a calculator can only illustrate, such as compound interest or affordability, the page says what it leaves out, like taxes, fees and inflation.",
      "These are quick calculators, not financial, legal or medical advice. Check anything important with a professional before you act on it.",
    ],
  },
};
