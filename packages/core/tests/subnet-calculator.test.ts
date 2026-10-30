import { describe, expect, it } from "vitest";
import {
  SUBNET_LIMITS,
  SubnetError,
  analyzeNetwork,
  classify,
  containsAddress,
  describeIp,
  expandIpv6,
  formatCidr,
  formatIp,
  formatIpv4,
  formatIpv6,
  ipv4PrefixTable,
  makeNetwork,
  maskToPrefix,
  networksOverlap,
  parseIp,
  parseIpv4,
  parseIpv6,
  parseNetwork,
  prefixForHosts,
  prefixForSubnetCount,
  prefixToMask,
  rangeToNetworks,
  splitNetwork,
  summarize,
} from "../src/subnet-calculator";

const v4 = (s: string) => parseIpv4(s);
const v6 = (s: string) => parseIpv6(s);
const net = (s: string) => parseNetwork(s);
const cidrs = (list: ReturnType<typeof rangeToNetworks>) => list.map(formatCidr);

describe("parseIpv4", () => {
  it("reads ordinary addresses", () => {
    expect(v4("0.0.0.0")).toBe(0n);
    expect(v4("192.168.1.10")).toBe(3232235786n);
    expect(v4("255.255.255.255")).toBe(4294967295n);
    expect(v4("  10.0.0.1  ")).toBe(167772161n);
  });
  it("rejects everything that is not four numbers from 0 to 255", () => {
    for (const bad of ["", " ", "1.2.3", "1.2.3.4.5", "256.0.0.1", "1.2.3.256", "a.b.c.d", "1.2.3.-4", "1..3.4", ".1.2.3", "1.2.3.", "1.2.3.4/24", "1.2.3.4 5", "0x7f.0.0.1", "1e2.0.0.1", "١.٢.٣.٤", "1.2.3.4\u0000", "999"]) {
      expect(() => v4(bad), JSON.stringify(bad)).toThrow(SubnetError);
    }
  });
  it("refuses leading zeros, which some systems read as octal", () => {
    expect(() => v4("010.0.0.1")).toThrow(/leading zero.*octal/);
    expect(() => v4("1.2.3.04")).toThrow(/Write 4 instead/);
    expect(v4("0.0.0.0")).toBe(0n);
  });
  it("round-trips every boundary", () => {
    for (const s of ["0.0.0.0", "0.0.0.1", "127.0.0.1", "128.0.0.0", "255.255.255.254", "255.255.255.255", "1.2.3.4"]) expect(formatIpv4(v4(s))).toBe(s);
  });
});

