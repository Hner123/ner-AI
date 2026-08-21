import { tool } from "ai";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  buildDocument,
  buildSpreadsheet,
  DOCX_MEDIA_TYPE,
  safeFilename,
  XLSX_MEDIA_TYPE,
  type DocBlock,
} from "@/lib/documents";

/** Refused rather than truncated — a half-written spreadsheet is worse than none. */
const MAX_CELLS = 50_000;

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/**
 * Tools bound to one turn: the file rows they create belong to this user and
 * conversation, so the ids are closed over rather than trusted from the model.
 */
export function fileTools({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}) {
  /** Stores the bytes and hands back the markdown the model should echo. */
  async function store(filename: string, mediaType: string, data: Buffer) {
    const row = await prisma.generatedFile.create({
      data: {
        userId,
        conversationId,
        filename,
        mediaType,
        size: data.byteLength,
        // Prisma's Bytes maps to Uint8Array<ArrayBuffer>; a Node Buffer is a
        // Uint8Array but typed over ArrayBufferLike, so it needs re-wrapping
        // rather than casting.
        data: new Uint8Array(data),
      },
      select: { id: true },
    });
    const url = `/api/files/${row.id}`;
    return {
      filename,
      sizeBytes: data.byteLength,
      url,
      // The model is asked to reproduce this verbatim; the route also appends
      // it on persist if the reply somehow leaves it out.
      markdownLink: `[${filename}](${url})`,
    };
  }

  return {
    create_spreadsheet: tool({
      description:
        "Create a real .xlsx spreadsheet the user can download. Use for tabular data, " +
        "calculations, lists or anything spreadsheet-shaped. Put numbers in as numbers, " +
        "not strings, so they can be totalled. Call this ONCE per file requested — the " +
        "file is saved the moment it returns, so calling again just leaves the user with " +
        "duplicates. Then reply in words, including the returned markdownLink exactly as given.",
      inputSchema: z.object({
        filename: z
          .string()
          .describe("Short descriptive name without extension, e.g. 'cebu-sales'"),
        sheets: z
          .array(
            z.object({
              name: z.string().describe("Tab name, max 31 chars"),
              headers: z.array(z.string()).optional().describe("Column headers"),
              rows: z.array(z.array(cell)).describe("Rows of values"),
            }),
          )
          .min(1),
      }),
      execute: async ({ filename, sheets }) => {
        const cells = sheets.reduce(
          (n, s) => n + s.rows.reduce((m, r) => m + r.length, 0) + (s.headers?.length ?? 0),
          0,
        );
        if (cells > MAX_CELLS) {
          return { error: `That's ${cells} cells; the limit is ${MAX_CELLS}. Ask for a smaller range or split it across files.` };
        }
        const name = safeFilename(filename, "xlsx");
        return store(name, XLSX_MEDIA_TYPE, await buildSpreadsheet(sheets));
      },
    }),

    create_document: tool({
      description:
        "Create a real .docx Word document the user can download. Use for letters, reports, " +
        "notes, summaries — prose rather than tables. Call this ONCE per file requested; the " +
        "file is saved the moment it returns. Then reply in words, including the returned " +
        "markdownLink exactly as given.",
      inputSchema: z.object({
        filename: z.string().describe("Short descriptive name without extension"),
        title: z.string().optional().describe("Document title, shown at the top"),
        blocks: z
          .array(
            z.union([
              z.object({
                type: z.literal("heading"),
                text: z.string(),
                level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
              }),
              z.object({ type: z.literal("paragraph"), text: z.string() }),
              z.object({ type: z.literal("bullets"), items: z.array(z.string()) }),
              z.object({
                type: z.literal("table"),
                headers: z.array(z.string()).optional(),
                rows: z.array(z.array(z.string())),
              }),
            ]),
          )
          .min(1)
          .describe("The document content, in order"),
      }),
      execute: async ({ filename, title, blocks }) => {
        const name = safeFilename(filename, "docx");
        const data = await buildDocument(title ?? "", blocks as DocBlock[]);
        return store(name, DOCX_MEDIA_TYPE, data);
      },
    }),
  };
}
