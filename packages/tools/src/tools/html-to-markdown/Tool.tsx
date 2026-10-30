"use client";

import { TransformTool } from "@toolwright/ui";
import { htmlToMarkdown } from "@toolwright/core/html-to-markdown";

const SAMPLE = `<h1>Release notes</h1>
<p>Version <strong>2.0</strong> is out. Read the <a href="https://example.com/changelog">full changelog</a> or <em>skim</em> the list:</p>
<ul>
  <li>Faster start-up</li>
  <li>Smaller downloads
    <ul><li>Images are now <code>lazy</code></li></ul>
  </li>
</ul>
<table>
  <thead><tr><th>Plan</th><th align="right">Price</th></tr></thead>
  <tbody><tr><td>Free</td><td>$0</td></tr><tr><td>Team</td><td>$12</td></tr></tbody>
</table>
<pre><code class="language-bash">npm install toolwright</code></pre>`;

export default function Tool() {
  return (
    <TransformTool
      acceptFile=".html,.htm,.txt"
      inputLabel="HTML"
      outputLabel="Markdown"
      outputFilename="document.md"
      outputMime="text/markdown"
      sample={SAMPLE}
      rows={16}
      options={[
        {
          type: "select",
          key: "bullet",
          label: "Bullet marker",
          default: "-",
          options: [
            { value: "-", label: "Dash (-)" },
            { value: "*", label: "Asterisk (*)" },
            { value: "+", label: "Plus (+)" },
          ],
        },
        { type: "toggle", key: "links", label: "Keep links", default: true },
        { type: "toggle", key: "images", label: "Keep images", default: true },
      ]}
      transform={(input, o) =>
        htmlToMarkdown(input, {
          bullet: o.bullet as "-" | "*" | "+",
          links: Boolean(o.links),
          images: Boolean(o.images),
        })
      }
    />
  );
}