describe("parseIpv6 and formatIpv6 (RFC 5952)", () => {
  it("writes the short form the RFC asks for", () => {
    expect(formatIpv6(v6("2001:0DB8:0:0:0:0:0:1"))).toBe("2001:db8::1");
    expect(formatIpv6(v6("2001:db8:0:0:1:0:0:1"))).toBe("2001:db8::1:0:0:1");
    expect(formatIpv6(v6("2001:db8:0:1:1:1:1:1"))).toBe("2001:db8:0:1:1:1:1:1"); // a single zero group is not compressed
    expect(formatIpv6(v6("2001:0:0:1:0:0:0:1"))).toBe("2001:0:0:1::1"); // the longer run wins
    expect(formatIpv6(v6("2001:db8:0:0:1:0:0:1"))).toBe("2001:db8::1:0:0:1"); // the first run wins a tie
    expect(formatIpv6(0n)).toBe("::");
    expect(formatIpv6(1n)).toBe("::1");
    expect(formatIpv6((1n << 128n) - 1n)).toBe("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff");
    expect(formatIpv6(v6("fe80::"))).toBe("fe80::");
  });
  it("writes the full form too", () => {
    expect(expandIpv6(v6("2001:db8::1"))).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(formatIpv6(v6("2001:db8::1"), false)).toBe("2001:db8:0:0:0:0:0:1");
  });
  it("reads :: in every position, brackets and an IPv4 tail", () => {
    expect(v6("::")).toBe(0n);
    expect(v6("::1")).toBe(1n);
    expect(v6("1::")).toBe(1n << 112n);
    expect(v6("1:2:3:4:5:6:7::")).toBe(v6("1:2:3:4:5:6:7:0"));
    expect(v6("::2:3:4:5:6:7:8")).toBe(v6("0:2:3:4:5:6:7:8"));
    expect(v6("[2001:db8::1]")).toBe(v6("2001:db8::1"));
    expect(v6("::ffff:192.0.2.1")).toBe(v6("::ffff:c000:201"));
    expect(v6("64:ff9b::192.0.2.33")).toBe(v6("64:ff9b::c000:221"));
    expect(v6("1:2:3:4:5:6:1.2.3.4")).toBe(v6("1:2:3:4:5:6:102:304"));
  });
  it("is not case sensitive and accepts short groups", () => {
    expect(v6("ABCD:ef::1")).toBe(v6("abcd:EF:0:0:0:0:0:1"));
  });
  it("rejects what is not an IPv6 address", () => {
    const bad = ["", "::g", "1:2:3:4:5:6:7", "1:2:3:4:5:6:7:8:9", ":::", "1::2::3", ":1:2:3:4:5:6:7", "1:2:3:4:5:6:7:", "12345::", "1:2:3:4:5:6:7:8::", "::1.2.3", "::1.2.3.256", "1.2.3.4::1", "fe80::1%eth0", "2001:db8::/32", "gggg::", "1:2", "[::1", "0x1::"];
    for (const text of bad) expect(() => v6(text), JSON.stringify(text)).toThrow(SubnetError);
  });
  it("round-trips a thousand addresses, including awkward zero runs", () => {
    let seed = 12345;
    const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 1000; i++) {
      const groups = Array.from({ length: 8 }, () => (rand() < 0.45 ? 0n : BigInt(Math.floor(rand() * 65536))));
      let value = 0n;
      for (const g of groups) value = (value << 16n) | g;
      expect(v6(formatIpv6(value))).toBe(value);
      expect(v6(formatIpv6(value, false))).toBe(value);
      expect(v6(expandIpv6(value))).toBe(value);
    }
  });
});

describe("parseIp", () => {
  it("picks the version from the colons", () => {
    expect(parseIp("10.0.0.1")).toEqual({ version: 4, value: 167772161n });
    expect(parseIp("::1")).toEqual({ version: 6, value: 1n });
  });
  it("passes on the reason", () => {
    expect(() => parseIp("hello")).toThrow(/not an IPv4 address/);
  });
});

describe("netmasks", () => {
  it("converts both ways for every prefix", () => {
    for (let p = 0; p <= 32; p++) expect(maskToPrefix(prefixToMask(p)), `/${p}`).toBe(p);
    expect(prefixToMask(24)).toBe("255.255.255.0");
    expect(prefixToMask(0)).toBe("0.0.0.0");
    expect(prefixToMask(32)).toBe("255.255.255.255");
    expect(prefixToMask(19)).toBe("255.255.224.0");
  });
  it("rejects masks with a hole in them", () => {
    for (const bad of ["255.0.255.0", "255.255.255.1", "0.255.255.255", "128.0.0.1", "255.255.0.255"]) expect(() => maskToPrefix(bad), bad).toThrow(/not a valid netmask/);
  });
  it("rejects prefixes outside 0 to 32", () => {
    expect(() => prefixToMask(33)).toThrow(SubnetError);
    expect(() => prefixToMask(-1)).toThrow(SubnetError);
    expect(() => prefixToMask(1.5)).toThrow(SubnetError);
  });
});

