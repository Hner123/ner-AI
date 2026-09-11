import assert from "node:assert/strict";
import test from "node:test";
import { extractDocument } from "../src/lib/extract";

/** Small generated PDFs keep private uploaded documents out of test fixtures. */
function pdfWithText(text: string) {
  const stream = `BT /F1 24 Tf 50 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let result = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(result));
    result += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n`;
  result += offsets.slice(1).map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("");
  result += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}

test("preserves embedded PDF text", async () => {
  const result = await extractDocument("text.pdf", "application/pdf", pdfWithText("Embedded text survives"));
  assert.equal(result.text, "Embedded text survives");
  assert.equal(result.truncated, false);
});

test("blank scans still produce a readable error after OCR", async () => {
  await assert.rejects(extractDocument("blank.pdf", "application/pdf", pdfWithText("")), /No readable text found/);
});

test("invalid PDFs reject without hanging", async () => {
  await assert.rejects(extractDocument("bad.pdf", "application/pdf", Buffer.from("not a PDF")));
});
