/**
 * A Dockerfile linter: reads a Dockerfile as text and reports common mistakes and risky habits, each with the line
 * it is on and a suggested fix. It never builds or runs anything. Keep this file free of React, the DOM and the network.
 */

export type Severity = "error" | "warning" | "info";

export interface Finding {
  /** Line where the instruction starts, counting from 1. */
  line: number;
  rule: string;
  severity: Severity;
  message: string;
  /** What to do about it. */
  fix?: string;
}

export interface Instruction {
  /** Upper-case name, such as RUN. */
  name: string;
  /** Everything after the name, with line continuations joined into one line. */
  args: string;
  line: number;
  endLine: number;
}

export interface LintResult {
  findings: Finding[];
  instructions: Instruction[];
  counts: Record<Severity, number>;
  /** Number of build stages (FROM lines). */
  stages: number;
}

const KNOWN = new Set(["FROM", "RUN", "CMD", "LABEL", "MAINTAINER", "EXPOSE", "ENV", "ADD", "COPY", "ENTRYPOINT", "VOLUME", "USER", "WORKDIR", "ARG", "ONBUILD", "STOPSIGNAL", "HEALTHCHECK", "SHELL"]);

/** Read the instructions of a Dockerfile, joining lines that end in a backslash. */
export function parseDockerfile(source: string): { instructions: Instruction[]; problems: Finding[] } {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const instructions: Instruction[] = [];
  const problems: Finding[] = [];
  let escape = "\\";
  let i = 0;

  // Parser directives (# escape=`) may only appear before everything else.
  while (i < lines.length) {
    const m = /^\s*#\s*(\w+)\s*=\s*(\S+)\s*$/.exec(lines[i] as string);
    if (!m) break;
    if ((m[1] as string).toLowerCase() === "escape") escape = m[2] as string;
    i++;
  }
  i = 0;

  while (i < lines.length) {
    const raw = lines[i] as string;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }
    const start = i;
    let text = raw;
    while (text.trimEnd().endsWith(escape) && i + 1 < lines.length) {
      text = text.trimEnd().slice(0, -escape.length).trimEnd();
      i++;
      // Comments and blank lines inside a continued instruction are skipped.
      while (i < lines.length && ((lines[i] as string).trim().startsWith("#") || !(lines[i] as string).trim())) {
        if (i + 1 >= lines.length) break;
        i++;
      }
      text += ` ${(lines[i] as string).trim()}`;
    }
    const m = /^\s*([A-Za-z]+)(?:\s+([\s\S]*))?$/.exec(text);
    if (!m) {
      problems.push({ line: start + 1, rule: "DF000", severity: "error", message: "This line is not a Dockerfile instruction.", fix: "Start each instruction with a keyword such as RUN, COPY or FROM." });
    } else {
      instructions.push({ name: (m[1] as string).toUpperCase(), args: (m[2] ?? "").trim(), line: start + 1, endLine: i + 1 });
    }
    i++;
  }
  return { instructions, problems };
}

/** Commands of a RUN, each with the command that follows a pipe, if any. */
function runCommands(args: string): { words: string[]; text: string; next?: string }[] {
  const body = args.replace(/^--\S+\s+/g, "").replace(/^--\S+\s+/g, "").replace(/^\[.*\]$/s, (m) => {
    try {
      const list = JSON.parse(m) as unknown;
      return Array.isArray(list) ? list.join(" ") : m;
    } catch {
      return m;
    }
  });
  const result: { words: string[]; text: string; next?: string }[] = [];
  const parts: { text: string; sepAfter: string }[] = [];
  let current = "";
  let quote = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i] as string;
    if (quote) {
      current += c;
      if (c === quote && body[i - 1] !== "\\") quote = "";
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      current += c;
    } else if ((c === "&" && body[i + 1] === "&") || (c === "|" && body[i + 1] === "|")) {
      parts.push({ text: current, sepAfter: c + c });
      current = "";
      i++;
    } else if (c === ";" || c === "|") {
      parts.push({ text: current, sepAfter: c });
      current = "";
    } else current += c;
  }
  parts.push({ text: current, sepAfter: "" });
  parts.forEach((p, i) => {
    const text = p.text.trim();
    if (!text) return;
    let words = text.split(/\s+/);
    // Leading VAR=value words set variables for the command; skip them.
    while (words.length > 1 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0] as string)) words = words.slice(1);
    result.push({ words, text, next: p.sepAfter === "|" ? parts[i + 1]?.text.trim() : undefined });
  });
  return result;
}

