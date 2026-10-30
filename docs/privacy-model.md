# Privacy model

> **Tools never send your input anywhere.** This document explains how that is enforced, how to verify it, and the precise limits of the claim.

## The guarantee

1. Every tool runs in the visitor's browser. Text, files and settings are processed by JavaScript on their device.
2. Pages can only connect to their **own origin**. The browser blocks any attempt to contact another server.
3. The site contains no analytics, advertising, fingerprinting or other third-party scripts, fonts or embeds.
4. There are no accounts, and the site sets no cookies.

## Enforcement

### Content Security Policy

Set for every response in `apps/web/next.config.ts`:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
media-src 'self' blob: data:;
font-src 'self' data:;
connect-src 'self';
worker-src 'self' blob:;
manifest-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

`connect-src 'self'` blocks `fetch`, XHR, WebSocket and beacons to other origins; `img-src` / `font-src` / `script-src` block third-party images, fonts and scripts; `form-action` stops forms from posting elsewhere; `frame-ancestors 'none'` plus `X-Frame-Options: DENY` prevent clickjacking. (`'unsafe-inline'` is required by Next.js's small inline bootstrap scripts; nonce-based CSP is a possible future hardening.)

Other headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera, microphone, geolocation, payment and USB, and `Cross-Origin-Opener-Policy: same-origin`.

### Code conventions

- Tools do not call `fetch`. The only `fetch` calls in the codebase are in `apps/web/src/lib/request-client.ts` (request board) and the service worker.
- `packages/core` is free of DOM and network APIs.
- Shareable state lives in the URL **fragment** (`#s=…`). Browsers never include fragments in HTTP requests or `Referer` headers.
- Tools handling secrets (JWTs, passwords, API keys, Wi-Fi passwords) keep that data in component state, not the URL.
- The Mermaid Diagram Editor loads the `mermaid` library on demand from this site, in strict security mode, with plain SVG labels, and shows the result through an `<img>` (which cannot run script). The library makes no network requests of its own (checked in its source), and a browser test draws every diagram type under the production policy.
- Compress PDF's "Smallest file" mode and the PDF Page Organizer's page previews load PDF.js on demand. The library, its worker, fonts and character maps are all served from this site (`/pdfjs/`, copied from the npm package at build time), so the page still talks only to its own origin. WebAssembly is not used: the policy has no `'wasm-unsafe-eval'`, so PDF.js runs its JavaScript decoders. The compression worker for "Keep text" is bundled with the page and receives the file once, in memory.
- The SVG Optimizer (SVGO), Image to SVG (a tracing library) and the GIF Maker and Editor (GIF encoder and decoder) do their work in Web Workers bundled with the page. Each library is loaded only when its tool first runs, and none makes a network request. SVG previews never draw untrusted SVG inline: they use an `<img>` made from a local blob, which cannot run script or load other files. The SVG Sanitizer is a first line of defence for people handling untrusted SVGs, not a guarantee; its page says to sanitize on the server too.
- PDF to Images and PDF to Text read pages with the same PDF.js as Compress PDF and the Page Organizer: the library, its worker, fonts and character maps come from this site, WebAssembly is not used, and the file is read into memory once. The pictures are drawn on a canvas in the tab, offered as links to local blobs, and the ZIP is built in the page. Nothing is stored and no new worker or storage was added.
- Crop, Rotate & Flip Image opens a picture with the browser's own decoder and saves a fresh copy drawn on a canvas, so GPS position and camera data in the original are not copied. The XML Formatter never loads or expands DOCTYPE entities, so a file cannot make it read a local file or fetch a URL. The IP & Subnet Calculator, Barcode Generator and XML Formatter keep what is typed out of the address bar.
- User-supplied HTML (Markdown preview) is sanitized with DOMPurify before insertion; SVG output is generated from controlled values; SVG input is rendered via `<img>`, which cannot run scripts.

### Automated verification (`e2e/privacy.spec.ts`)

- Security headers exist on pages and tool pages.
- The browser actually **blocks** a cross-origin `fetch` (a `securitypolicyviolation` event is observed).
- Visiting **every tool page** produces **zero** requests to other origins.
- A unique canary string typed into several tools never appears in any request URL or body.
- The URL hash is not sent on reload; no cookies are set.
- File workflows (merge PDF, compress image) make no external requests and no non-GET requests.

## The network ledger (what it shows)

Tool pages, the home page bench and the footer show **"outside requests: N"**. It is computed in your browser by `useOutsideRequests()` from the Resource Timing API: every resource this page loaded whose origin differs from the site's own (`data:` and `blob:` are ignored). It starts as "…" and only shows a number once measured.

What it proves: the page, its scripts, fonts and images did not fetch anything from another origin while you had it open.

What it does **not** prove:

- It cannot see request *bodies*, so it is not a replacement for the DevTools check below.
- Requests blocked by the Content Security Policy never leave your device, so they are not counted (that is the point of the policy). The home page's "Try to make it leak" button shows this: it attempts a cross-origin POST and reports the browser's refusal.
- It measures this page only, not browser extensions or the network layer.

It complements the automated tests in `e2e/privacy.spec.ts`; it does not replace them.

## Verify it yourself in 60 seconds

1. Open any tool, then your browser's developer tools → **Network** tab; clear it.
2. Use the tool with some data or a file. No request carries your input.
3. Optional: switch to airplane mode after the page loads. Opened tools keep working.

## What is stored on the visitor's device

All in `localStorage`, never transmitted:

| Key | Purpose |
| --- | --- |
| `tw-theme` | Light / dark / system |
| `tw-favorites`, `tw-recents` | Starred and recently used tools |
| `tw-token` | Random anonymous code for the request board (created on first use) |
| Service worker cache | Site files for offline use |

## What reaches the server

| Data | When | Notes |
| --- | --- | --- |
| Standard HTTP request metadata | Every page load | Handled by the hosting platform's normal logs (may include IP, user agent). Contains no tool input. |
| Request-board submissions | Only when a visitor submits or votes | Title/description the visitor typed + SHA-256 hash of their anonymous token (`creator_hash`, `voter_hash`). No email, name or IP stored by the app. |

Hashes are domain-separated (`toolwright:creator:<token>` vs `toolwright:voter:<token>`) so a creator hash can't be linked to a voter hash.

## Limits of the claim (be honest in docs and UI copy)

- A compromised device, malicious browser extension, or a hostile browser can read anything on the page. No website can prevent that.
- Share links contain the shared input. They are opt-in and visible in the address bar.
- The hosting provider can see ordinary access logs. The app does not add tracking to them.
- Browser-provided crypto (`crypto.subtle`, `getRandomValues`) is trusted. We do not implement our own CSPRNG; MD5 and CRC are implemented locally because Web Crypto does not provide them.
- ROT13, Caesar and Morse are not security. They are labelled as such.
- Metadata removal covers the formats and segments documented in `packages/core/src/image-meta.ts` (JPEG APPn/COM, PNG text/EXIF/time, WebP EXIF/XMP). Re-encoding (e.g. through the compressor) removes metadata as a side effect.

## Reporting a problem

If you find a request that carries user input, a missing header, or copy that overstates the model, treat it as a high-priority bug. See [SECURITY.md](../SECURITY.md).
