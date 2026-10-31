import type { Metadata } from "next";
import { pageMetadata } from "../../lib/seo";
import Link from "next/link";
import { ProsePage } from "../../components/prose-page";
import { SITE } from "../../lib/site";

export const metadata: Metadata = pageMetadata({ title: "How Toolwright Keeps Your Files Private", description: "Toolwright tools run entirely in your browser. Here is exactly what that means, what is stored, and how you can verify it yourself.", path: "/privacy" });

export default function PrivacyPage() {
  return (
    <ProsePage kicker="The privacy model" title="How privacy works" intro="“Your data never leaves your device” is easy to say. This page explains how it is true, what the few exceptions are, and how to check for yourself.">
      <h2>The short version</h2>
      <ul>
        <li>
          <strong>Tools run in your browser.</strong> When you format JSON, merge PDFs or compress an image, the work is done by JavaScript on your device. Your text and files are not sent anywhere.
        </li>
        <li>
          <strong>The browser enforces it.</strong> Our pages ship a Content Security Policy that only allows connections back to toolwright.com. A tool physically cannot send your input to another server.
        </li>
        <li>
          <strong>No accounts and no tracking scripts.</strong> We don&rsquo;t ask who you are, and there are no analytics, advertising or fingerprinting scripts on the site.
        </li>
        <li>
          <strong>It&rsquo;s open source.</strong> Everything described here is in{" "}
          <a href={SITE.repo} target="_blank" rel="noopener noreferrer">
            the public repository
          </a>
          , so you can read exactly what each tool does.
        </li>
      </ul>

      <h2 id="verify" className="scroll-mt-24">Verify it yourself in 60 seconds</h2>
      <ol>
        <li>
          Open any tool, for example the <Link href="/tools/json-formatter">JSON Formatter</Link>.
        </li>
        <li>
          Open your browser&rsquo;s developer tools (<code>F12</code>, or <code>Ctrl/Cmd + Shift + I</code>) and switch to the <strong>Network</strong> tab. Clear it.
        </li>
        <li>Paste some data, drop a file, and use the tool. Watch the Network tab: no requests are made with your data.</li>
        <li>
          For a stronger test, switch your device to airplane mode after the page has loaded. Tools you have opened keep working, because nothing needed the network in the first place.
        </li>
      </ol>

      <h2>The Content Security Policy</h2>
      <p>
        Every response from this site includes a policy like the one below. <code>connect-src &#39;self&#39;</code> is the important part: the browser refuses any attempt by page code to talk to a third party.
      </p>
      <pre>
        <code>{`Content-Security-Policy:
  default-src 'self';
  connect-src 'self';
  img-src 'self' data: blob:;
  object-src 'none';
  frame-ancestors 'none'; …`}</code>
      </pre>

      <h2>What is stored on your device</h2>
      <p>These live only in your browser (localStorage). We never receive them.</p>
      <ul>
        <li>Your theme choice (light, dark or system).</li>
        <li>Your favorite tools and recently used tools.</li>
        <li>A random anonymous code used by the tool request board (see below).</li>
        <li>For some tools, your input and settings in the page address after the <code>#</code> so you can share a link. The part of a URL after <code>#</code> is never sent to a server.</li>
        <li>Cached copies of the site&rsquo;s own files, so tools work offline.</li>
      </ul>

      <h2>What does reach our server</h2>
      <p>Being honest about the exceptions matters more than a perfect-sounding slogan:</p>
      <ul>
        <li>
          <strong>Loading the site.</strong> Like every website, the server that delivers our pages and scripts sees the request, and standard web-server logs may include your IP address and browser type. Tool input is not part of those requests.
        </li>
        <li>
          <strong>The tool request board.</strong> If you suggest or vote for an idea, we store the idea text you wrote and a one-way SHA-256 hash of your anonymous browser code to count votes and limit spam. We do not store your email, name or IP address in that data.
        </li>
        <li>
          <strong>Links you click.</strong> A few tools offer optional links to outside sites (for example, showing a photo&rsquo;s coordinates on OpenStreetMap). Nothing is sent unless you click them.
        </li>
      </ul>

      <h2>Limits worth knowing</h2>
      <ul>
        <li>
          <strong>Your device is the boundary.</strong> If your computer or a browser extension is compromised, no website can protect you. Browser extensions can read page content.
        </li>
        <li>
          <strong>Shared links contain your input.</strong> If you copy a share link, anyone who has it can see the data inside it. Share links are optional and only for you to send on purpose.
        </li>
        <li>
          <strong>Cryptographic tools are conveniences, not vaults.</strong> The password generator uses your browser&rsquo;s cryptographic random source, but you should still store passwords in a password manager.
        </li>
      </ul>

      <h2>Questions or concerns?</h2>
      <p>
        If you find something that doesn&rsquo;t match this page, please{" "}
        <a href={`${SITE.repo}/issues`} target="_blank" rel="noopener noreferrer">
          open an issue
        </a>
        . Privacy bugs are treated as top priority.
      </p>
    </ProsePage>
  );
}