interface Image {
  name: string;
  tag: string | null;
  digest: boolean;
  variable: boolean;
}

function parseImage(ref: string): Image {
  if (/\$/.test(ref)) return { name: ref, tag: null, digest: false, variable: true };
  if (ref.includes("@")) return { name: ref.split("@")[0] as string, tag: null, digest: true, variable: false };
  const slash = ref.lastIndexOf("/");
  const colon = ref.lastIndexOf(":");
  if (colon > slash) return { name: ref.slice(0, colon), tag: ref.slice(colon + 1), digest: false, variable: false };
  return { name: ref, tag: null, digest: false, variable: false };
}

const SECRET_NAME = /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY|CREDENTIAL)/i;

const isExecForm = (args: string) => {
  if (!args.startsWith("[")) return false;
  try {
    return Array.isArray(JSON.parse(args));
  } catch {
    return false;
  }
};

/** Names and values of an ENV or ARG instruction ("A=1 B=2" and the old "A 1" form). */
function assignments(name: string, args: string): { key: string; value: string | null }[] {
  const out: { key: string; value: string | null }[] = [];
  if (name === "ENV" && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(args)) {
    const m = /^(\S+)\s+([\s\S]*)$/.exec(args);
    return m ? [{ key: m[1] as string, value: m[2] as string }] : [];
  }
  const re = /([A-Za-z_][A-Za-z0-9_]*)(?:=("[^"]*"|'[^']*'|\S*))?/g;
  for (const m of args.matchAll(re)) out.push({ key: m[1] as string, value: m[2] === undefined ? null : (m[2] as string).replace(/^["']|["']$/g, "") });
  return out;
}

/** Lint a Dockerfile. */
export function lintDockerfile(source: string): LintResult {
  const { instructions, problems } = parseDockerfile(source);
  const findings: Finding[] = [...problems];
  const add = (line: number, rule: string, severity: Severity, message: string, fix?: string) => findings.push({ line, rule, severity, message, fix });

  const fromIndexes = instructions.map((ins, i) => (ins.name === "FROM" ? i : -1)).filter((i) => i >= 0);
  const stageNames = new Map<string, number>();
  const stageList: { name?: string; start: number; end: number }[] = [];

  instructions.forEach((ins, idx) => {
    if (!KNOWN.has(ins.name)) add(ins.line, "DF001", "error", `“${ins.name}” is not a Dockerfile instruction.`, "Check the spelling. Instructions are words such as FROM, RUN, COPY, CMD.");
    if (ins.name === "FROM") {
      const next = fromIndexes[fromIndexes.indexOf(idx) + 1];
      stageList.push({ start: idx, end: next === undefined ? instructions.length : next });
    }
  });

  if (instructions.length === 0) {
    return { findings: [], instructions, counts: { error: 0, warning: 0, info: 0 }, stages: 0 };
  }
  const firstReal = instructions.find((i) => i.name !== "ARG");
  if (firstReal && firstReal.name !== "FROM" && KNOWN.has(firstReal.name)) add(firstReal.line, "DF002", "error", `The first instruction is ${firstReal.name}, but a Dockerfile must start with FROM (only ARG may come before it).`, "Add a FROM line with your base image at the top.");
  if (fromIndexes.length === 0 && !firstReal) add(1, "DF002", "error", "There is no FROM instruction. Every image starts from a base image.", "Add a line such as FROM node:22-slim.");

  // Stages: names, base images.
  for (const stage of stageList) {
    const from = instructions[stage.start] as Instruction;
    const m = /^(?:--\S+\s+)*(\S+)(?:\s+[Aa][Ss]\s+(\S+))?\s*$/.exec(from.args);
    if (!m) {
      add(from.line, "DF003", "error", "This FROM line is not in the form FROM image[:tag] [AS name].", "For example: FROM node:22-slim AS build");
      continue;
    }
    const image = parseImage(m[1] as string);
    stage.name = m[2]?.toLowerCase();
    if (stage.name) {
      if (stageNames.has(stage.name)) add(from.line, "DF004", "error", `The stage name “${stage.name}” is already used on line ${(instructions[stageNames.get(stage.name) as number] as Instruction).line}.`, "Give each stage its own name.");
      else stageNames.set(stage.name, stage.start);
    }
    const isStageRef = stageNames.has((m[1] as string).toLowerCase()) && !image.tag;
    if (image.name !== "scratch" && !image.variable && !image.digest && !isStageRef) {
      if (image.tag === "latest") add(from.line, "DF005", "warning", `${image.name}:latest changes whenever the image is updated, so builds are not repeatable.`, `Pin a version, for example ${image.name}:<version>, or a digest.`);
      else if (image.tag === null) add(from.line, "DF006", "warning", `${image.name} has no tag, which means :latest, so builds are not repeatable.`, `Pin a version, for example ${image.name}:<version>.`);
    }
  }

  for (const [si, stage] of stageList.entries()) {
    const body = instructions.slice(stage.start + 1, stage.end);
    const isFinal = si === stageList.length - 1;
    const byName = (n: string) => body.filter((b) => b.name === n);

    // CMD / ENTRYPOINT / HEALTHCHECK counts
    for (const n of ["CMD", "ENTRYPOINT"]) {
      const list = byName(n);
      if (list.length > 1) add((list[0] as Instruction).line, "DF007", "warning", `This stage has ${list.length} ${n} instructions. Only the last one (line ${(list[list.length - 1] as Instruction).line}) takes effect.`, `Remove the extra ${n} lines.`);
      for (const ins of list) {
        if (ins.args && !isExecForm(ins.args)) add(ins.line, "DF008", "info", `${n} is in shell form, so it runs under /bin/sh -c and the app may not receive stop signals.`, `Use exec form: ${n} ["executable", "arg1"]`);
      }
    }

    if (isFinal) {
      const users = byName("USER");
      const last = users[users.length - 1];
      if (!users.length) add((instructions[stage.start] as Instruction).line, "DF009", "warning", "The final image never sets USER, so the container runs as root.", "Create a non-root user and switch to it: USER app");
      else if (last && /^(root|0)(:.*)?$/i.test(last.args)) add(last.line, "DF010", "warning", "The last USER is root, so the container runs as root.", "Switch to a non-root user before CMD or ENTRYPOINT.");
      if (!byName("HEALTHCHECK").length && byName("EXPOSE").length) add((byName("EXPOSE")[0] as Instruction).line, "DF011", "info", "The image exposes a port but has no HEALTHCHECK, so Docker cannot tell whether the service works.", "Add HEALTHCHECK CMD curl -f http://localhost:PORT/ || exit 1");
    }

    let sawAptUpdate: Instruction | null = null;
    for (const ins of body) {
      switch (ins.name) {
        case "MAINTAINER":
          add(ins.line, "DF012", "warning", "MAINTAINER is deprecated.", `Use LABEL org.opencontainers.image.authors="${ins.args}"`);
          break;
        case "WORKDIR":
          if (!/^(\/|[A-Za-z]:[\\/]|\$|\\)/.test(ins.args) && ins.args) add(ins.line, "DF013", "warning", `WORKDIR ${ins.args} is a relative path, so it depends on the previous WORKDIR.`, "Use an absolute path such as /app.");
          break;
        case "EXPOSE":
          if (/(^|\s)22(\/|\s|$)/.test(ins.args)) add(ins.line, "DF014", "warning", "Port 22 (SSH) is exposed. Containers should not run an SSH server.", "Use docker exec for a shell, and remove the SSH service.");
          break;
        case "ADD": {
          const parts = ins.args.replace(/^(--\S+\s+)+/, "").split(/\s+/).filter(Boolean);
          const sources = parts.slice(0, -1);
          if (sources.length && sources.every((s) => !/^https?:\/\//i.test(s) && !/\.(tar|tgz|tar\.gz|tar\.bz2|tar\.xz|txz)$/i.test(s))) add(ins.line, "DF015", "info", "ADD is used to copy plain files. ADD also unpacks archives and fetches URLs, which is rarely wanted.", "Use COPY instead.");
          if (sources.some((s) => /^https?:\/\//i.test(s))) add(ins.line, "DF016", "info", "ADD downloads a URL into the image, so the download is not checked.", "Download with curl or wget in a RUN step, verify its checksum, and clean up after.");
          if (sources.length > 1 && !(parts[parts.length - 1] as string).endsWith("/")) add(ins.line, "DF017", "error", "With several sources, the destination must end with /.", `Change the destination to ${parts[parts.length - 1]}/`);
          break;
        }
        case "COPY": {
          const flags = /--from=(\S+)/.exec(ins.args);
          const parts = ins.args.replace(/^(--\S+\s+)+/, "").split(/\s+/).filter(Boolean);
          if (parts.length > 2 && !(parts[parts.length - 1] as string).endsWith("/")) add(ins.line, "DF017", "error", "With several sources, the destination must end with /.", `Change the destination to ${parts[parts.length - 1]}/`);
          if (flags) {
            const ref = (flags[1] as string).toLowerCase();
            if (!/^\d+$/.test(ref) && !stageNames.has(ref) && !/[/:.$]/.test(ref)) add(ins.line, "DF018", "error", `COPY --from=${flags[1]} refers to a stage that does not exist.`, "Name an earlier stage with FROM … AS name, or use an image name.");
            else if (stageNames.has(ref) && (stageNames.get(ref) as number) >= stage.start) add(ins.line, "DF018", "error", `COPY --from=${flags[1]} refers to this stage or a later one.`, "You can only copy from stages defined earlier.");
          }
          break;
        }
        case "ENV":
        case "ARG":
          for (const a of assignments(ins.name, ins.args)) {
            if (ins.name === "ENV" || a.value !== null) {
              if (SECRET_NAME.test(a.key) && a.value !== null && a.value !== "" && !/^\$/.test(a.value)) add(ins.line, "DF019", "warning", `${ins.name} ${a.key} puts what looks like a secret in the image, where anyone who can pull it can read it.`, "Pass secrets at run time, or use a BuildKit secret mount (RUN --mount=type=secret).");
            }
          }
          break;
        case "RUN": {
          const cmds = runCommands(ins.args);
          for (const c of cmds) {
            const [bin = "", sub = ""] = c.words;
            const text = c.text;
            if (bin === "sudo") add(ins.line, "DF020", "warning", "sudo is not needed in a Dockerfile, where RUN already runs as the current USER.", "Remove sudo, or switch USER for that step.");
            if (bin === "cd") add(ins.line, "DF021", "info", "cd in RUN only lasts for that line.", "Use WORKDIR to change the directory for later instructions.");
            if (bin === "apt") add(ins.line, "DF022", "warning", "apt has no stable command-line interface for scripts.", "Use apt-get instead.");
            if ((bin === "apt-get" || bin === "apt") && sub === "update") sawAptUpdate = ins;
            if (bin === "apt-get" && /\binstall\b/.test(text)) {
              if (!/(\s-y\b|\s-yq\b|\s-qy\b|--yes|--assume-yes|-y[a-z]*\b)/.test(text)) add(ins.line, "DF023", "error", "apt-get install without -y waits for an answer, so the build fails.", "Add -y.");
              if (!/--no-install-recommends/.test(text)) add(ins.line, "DF024", "info", "apt-get install pulls in recommended packages, which makes the image bigger.", "Add --no-install-recommends.");
              if (sawAptUpdate && sawAptUpdate.line !== ins.line && !instructionHasUpdate(ins)) add(ins.line, "DF025", "warning", `apt-get update is on line ${sawAptUpdate.line}, in another RUN. Docker caches that layer, so install can use a stale package list.`, "Put update and install in the same RUN, joined by &&.");
              if (!/rm -rf \/var\/lib\/apt\/lists/.test(ins.args)) add(ins.line, "DF026", "info", "The apt package lists are left in the layer.", "End the RUN with && rm -rf /var/lib/apt/lists/*");
            }
            if (/^(pip|pip3)$/.test(bin) && sub === "install" && !/--no-cache-dir/.test(text) && !/PIP_NO_CACHE_DIR/.test(source)) add(ins.line, "DF027", "info", "pip keeps a download cache in the layer.", "Add --no-cache-dir.");
            if (bin === "apk" && sub === "add" && !/--no-cache/.test(text)) add(ins.line, "DF028", "info", "apk add keeps its index in the layer.", "Add --no-cache.");
            if (bin === "yum" && /\binstall\b/.test(text) && !/\s-y\b|--assumeyes/.test(text)) add(ins.line, "DF023", "error", "yum install without -y waits for an answer, so the build fails.", "Add -y.");
            if (/\bchmod\b[^|;&]*\b(-R\s+)?0?777\b/.test(text)) add(ins.line, "DF029", "warning", "chmod 777 lets every user read, write and run the files.", "Grant only the permissions that are needed, for example 755 or 644.");
            if ((bin === "curl" || bin === "wget") && c.next && /^(sudo\s+)?(ba|z|da|)sh\b/.test(c.next)) add(ins.line, "DF030", "warning", `Piping ${bin} into a shell runs whatever the server sends, unchecked.`, "Download the file, verify its checksum, then run it.");
          }
          break;
        }
        default:
          break;
      }
    }
  }

  findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return { findings, instructions, counts, stages: stageList.length };
}

const instructionHasUpdate = (ins: Instruction) => /\bapt(-get)?\s+update\b/.test(ins.args);
