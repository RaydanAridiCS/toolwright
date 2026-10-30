import { describe, expect, it } from "vitest";
import { lintDockerfile, parseDockerfile } from "../src/dockerfile-linter";

const rules = (src: string) => lintDockerfile(src).findings.map((f) => f.rule);
const find = (src: string, rule: string) => lintDockerfile(src).findings.find((f) => f.rule === rule);

const GOOD = `FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN useradd --create-home app
USER app
EXPOSE 3000
HEALTHCHECK CMD curl -f http://localhost:3000/ || exit 1
CMD ["node", "dist/index.js"]
`;

describe("parseDockerfile", () => {
  it("joins continuation lines and skips comments and blank lines", () => {
    const { instructions } = parseDockerfile('# top\nFROM a\n\nRUN one \\\n  # inner comment\n  && two\nCMD ["x"]');
    expect(instructions.map((i) => [i.name, i.line, i.endLine])).toEqual([
      ["FROM", 2, 2],
      ["RUN", 4, 6],
      ["CMD", 7, 7],
    ]);
    expect(instructions[1]?.args).toBe("one && two");
  });

  it("understands the escape directive", () => {
    const { instructions } = parseDockerfile("# escape=`\nFROM a\nRUN one `\n  two");
    expect(instructions[1]?.args).toBe("one two");
  });

  it("copes with CRLF, a BOM and lower-case instructions", () => {
    const { instructions } = parseDockerfile("﻿from a\r\nrun b\r\n");
    expect(instructions.map((i) => i.name)).toEqual(["FROM", "RUN"]);
  });
});

describe("lintDockerfile: a good file", () => {
  it("has no findings", () => {
    const r = lintDockerfile(GOOD);
    expect(r.findings).toEqual([]);
    expect(r.stages).toBe(2);
  });

  it("returns nothing for an empty file", () => {
    expect(lintDockerfile("").findings).toEqual([]);
    expect(lintDockerfile("# only a comment").counts).toEqual({ error: 0, warning: 0, info: 0 });
  });
});

describe("lintDockerfile: base images and stages", () => {
  it("warns about :latest and missing tags, but not scratch, digests, variables or earlier stages", () => {
    expect(rules("FROM node:latest\nUSER a")).toContain("DF005");
    expect(rules("FROM node\nUSER a")).toContain("DF006");
    expect(rules("FROM scratch\nUSER a")).not.toContain("DF006");
    expect(rules("FROM node@sha256:abc\nUSER a")).not.toContain("DF006");
    expect(rules("ARG BASE=node:22\nFROM $BASE\nUSER a")).not.toContain("DF006");
    expect(rules("FROM node:22 AS build\nFROM build\nUSER a")).not.toContain("DF006");
    expect(rules("FROM registry.example.com:5000/team/app\nUSER a")).toContain("DF006");
  });

  it("requires FROM first, but allows ARG before it", () => {
    expect(rules("RUN echo hi")).toContain("DF002");
    expect(rules("ARG V=1\nFROM node:22\nUSER a")).not.toContain("DF002");
    expect(find("RUN echo hi", "DF002")?.severity).toBe("error");
  });

  it("catches duplicate stage names and COPY --from to stages that do not exist", () => {
    expect(rules("FROM a:1 AS x\nFROM b:1 AS x\nUSER u")).toContain("DF004");
    expect(rules("FROM a:1\nCOPY --from=nope /a /b\nUSER u")).toContain("DF018");
    expect(rules("FROM a:1 AS build\nFROM b:1\nCOPY --from=build /a /b\nUSER u")).not.toContain("DF018");
    expect(rules("FROM a:1\nCOPY --from=nginx:1.27 /a /b\nUSER u")).not.toContain("DF018");
    expect(rules("FROM a:1\nCOPY --from=0 /a /b\nUSER u")).not.toContain("DF018");
  });

  it("reports unknown instructions and malformed FROM lines", () => {
    expect(rules("FROM a:1\nRNU echo\nUSER u")).toContain("DF001");
    expect(rules("FROM\nUSER u")).toContain("DF003");
  });
});

describe("lintDockerfile: user, healthcheck, cmd", () => {
  it("warns when the final image runs as root, only in the final stage", () => {
    expect(rules('FROM a:1\nCMD ["x"]')).toContain("DF009");
    expect(rules('FROM a:1 AS build\nFROM b:1\nUSER app\nCMD ["x"]')).not.toContain("DF009");
    expect(rules("FROM a:1\nUSER root")).toContain("DF010");
    expect(rules("FROM a:1\nUSER app\nUSER root")).toContain("DF010");
  });

  it("suggests a healthcheck only when a port is exposed", () => {
    expect(rules("FROM a:1\nUSER u\nEXPOSE 80")).toContain("DF011");
    expect(rules("FROM a:1\nUSER u")).not.toContain("DF011");
    expect(rules("FROM a:1\nUSER u\nEXPOSE 80\nHEALTHCHECK CMD true")).not.toContain("DF011");
  });

  it("flags repeated CMD and shell-form CMD and ENTRYPOINT", () => {
    expect(rules('FROM a:1\nUSER u\nCMD ["a"]\nCMD ["b"]')).toContain("DF007");
    expect(rules("FROM a:1\nUSER u\nCMD node app.js")).toContain("DF008");
    expect(rules("FROM a:1\nUSER u\nENTRYPOINT /run.sh")).toContain("DF008");
    expect(rules('FROM a:1\nUSER u\nCMD ["node", "app.js"]')).not.toContain("DF008");
  });
});