describe("parseNetwork", () => {
  it("masks the host bits and remembers what you typed", () => {
    const n = net("192.168.1.77/24");
    expect(formatIpv4(n.network)).toBe("192.168.1.0");
    expect(formatIpv4(n.last)).toBe("192.168.1.255");
    expect(formatIpv4(n.address)).toBe("192.168.1.77");
    expect(formatCidr(n)).toBe("192.168.1.0/24");
  });
  it("accepts a dotted netmask and a bare address", () => {
    expect(formatCidr(net("10.1.2.3/255.255.0.0"))).toBe("10.1.0.0/16");
    expect(formatCidr(net("10.1.2.3"))).toBe("10.1.2.3/32");
    expect(formatCidr(net("2001:db8::5"))).toBe("2001:db8::5/128");
  });
  it("handles IPv6", () => {
    expect(formatCidr(net("2001:db8:abcd:12::1/64"))).toBe("2001:db8:abcd:12::/64");
    expect(formatCidr(net("::/0"))).toBe("::/0");
  });
  it("handles /0 and the host prefixes", () => {
    const all = net("1.2.3.4/0");
    expect(all.network).toBe(0n);
    expect(all.last).toBe(4294967295n);
    expect(net("1.2.3.4/32").network).toBe(v4("1.2.3.4"));
  });
  it("rejects bad prefixes and extra slashes", () => {
    for (const bad of ["1.2.3.4/33", "1.2.3.4/-1", "1.2.3.4/", "1.2.3.4/a", "1.2.3.4/24/8", "::1/129", "::1/255.255.255.0", "1.2.3.4/1.5", "/24", "", "1.2.3.4/ 24 5"]) {
      expect(() => net(bad), JSON.stringify(bad)).toThrow(SubnetError);
    }
  });
  it("tolerates spaces around the prefix", () => {
    expect(formatCidr(net(" 10.0.0.0 / 8 "))).toBe("10.0.0.0/8");
  });
});

describe("analyzeNetwork", () => {
  it("describes a /24", () => {
    const info = analyzeNetwork(net("192.168.1.77/24"));
    expect(info).toMatchObject({
      cidr: "192.168.1.0/24",
      network: "192.168.1.0",
      netmask: "255.255.255.0",
      wildcard: "0.0.0.255",
      broadcast: "192.168.1.255",
      firstHost: "192.168.1.1",
      lastHost: "192.168.1.254",
      totalAddresses: 256n,
      usableHosts: 254n,
      hostBits: 8,
      kind: "Private network (RFC 1918)",
    });
    expect(info.notes.join(" ")).toContain("192.168.1.77");
  });
  it("matches the textbook numbers for common sizes", () => {
    expect(analyzeNetwork(net("10.0.0.0/8")).usableHosts).toBe(16_777_214n);
    expect(analyzeNetwork(net("172.16.0.0/12")).totalAddresses).toBe(1_048_576n);
    expect(analyzeNetwork(net("192.168.0.0/16")).usableHosts).toBe(65_534n);
    expect(analyzeNetwork(net("192.168.1.0/30")).usableHosts).toBe(2n);
    expect(analyzeNetwork(net("0.0.0.0/0")).totalAddresses).toBe(4_294_967_296n);
  });
  it("treats /31 and /32 as the special cases they are", () => {
    const p2p = analyzeNetwork(net("10.0.0.0/31"));
    expect(p2p).toMatchObject({ usableHosts: 2n, firstHost: "10.0.0.0", lastHost: "10.0.0.1" });
    expect(p2p.notes.join(" ")).toMatch(/RFC 3021/);
    const host = analyzeNetwork(net("10.0.0.5/32"));
    expect(host).toMatchObject({ usableHosts: 1n, firstHost: "10.0.0.5", lastHost: "10.0.0.5", totalAddresses: 1n });
  });
  it("describes IPv6 without a broadcast address or a netmask", () => {
    const info = analyzeNetwork(net("2001:db8::/32"));
    expect(info.netmask).toBeUndefined();
    expect(info.broadcast).toBeUndefined();
    expect(info).toMatchObject({ firstAddress: "2001:db8::", lastAddress: "2001:db8:ffff:ffff:ffff:ffff:ffff:ffff", totalAddresses: 1n << 96n, kind: "Documentation (RFC 3849)" });
    expect(analyzeNetwork(net("::/0")).totalAddresses).toBe(1n << 128n);
    expect(analyzeNetwork(net("2001:db8::/127")).notes.join(" ")).toMatch(/RFC 6164/);
    expect(analyzeNetwork(net("2001:db8::/96")).notes.join(" ")).toMatch(/\/64/);
  });
  it("checks the arithmetic: size equals 2^hostBits for every IPv4 prefix", () => {
    for (let p = 0; p <= 32; p++) {
      const info = analyzeNetwork(makeNetwork(4, 0xc0a80000n, p));
      expect(info.totalAddresses).toBe(1n << BigInt(32 - p));
      expect(info.hostBits).toBe(32 - p);
    }
  });
});

