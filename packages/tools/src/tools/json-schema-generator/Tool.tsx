"use client";

import { TransformTool } from "@toolwright/ui";
import { jsonToSchema, type SchemaDraft } from "@toolwright/core/json-schema-generator";

const SAMPLE = JSON.stringify(
  [
    { id: 1, name: "Ada Lovelace", email: "ada@example.com", joined: "2024-03-01", score: 9.5, tags: ["math", "engines"], address: { city: "London" } },
    { id: 2, name: "Grace Hopper", email: "grace@example.com", joined: "2024-04-12", score: 10, tags: [], nickname: null },
  ],
  null,
  2,
);

export default function Tool() {
  return (
    <TransformTool
      acceptFile=".json,.txt"
      inputLabel="JSON sample"
      outputLabel="JSON Schema"
      outputFilename="schema.json"
      outputMime="application/json"
      sample={SAMPLE}
      rows={16}
      options={[
        {
          type: "select",
          key: "draft",
          label: "Schema version",
          default: "2020-12",
          options: [
            { value: "2020-12", label: "2020-12" },
            { value: "2019-09", label: "2019-09" },
            { value: "draft-07", label: "Draft 7" },
          ],
        },
        { type: "toggle", key: "markRequired", label: "Mark keys present in every sample as required", default: true },
        { type: "toggle", key: "detectFormats", label: "Detect formats (date, email, uuid…)", default: true },
        { type: "toggle", key: "noAdditionalProperties", label: "Disallow extra keys", default: false },
      ]}
      transform={(input, o) =>
        jsonToSchema(input, {
          draft: o.draft as SchemaDraft,
          markRequired: Boolean(o.markRequired),
          detectFormats: Boolean(o.detectFormats),
          noAdditionalProperties: Boolean(o.noAdditionalProperties),
        })
      }
    />
  );
}
