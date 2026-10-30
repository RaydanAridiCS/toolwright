"use client";

import { TransformTool } from "@toolwright/ui";
import { formatGraphql, minifyGraphql } from "@toolwright/core/graphql-formatter";

const SAMPLE = `query GetUser($id: ID!, $first: Int = 10){user(id:$id){id name,email friends(first:$first){edges{node{id name}}} ...Profile}}
fragment Profile on User{avatarUrl(size:64) bio}`;

export default function Tool() {
  return (
    <TransformTool
      acceptFile=".graphql,.gql,.txt"
      inputLabel="GraphQL"
      outputLabel="Formatted GraphQL"
      outputFilename="query.graphql"
      sample={SAMPLE}
      rows={14}
      options={[
        {
          type: "select",
          key: "action",
          label: "Action",
          default: "format",
          options: [
            { value: "format", label: "Format" },
            { value: "minify", label: "Minify" },
          ],
        },
        {
          type: "select",
          key: "indent",
          label: "Indent",
          default: "2",
          options: [
            { value: "2", label: "2 spaces" },
            { value: "4", label: "4 spaces" },
            { value: "tab", label: "Tab" },
          ],
        },
      ]}
      transform={(input, o) => (o.action === "minify" ? minifyGraphql(input) : formatGraphql(input, { indent: o.indent === "tab" ? "tab" : Number(o.indent) }))}
    />
  );
}
