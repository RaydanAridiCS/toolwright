/**
 * IP address and subnet maths for IPv4 and IPv6. Addresses are BigInts, so IPv6 needs no special cases.
 * Keep this file free of React, the DOM and the network.
 */

export type IpVersion = 4 | 6;

export class SubnetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubnetError";
  }
}

export interface Ip {
  version: IpVersion;
  value: bigint;
}

export interface Network {
  version: IpVersion;
  /** The address as typed (it may have host bits set, as in 192.168.1.77/24). */
  address: bigint;
  prefix: number;
  /** First address of the block. */
  network: bigint;
  /** Last address of the block. */
  last: bigint;
}

export const SUBNET_LIMITS = {
  /** Subnets listed by a split. The total is still counted exactly. */
  maxListed: 1024,
  maxSummarizeLines: 20_000,
  maxInputChars: 2_000_000,
} as const;

const bitsOf = (version: IpVersion): number => (version === 4 ? 32 : 128);
const maxValue = (version: IpVersion): bigint => (1n << BigInt(bitsOf(version))) - 1n;
const hostMask = (version: IpVersion, prefix: number): bigint => (1n << BigInt(bitsOf(version) - prefix)) - 1n;

/* ----------------------------------------------------------------------------------------------- */
/* Reading and writing addresses                                                                    */
/* ----------------------------------------------------------------------------------------------- */

export function parseIpv4(text: string): bigint {
  const s = text.trim();
  if (s === "") throw new SubnetError("Enter an IPv4 address such as 192.168.1.10.");
  const parts = s.split(".");
  if (parts.length !== 4) throw new SubnetError(`"${s}" is not an IPv4 address. It needs four numbers separated by dots, like 192.168.1.10.`);
  let value = 0n;
  for (const part of parts) {
    if (!/^[0-9]{1,3}$/.test(part)) throw new SubnetError(`"${part}" is not a number from 0 to 255 in "${s}".`);
    if (part.length > 1 && part.startsWith("0")) {
      throw new SubnetError(`"${part}" has a leading zero. Some systems read that as octal (010 means 8), so it is refused. Write ${Number(part)} instead.`);
    }
    const n = Number(part);
    if (n > 255) throw new SubnetError(`${n} is too large for part of an IPv4 address. Each number is 0 to 255.`);
    value = (value << 8n) | BigInt(n);
  }
  return value;
}

export function parseIpv6(text: string): bigint {
  let s = text.trim();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  if (s === "") throw new SubnetError("Enter an IPv6 address such as 2001:db8::1.");
  if (s.includes("%")) throw new SubnetError("Zone IDs such as %eth0 are not supported. Remove the part from the % on.");
  if (!/^[0-9a-fA-F:.]+$/.test(s)) throw new SubnetError(`"${s}" is not an IPv6 address. It may only contain digits, the letters a to f, colons and (at the end) an IPv4 address.`);
  if (s.includes(":::")) throw new SubnetError("Three colons in a row are not allowed. Use :: only once.");
  const halves = s.split("::");
  if (halves.length > 2) throw new SubnetError("Only one :: is allowed in an IPv6 address.");
  const toGroups = (part: string): string[] => (part === "" ? [] : part.split(":"));
  const head = toGroups(halves[0] as string);
  const tail = halves.length === 2 ? toGroups(halves[1] as string) : null;
  const last = (tail ?? head);
  // An IPv4 address may stand in for the last two groups (::ffff:192.0.2.1).
  const final = last[last.length - 1];
  if (final !== undefined && final.includes(".")) {
    let v4: bigint;
    try {
      v4 = parseIpv4(final);
    } catch {
      throw new SubnetError(`"${final}" is not a valid IPv4 address at the end of the IPv6 address.`);
    }
    last.splice(last.length - 1, 1, ((v4 >> 16n) & 0xffffn).toString(16), (v4 & 0xffffn).toString(16));
  }
  const all = [...head, ...(tail ?? [])];
  for (const g of all) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) throw new SubnetError(g === "" ? "An IPv6 address cannot start or end with a single colon." : `"${g}" is not a valid IPv6 group. Each group is one to four hex digits.`);
  }
  if (tail === null && all.length !== 8) throw new SubnetError(`An IPv6 address has eight groups, but this has ${all.length}. Use :: to stand for a run of zeros.`);
  if (tail !== null && all.length > 7) throw new SubnetError("There are too many groups for :: to stand for any zeros.");
  const missing = tail === null ? 0 : 8 - all.length;
  const groups = [...head.map((g) => BigInt("0x" + g)), ...new Array<bigint>(missing).fill(0n), ...(tail ?? []).map((g) => BigInt("0x" + g))];
  let value = 0n;
  for (const g of groups) value = (value << 16n) | g;
  return value;
}

