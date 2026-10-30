/**
 * Convert HTML to Markdown (GitHub-flavoured: tables, task lists, fenced code).
 *
 * The converter walks a parsed DOM tree. It uses DOM *types* and `DOMParser` only inside `htmlToMarkdown`,
 * which browsers and jsdom provide; scripts, styles and event handlers are dropped and never run.
 */

export interface HtmlToMarkdownOptions {
  /** Marker for bullet lists (default `-`). */
  bullet?: "-" | "*" | "+";
  /** Keep links as `[text](url)`. When false only the link text is kept. Default true. */
  links?: boolean;
  /** Keep images as `![alt](src)`. When false they are dropped. Default true. */
  images?: boolean;
}

interface Config {
  bullet: string;
  links: boolean;
  images: boolean;
}

interface Block {
  text: string;
  list?: boolean;
}

const SKIP = new Set(["script", "style", "noscript", "template", "head", "iframe", "object", "embed", "svg", "canvas", "select", "button", "textarea", "meta", "link", "title"]);
const BLOCK = new Set([
  "address", "article", "aside", "blockquote", "body", "details", "dd", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "html", "main", "nav", "ol", "p", "pre", "section", "summary", "table", "ul",
]);

const MAX_INPUT = 5_000_000;

/** Convert an HTML string. Needs `DOMParser` (available in browsers and jsdom). */
export function htmlToMarkdown(html: string, options: HtmlToMarkdownOptions = {}): string {
  if (!html.trim()) return "";
  if (html.length > MAX_INPUT) throw new Error("That is too much HTML for one go. Convert it in smaller pieces.");
  if (typeof DOMParser === "undefined") throw new Error("This browser cannot parse HTML.");
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return nodeToMarkdown(doc.body, options);
  } catch (err) {
    // Some parsers recurse on nesting too, so a stack overflow can come from here as well.
    if (err instanceof RangeError) throw new Error("The HTML is nested too deeply to convert.");
    throw err;
  }
}

/** Convert an already parsed DOM node (usually `document.body`). */
export function nodeToMarkdown(root: Node, options: HtmlToMarkdownOptions = {}): string {
  const config: Config = { bullet: options.bullet ?? "-", links: options.links ?? true, images: options.images ?? true };
  try {
    const blocks = renderBlocks(root, config);
    return blocks
      .map((b) => b.text)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch (err) {
    if (err instanceof RangeError) throw new Error("The HTML is nested too deeply to convert.");
    throw err;
  }
}

const tag = (node: Node) => (node.nodeType === 1 ? (node as Element).tagName.toLowerCase() : "");

/** Walk the children of a container, grouping inline content into paragraphs and keeping block elements apart. */
function renderBlocks(container: Node, cfg: Config): Block[] {
  const blocks: Block[] = [];
  let inline = "";
  const flush = () => {
    // Tidy the spaces around line breaks but keep the two trailing spaces that mean a hard break.
    const text = escapeLineStart(inline.replace(/( {2,})?[ \t]*\n[ \t]*/g, (_m, hard?: string) => (hard ? "  \n" : "\n")).trim());
    if (text) blocks.push({ text });
    inline = "";
  };
  container.childNodes.forEach((child) => {
    const name = tag(child);
    if (child.nodeType === 1 && BLOCK.has(name) && !SKIP.has(name)) {
      flush();
      blocks.push(...renderBlock(child as Element, name, cfg));
    } else inline += renderInline(child, cfg);
  });
  flush();
  return blocks;
}

function renderBlock(el: Element, name: string, cfg: Config): Block[] {
  switch (name) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const text = inlineText(el, cfg).replace(/\s*\n\s*/g, " ").trim();
      return text ? [{ text: `${"#".repeat(Number(name[1]))} ${text}` }] : [];
    }
    case "hr":
      return [{ text: "---" }];
    case "pre":
      return [{ text: fencedCode(el) }];
    case "blockquote": {
      const inner = renderBlocks(el, cfg).map((b) => b.text).join("\n\n");
      return inner ? [{ text: inner.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n") }] : [];
    }
    case "ul":
    case "ol":
      return [renderList(el, name === "ol", cfg)].filter((b) => b.text);
    case "table": {
      const text = renderTable(el, cfg);
      return text ? [{ text }] : [];
    }
    case "dt": {
      const text = inlineText(el, cfg).trim();
      return text ? [{ text: `**${text}**` }] : [];
    }
    case "details":
    case "figure":
      return renderBlocks(el, cfg);
    default:
      // div, section, p, article, ...: the children decide. A <p> is just a container whose inline text becomes one paragraph.
      return renderBlocks(el, cfg);
  }
}

function inlineText(el: Node, cfg: Config): string {
  let out = "";
  el.childNodes.forEach((c) => {
    out += renderInline(c, cfg);
  });
  return out;
}

function renderInline(node: Node, cfg: Config): string {
  if (node.nodeType === 3) return escapeText((node.textContent ?? "").replace(/[\s\u00a0]+/g, " "));
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  const name = tag(el);
  if (SKIP.has(name)) return "";
  if (BLOCK.has(name)) {
    // A block nested inside inline content (for example a <div> inside <a>): keep its text on its own lines.
    const inner = renderBlocks(el, cfg).map((b) => b.text).join("\n\n");
    return inner ? `\n\n${inner}\n\n` : "";
  }
  switch (name) {
    case "br":
      return "  \n";
    case "strong":
    case "b":
      return wrap("**", inlineText(el, cfg));
    case "em":
    case "i":
    case "cite":
      return wrap("*", inlineText(el, cfg));
    case "del":
    case "s":
    case "strike":
      return wrap("~~", inlineText(el, cfg));
    case "code":
    case "kbd":
    case "samp":
    case "tt":
      return inlineCode(el.textContent ?? "");
    case "a": {
      const text = inlineText(el, cfg).trim();
      const href = safeUrl(el.getAttribute("href"));
      if (!cfg.links || !href || !text) return text;
      const title = el.getAttribute("title");
      return `[${text}](${href}${title ? ` "${title.replace(/"/g, '\\"')}"` : ""})`;
    }
    case "img": {
      if (!cfg.images) return "";
      const src = safeUrl(el.getAttribute("src"));
      if (!src) return "";
      const alt = (el.getAttribute("alt") ?? "").replace(/[[\]]/g, "").trim();
      const title = el.getAttribute("title");
      return `![${alt}](${src}${title ? ` "${title.replace(/"/g, '\\"')}"` : ""})`;
    }
    case "input":
      return el.getAttribute("type") === "checkbox" ? ((el as HTMLInputElement).checked || el.hasAttribute("checked") ? "[x]" : "[ ]") : "";
    default:
      return inlineText(el, cfg);
  }
}