describe("lintDockerfile: RUN", () => {
  const run = (cmd: string) => rules(`FROM a:1\nUSER u\nRUN ${cmd}`);

  it("catches apt-get install without -y, and offers the usual improvements", () => {
    const bad = run("apt-get install curl");
    expect(bad).toEqual(expect.arrayContaining(["DF023", "DF024", "DF026"]));
    const good = run("apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*");
    expect(good).toEqual([]);
  });

  it("warns when apt-get update and install are in different RUN instructions", () => {
    const r = rules("FROM a:1\nUSER u\nRUN apt-get update\nRUN apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*");
    expect(r).toContain("DF025");
  });

  it("prefers apt-get to apt", () => {
    expect(run("apt install -y curl")).toContain("DF022");
  });

  it("flags cd, sudo, chmod 777 and piping a download into a shell", () => {
    expect(run("cd /app && make")).toContain("DF021");
    expect(run("sudo make install")).toContain("DF020");
    expect(run("chmod -R 777 /data")).toContain("DF029");
    expect(run("curl -fsSL https://x.test/install.sh | sh")).toContain("DF030");
    expect(run("wget -qO- https://x.test/i | bash")).toContain("DF030");
    expect(run("curl -fsSL https://x.test/f -o f && sh f")).not.toContain("DF030");
  });

  it("suggests no-cache options for pip and apk, and -y for yum", () => {
    expect(run("pip install flask")).toContain("DF027");
    expect(run("pip install --no-cache-dir flask")).not.toContain("DF027");
    expect(run("apk add curl")).toContain("DF028");
    expect(run("apk add --no-cache curl")).not.toContain("DF028");
    expect(run("yum install httpd")).toContain("DF023");
  });

  it("reads the exec form of RUN and skips leading variable assignments", () => {
    expect(rules('FROM a:1\nUSER u\nRUN ["sudo", "make"]')).toContain("DF020");
    expect(run("DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*")).toEqual([]);
  });

  it("does not mistake text inside quotes for commands", () => {
    expect(run("echo 'cd /tmp && sudo rm -rf x'")).toEqual([]);
  });
});

describe("lintDockerfile: other instructions", () => {
  const body = (line: string) => rules(`FROM a:1\nUSER u\n${line}`);

  it("flags secrets in ENV and ARG values, but not references or empty values", () => {
    expect(body("ENV API_TOKEN=abc123")).toContain("DF019");
    expect(body("ENV DB_PASSWORD hunter2")).toContain("DF019");
    expect(body("ARG NPM_TOKEN=abc")).toContain("DF019");
    expect(body("ARG NPM_TOKEN")).not.toContain("DF019");
    expect(body("ENV API_TOKEN=$FROM_SOMEWHERE")).not.toContain("DF019");
    expect(body("ENV NODE_ENV=production")).not.toContain("DF019");
  });

  it("explains ADD, COPY destination rules, MAINTAINER, WORKDIR and EXPOSE 22", () => {
    expect(body("ADD app.js /app/")).toContain("DF015");
    expect(body("ADD app.tar.gz /app/")).not.toContain("DF015");
    expect(body("ADD https://x.test/f.zip /f.zip")).toContain("DF016");
    expect(body("COPY a b /dest")).toContain("DF017");
    expect(body("COPY a b /dest/")).not.toContain("DF017");
    expect(body("MAINTAINER me")).toContain("DF012");
    expect(body("WORKDIR app")).toContain("DF013");
    expect(body("WORKDIR /app")).not.toContain("DF013");
    expect(body("EXPOSE 22")).toContain("DF014");
    expect(body("EXPOSE 2222")).not.toContain("DF014");
  });
});

describe("lintDockerfile: results", () => {
  it("sorts by line, counts severities and gives every finding a message and a rule", () => {
    const r = lintDockerfile("FROM node:latest\nRUN apt-get install curl\nMAINTAINER me");
    expect(r.findings.map((f) => f.line)).toEqual([...r.findings.map((f) => f.line)].sort((a, b) => a - b));
    expect(r.counts.error + r.counts.warning + r.counts.info).toBe(r.findings.length);
    expect(r.counts.error).toBe(1);
    for (const f of r.findings) {
      expect(f.message.length).toBeGreaterThan(10);
      expect(f.rule).toMatch(/^DF\d{3}$/);
    }
  });

  it("is fast on a long file", () => {
    const big = `FROM a:1\n${"RUN echo hello && echo world\n".repeat(20_000)}USER u`;
    const t0 = Date.now();
    lintDockerfile(big);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});