export function parseIp(text: string): Ip {
  const s = text.trim();
  if (s.includes(":")) return { version: 6, value: parseIpv6(s) };
  return { version: 4, value: parseIpv4(s) };
}

export function formatIpv4(value: bigint): string {
  return [24n, 16n, 8n, 0n].map((shift) => ((value >> shift) & 0xffn).toString()).join(".");
}

/** The usual short form of RFC 5952: lower case, no leading zeros, the longest run of zero groups written as ::. */
export function formatIpv6(value: bigint, compress = true): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) groups.push(((value >> BigInt(i * 16)) & 0xffffn).toString(16));
  if (!compress) return groups.join(":");
  let bestStart = -1;
  let bestLength = 0;
  for (let i = 0; i < 8; ) {
    if (groups[i] !== "0") {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === "0") j++;
    if (j - i > bestLength) {
      bestStart = i;
      bestLength = j - i;
    }
    i = j;
  }
  // A single zero group is written out, as the RFC asks.
  if (bestLength < 2) return groups.join(":");
  const left = groups.slice(0, bestStart).join(":");
  const right = groups.slice(bestStart + bestLength).join(":");
  return `${left}::${right}`;
}

export const formatIp = (ip: Ip, compress = true): string => (ip.version === 4 ? formatIpv4(ip.value) : formatIpv6(ip.value, compress));

/** The full eight-group form with every leading zero, such as 2001:0db8:0000:0000:0000:0000:0000:0001. */
export function expandIpv6(value: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) groups.push(((value >> BigInt(i * 16)) & 0xffffn).toString(16).padStart(4, "0"));
  return groups.join(":");
}

/* ----------------------------------------------------------------------------------------------- */
/* Networks                                                                                         */
/* ----------------------------------------------------------------------------------------------- */

/** Turns 255.255.255.0 into 24. The mask must be a run of ones followed by zeros. */
export function maskToPrefix(mask: string): number {
  const value = parseIpv4(mask);
  const inverted = value ^ maxValue(4);
  // A valid netmask inverted is 2^k - 1, which has no zero below its top set bit.
  if ((inverted & (inverted + 1n)) !== 0n) throw new SubnetError(`${mask} is not a valid netmask. A netmask is a run of ones followed by zeros, like 255.255.255.0.`);
  return 32 - (inverted.toString(2) === "0" ? 0 : inverted.toString(2).length);
}

export function prefixToMask(prefix: number): string {
  checkPrefix(4, prefix);
  return formatIpv4(maxValue(4) ^ hostMask(4, prefix));
}

function checkPrefix(version: IpVersion, prefix: number): void {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bitsOf(version)) {
    throw new SubnetError(`The prefix length must be a whole number from 0 to ${bitsOf(version)} for IPv${version}.`);
  }
}

export function makeNetwork(version: IpVersion, address: bigint, prefix: number): Network {
  checkPrefix(version, prefix);
  const host = hostMask(version, prefix);
  const network = address & ~host & maxValue(version);
  return { version, address, prefix, network, last: network | host };
}

/** Reads `192.168.1.77/24`, `192.168.1.0/255.255.255.0`, `2001:db8::/32`, or a bare address (which is a single-address network). */
export function parseNetwork(text: string): Network {
  const s = text.trim();
  if (s === "") throw new SubnetError("Enter a network such as 192.168.1.0/24.");
  const slash = s.indexOf("/");
  if (slash !== s.lastIndexOf("/")) throw new SubnetError(`"${s}" has more than one "/". Write it like 192.168.1.0/24.`);
  const ip = parseIp(slash === -1 ? s : s.slice(0, slash));
  if (slash === -1) return makeNetwork(ip.version, ip.value, bitsOf(ip.version));
  const rest = s.slice(slash + 1).trim();
  if (rest === "") throw new SubnetError("There is nothing after the \"/\". Write a prefix length such as /24.");
  if (/^[0-9]+$/.test(rest)) return makeNetwork(ip.version, ip.value, Number(rest));
  if (ip.version === 4 && /^[0-9.]+$/.test(rest)) return makeNetwork(4, ip.value, maskToPrefix(rest));
  throw new SubnetError(`"${rest}" is not a prefix length. Use a number such as 24${ip.version === 4 ? " or a netmask such as 255.255.255.0" : ""}.`);
}

