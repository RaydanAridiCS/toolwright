import type { Metadata } from "next";
import { pageMetadata } from "../../lib/seo";
import Link from "next/link";
import { ProsePage } from "../../components/prose-page";
import { SITE } from "../../lib/site";

export const metadata: Metadata = pageMetadata({ title: "Contribute a Tool to Toolwright", description: "Add a tool, fix a bug or improve the docs. Every Toolwright tool is a single folder, and a generator scaffolds it for you.", path: "/contribute" });

export default function ContributePage() {
  return (
    <ProsePage kicker="Join the workshop" title="Contribute" intro="The easiest way to add to Toolwright is to add a tool. Each one lives in its own folder, so you never need to touch the rest of the app.">
      <h2>Add a tool in five steps</h2>
      <ol>
        <li>
          <strong>Pick an idea</strong> from the <Link href="/requests">most-voted requests</Link> (or open an issue first if you&rsquo;re unsure it fits).
        </li>
        <li>
          <strong>Scaffold it:</strong>
          <pre>
            <code>{`git clone ${SITE.repo}
cd toolwright
npm install
npm run new-tool my-tool-name`}</code>
          </pre>
        </li>
        <li>
          <strong>Write the logic</strong> as pure functions in <code>packages/core/src</code> and test them. Keep it free of React and the DOM so it can be reused and tested in Node.
        </li>
        <li>
          <strong>Build the UI</strong> in <code>packages/tools/src/tools/my-tool-name/Tool.tsx</code>. For text-in/text-out tools, the <code>TransformTool</code> component gives you input, output, options, copy, download and shareable links in about 20 lines.
        </li>
        <li>
          <strong>Run the checks</strong> and open a pull request:
          <pre>
            <code>{`npm run lint && npm run typecheck && npm test`}</code>
          </pre>
        </li>
      </ol>

      <h2>The rules of the workshop</h2>
      <ul>
        <li>
          <strong>No network calls from tools.</strong> Input must never leave the device. The Content Security Policy blocks it and the end-to-end tests fail if a tool tries.
        </li>
        <li>
          <strong>Be honest in the copy.</strong> Say what the tool can&rsquo;t do. Never overstate security.
        </li>
        <li>
          <strong>Test the logic.</strong> New <code>core</code> functions need unit tests, including edge cases and bad input.
        </li>
        <li>
          <strong>Accessible by default.</strong> Label every control, support keyboard use, and don&rsquo;t rely on color alone.
        </li>
        <li>
          <strong>Keep dependencies light.</strong> Prefer platform APIs. New packages need a clear reason.
        </li>
      </ul>

      <h2>Other ways to help</h2>
      <ul>
        <li>Report bugs or privacy concerns on GitHub.</li>
        <li>Improve documentation and tool descriptions.</li>
        <li>Check tools on your devices and tell us what breaks.</li>
        <li>Translate or review the tool help text.</li>
      </ul>

      <p>
        Full guides (architecture, writing a tool, testing) are in the{" "}
        <a href={`${SITE.repo}/tree/main/docs`} target="_blank" rel="noopener noreferrer">
          docs folder
        </a>
        . Thank you for helping build it.
      </p>
    </ProsePage>
  );
}
