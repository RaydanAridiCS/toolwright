import type { Page, Request } from "@playwright/test";

/** Records every network request a page makes (including fetch, XHR, images, workers). */
export function trackRequests(page: Page) {
  const requests: Request[] = [];
  page.on("request", (r) => requests.push(r));
  return {
    all: requests,
    /** Requests that left the site's own origin. */
    external(origin: string) {
      return requests.filter((r) => {
        const url = r.url();
        return !url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:");
      });
    },
    /** Requests whose URL or body contains the text. */
    containing(text: string) {
      return requests.filter((r) => r.url().includes(text) || (r.postData() ?? "").includes(text) || decodeURIComponent(r.url()).includes(text));
    },
  };
}

/** Builds a PNG in the browser (so the tests need no image library) and returns its bytes. */
export async function makePng(page: Page, width = 400, height = 300): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w as number;
      canvas.height = h as number;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createLinearGradient(0, 0, w as number, h as number);
      gradient.addColorStop(0, "#0b6b55");
      gradient.addColorStop(1, "#d8ec4e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w as number, h as number);
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `hsl(${(i * 37) % 360} 70% 50%)`;
        ctx.fillRect((i * 53) % (w as number), (i * 91) % (h as number), 6, 6);
      }
      return canvas.toDataURL("image/png");
    },
    [width, height],
  );
  return Buffer.from(dataUrl.split(",")[1] as string, "base64");
}

/** A noisy JPEG made in the browser, so compressing it has real work to do. */
export async function makeJpeg(page: Page, width = 1200, height = 900, quality = 0.95): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ([w, h, q]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w as number;
      canvas.height = h as number;
      const ctx = canvas.getContext("2d")!;
      const image = ctx.createImageData(w as number, h as number);
      let seed = 12345;
      for (let i = 0; i < image.data.length; i += 4) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const x = (i / 4) % (w as number);
        const y = Math.floor(i / 4 / (w as number));
        const noise = (seed >>> 24) % 64;
        image.data[i] = (x * 255) / (w as number) / 2 + noise;
        image.data[i + 1] = (y * 255) / (h as number) / 2 + noise;
        image.data[i + 2] = 128 + noise / 2;
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      return canvas.toDataURL("image/jpeg", q as number);
    },
    [width, height, quality],
  );
  return Buffer.from(dataUrl.split(",")[1] as string, "base64");
}

/** Adds an EXIF orientation tag to a JPEG. Orientation 6 means "rotate 90° clockwise to display". */
export function withExifOrientation(jpeg: Buffer, orientation: number): Buffer {
  const tiff = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const body = Buffer.concat([Buffer.from("Exif\0\0"), tiff]);
  const segment = Buffer.concat([Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff]), body]);
  return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
}

/** App alerts, excluding Next.js's built-in (empty) route announcer which also has role="alert". */
export const appAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