export const formatCidr = (net: Network): string => `${formatIp({ version: net.version, value: net.network })}/${net.prefix}`;

const sizeOf = (net: Network): bigint => net.last - net.network + 1n;

export interface NetworkInfo {
  version: IpVersion;
  cidr: string;
  address: string;
  prefix: number;
  network: string;
  /** IPv4 only. */
  netmask?: string;
  /** IPv4 only: the netmask turned around, as used in some access lists. */
  wildcard?: string;
  /** IPv4 only. */
  broadcast?: string;
  firstAddress: string;
  lastAddress: string;
  firstHost: string;
  lastHost: string;
  totalAddresses: bigint;
  usableHosts: bigint;
  hostBits: number;
  /** What kind of block it is: private, loopback, documentation and so on. */
  kind: string;
  /** Short notes: /31 and /32 are special, the address had host bits set, and so on. */
  notes: string[];
}

export function analyzeNetwork(net: Network): NetworkInfo {
  const v = net.version;
  const total = sizeOf(net);
  const hostBits = bitsOf(v) - net.prefix;
  const f = (value: bigint) => formatIp({ version: v, value });
  const notes: string[] = [];
  let usable: bigint;
  let firstHost = net.network;
  let lastHost = net.last;

  if (v === 4) {
    if (net.prefix === 32) {
      usable = 1n;
      notes.push("A /32 is a single address, used for host routes.");
    } else if (net.prefix === 31) {
      usable = 2n;
      notes.push("A /31 has two addresses and no broadcast address; both are usable on a point-to-point link (RFC 3021).");
    } else {
      usable = total - 2n;
      firstHost = net.network + 1n;
      lastHost = net.last - 1n;
    }
  } else {
    usable = total;
    if (net.prefix === 128) notes.push("A /128 is a single address.");
    else if (net.prefix === 127) notes.push("A /127 has two addresses and is used for point-to-point links (RFC 6164).");
    else if (net.prefix > 64) notes.push("Most IPv6 networks use a /64 for each segment; longer prefixes break features such as SLAAC.");
  }
  if (net.address !== net.network) notes.push(`The address you typed (${f(net.address)}) is inside the network. The network itself starts at ${f(net.network)}.`);

  return {
    version: v,
    cidr: formatCidr(net),
    address: f(net.address),
    prefix: net.prefix,
    network: f(net.network),
    netmask: v === 4 ? prefixToMask(net.prefix) : undefined,
    wildcard: v === 4 ? formatIpv4(hostMask(4, net.prefix)) : undefined,
    broadcast: v === 4 ? f(net.last) : undefined,
    firstAddress: f(net.network),
    lastAddress: f(net.last),
    firstHost: f(firstHost),
    lastHost: f(lastHost),
    totalAddresses: total,
    usableHosts: usable,
    hostBits,
    kind: classify({ version: v, value: net.network }),
    notes,
  };
}

/* ----------------------------------------------------------------------------------------------- */
/* What kind of address is it?                                                                      */
/* ----------------------------------------------------------------------------------------------- */

interface Special {
  cidr: string;
  label: string;
}

const SPECIAL_V4: Special[] = [
  { cidr: "0.0.0.0/8", label: "This network (0.0.0.0/8)" },
  { cidr: "10.0.0.0/8", label: "Private network (RFC 1918)" },
  { cidr: "100.64.0.0/10", label: "Shared address space for carrier-grade NAT (RFC 6598)" },
  { cidr: "127.0.0.0/8", label: "Loopback" },
  { cidr: "169.254.0.0/16", label: "Link-local (self-assigned)" },
  { cidr: "172.16.0.0/12", label: "Private network (RFC 1918)" },
  { cidr: "192.0.0.0/24", label: "IETF protocol assignments" },
  { cidr: "192.0.2.0/24", label: "Documentation (TEST-NET-1)" },
  { cidr: "192.168.0.0/16", label: "Private network (RFC 1918)" },
  { cidr: "198.18.0.0/15", label: "Network benchmark testing" },
  { cidr: "198.51.100.0/24", label: "Documentation (TEST-NET-2)" },
  { cidr: "203.0.113.0/24", label: "Documentation (TEST-NET-3)" },
  { cidr: "224.0.0.0/4", label: "Multicast" },
  { cidr: "240.0.0.0/4", label: "Reserved for future use" },
];

