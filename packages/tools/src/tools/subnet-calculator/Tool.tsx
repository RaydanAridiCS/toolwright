"use client";

import { useMemo, useState } from "react";
import { Alert, CopyButton, Field, Input, Panel, ResultSlab, ScrollArea, SegmentedControl, Select, Stat, StatGrid, Textarea } from "@toolwright/ui";
import {
  SUBNET_LIMITS,
  analyzeNetwork,
  containsAddress,
  describeIp,
  formatCidr,
  formatIp,
  ipv4PrefixTable,
  parseIp,
  parseNetwork,
  prefixForHosts,
  prefixForSubnetCount,
  rangeToNetworks,
  splitNetwork,
  summarize,
  type Ip,
  type Network,
} from "@toolwright/core/subnet-calculator";
import { ResultRow } from "../../shared/result-row";
import { errorMessage, formatInt } from "../../shared/format";

type Mode = "network" | "split" | "range" | "contains" | "merge";
type SplitBy = "prefix" | "count" | "hosts";

const MODES: { value: Mode; label: string }[] = [
  { value: "network", label: "Network" },
  { value: "split", label: "Split" },
  { value: "range", label: "Range to CIDR" },
  { value: "contains", label: "Contains" },
  { value: "merge", label: "Merge list" },
];

const big = (n: bigint) => n.toLocaleString("en-US");

/** Runs a calculation and turns a thrown error into a message instead of a crash. */
function attempt<T>(run: () => T): { value: T; error: null } | { value: null; error: string } {
  try {
    return { value: run(), error: null };
  } catch (err) {
    return { value: null, error: errorMessage(err) };
  }
}

/** The address part of "192.168.1.77/24", for the details panel. */
function addressPart(text: string): Ip {
  const slash = text.indexOf("/");
  return parseIp(slash === -1 ? text : text.slice(0, slash));
}

