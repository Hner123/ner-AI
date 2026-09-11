import { createRequire } from "node:module";
import path from "node:path";
import type { Worker } from "tesseract.js";

/** Extract text layers first, then read scanned pages with local English OCR. */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const pdfRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
  const task = getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    standardFontDataUrl: path.join(pdfRoot, "standard_fonts").replaceAll("\\", "/") + "/",
    cMapUrl: path.join(pdfRoot, "cmaps").replaceAll("\\", "/") + "/",
    cMapPacked: true,
    maxImageSize: 16_777_216,
  });
  let worker: Worker | undefined;
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error("PDF exceeds 100 pages. Please split it into smaller files.");
    const pages: string[] = [];
    let scannedPages = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      try {
        const content = await page.getTextContent();
        let text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
        if (!text) {
          if (++scannedPages > 10) throw new Error("PDF exceeds 10 scanned pages. Please split it into smaller files.");
          if (!worker) {
            const { createWorker } = await import("tesseract.js");
            worker = await createWorker("eng", 1, {
              langPath: path.join(path.dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0"),
              cacheMethod: "none",
            });
          }
          const size = page.getViewport({ scale: 1 });
          const scale = Math.min(3, 3000 / Math.max(size.width, size.height));
          const viewport = page.getViewport({ scale });
          const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          try {
            await page.render({
              canvas: canvas as unknown as HTMLCanvasElement,
              canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
              viewport,
            }).promise;
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              const result = await Promise.race([
                worker.recognize(canvas.toBuffer("image/png")),
                new Promise<never>((_, reject) => {
                  timer = setTimeout(() => reject(new Error("Reading the scanned page took too long. Please upload a smaller or clearer scan.")), 45_000);
                }),
              ]);
              text = result.data.text.trim();
            } finally {
              clearTimeout(timer);
            }
          } finally {
            canvas.width = 1;
            canvas.height = 1;
          }
        }
        pages.push(text);
      } finally {
        page.cleanup();
      }
    }
    return pages.join("\n\n");
  } finally {
    try {
      await worker?.terminate();
    } finally {
      await task.destroy();
    }
  }
}