const SPECIAL_V6: Special[] = [
  { cidr: "::/128", label: "Unspecified address" },
  { cidr: "::1/128", label: "Loopback" },
  { cidr: "::ffff:0:0/96", label: "IPv4-mapped address" },
  { cidr: "64:ff9b::/96", label: "IPv4/IPv6 translation (NAT64)" },
  { cidr: "100::/64", label: "Discard-only block" },
  { cidr: "2001:db8::/32", label: "Documentation (RFC 3849)" },
  { cidr: "2001::/23", label: "IETF protocol assignments" },
  { cidr: "3fff::/20", label: "Documentation (RFC 9637)" },
  { cidr: "2001::/32", label: "Teredo tunnelling" },
  { cidr: "2002::/16", label: "6to4 tunnelling" },
  { cidr: "fc00::/7", label: "Unique local (private) address" },
  { cidr: "fe80::/10", label: "Link-local" },
  { cidr: "ff00::/8", label: "Multicast" },
];

const specials = (list: Special[]) => list.map((s) => ({ net: parseNetwork(s.cidr), label: s.label }));
const SPECIAL_NETS = { 4: specials(SPECIAL_V4), 6: specials(SPECIAL_V6) };

/** Names the most specific special-purpose block an address falls into. */
export function classify(ip: Ip): string {
  if (ip.version === 4 && ip.value === maxValue(4)) return "Limited broadcast";
  let best: { label: string; prefix: number } | null = null;
  for (const entry of SPECIAL_NETS[ip.version]) {
    if (ip.value >= entry.net.network && ip.value <= entry.net.last && (!best || entry.net.prefix > best.prefix)) best = { label: entry.label, prefix: entry.net.prefix };
  }
  if (best) return best.label;
  if (ip.version === 6 && ip.value >> 125n !== 1n) return "Reserved by IANA (outside the 2000::/3 global range)";
  return "Public address";
}

export interface IpDetails {
  version: IpVersion;
  compressed: string;
  expanded?: string;
  decimal: string;
  hex: string;
  binary: string;
  reverseDns: string;
  kind: string;
  /** The IPv4 address inside an IPv4-mapped IPv6 address. */
  mappedV4?: string;
}

export function describeIp(ip: Ip): IpDetails {
  const bits = bitsOf(ip.version);
  const binaryAll = ip.value.toString(2).padStart(bits, "0");
  const groupSize = ip.version === 4 ? 8 : 16;
  const binary = binaryAll.match(new RegExp(`.{${groupSize}}`, "g"))!.join(ip.version === 4 ? "." : " ");
  const mapped = ip.version === 6 && ip.value >> 32n === 0xffffn ? formatIpv4(ip.value & 0xffffffffn) : undefined;
  let reverse: string;
  if (ip.version === 4) reverse = `${formatIpv4(ip.value).split(".").reverse().join(".")}.in-addr.arpa`;
  else reverse = `${expandIpv6(ip.value).replace(/:/g, "").split("").reverse().join(".")}.ip6.arpa`;
  return {
    version: ip.version,
    compressed: formatIp(ip),
    expanded: ip.version === 6 ? expandIpv6(ip.value) : undefined,
    decimal: ip.value.toString(10),
    hex: "0x" + ip.value.toString(16).padStart(bits / 4, "0"),
    binary,
    reverseDns: reverse,
    kind: classify(ip),
    mappedV4: mapped,
  };
}

/* ----------------------------------------------------------------------------------------------- */
/* Splitting, ranges, containment and summarising                                                   */
/* ----------------------------------------------------------------------------------------------- */

