/**
 * Turn an uploaded document into plain text.
 *
 * The gateway's provider adapters only understand text and images — a raw PDF
 * or spreadsheet forwarded as a file part would reach the model as garbage.
 * So documents are extracted to text here (server-side) and sent as text,
 * which is also what the gateway's own playground and OpenClaw do.
 */

/** Cap extracted text so one spreadsheet can't blow the model's context. */
export const MAX_EXTRACTED_CHARS = 100_000;

export type ExtractedDoc = {
  filename: string;
  mediaType: string;
  text: string;
  chars: number;
  truncated: boolean;
};

function isType(name: string, contentType: string, ext: string, ...mimeHints: string[]) {
  return name.endsWith(ext) || mimeHints.some((h) => contentType.includes(h));
}

async function extractPdf(data: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const out: string[] = [];
  workbook.eachSheet((sheet) => {
    out.push(`# Sheet: ${sheet.name}`);
    sheet.eachRow({ includeEmpty: false }, (row) => {
      // row.values is 1-indexed with a leading hole.
      const cells = (row.values as unknown[]).slice(1).map((v) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "object") {
          const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
          if (typeof o.text === "string") return o.text;
          if (o.richText) return o.richText.map((r) => r.text).join("");
          if (o.result !== undefined) return String(o.result);
          return "";
        }
        return String(v);
      });
      if (cells.some((c) => c !== "")) out.push(cells.join("\t"));
    });
  });
  return out.join("\n");
}

/** Extract text from a supported document. Throws with a readable message. */
export async function extractDocument(
  filename: string,
  contentType: string,
  buffer: Buffer,
): Promise<ExtractedDoc> {
  const name = filename.toLowerCase();
  const ct = (contentType || "").toLowerCase();

  let text: string;
  let mediaType: string;

  if (isType(name, ct, ".pdf", "pdf")) {
    mediaType = "application/pdf";
    text = await extractPdf(new Uint8Array(buffer));
  } else if (isType(name, ct, ".docx", "wordprocessingml")) {
    mediaType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    text = await extractDocx(buffer);
  } else if (isType(name, ct, ".xlsx", "spreadsheetml")) {
    mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    text = await extractXlsx(buffer);
  } else if (/\.(doc|xls|ppt)$/.test(name)) {
    throw new Error("Legacy Office format — please save as .docx or .xlsx and try again");
  } else if (/\.(txt|csv|md|markdown|json|ya?ml|tsv|log|html?|xml|ts|tsx|js|jsx|py|sql|sh|css)$/.test(name)) {
    mediaType = "text/plain";
    text = buffer.toString("utf8");
  } else {
    throw new Error(`Unsupported file type: ${filename}`);
  }

  text = text.replace(/\n{4,}/g, "\n\n\n").trim();
  if (!text) throw new Error(`No readable text found in ${filename}`);

  const truncated = text.length > MAX_EXTRACTED_CHARS;
  return {
    filename,
    mediaType,
    text: truncated ? text.slice(0, MAX_EXTRACTED_CHARS) : text,
    chars: text.length,
    truncated,
  };
}
