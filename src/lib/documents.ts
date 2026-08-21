/**
 * Builders for the files the assistant can produce. Both libraries are
 * imported lazily — they're only needed on the rare turn that actually writes
 * a file, and eagerly loading them would cost every request.
 */

export type SheetSpec = {
  name: string;
  /** Column headers. Rendered bold and frozen so long sheets stay readable. */
  headers?: string[];
  /** Row values. Numbers stay numbers so Excel can total them. */
  rows: (string | number | boolean | null)[][];
};

export type DocBlock =
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "table"; headers?: string[]; rows: string[][] };

export const XLSX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Strips anything that would make a filename awkward to save or serve. */
export function safeFilename(name: string, extension: string): string {
  const base = (name || "file")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "file"}.${extension}`;
}

export async function buildSpreadsheet(sheets: SheetSpec[]): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  for (const spec of sheets.length ? sheets : [{ name: "Sheet1", rows: [] }]) {
    // Excel rejects these characters in a tab name and the whole file fails to
    // open, which looks like a corrupt download rather than a naming problem.
    const sheet = workbook.addWorksheet((spec.name || "Sheet1").replace(/[\\/*?:[\]]/g, "").slice(0, 31) || "Sheet1");

    if (spec.headers?.length) {
      const header = sheet.addRow(spec.headers);
      header.font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
    }
    for (const row of spec.rows) sheet.addRow(row);

    // Size columns to their contents — the default leaves numbers as ####.
    const widths = (spec.headers ?? []).map((h) => String(h).length);
    for (const row of spec.rows) {
      row.forEach((cell, i) => {
        const len = cell === null || cell === undefined ? 0 : String(cell).length;
        widths[i] = Math.max(widths[i] ?? 0, len);
      });
    }
    widths.forEach((w, i) => {
      sheet.getColumn(i + 1).width = Math.min(Math.max(w + 2, 8), 60);
    });
  }

  // exceljs types this as its own Buffer shape; the runtime value is a Node one.
  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

export async function buildDocument(title: string, blocks: DocBlock[]): Promise<Buffer> {
  const {
    Document,
    Packer,
    Paragraph,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    TextRun,
    WidthType,
  } = await import("docx");

  const levels = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  } as const;

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

  if (title) {
    children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));
  }

  // Models routinely pass the title again as the first heading, which renders
  // as the same words twice at the top of the page.
  const content =
    title && blocks[0]?.type === "heading" && blocks[0].text.trim() === title.trim()
      ? blocks.slice(1)
      : blocks;

  for (const block of content) {
    if (block.type === "heading") {
      children.push(new Paragraph({ text: block.text, heading: levels[block.level ?? 2] }));
    } else if (block.type === "paragraph") {
      children.push(new Paragraph({ children: [new TextRun(block.text)] }));
    } else if (block.type === "bullets") {
      for (const item of block.items) {
        children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
      }
    } else if (block.type === "table") {
      const rows: InstanceType<typeof TableRow>[] = [];
      if (block.headers?.length) {
        rows.push(
          new TableRow({
            children: block.headers.map(
              (h) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                }),
            ),
          }),
        );
      }
      for (const row of block.rows) {
        rows.push(
          new TableRow({
            children: row.map(
              (cell) => new TableCell({ children: [new Paragraph(String(cell ?? ""))] }),
            ),
          }),
        );
      }
      if (rows.length) {
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        // Word runs consecutive tables together without a paragraph between.
        children.push(new Paragraph({ text: "" }));
      }
    }
  }

  if (!children.length) children.push(new Paragraph({ text: "" }));

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