export interface SplitResult {
  parent: string;
  newPrefix: number;
  /** Exact number of subnets, even when only some are listed. */
  total: bigint;
  /** Addresses in each subnet. */
  perSubnet: bigint;
  subnets: { cidr: string; first: string; last: string }[];
  /** True when `total` is larger than the list. */
  truncated: boolean;
}

export function splitNetwork(net: Network, newPrefix: number, limit: number = SUBNET_LIMITS.maxListed): SplitResult {
  checkPrefix(net.version, newPrefix);
  if (newPrefix < net.prefix) throw new SubnetError(`The new prefix /${newPrefix} is shorter than the network's /${net.prefix}, so it would be bigger, not smaller. Choose /${net.prefix} or longer.`);
  const total = 1n << BigInt(newPrefix - net.prefix);
  const perSubnet = 1n << BigInt(bitsOf(net.version) - newPrefix);
  const shown = total < BigInt(limit) ? Number(total) : limit;
  const subnets: SplitResult["subnets"] = [];
  for (let i = 0; i < shown; i++) {
    const first = net.network + BigInt(i) * perSubnet;
    const sub = makeNetwork(net.version, first, newPrefix);
    subnets.push({ cidr: formatCidr(sub), first: formatIp({ version: net.version, value: sub.network }), last: formatIp({ version: net.version, value: sub.last }) });
  }
  return { parent: formatCidr(net), newPrefix, total, perSubnet, subnets, truncated: total > BigInt(shown) };
}

/** The prefix that gives at least `count` equal subnets. */
export function prefixForSubnetCount(net: Network, count: number): number {
  if (!Number.isInteger(count) || count < 1) throw new SubnetError("The number of subnets must be a whole number of 1 or more.");
  const extra = count === 1 ? 0 : (BigInt(count) - 1n).toString(2).length;
  const prefix = net.prefix + extra;
  if (prefix > bitsOf(net.version)) throw new SubnetError(`A /${net.prefix} network cannot be split into ${count.toLocaleString("en-US")} subnets. The most it can make is ${(1n << BigInt(bitsOf(net.version) - net.prefix)).toLocaleString("en-US")}.`);
  return prefix;
}

/** The longest prefix whose subnets still hold `hosts` usable addresses. */
export function prefixForHosts(version: IpVersion, hosts: number): number {
  if (!Number.isInteger(hosts) || hosts < 1) throw new SubnetError("The number of hosts must be a whole number of 1 or more.");
  const bits = bitsOf(version);
  // IPv4 loses the network and broadcast addresses, except in the /31 and /32 special cases.
  const needed = version === 4 ? (hosts === 1 ? 1n : hosts === 2 ? 2n : BigInt(hosts) + 2n) : BigInt(hosts);
  const hostBits = needed <= 1n ? 0 : (needed - 1n).toString(2).length;
  if (hostBits > bits) throw new SubnetError(`There is no IPv${version} network with room for ${hosts.toLocaleString("en-US")} hosts.`);
  return bits - hostBits;
}

export function containsAddress(net: Network, ip: Ip): boolean {
  return net.version === ip.version && ip.value >= net.network && ip.value <= net.last;
}

export function networksOverlap(a: Network, b: Network): boolean {
  return a.version === b.version && a.network <= b.last && b.network <= a.last;
}

/** The fewest CIDR blocks that cover exactly the addresses from `start` to `end`, both included. */
export function rangeToNetworks(start: Ip, end: Ip): Network[] {
  if (start.version !== end.version) throw new SubnetError("The start and end must both be IPv4 or both be IPv6.");
  if (start.value > end.value) throw new SubnetError("The start address is after the end address. Swap them.");
  const version = start.version;
  const bits = bitsOf(version);
  const out: Network[] = [];
  let current = start.value;
  while (current <= end.value) {
    // The biggest block that begins here is limited by how many trailing zero bits the address has...
    let size = current === 0n ? 1n << BigInt(bits) : current & -current;
    // ...and by how much range is left.
    while (current + size - 1n > end.value) size >>= 1n;
    const hostBitsUsed = size.toString(2).length - 1;
    out.push(makeNetwork(version, current, bits - hostBitsUsed));
    current += size;
  }
  return out;
}

export interface Summary {
  version: IpVersion;
  networks: Network[];
  /** How many addresses or networks went in, for version 4 or 6 as the case may be. */
  inputCount: number;
}