describe("classify", () => {
  const kind = (s: string) => classify(parseIp(s));
  it("names the special IPv4 blocks", () => {
    expect(kind("10.1.2.3")).toMatch(/Private/);
    expect(kind("172.16.0.1")).toMatch(/Private/);
    expect(kind("172.32.0.1")).toBe("Public address");
    expect(kind("192.168.0.1")).toMatch(/Private/);
    expect(kind("127.0.0.1")).toBe("Loopback");
    expect(kind("169.254.1.1")).toMatch(/Link-local/);
    expect(kind("100.64.0.1")).toMatch(/carrier-grade/);
    expect(kind("192.0.2.5")).toMatch(/TEST-NET-1/);
    expect(kind("198.51.100.7")).toMatch(/TEST-NET-2/);
    expect(kind("203.0.113.9")).toMatch(/TEST-NET-3/);
    expect(kind("224.0.0.251")).toBe("Multicast");
    expect(kind("240.0.0.1")).toMatch(/Reserved/);
    expect(kind("255.255.255.255")).toBe("Limited broadcast");
    expect(kind("8.8.8.8")).toBe("Public address");
    expect(kind("0.0.0.0")).toMatch(/This network/);
  });
  it("names the special IPv6 blocks", () => {
    expect(kind("::")).toBe("Unspecified address");
    expect(kind("::1")).toBe("Loopback");
    expect(kind("::ffff:1.2.3.4")).toBe("IPv4-mapped address");
    expect(kind("2001:db8::1")).toMatch(/Documentation/);
    expect(kind("fe80::1")).toBe("Link-local");
    expect(kind("fd12:3456::1")).toMatch(/Unique local/);
    expect(kind("ff02::1")).toBe("Multicast");
    expect(kind("2606:4700:4700::1111")).toBe("Public address");
    expect(kind("4000::1")).toMatch(/Reserved/);
  });
  it("uses the most specific block (TEST-NET inside the IETF /24 neighbour, Teredo vs documentation)", () => {
    expect(kind("192.0.0.5")).toBe("IETF protocol assignments");
    expect(kind("2001:db8::1")).toMatch(/Documentation/);
    expect(kind("2001:1::1")).toBe("IETF protocol assignments");
    expect(kind("2001:200::1")).toBe("Public address");
    expect(kind("3fff::1")).toMatch(/Documentation/);
  });
});

describe("describeIp", () => {
  it("shows the other ways to write an IPv4 address", () => {
    expect(describeIp(parseIp("192.168.1.1"))).toMatchObject({
      compressed: "192.168.1.1",
      decimal: "3232235777",
      hex: "0xc0a80101",
      binary: "11000000.10101000.00000001.00000001",
      reverseDns: "1.1.168.192.in-addr.arpa",
    });
  });
  it("shows the other ways to write an IPv6 address", () => {
    const d = describeIp(parseIp("2001:db8::567:89ab"));
    expect(d.expanded).toBe("2001:0db8:0000:0000:0000:0000:0567:89ab");
    expect(d.reverseDns).toBe("b.a.9.8.7.6.5.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa");
    expect(d.hex).toBe("0x20010db80000000000000000056789ab");
    expect(d.binary.split(" ")).toHaveLength(8);
    expect(describeIp(parseIp("::ffff:192.0.2.1")).mappedV4).toBe("192.0.2.1");
    expect(d.mappedV4).toBeUndefined();
  });
});