function NetworkMode() {
  const [text, setText] = useState("192.168.1.77/24");
  const result = useMemo(() => attempt(() => ({ net: parseNetwork(text), details: describeIp(addressPart(text)) })), [text]);
  const info = result.value ? analyzeNetwork(result.value.net) : null;
  const details = result.value?.details;
  return (
    <div className="flex flex-col gap-5">
      <Field label="Network or address" hint="For example 192.168.1.0/24, 10.0.0.5/255.255.255.0 or 2001:db8::/32.">
        {(id) => <Input id={id} mono value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoComplete="off" />}
      </Field>
      {result.error && text.trim() ? <Alert tone="error">{result.error}</Alert> : null}
      {info && details ? (
        <>
          <ResultSlab label="Usable hosts" value={big(info.usableHosts)} valueTestId="subnet-hosts" note={`${info.cidr} · ${info.kind}`} />
          <StatGrid>
            <Stat label="Prefix" value={`/${info.prefix}`} />
            <Stat label="Total addresses" value={big(info.totalAddresses)} />
            <Stat label="Host bits" value={String(info.hostBits)} />
          </StatGrid>
          {info.notes.map((note) => (
            <Alert key={note} tone="info">
              {note}
            </Alert>
          ))}
          <div className="grid gap-2 sm:grid-cols-2">
            <ResultRow label="Network address" value={info.network} />
            {info.netmask ? <ResultRow label="Netmask" value={info.netmask} /> : null}
            {info.wildcard ? <ResultRow label="Wildcard mask" value={info.wildcard} /> : null}
            {info.broadcast ? <ResultRow label="Broadcast address" value={info.broadcast} /> : null}
            <ResultRow label="First usable address" value={info.firstHost} />
            <ResultRow label="Last usable address" value={info.lastHost} />
            <ResultRow label="CIDR notation" value={info.cidr} />
            {info.version === 6 ? <ResultRow label="Last address" value={info.lastAddress} /> : null}
          </div>
          <Panel title="The address you typed">
            <div className="grid gap-2 sm:grid-cols-2">
              <ResultRow label="Short form" value={details.compressed} />
              {details.expanded ? <ResultRow label="Full form" value={details.expanded} /> : null}
              <ResultRow label="As a number" value={details.decimal} />
              <ResultRow label="Hexadecimal" value={details.hex} />
              <ResultRow label="Binary" value={details.binary} />
              <ResultRow label="Reverse DNS name" value={details.reverseDns} />
              {details.mappedV4 ? <ResultRow label="Contains the IPv4 address" value={details.mappedV4} /> : null}
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function SplitMode() {
  const [text, setText] = useState("192.168.0.0/16");
  const [by, setBy] = useState<SplitBy>("prefix");
  const [value, setValue] = useState("24");
  const result = useMemo(
    () =>
      attempt(() => {
        const net = parseNetwork(text);
        if (!/^\d+$/.test(value.trim())) throw new Error("Enter a whole number.");
        const n = Number(value);
        const prefix = by === "prefix" ? n : by === "count" ? prefixForSubnetCount(net, n) : prefixForHosts(net.version, n);
        return splitNetwork(net, prefix);
      }),
    [text, by, value],
  );
  const split = result.value;
  const listText = split ? split.subnets.map((s) => s.cidr).join("\n") : "";
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Network to split">{(id) => <Input id={id} mono value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoComplete="off" />}</Field>
        <Field label="Split by">
          {(id) => (
            <Select id={id} value={by} onChange={(e) => setBy(e.target.value as SplitBy)}>
              <option value="prefix">New prefix length</option>
              <option value="count">Number of subnets</option>
              <option value="hosts">Hosts per subnet</option>
            </Select>
          )}
        </Field>
        <Field label={by === "prefix" ? "New prefix (the number after /)" : by === "count" ? "How many subnets" : "Hosts needed in each"}>
          {(id) => <Input id={id} mono inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />}
        </Field>
      </div>
      {result.error && text.trim() ? <Alert tone="error">{result.error}</Alert> : null}
      {split ? (
        <>
          <ResultSlab label="Subnets" value={big(split.total)} valueTestId="subnet-split-count" note={`${split.parent} into /${split.newPrefix} blocks of ${big(split.perSubnet)} addresses each`} />
          {split.truncated ? (
            <Alert tone="info">
              Showing the first {formatInt(split.subnets.length)} of {big(split.total)} subnets.
            </Alert>
          ) : null}
          <div className="flex items-center gap-2">
            <CopyButton text={listText} label="Copy list" disabled={!listText} />
          </div>
          <ScrollArea label="Subnets" className="max-h-96 border border-border bg-card">
            <table className="w-full min-w-[30rem] text-left font-mono text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Subnet</th>
                  <th scope="col" className="px-3 py-2 font-medium">First address</th>
                  <th scope="col" className="px-3 py-2 font-medium">Last address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {split.subnets.map((s) => (
                  <tr key={s.cidr}>
                    <td className="px-3 py-1.5">{s.cidr}</td>
                    <td className="px-3 py-1.5">{s.first}</td>
                    <td className="px-3 py-1.5">{s.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </>
      ) : null}
    </div>
  );
}

function RangeMode() {
  const [start, setStart] = useState("10.0.0.1");
  const [end, setEnd] = useState("10.0.0.6");
  const result = useMemo(() => attempt(() => rangeToNetworks(parseIp(start), parseIp(end))), [start, end]);
  const list = result.value ? result.value.map(formatCidr) : [];
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First address">{(id) => <Input id={id} mono value={start} onChange={(e) => setStart(e.target.value)} spellCheck={false} autoComplete="off" />}</Field>
        <Field label="Last address">{(id) => <Input id={id} mono value={end} onChange={(e) => setEnd(e.target.value)} spellCheck={false} autoComplete="off" />}</Field>
      </div>
      {result.error && (start.trim() || end.trim()) ? <Alert tone="error">{result.error}</Alert> : null}
      {result.value ? (
        <>
          <ResultSlab label="CIDR blocks needed" value={String(list.length)} valueTestId="range-count" note="The fewest blocks that cover exactly this range." />
          <div className="flex items-center gap-2">
            <CopyButton text={list.join("\n")} label="Copy list" />
          </div>
          <ul aria-label="CIDR blocks" className="grid gap-1.5 font-mono text-sm sm:grid-cols-2">
            {list.map((cidr) => (
              <li key={cidr} className="border border-border bg-card px-3 py-1.5">
                {cidr}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function ContainsMode() {
  const [networkText, setNetworkText] = useState("10.0.0.0/8");
  const [addressText, setAddressText] = useState("10.200.3.4");
  const result = useMemo(
    () =>
      attempt(() => {
        const net: Network = parseNetwork(networkText);
        const ip = parseIp(addressText);
        const info = analyzeNetwork(net);
        return { inside: containsAddress(net, ip), cidr: info.cidr, address: formatIp(ip), mismatch: net.version !== ip.version, first: info.firstAddress, last: info.lastAddress };
      }),
    [networkText, addressText],
  );
  const answer = result.value;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Network">{(id) => <Input id={id} mono value={networkText} onChange={(e) => setNetworkText(e.target.value)} spellCheck={false} autoComplete="off" />}</Field>
        <Field label="Address to check">{(id) => <Input id={id} mono value={addressText} onChange={(e) => setAddressText(e.target.value)} spellCheck={false} autoComplete="off" />}</Field>
      </div>
      {result.error && (networkText.trim() || addressText.trim()) ? <Alert tone="error">{result.error}</Alert> : null}
      {answer ? (
        <ResultSlab
          size="md"
          label="Answer"
          value={answer.inside ? "Yes, it is inside" : "No, it is outside"}
          valueTestId="contains-answer"
          note={
            answer.mismatch
              ? `${answer.address} and ${answer.cidr} are different IP versions, so they never match.`
              : `${answer.address} ${answer.inside ? "is in" : "is not in"} ${answer.cidr} (${answer.first} to ${answer.last}).`
          }
        />
      ) : null}
    </div>
  );
}

const MERGE_SAMPLE = "192.168.0.0/24\n192.168.1.0/24\n192.168.2.0/25\n10.0.0.1 - 10.0.0.6\n2001:db8::/33\n2001:db8:8000::/33";

function MergeMode() {
  const [text, setText] = useState(MERGE_SAMPLE);
  const result = useMemo(() => attempt(() => summarize(text)), [text]);
  const out = result.value;
  const lines = out ? out.summaries.flatMap((s) => s.networks.map(formatCidr)) : [];
  return (
    <div className="flex flex-col gap-5">
      <Field label="Addresses, networks and ranges" hint="One per line, or separated by commas. Ranges are written 10.0.0.1 - 10.0.0.9. Everything after # is ignored.">
        {(id) => <Textarea id={id} rows={8} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />}
      </Field>
      {result.error ? <Alert tone="error">{result.error}</Alert> : null}
      {out ? (
        <>
          {out.problems.length > 0 ? (
            <Alert tone="warning" title={`${out.problems.length} ${out.problems.length === 1 ? "item" : "items"} could not be read`}>
              <ul className="list-disc pl-5">
                {out.problems.slice(0, 6).map((p, i) => (
                  <li key={i}>
                    Line {p.line}, &ldquo;{p.text}&rdquo;: {p.message}
                  </li>
                ))}
              </ul>
              {out.problems.length > 6 ? <p>And {out.problems.length - 6} more.</p> : null}
            </Alert>
          ) : null}
          {lines.length > 0 ? (
            <>
              <ResultSlab label="Blocks after merging" value={String(lines.length)} valueTestId="merge-count" note={`From ${out.linesRead} ${out.linesRead === 1 ? "item" : "items"}.`} />
              <div className="flex items-center gap-2">
                <CopyButton text={lines.join("\n")} label="Copy list" />
              </div>
              <ul aria-label="Merged blocks" className="grid gap-1.5 font-mono text-sm sm:grid-cols-2">
                {lines.map((cidr) => (
                  <li key={cidr} className="border border-border bg-card px-3 py-1.5">
                    {cidr}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
      <p className="text-xs text-muted-foreground">Up to {formatInt(SUBNET_LIMITS.maxSummarizeLines)} lines at a time.</p>
    </div>
  );
}

function PrefixTable() {
  const rows = useMemo(() => ipv4PrefixTable(), []);
  return (
    <ScrollArea label="IPv4 prefix lengths" className="max-h-96 border border-border bg-card">
      <table className="w-full min-w-[34rem] text-left font-mono text-sm">
        <caption className="sr-only">IPv4 prefix lengths from /8 to /32</caption>
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Prefix</th>
            <th scope="col" className="px-3 py-2 font-medium">Netmask</th>
            <th scope="col" className="px-3 py-2 font-medium">Wildcard</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Addresses</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Usable</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.prefix}>
              <td className="px-3 py-1.5">/{r.prefix}</td>
              <td className="px-3 py-1.5">{r.netmask}</td>
              <td className="px-3 py-1.5">{r.wildcard}</td>
              <td className="px-3 py-1.5 text-right">{big(r.addresses)}</td>
              <td className="px-3 py-1.5 text-right">{big(r.usable)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

export default function Tool() {
  const [mode, setMode] = useState<Mode>("network");
  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl<Mode> label="What do you want to do" value={mode} onValueChange={setMode} options={MODES} />
      {mode === "network" ? <NetworkMode /> : null}
      {mode === "split" ? <SplitMode /> : null}
      {mode === "range" ? <RangeMode /> : null}
      {mode === "contains" ? <ContainsMode /> : null}
      {mode === "merge" ? <MergeMode /> : null}
      <Panel title="IPv4 prefix lengths">
        <PrefixTable />
      </Panel>
    </div>
  );
}
