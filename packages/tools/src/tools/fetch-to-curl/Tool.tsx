"use client";

import { TransformTool } from "@toolwright/ui";
import { fetchToCurl } from "@toolwright/core/fetch-to-curl";

const SAMPLE = `const response = await fetch("https://api.example.com/v1/users", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_TOKEN",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com" }),
});`;

export default function Tool() {
  return (
    <TransformTool
      // Code often contains tokens and passwords, so keep it out of shareable URLs.
      shareable={false}
      inputLabel="fetch code"
      outputLabel="cURL command"
      outputFilename="request.sh"
      outputMime="text/x-shellscript"
      sample={SAMPLE}
      rows={12}
      options={[
        { type: "toggle", key: "multiline", label: "One option per line", default: true },
        { type: "toggle", key: "followRedirects", label: "Follow redirects (-L), as fetch does", default: true },
        { type: "toggle", key: "compressed", label: "Ask for compressed responses (--compressed)", default: false },
      ]}
      transform={(input, o) =>
        fetchToCurl(input, { multiline: Boolean(o.multiline), followRedirects: Boolean(o.followRedirects), compressed: Boolean(o.compressed) })
      }
    />
  );
}