/** Put the markers against the words: `** bold **` is not bold in Markdown. */
function wrap(marker: string, inner: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner) as RegExpExecArray;
  return m[2] ? `${m[1]}${marker}${m[2]}${marker}${m[3]}` : inner;
}

function inlineCode(text: string): string {
  const flat = text.replace(/\s*\n\s*/g, " ");
  if (!flat.trim()) return "";
  const longest = Math.max(0, ...(flat.match(/`+/g) ?? []).map((r) => r.length));
  const fence = "`".repeat(longest + 1);
  const pad = flat.startsWith("`") || flat.endsWith("`") ? " " : "";
  return `${fence}${pad}${flat}${pad}${fence}`;
}

function fencedCode(pre: Element): string {
  const code = pre.querySelector("code");
  const text = (code ?? pre).textContent?.replace(/\r\n/g, "\n").replace(/\n+$/, "") ?? "";
  const lang = /(?:^|\s)(?:language|lang)-([\w+#-]+)/.exec(`${code?.className ?? ""} ${pre.className}`)?.[1] ?? "";
  const longest = Math.max(0, ...(text.match(/^`{3,}/gm) ?? []).map((r) => r.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${text}\n${fence}`;
}

function renderList(list: Element, ordered: boolean, cfg: Config): Block {
  const start = ordered ? Number.parseInt(list.getAttribute("start") ?? "1", 10) || 1 : 1;
  const items: string[] = [];
  let n = start;
  list.childNodes.forEach((child) => {
    if (tag(child) !== "li") return;
    const marker = ordered ? `${n}. ` : `${cfg.bullet} `;
    n++;
    const blocks = renderBlocks(child, cfg);
    const body = blocks.map((b, i) => (i === 0 ? b.text : `${blocks[i - 1]?.list || b.list ? "\n" : "\n\n"}${b.text}`)).join("");
    const pad = " ".repeat(marker.length);
    const lines = (body || "").split("\n").map((line, i) => (i === 0 ? marker + line : line ? pad + line : ""));
    items.push(lines.join("\n"));
  });
  const loose = items.some((item) => item.includes("\n\n"));
  return { text: items.join(loose ? "\n\n" : "\n"), list: true };
}

function renderTable(table: Element, cfg: Config): string {
  const rows = Array.from(table.querySelectorAll("tr")).filter((tr) => tr.closest("table") === table);
  const grid = rows.map((tr) =>
    Array.from(tr.children)
      .filter((c) => c.tagName === "TH" || c.tagName === "TD")
      .map((cell) => ({
        text: inlineText(cell, cfg).replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|").trim(),
        align: (cell.getAttribute("align") ?? /text-align:\s*(left|right|center)/i.exec(cell.getAttribute("style") ?? "")?.[1] ?? "").toLowerCase(),
        span: Math.max(1, Number.parseInt(cell.getAttribute("colspan") ?? "1", 10) || 1),
      })),
  );
  const filled = grid.filter((r) => r.length);
  if (!filled.length) return "";
  const widthOf = (r: (typeof grid)[number]) => r.reduce((sum, c) => sum + c.span, 0);
  const cols = Math.min(50, Math.max(...filled.map(widthOf)));
  const cells = (r: (typeof grid)[number]) => {
    const out: string[] = [];
    for (const c of r) {
      out.push(c.text);
      for (let i = 1; i < c.span; i++) out.push("");
    }
    while (out.length < cols) out.push("");
    return out.slice(0, cols);
  };
  const header = filled[0] as (typeof grid)[number];
  const aligns = cells(header.map((c) => ({ ...c, text: c.align }))).map((a) => (a === "center" ? ":---:" : a === "right" ? "---:" : a === "left" ? ":---" : "---"));
  const line = (r: string[]) => `| ${r.join(" | ")} |`;
  return [line(cells(header)), line(aligns), ...filled.slice(1).map((r) => line(cells(r)))].join("\n");
}

function safeUrl(url: string | null): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed || /^(javascript|vbscript|data:text\/html)/i.test(trimmed)) return "";
  return trimmed.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
}

function escapeText(text: string): string {
  return text
    .replace(/[\\`*[\]]/g, "\\$&")
    .replace(/(^|[^\p{L}\p{N}])_|_(?=[^\p{L}\p{N}]|$)/gu, (m) => m.replace("_", "\\_"))
    .replace(/<(?=[A-Za-z/!])/g, "\\<");
}

/** A paragraph that starts like Markdown syntax would be read as syntax: escape its first character. */
function escapeLineStart(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^(\s*)(#{1,6}(?=\s)|[>+-](?=\s)|(\d+)(?=[.)]\s))/, (_m, ws: string, lead: string, digits?: string) => (digits ? `${ws}${lead}\\` : `${ws}\\${lead}`)))
    .join("\n");
}
