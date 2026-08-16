"use client";

import type { FileUIPart } from "ai";
import { ArrowUpIcon, FileTextIcon, PaperclipIcon, SquareIcon, XIcon } from "lucide-react";
import {
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DocPart } from "@/lib/chat-message";
import { fileToFileUIPart } from "@/lib/messages";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_DOC_BYTES = 15 * 1024 * 1024; // 15MB — matches /api/extract

const DOC_EXTENSIONS =
  ".pdf,.docx,.xlsx,.txt,.csv,.md,.markdown,.json,.yaml,.yml,.tsv,.log,.html,.htm,.xml,.ts,.tsx,.js,.jsx,.py,.sql,.sh,.css";

type ImageAttachment = { kind: "image"; file: File; previewUrl: string };
type DocAttachment = { kind: "doc"; filename: string; status: "reading" | "ready"; doc?: DocPart };
type Attachment = ImageAttachment | DocAttachment;

function formatChars(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}k chars` : `${n} chars`;
}

export function Composer({
  onSend,
  onStop,
  disabled,
  streaming,
  placeholder = "Message…",
}: {
  onSend: (text: string, files: FileUIPart[], docs: DocPart[]) => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);

  async function addDoc(file: File) {
    const placeholderItem: DocAttachment = {
      kind: "doc",
      filename: file.name,
      status: "reading",
    };
    setAttachments((prev) => [...prev, placeholderItem]);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? `Could not read ${file.name}`);
        setAttachments((prev) => prev.filter((a) => a !== placeholderItem));
        return;
      }
      setAttachments((prev) =>
        prev.map((a) => (a === placeholderItem ? { ...a, status: "ready", doc: data } : a)),
      );
      if (data.truncated) {
        toast.info(`${file.name} was long — only the first part was included.`);
      }
    } catch {
      toast.error(`Could not read ${file.name}`);
      setAttachments((prev) => prev.filter((a) => a !== placeholderItem));
    }
  }

  function addFiles(fileList: FileList | File[]) {
    for (const file of Array.from(fileList)) {
      if (file.type.startsWith("image/")) {
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(`${file.name} is over 8MB.`);
          continue;
        }
        setAttachments((prev) => [
          ...prev,
          { kind: "image", file, previewUrl: URL.createObjectURL(file) },
        ]);
      } else {
        if (file.size > MAX_DOC_BYTES) {
          toast.error(`${file.name} is over 15MB.`);
          continue;
        }
        void addDoc(file);
      }
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const item = prev[index];
      if (item?.kind === "image") URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function submit() {
    const text = textRef.current?.value.trim() ?? "";
    if (disabled || sending) return;

    if (attachments.some((a) => a.kind === "doc" && a.status === "reading")) {
      toast.info("Still reading a file — one moment.");
      return;
    }

    const images = attachments.filter((a): a is ImageAttachment => a.kind === "image");
    const docs = attachments
      .filter((a): a is DocAttachment => a.kind === "doc")
      .map((a) => a.doc)
      .filter((d): d is DocPart => Boolean(d));

    if (!text && images.length === 0 && docs.length === 0) return;

    setSending(true);
    try {
      const fileParts = await Promise.all(images.map((a) => fileToFileUIPart(a.file)));
      onSend(text, fileParts, docs);
      if (textRef.current) textRef.current.value = "";
      images.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      setAttachments([]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (e.clipboardData.files.length) addFiles(e.clipboardData.files);
  }

  function handleDrop(e: DragEvent<HTMLFormElement>) {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  return (
    <form
      onSubmit={handleSubmit}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-input bg-card focus-within:ring-ring/40 flex flex-col gap-2 rounded-md border p-2 shadow-sm focus-within:ring-2"
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 pt-1">
          {attachments.map((a, i) =>
            a.kind === "image" ? (
              <div key={i} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- ephemeral client-side blob: preview, not an optimizable asset */}
                <img
                  src={a.previewUrl}
                  alt={a.file.name}
                  className="border-border size-16 rounded-md border object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  aria-label={`Remove ${a.file.name}`}
                  className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ) : (
              <div
                key={i}
                className="group border-border bg-muted/50 relative flex items-center gap-2 rounded-lg border px-2.5 py-2"
              >
                <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0 font-ui">
                  <div className="max-w-40 truncate text-xs font-medium">{a.filename}</div>
                  <div className="text-muted-foreground text-[11px] tabular-nums">
                    {a.status === "reading" ? "Reading…" : a.doc ? formatChars(a.doc.chars) : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  aria-label={`Remove ${a.filename}`}
                  className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ),
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach image or document"
        >
          <PaperclipIcon className="size-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={`image/*,${DOC_EXTENSIONS}`}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Textarea
          ref={textRef}
          rows={1}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="placeholder:font-ui max-h-48 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0"
        />
        {streaming ? (
          <Button type="button" size="icon" variant="secondary" onClick={onStop} className="rounded-sm">
            <SquareIcon className="size-3.5" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={disabled || sending}
            className="bg-brand text-brand-foreground hover:bg-brand/85 rounded-sm"
          >
            <ArrowUpIcon className="size-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