describe("containsAddress and networksOverlap", () => {
  it("includes both ends and excludes the neighbours", () => {
    const n = net("10.0.0.0/24");
    expect(containsAddress(n, parseIp("10.0.0.0"))).toBe(true);
    expect(containsAddress(n, parseIp("10.0.0.255"))).toBe(true);
    expect(containsAddress(n, parseIp("9.255.255.255"))).toBe(false);
    expect(containsAddress(n, parseIp("10.0.1.0"))).toBe(false);
  });
  it("never mixes versions", () => {
    expect(containsAddress(net("0.0.0.0/0"), parseIp("::ffff:1.2.3.4"))).toBe(false);
    expect(containsAddress(net("::/0"), parseIp("1.2.3.4"))).toBe(false);
    expect(networksOverlap(net("0.0.0.0/0"), net("::/0"))).toBe(false);
  });
  it("sees overlaps, nesting and touching blocks", () => {
    expect(networksOverlap(net("10.0.0.0/8"), net("10.1.0.0/16"))).toBe(true);
    expect(networksOverlap(net("10.0.0.0/24"), net("10.0.1.0/24"))).toBe(false);
    expect(networksOverlap(net("10.0.0.0/24"), net("10.0.0.255/32"))).toBe(true);
  });
});

describe("splitNetwork", () => {
  it("splits a /24 into four /26 blocks", () => {
    const r = splitNetwork(net("192.168.1.0/24"), 26);
    expect(r.total).toBe(4n);
    expect(r.perSubnet).toBe(64n);
    expect(r.subnets.map((s) => s.cidr)).toEqual(["192.168.1.0/26", "192.168.1.64/26", "192.168.1.128/26", "192.168.1.192/26"]);
    expect(r.subnets[3]).toMatchObject({ first: "192.168.1.192", last: "192.168.1.255" });
    expect(r.truncated).toBe(false);
  });
  it("returns the network itself when the prefix does not change", () => {
    expect(splitNetwork(net("10.0.0.0/8"), 8).subnets.map((s) => s.cidr)).toEqual(["10.0.0.0/8"]);
  });
  it("covers the parent exactly, with no gaps or overlaps", () => {
    const parent = net("172.16.0.0/20");
    for (const p of [20, 21, 24, 28, 32]) {
      const r = splitNetwork(parent, p, 1_000_000);
      expect(r.truncated).toBe(false);
      let expected = parent.network;
      for (const s of r.subnets) {
        const sub = net(s.cidr);
        expect(sub.network).toBe(expected);
        expected = sub.last + 1n;
      }
      expect(expected).toBe(parent.last + 1n);
    }
  });
  it("counts exactly but lists only a few when the result is huge", () => {
    const r = splitNetwork(net("10.0.0.0/8"), 24);
    expect(r.total).toBe(65_536n);
    expect(r.subnets).toHaveLength(SUBNET_LIMITS.maxListed);
    expect(r.truncated).toBe(true);
    const v6 = splitNetwork(net("2001:db8::/32"), 64);
    expect(v6.total).toBe(1n << 32n);
    expect(v6.subnets).toHaveLength(SUBNET_LIMITS.maxListed);
    expect(v6.subnets[1]?.cidr).toBe("2001:db8:0:1::/64");
    const extreme = splitNetwork(net("::/0"), 128, 3);
    expect(extreme.total).toBe(1n << 128n);
    expect(extreme.subnets.map((s) => s.cidr)).toEqual(["::/128", "::1/128", "::2/128"]);
  });
  it("refuses a shorter prefix or one that is out of range", () => {
    expect(() => splitNetwork(net("10.0.0.0/24"), 16)).toThrow(/shorter/);
    expect(() => splitNetwork(net("10.0.0.0/24"), 33)).toThrow(SubnetError);
    expect(() => splitNetwork(net("10.0.0.0/24"), NaN)).toThrow(SubnetError);
  });
});

