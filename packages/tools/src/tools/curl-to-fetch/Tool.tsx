"use client";

import { TransformTool } from "@toolwright/ui";
import { curlToFetch } from "@toolwright/core/curl-to-fetch";

const SAMPLE = `curl -X POST 'https://api.example.com/v1/users' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Ada Lovelace","email":"ada@example.com"}'`;

export default function Tool() {
  return (
    <TransformTool
      // Commands often contain tokens and passwords, so keep them out of shareable URLs.
      shareable={false}
      inputLabel="cURL command"
      outputLabel="fetch code"
      outputFilename="request.js"
      outputMime="text/javascript"
      sample={SAMPLE}
      rows={12}
      options={[
        {
          type: "select",
          key: "responseAs",
          label: "Read the response as",
          default: "json",
          options: [
            { value: "json", label: "JSON" },
            { value: "text", label: "Text" },
            { value: "none", label: "Leave it out" },
          ],
        },
        { type: "toggle", key: "omitBrowserHeaders", label: "Leave out headers browsers refuse to set", default: false },
      ]}
      transform={(input, o) =>
        curlToFetch(input, {
          responseAs: o.responseAs === "text" ? "text" : o.responseAs === "none" ? "none" : "json",
          omitBrowserHeaders: Boolean(o.omitBrowserHeaders),
        })
      }
    />
  );
}