export interface SummarizeResult {
  summaries: Summary[];
  /** Lines that could not be read, with the reason. */
  problems: { line: number; text: string; message: string }[];
  linesRead: number;
}

/** Reads a list of addresses, CIDR blocks and `start - end` ranges, one per line, and merges them into the smallest list of blocks. */
export function summarize(text: string): SummarizeResult {
  if (text.length > SUBNET_LIMITS.maxInputChars) throw new SubnetError(`The list is too long. The limit is ${(SUBNET_LIMITS.maxInputChars / 1e6).toFixed(0)} million characters.`);
  const lines = text.split(/\r?\n/);
  if (lines.length > SUBNET_LIMITS.maxSummarizeLines) throw new SubnetError(`The list has ${lines.length.toLocaleString("en-US")} lines. At most ${SUBNET_LIMITS.maxSummarizeLines.toLocaleString("en-US")} can be merged at once.`);
  const ranges: Record<IpVersion, { start: bigint; end: bigint }[]> = { 4: [], 6: [] };
  const problems: SummarizeResult["problems"] = [];
  let read = 0;
  lines.forEach((raw, index) => {
    // Comments and commas: a pasted list may be separated by commas or have # notes.
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) return;
    for (const chunk of line.split(/[,;]/)) {
      const piece = chunk.trim();
      if (!piece) continue;
      // "10.0.0.1 - 10.0.0.9" is one item; anything else separated by spaces is a list.
      const items = /^\S+\s*-\s*\S+$/.test(piece) && !piece.includes("/") ? [piece] : piece.split(/\s+/);
      for (const item of items) {
        try {
          const range = item.includes("-") && !item.includes("/") ? parseRange(item) : parseNetworkAsRange(item);
          ranges[range.version].push({ start: range.start, end: range.end });
          read++;
        } catch (err) {
          problems.push({ line: index + 1, text: item, message: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  });
  const summaries: Summary[] = [];
  for (const version of [4, 6] as const) {
    const list = ranges[version];
    if (list.length === 0) continue;
    list.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    const merged: { start: bigint; end: bigint }[] = [];
    for (const r of list) {
      const prev = merged[merged.length - 1];
      if (prev && r.start <= prev.end + 1n) {
        if (r.end > prev.end) prev.end = r.end;
      } else merged.push({ start: r.start, end: r.end });
    }
    const networks = merged.flatMap((m) => rangeToNetworks({ version, value: m.start }, { version, value: m.end }));
    summaries.push({ version, networks, inputCount: list.length });
  }
  return { summaries, problems, linesRead: read };
}

function parseNetworkAsRange(item: string): { version: IpVersion; start: bigint; end: bigint } {
  const net = parseNetwork(item);
  return { version: net.version, start: net.network, end: net.last };
}

function parseRange(item: string): { version: IpVersion; start: bigint; end: bigint } {
  const parts = item.split("-").map((p) => p.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new SubnetError(`"${item}" is not a range. Write it as start - end, like 10.0.0.1 - 10.0.0.9.`);
  const a = parseIp(parts[0]);
  const b = parseIp(parts[1]);
  if (a.version !== b.version) throw new SubnetError("The start and end of a range must both be IPv4 or both be IPv6.");
  if (a.value > b.value) throw new SubnetError(`The range "${item}" starts after it ends.`);
  return { version: a.version, start: a.value, end: b.value };
}

/* ----------------------------------------------------------------------------------------------- */
/* A reference table                                                                                */
/* ----------------------------------------------------------------------------------------------- */

export interface PrefixRow {
  prefix: number;
  netmask: string;
  wildcard: string;
  addresses: bigint;
  usable: bigint;
}

/** Every IPv4 prefix from /8 to /32, as in the cheat sheets. */
export function ipv4PrefixTable(): PrefixRow[] {
  const rows: PrefixRow[] = [];
  for (let prefix = 8; prefix <= 32; prefix++) {
    const addresses = 1n << BigInt(32 - prefix);
    rows.push({ prefix, netmask: prefixToMask(prefix), wildcard: formatIpv4(hostMask(4, prefix)), addresses, usable: prefix === 32 ? 1n : prefix === 31 ? 2n : addresses - 2n });
  }
  return rows;
}