describe("prefixForSubnetCount and prefixForHosts", () => {
  it("rounds the number of subnets up to a power of two", () => {
    const n = net("10.0.0.0/16");
    expect(prefixForSubnetCount(n, 1)).toBe(16);
    expect(prefixForSubnetCount(n, 2)).toBe(17);
    expect(prefixForSubnetCount(n, 3)).toBe(18);
    expect(prefixForSubnetCount(n, 4)).toBe(18);
    expect(prefixForSubnetCount(n, 5)).toBe(19);
    expect(prefixForSubnetCount(n, 65536)).toBe(32);
  });
  it("refuses impossible counts", () => {
    expect(() => prefixForSubnetCount(net("10.0.0.0/30"), 5)).toThrow(/cannot be split into 5/);
    expect(() => prefixForSubnetCount(net("10.0.0.0/24"), 0)).toThrow(SubnetError);
    expect(() => prefixForSubnetCount(net("10.0.0.0/24"), 2.5)).toThrow(SubnetError);
  });
  it("finds the prefix that holds a number of hosts", () => {
    expect(prefixForHosts(4, 1)).toBe(32);
    expect(prefixForHosts(4, 2)).toBe(31);
    expect(prefixForHosts(4, 3)).toBe(29);
    expect(prefixForHosts(4, 6)).toBe(29);
    expect(prefixForHosts(4, 7)).toBe(28);
    expect(prefixForHosts(4, 254)).toBe(24);
    expect(prefixForHosts(4, 255)).toBe(23);
    expect(prefixForHosts(6, 1)).toBe(128);
    expect(prefixForHosts(6, 2 ** 31)).toBe(97);
  });
  it("is consistent with the usable-host count", () => {
    for (const hosts of [1, 2, 3, 10, 50, 100, 253, 254, 255, 1000, 65_533, 65_534, 65_535]) {
      const p = prefixForHosts(4, hosts);
      expect(analyzeNetwork(makeNetwork(4, 0n, p)).usableHosts >= BigInt(hosts), `${hosts} in /${p}`).toBe(true);
      if (p < 32) expect(analyzeNetwork(makeNetwork(4, 0n, p + 1)).usableHosts < BigInt(hosts), `${hosts} would fit /${p + 1}`).toBe(true);
    }
  });
  it("refuses silly numbers", () => {
    expect(() => prefixForHosts(4, 0)).toThrow(SubnetError);
    expect(() => prefixForHosts(4, 2 ** 40)).toThrow(/no IPv4 network/);
    expect(() => prefixForHosts(4, NaN)).toThrow(SubnetError);
  });
});

