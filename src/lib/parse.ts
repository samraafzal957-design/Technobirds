// Document parsing: PDF (page-mapped) + DOCX + TXT
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { buildVisualDoc, type VisualDoc } from "./visual";

export interface DocPage {
  page: number; // 1-based original page number
  text: string;
}

export interface ParsedDoc {
  fileName: string;
  fileSizeKb: string;
  pages: DocPage[];
  fullText: string;
  wordCount: number;
  charCount: number;
  pageCount: number;
  source: "pdf" | "docx" | "txt";
  /** Rasterized original pages + text geometry (null for TXT or on failure). */
  visual: VisualDoc | null;
}

const VIRTUAL_PAGE_CHARS = 3100; // ~one Letter page at 12pt serif

/**
 * Rebuild paragraphs from raw PDF line breaks (text reflow).
 * Joins wrapped lines into blocks; breaks at blank lines, headings,
 * short terminal lines (paragraph ends), and list items.
 */
export function reflowPdfLines(pageText: string): string[] {
  const lines = pageText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => {
      // Drop common page-chrome noise: page numbers, report headers, redaction-only tokens
      if (/^\d{1,4}$/.test(l)) return false;
      if (/^page\s+\d+\s*(of|\/)\s*\d+/i.test(l)) return false;
      const tokens = l.match(/\[[^\]]+\]/g);
      if (tokens && tokens.join("").length >= l.length * 0.9) return false; // "[X REDACTED] [Y REDACTED]"
      return true;
    });
  if (lines.length === 0) return [];

  const maxWidth = Math.max(...lines.map((l) => l.length), 1);
  const HEADING = /^(\d+(\.\d+){0,3}\s+\S|[A-Z][A-Za-z,'’() -]{2,60}$)/;
  const blocks: string[] = [];
  let cur = "";

  const isHeadingish = (s: string) => s.length <= 80 && (HEADING.test(s) || /^(abstract|content|contents|references|appendix|acknowledg|introduction|conclusion)\b/i.test(s));

  for (const line of lines) {
    if (!cur) {
      cur = line;
      continue;
    }
    const endsTerm = /[.!?…:;]["')\]]?$/.test(cur);
    const endsHyphen = /[-\u2010\u2011]$/.test(cur);
    const curShort = cur.length < maxWidth * 0.72;
    const curHeading = isHeadingish(cur) && !endsTerm;
    const nextHeading = isHeadingish(line) && line.length < 80 && !endsTerm;
    const nextList = /^([-–—•*·]|\d{1,2}[.)]\s)/.test(line);

    if (curHeading || nextHeading || nextList || (endsTerm && curShort)) {
      blocks.push(cur);
      cur = line;
    } else {
      cur = endsHyphen ? cur.slice(0, -1) + line : `${cur} ${line}`;
    }
  }
  if (cur) blocks.push(cur);
  return blocks;
}

/** Strip control characters, normalize whitespace variants. */
function cleanText(t: string): string {
  return t
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Pack continuous text into virtual pages (used for DOCX / TXT). */
function paginateText(text: string): DocPage[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const pages: DocPage[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current.length > 0 && current.length + p.length + 2 > VIRTUAL_PAGE_CHARS) {
      pages.push({ page: pages.length + 1, text: current.trim() });
      current = "";
    }
    current += (current.length ? "\n\n" : "") + p;
  }
  if (current.trim().length > 0) pages.push({ page: pages.length + 1, text: current.trim() });
  return pages.length ? pages : [{ page: 1, text }];
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export async function parseDocument(buf: Buffer, fileName: string, byteSize: number): Promise<ParsedDoc> {
  const lower = fileName.toLowerCase();
  let pages: DocPage[] = [];
  let source: ParsedDoc["source"] = "txt";

  if (lower.endsWith(".pdf")) {
    source = "pdf";
    const data = new Uint8Array(buf);
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: false });
    const arr = Array.isArray(text) ? text : [String(text)];
    arr.forEach((t, i) => {
      const cleaned = cleanText(t);
      if (cleaned.length === 0) return;
      const blocks = reflowPdfLines(cleaned);
      pages.push({ page: i + 1, text: blocks.join("\n\n") });
    });
    if (pages.length === 0) throw new Error("This PDF contains no extractable text. Scanned/image-only PDFs are not supported.");
  } else if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
    source = "docx";
    const result = await mammoth.extractRawText({ buffer: buf });
    pages = paginateText(cleanText(result.value));
  } else if (lower.endsWith(".txt")) {
    source = "txt";
    pages = paginateText(cleanText(buf.toString("utf8")));
  } else {
    throw new Error("Unsupported file type. Please upload a PDF, DOCX or TXT file.");
  }

  const fullText = pages.map((p) => p.text).join("\n\n");
  const words = fullText.split(/\s+/).filter(Boolean).length;
  const chars = fullText.replace(/\n/g, "").length;

  // Preserve the original document look: rasterize real pages + capture text
  // geometry so the report can highlight on top of the untouched layout.
  const visual = source === "txt" ? null : await buildVisualDoc(buf, fileName, source);
  const realPageCount = visual?.pages.length ?? 0;

  return {
    fileName,
    fileSizeKb: fmtSize(byteSize),
    pages,
    fullText,
    wordCount: words,
    charCount: chars,
    pageCount: realPageCount > 0 ? realPageCount : pages.length,
    source,
    visual,
  };
}