describe("rangeToNetworks", () => {
  const range = (a: string, b: string) => cidrs(rangeToNetworks(parseIp(a), parseIp(b)));
  it("gives the smallest list of blocks", () => {
    expect(range("10.0.0.1", "10.0.0.6")).toEqual(["10.0.0.1/32", "10.0.0.2/31", "10.0.0.4/31", "10.0.0.6/32"]);
    expect(range("192.168.0.0", "192.168.255.255")).toEqual(["192.168.0.0/16"]);
    expect(range("10.0.0.0", "10.0.0.0")).toEqual(["10.0.0.0/32"]);
    expect(range("192.168.1.100", "192.168.2.50")).toEqual(["192.168.1.100/30", "192.168.1.104/29", "192.168.1.112/28", "192.168.1.128/25", "192.168.2.0/27", "192.168.2.32/28", "192.168.2.48/31", "192.168.2.50/32"]);
  });
  it("covers the whole address space with one block", () => {
    expect(range("0.0.0.0", "255.255.255.255")).toEqual(["0.0.0.0/0"]);
    expect(range("::", "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toEqual(["::/0"]);
    expect(range("0.0.0.0", "0.0.0.0")).toEqual(["0.0.0.0/32"]);
    expect(range("255.255.255.255", "255.255.255.255")).toEqual(["255.255.255.255/32"]);
  });
  it("works for IPv6", () => {
    expect(range("2001:db8::", "2001:db8::ffff")).toEqual(["2001:db8::/112"]);
    expect(range("2001:db8::1", "2001:db8::2")).toEqual(["2001:db8::1/128", "2001:db8::2/128"]);
  });
  it("matches a brute-force answer: exact cover, no overlap, and no mergeable neighbours", () => {
    let seed = 99;
    const rand = (n: number) => Math.floor(((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * n);
    for (let trial = 0; trial < 300; trial++) {
      const a = rand(1 << 12);
      const b = a + rand(1 << 10);
      const start = 0x0a000000n + BigInt(a);
      const end = 0x0a000000n + BigInt(b);
      const nets = rangeToNetworks({ version: 4, value: start }, { version: 4, value: end });
      let expected = start;
      for (const n of nets) {
        expect(n.network, `trial ${trial}`).toBe(expected);
        expected = n.last + 1n;
      }
      expect(expected).toBe(end + 1n);
      // Minimal: no two neighbouring blocks of equal size that could have been one bigger block.
      for (let i = 0; i + 1 < nets.length; i++) {
        const x = nets[i] as ReturnType<typeof makeNetwork>;
        const y = nets[i + 1] as ReturnType<typeof makeNetwork>;
        const joinable = x.prefix === y.prefix && x.prefix > 0 && (x.network & (1n << BigInt(32 - x.prefix))) === 0n;
        expect(joinable, `trial ${trial}: ${formatCidr(x)} ${formatCidr(y)}`).toBe(false);
      }
    }
  });
  it("is quick for the worst case (an IPv6 range that needs about 250 blocks)", () => {
    const started = Date.now();
    const nets = rangeToNetworks(parseIp("::1"), parseIp("ffff:ffff:ffff:ffff:ffff:ffff:ffff:fffe"));
    expect(nets.length).toBeGreaterThan(200);
    expect(nets.length).toBeLessThan(260);
    expect(Date.now() - started).toBeLessThan(500);
  });
  it("refuses mixed versions and backwards ranges", () => {
    expect(() => rangeToNetworks(parseIp("1.2.3.4"), parseIp("::1"))).toThrow(/both be IPv4 or both be IPv6/);
    expect(() => rangeToNetworks(parseIp("10.0.0.9"), parseIp("10.0.0.1"))).toThrow(/after the end/);
  });
});

describe("summarize", () => {
  const sum = (text: string) => summarize(text).summaries.map((s) => cidrs(s.networks));
  it("joins neighbouring blocks into one", () => {
    expect(sum("192.168.0.0/24\n192.168.1.0/24")).toEqual([["192.168.0.0/23"]]);
    expect(sum("10.0.0.0/25\n10.0.0.128/25")).toEqual([["10.0.0.0/24"]]);
  });
  it("drops blocks that are inside others, and duplicates", () => {
    expect(sum("10.0.0.0/8\n10.1.2.0/24\n10.0.0.0/8\n10.255.255.255")).toEqual([["10.0.0.0/8"]]);
  });
  it("keeps separate blocks separate, in order", () => {
    expect(sum("192.168.1.0/24\n10.0.0.0/24\n172.16.0.0/24")).toEqual([["10.0.0.0/24", "172.16.0.0/24", "192.168.1.0/24"]]);
  });
  it("turns single addresses and ranges into blocks", () => {
    expect(sum("10.0.0.1\n10.0.0.2\n10.0.0.3\n10.0.0.0")).toEqual([["10.0.0.0/30"]]);
    expect(sum("10.0.0.1 - 10.0.0.6")).toEqual([["10.0.0.1/32", "10.0.0.2/31", "10.0.0.4/31", "10.0.0.6/32"]]);
    expect(sum("10.0.0.1-10.0.0.2")).toEqual([["10.0.0.1/32", "10.0.0.2/32"]]);
  });
  it("accepts commas, semicolons, spaces, comments and Windows line endings", () => {
    expect(sum("10.0.0.0/25, 10.0.0.128/25 # the lab\r\n; 192.168.0.0/16")).toEqual([["10.0.0.0/24", "192.168.0.0/16"]]);
    expect(sum("10.0.0.0/25 10.0.0.128/25")).toEqual([["10.0.0.0/24"]]);
  });
  it("handles IPv4 and IPv6 together, each on its own", () => {
    const result = summarize("10.0.0.0/24\n2001:db8::/33\n2001:db8:8000::/33");
    expect(result.summaries.map((s) => [s.version, cidrs(s.networks)])).toEqual([
      [4, ["10.0.0.0/24"]],
      [6, ["2001:db8::/32"]],
    ]);
  });
  it("reports lines it cannot read and still does the rest", () => {
    const result = summarize("10.0.0.0/24\nnot an address\n10.0.0.256\n10.0.1.0/24");
    expect(cidrs(result.summaries[0]!.networks)).toEqual(["10.0.0.0/23"]);
    expect(result.problems.map((p) => [p.line, p.text])).toEqual([
      [2, "not"],
      [2, "an"],
      [2, "address"],
      [3, "10.0.0.256"],
    ]);
    expect(result.linesRead).toBe(2);
  });
  it("covers exactly what went in (checked against a brute-force bitmap)", () => {
    let seed = 7;
    const rand = (n: number) => Math.floor(((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * n);
    for (let trial = 0; trial < 100; trial++) {
      const lines: string[] = [];
      const covered = new Set<number>();
      for (let k = 0; k < 8; k++) {
        const prefix = 24 + rand(9);
        const offset = rand(1 << 10);
        const addr = 0x0a000000 + offset;
        const size = 2 ** (32 - prefix);
        const start = addr - (addr % size);
        lines.push(`${formatIpv4(BigInt(start))}/${prefix}`);
        for (let a = start; a < start + size; a++) covered.add(a);
      }
      const out = summarize(lines.join("\n")).summaries[0]!.networks;
      const got = new Set<number>();
      for (const n of out) for (let a = Number(n.network); a <= Number(n.last); a++) got.add(a);
      expect(got.size, `trial ${trial}`).toBe(covered.size);
      for (const a of covered) expect(got.has(a)).toBe(true);
    }
  });
  it("copes with an empty list and a huge one", () => {
    expect(summarize("").summaries).toEqual([]);
    expect(summarize("  \n # nothing \n").summaries).toEqual([]);
    const many = Array.from({ length: 10_000 }, (_, i) => `10.${i >> 8}.${i & 255}.0/24`).join("\n");
    const result = summarize(many);
    expect(result.linesRead).toBe(10_000);
    expect(result.summaries[0]?.networks.length).toBeLessThan(50);
  });
  it("refuses a list that is far too long", () => {
    expect(() => summarize("1.1.1.1\n".repeat(SUBNET_LIMITS.maxSummarizeLines + 1))).toThrow(/At most/);
    expect(() => summarize("x".repeat(SUBNET_LIMITS.maxInputChars + 1))).toThrow(/too long/);
  });
});

describe("ipv4PrefixTable", () => {
  it("has /8 to /32 with the usual figures", () => {
    const rows = ipv4PrefixTable();
    expect(rows).toHaveLength(25);
    expect(rows[0]).toMatchObject({ prefix: 8, netmask: "255.0.0.0", addresses: 16_777_216n, usable: 16_777_214n });
    const slash24 = rows.find((r) => r.prefix === 24)!;
    expect(slash24).toMatchObject({ netmask: "255.255.255.0", wildcard: "0.0.0.255", addresses: 256n, usable: 254n });
    expect(rows.at(-1)).toMatchObject({ prefix: 32, usable: 1n });
    expect(rows.find((r) => r.prefix === 31)?.usable).toBe(2n);
  });
});

describe("formatIp", () => {
  it("formats either version", () => {
    expect(formatIp({ version: 4, value: 1n })).toBe("0.0.0.1");
    expect(formatIp({ version: 6, value: 1n })).toBe("::1");
    expect(formatIp({ version: 6, value: 1n }, false)).toBe("0:0:0:0:0:0:0:1");
  });
});
