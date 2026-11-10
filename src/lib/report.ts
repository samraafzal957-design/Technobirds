// Turnitin-style AI Writing Report generator (PDFKit).
// Replicates: Cover Page -> AI Writing Overview -> AI Writing Submission pages
// with cyan (AI-generated) / purple (AI-paraphrased) highlights.
import PDFDocument from "pdfkit";
import type { ParsedDoc } from "./parse";
import type { SegmentedDoc } from "./segment";
import type { DetectionResult } from "./detect";
import type { VisualPage } from "./visual";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;

const COL = {
  ink: "#202122",
  gray: "#54595d",
  faint: "#8a9199",
  badgeBg: "#f3f4f5",
  badgeBorder: "#d8dadc",
  rule: "#e3e5e8",
  cyan: "#7ef0ee",
  purple: "#d9b8f7",
  cautionBg: "#dbe9f6",
  teal: "#2f9e8f",
  white: "#ffffff",
};

const BRAND_A = "Techno";
const BRAND_B = "birds";

export interface ReportMeta {
  submissionId: string;
  submissionDate: string;
  downloadDate: string;
}

function genSubmissionId(): string {
  const n = Math.floor(1_000_000_000 + Math.random() * 8_999_999_999);
  return `trn:oid:::1:${n}`;
}

function fmtDate(d: Date): string {
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const off = -d.getTimezoneOffset() / 60;
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const offStr = Number.isInteger(abs) ? `${sign}${abs}` : `${sign}${abs.toFixed(1)}`;
  return `${date}, ${time} GMT${offStr}`;
}

/** WinAnsi-safe text for standard PDF fonts. */
function win(t: string): string {
  return t
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "");
}

interface ReportPageMeta {
  kind: "cover" | "overview" | "submission";
  orig?: number;
}

export async function buildReport(
  doc: ParsedDoc,
  seg: SegmentedDoc,
  det: DetectionResult,
  meta?: Partial<ReportMeta>
): Promise<Buffer> {
  const m: ReportMeta = {
    submissionId: meta?.submissionId ?? genSubmissionId(),
    submissionDate: meta?.submissionDate ?? fmtDate(new Date()),
    downloadDate: meta?.downloadDate ?? fmtDate(new Date()),
  };

  const pdf = new PDFDocument({
    size: "LETTER",
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    info: { Title: `AI Writing Report - ${doc.fileName}`, Author: "Technobirds", Creator: "Technobirds AI Writing Detection" },
  });

  const chunks: Buffer[] = [];
  pdf.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => pdf.on("end", () => resolve(Buffer.concat(chunks))));

  const pageMetas: ReportPageMeta[] = [];
  const newPage = (kind: ReportPageMeta["kind"], orig?: number, size?: [number, number]) => {
    if (pageMetas.length > 0) pdf.addPage(size ? { size } : undefined);
    pageMetas.push({ kind, orig });
  };

  // ---------------- Cover Page ----------------
  newPage("cover");
  pdf.fillColor(COL.ink);

  // big document title (prominent, like a real title page)
  const fname = win(doc.fileName);
  const titleText = win(doc.fileName.replace(/\.[^.]+$/, "")) || fname;
  const ty = 226;
  pdf.font("Helvetica-Bold").fontSize(22).fillColor(COL.ink);
  pdf.text(titleText, MARGIN, ty, { width: 340, height: 62, ellipsis: true, lineGap: 2 });
  const titleEnd = Math.max(pdf.y, ty + 28);

  // account line
  const accY = titleEnd + 16;
  pdf.font("Helvetica-Bold").fontSize(9).fillColor(COL.teal);
  pdf.circle(MARGIN + 6, accY + 7, 5).fill();
  pdf.font("Helvetica").fontSize(9.5).fillColor(COL.gray);
  pdf.text("Technobirds Documents", MARGIN + 18, accY, { lineBreak: false });

  // Document Details
  let dy = 352;
  pdf.font("Helvetica-Bold").fontSize(13).fillColor(COL.ink);
  pdf.text("Document Details", MARGIN, dy, { lineBreak: false });

  dy += 36;
  const rows: [string, string][] = [
    ["SUBMISSION ID", m.submissionId],
    ["SUBMISSION DATE", m.submissionDate],
    ["DOWNLOAD DATE", m.downloadDate],
    ["FILE NAME", fname],
    ["FILE SIZE", doc.fileSizeKb],
  ];
  for (const [label, value] of rows) {
    pdf.font("Helvetica").fontSize(8).fillColor(COL.faint);
    pdf.text(label, MARGIN, dy, { characterSpacing: 0.4, lineBreak: false });
    pdf.font("Helvetica").fontSize(10.5).fillColor(COL.ink);
    pdf.text(value, MARGIN, dy + 13, { width: 340, lineBreak: false, ellipsis: true });
    dy += 44;
  }

  // right column stats
  const stats = [`${doc.pageCount} Pages`, `${doc.wordCount.toLocaleString("en-US")} Words`, `${doc.charCount.toLocaleString("en-US")} Characters`];
  let sy = 356;
  pdf.x = 400;
  for (const s of stats) {
    pdf.font("Helvetica-Bold").fontSize(10.5).fillColor(COL.ink);
    pdf.text(s, 400, sy, { lineBreak: false });
    sy += 19;
  }

  // ---------------- AI Writing Overview ----------------
  newPage("overview");

  const reported = det.reported;
  const headPct = reported ? `${det.percent}%` : "*%";
  pdf.font("Helvetica-Bold").fontSize(25).fillColor(COL.ink);
  pdf.text(`${headPct} detected as AI`, MARGIN, 74, { lineBreak: false });

  pdf.font("Helvetica").fontSize(9).fillColor(COL.ink);
  pdf.text(
    win("The percentage indicates the combined amount of likely AI-generated text as well as likely AI-generated text that was also likely revised by AI."),
    MARGIN,
    110,
    { width: 285, lineGap: 1.5 }
  );

  // caution box (right)
  const cbX = 352;
  const cbW = 210;
  pdf.save();
  pdf.roundedRect(cbX, 70, cbW, 92, 4).fill(COL.cautionBg);
  pdf.restore();
  pdf.font("Helvetica-Bold").fontSize(8.5).fillColor(COL.ink);
  pdf.text("Caution: Review required.", cbX + 12, 80, { lineBreak: false });
  pdf.font("Helvetica").fontSize(7.6).fillColor("#37414b");
  pdf.text(
    win("It is essential to understand the limitations of AI detection before making decisions about a student's work. We encourage you to learn more about Technobirds' AI detection capabilities before using the tool."),
    cbX + 12,
    93,
    { width: cbW - 24, lineGap: 1 }
  );

  let oy = 210;
  const rule = () => {
    pdf.save();
    pdf.moveTo(MARGIN, oy).lineTo(PAGE_W - MARGIN, oy).lineWidth(0.8).strokeColor(COL.rule).stroke();
    pdf.restore();
  };
  rule();
  oy += 18;

  // Detection Groups
  pdf.font("Helvetica-Bold").fontSize(9).fillColor(COL.faint);
  pdf.text("DETECTION GROUPS", MARGIN, oy, { characterSpacing: 0.5, lineBreak: false });
  oy += 24;

  const group = (title: string, pct: string, desc: string) => {
    // icon: small filled rounded square with sparkle
    pdf.save();
    pdf.roundedRect(MARGIN, oy, 18, 18, 4).fill(COL.teal);
    pdf.restore();
    pdf.font("Helvetica-Bold").fontSize(9).fillColor(COL.white);
    pdf.text("AI", MARGIN, oy + 5, { width: 18, align: "center", lineBreak: false });
    pdf.font("Helvetica-Bold").fontSize(11.5).fillColor(COL.ink);
    pdf.text(win(title), MARGIN + 26, oy + 2, { lineBreak: false });
    pdf.text(pct, PAGE_W - MARGIN - 40, oy + 2, { width: 40, align: "right", lineBreak: false });
    pdf.font("Helvetica").fontSize(8.5).fillColor(COL.gray);
    pdf.text(win(desc), MARGIN + 26, oy + 19, { width: PAGE_W - MARGIN - (MARGIN + 26), lineBreak: false });
    oy += 48;
  };

  group(`AI-generated only ${det.aiOnlyPercent}%`, `${det.aiOnlyPercent}%`, "Likely AI-generated text from a large-language model.");
  group(`AI-generated text that was AI-paraphrased ${det.paraPercent}%`, `${det.paraPercent}%`, "Likely AI-generated text that was likely revised using an AI-paraphrase tool or word spinner.");

  oy += 14;
  rule();
  oy += 18;

  pdf.font("Helvetica-Bold").fontSize(9.5).fillColor(COL.ink);
  pdf.text("Disclaimer", MARGIN, oy, { lineBreak: false });
  oy += 16;
  pdf.font("Helvetica").fontSize(7.8).fillColor(COL.gray);
  const disclaimer =
    "Our AI writing assessment is designed to help educators identify text that might be prepared by a generative AI tool. Our AI writing assessment may not always be accurate (it may misidentify writing that is likely human generated as AI generated and likely AI generated as human generated) so it should not be used as the sole basis for adverse actions against a student. It takes further scrutiny and human judgment in conjunction with an organization's application of its specific academic policies to determine whether any academic misconduct has occurred.";
  pdf.text(win(disclaimer), MARGIN, oy, { width: PAGE_W - MARGIN * 2, lineGap: 1.2 });
  oy = pdf.y + 16;
  rule();
  oy += 18;

  // FAQ (may flow to a continuation overview page)
  const ensure = (h: number) => {
    if (oy + h > PAGE_H - 70) {
      newPage("overview");
      oy = 80;
    }
  };
  pdf.font("Helvetica-Bold").fontSize(10.5).fillColor(COL.ink);
  ensure(24);
  pdf.text("Frequently Asked Questions", MARGIN, oy, { lineBreak: false });
  oy += 22;

  const faq = (q: string, a: string) => {
    ensure(60);
    pdf.font("Helvetica-Bold").fontSize(8.6).fillColor(COL.ink);
    oy = pdf.text(win(q), MARGIN, oy, { width: PAGE_W - MARGIN * 2, lineGap: 1.2 }).y + 8;
    pdf.font("Helvetica").fontSize(7.8).fillColor(COL.gray);
    ensure(80);
    oy = pdf.text(win(a), MARGIN, oy, { width: PAGE_W - MARGIN * 2, lineGap: 1.3 }).y + 16;
  };

  faq(
    "How should I interpret Technobirds' AI writing percentage and false positives?",
    "The percentage shown in the AI writing report is the amount of qualifying text within the submission that Technobirds' AI writing detection model determines was either likely AI-generated text from a large-language model or likely AI-generated text that was likely revised using an AI paraphrase tool or word spinner. False positives (incorrectly flagging human-written text as AI-generated) are a possibility in AI models. AI detection scores under 20%, which we do not surface in new reports, have a higher likelihood of false positives. To reduce the likelihood of misinterpretation, no score or highlights are attributed and are indicated with an asterisk in the report (*%). The AI writing percentage should not be the sole basis to determine whether misconduct has occurred. The reviewer/instructor should use the percentage as a means to start a formative conversation with their student and/or use it to examine the submitted assignment in accordance with their school's policies."
  );
  faq(
    "What does 'qualifying text' mean?",
    "Our model only processes qualifying text in the form of long-form writing. Long-form writing means individual sentences contained in paragraphs that make up a longer piece of written work, such as an essay, a dissertation, or an article, etc. Qualifying text that has been determined to be likely AI-generated will be highlighted in cyan in the submission, and likely AI-generated and then likely AI-paraphrased will be highlighted purple. Non-qualifying text, such as bullet points, annotated bibliographies, etc., will not be processed and can create disparity between the submission highlights and the percentage shown."
  );

  // ---------------- Submission pages (highlighted) ----------------
  if (doc.visual && doc.visual.pages.length > 0) {
    // Preserve the ORIGINAL document: draw each rasterized page untouched,
    // then overlay cyan / purple highlight bands on the flagged sentences.
    const pending = det.flagged.map((f) => ({
      text: normForMatch(f.text),
      v: f.verdict as "ai" | "para",
      done: false,
    }));
    const PW_DYN = PAGE_W;
    const PH_DYN = PAGE_H;

    for (const vp of doc.visual.pages) {
      newPage("submission");
      // Scale the original page into the frame between report header & footer
      // (like Turnitin) so chrome never collides with the submission content.
      const topBand = 66;
      const bottomBand = 64;
      const sidePad = 8;
      const frameW = PW_DYN - sidePad * 2;
      const frameH = PH_DYN - topBand - bottomBand;
      const scale = Math.min(frameW / vp.width, frameH / vp.height, 1);
      const drawW = vp.width * scale;
      const drawH = vp.height * scale;
      const ox = (PW_DYN - drawW) / 2;
      const oy = topBand + (frameH - drawH) / 2;
      if (vp.image) {
        try {
          pdf.image(vp.image, ox, oy, { width: drawW, height: drawH });
        } catch {
          // image missing/corrupt -> blank page with highlights only
        }
      }
      const rects = matchFlagRects(vp, pending);
      for (const r of rects) {
        pdf.save();
        pdf.opacity(0.45);
        pdf.fillColor(r.v === "ai" ? "#0fd9d2" : "#8b5cf6");
        pdf.rect(ox + r.x * scale, oy + r.y * scale, r.w * scale, r.h * scale).fill();
        pdf.restore();
      }
    }
  } else {
    for (const page of doc.pages) {
      newPage("submission", page.page);
      let y = 88;
      const topX = 110;
      const width = PAGE_W - 110 - 120;

      const paras = seg.paragraphs.filter((p) => p.page === page.page);
      for (const para of paras) {
        // tokens: sentences with verdicts, joined by spaces
        const tokens: { t: string; v: "ai" | "para" | null }[] = [];
        para.sentenceIds.forEach((id, idx) => {
          const s = seg.sentences[id];
          const v = det.verdicts[id]?.verdict;
          if (idx > 0) tokens.push({ t: " ", v: null });
          for (const w of s.text.split(" ")) tokens.push({ t: w, v: v === "ai" || v === "para" ? v : null });
        });

        y = drawTokens(pdf, tokens, { x: topX, width, y, topY: 88, bottomY: PAGE_H - 84, fontSize: 10.5, lineHeight: 15 }, () => {
          newPage("submission", page.page);
        });
        y += 7; // paragraph gap
      }

      // original page number at bottom of content area
      pdf.font("Helvetica").fontSize(9).fillColor(COL.gray);
      pdf.text(String(page.page), 0, PAGE_H - 64, { width: PAGE_W, align: "center", lineBreak: false });
    }
  }

  // ---------------- Chrome (headers/footers) on all pages ----------------
  const total = pageMetas.length;
  for (let i = 0; i < total; i += 1) {
    pdf.switchToPage(i);
    const kind = pageMetas[i].kind;
    const label = kind === "cover" ? "Cover Page" : kind === "overview" ? "AI Writing Overview" : "AI Writing Submission";
    drawChrome(pdf, i + 1, total, label, m.submissionId);
  }

  pdf.end();
  return done;
}

function drawChrome(pdf: PDFKit.PDFDocument, pageNo: number, total: number, label: string, submissionId: string) {
  const PW = pdf.page.width;
  const PH = pdf.page.height;
  const idText = win(`Submission ID: ${submissionId}`);

  // hairline rules separating the chrome band from page content
  pdf.save();
  pdf.moveTo(MARGIN, 47).lineTo(PW - MARGIN, 47).lineWidth(0.7).strokeColor(COL.rule).stroke();
  pdf.moveTo(MARGIN, PH - 45).lineTo(PW - MARGIN, PH - 45).lineWidth(0.7).strokeColor(COL.rule).stroke();
  pdf.restore();

  const bar = (y: number) => {
    // two-tone brand wordmark (no logo mark)
    pdf.font("Helvetica-Bold").fontSize(11);
    pdf.fillColor(COL.ink).text(BRAND_A, MARGIN, y, { lineBreak: false });
    const aw = pdf.widthOfString(BRAND_A);
    pdf.fillColor(COL.teal).text(BRAND_B, MARGIN + aw, y, { lineBreak: false });
    const brandW = aw + pdf.widthOfString(BRAND_B);
    pdf.font("Helvetica").fontSize(7.5).fillColor(COL.faint);
    pdf.text(win(`Page ${pageNo} of ${total} · ${label}`), MARGIN + brandW + 12, y + 3.5, { lineBreak: false });
    pdf.text(idText, PW - MARGIN - 220, y + 3.5, { width: 220, align: "right", lineBreak: false });
  };

  bar(31);
  bar(PH - 36);
}

interface DrawOpts {
  x: number;
  width: number;
  y: number;
  topY: number;
  bottomY: number;
  fontSize: number;
  lineHeight: number;
}

/** Word-wrapped paragraph rendering with per-word highlight bands. Returns ending y. */
function drawTokens(
  pdf: PDFKit.PDFDocument,
  tokens: { t: string; v: "ai" | "para" | null }[],
  opts: DrawOpts,
  onOverflow: () => void
): number {
  let { y } = opts;
  let x = opts.x;
  pdf.font("Times-Roman").fontSize(opts.fontSize);
  const spaceW = pdf.widthOfString(" ");
  const pad = 1;

  const newLine = () => {
    y += opts.lineHeight;
    x = opts.x;
    if (y > opts.bottomY) {
      onOverflow();
      y = opts.topY;
    }
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok.t === " " || tok.t === "") {
      x += spaceW;
      continue;
    }
    let pieces: string[] = [tok.t];
    let w = pdf.widthOfString(tok.t);
    if (w > opts.width) {
      // hard-break very long tokens (URLs, formulas)
      pieces = [];
      let cur = "";
      for (const ch of tok.t) {
        if (pdf.widthOfString(cur + ch) > opts.width - 2) {
          pieces.push(cur);
          cur = ch;
        } else cur += ch;
      }
      pieces.push(cur);
    }

    for (let p = 0; p < pieces.length; p += 1) {
      const piece = pieces[p];
      w = pdf.widthOfString(piece);
      if (x + w > opts.x + opts.width && x > opts.x) newLine();

      if (tok.v) {
        const nextTok = pieces.length > 1 ? (p < pieces.length - 1 ? pieces[p + 1] : " ") : tokens[i + 1]?.t;
        const extendToSpace = tok.v === (p < pieces.length - 1 ? tok.v : tokens[i + 1]?.v) && nextTok !== undefined;
        const bandW = w + (extendToSpace ? spaceW : 0) + pad;
        pdf.save();
        pdf.rect(x - 0.5, y + 2.6, bandW, opts.lineHeight - 5).fill(tok.v === "ai" ? COL.cyan : COL.purple);
        pdf.restore();
      }
      pdf.font("Times-Roman").fontSize(opts.fontSize).fillColor(COL.ink);
      pdf.text(piece, x, y, { lineBreak: false });
      x += w + spaceW;
    }
  }
  return y + opts.lineHeight;
}

// ---------------- Highlight overlay matching (original-page mode) ----------------

interface FlagRect {
  x: number;
  y: number;
  w: number;
  h: number;
  v: "ai" | "para";
}

interface PendingFlag {
  text: string;
  v: "ai" | "para";
  done: boolean;
}

/** Aggressive normalize: letters/digits only, diacritics folded, single spaces. */
function normForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Match flagged sentences against a visual page's text items and produce
 * highlight rectangles in PDF points (top-left origin, like pdfkit).
 * Uses char-proportional x positions for partially matched items.
 */
function matchFlagRects(vp: VisualPage, pending: PendingFlag[]): FlagRect[] {
  if (vp.items.length === 0) return [];

  // Build normalized page text char-by-char with (item, offset) mapping.
  const chars: { item: number; off: number }[] = [];
  let norm = "";
  const normLenByItem = new Map<number, number>();
  vp.items.forEach((it, k) => {
    const chunk = normForMatch(it.str);
    normLenByItem.set(k, chunk.length);
    if (!chunk) return;
    if (norm.length > 0) {
      norm += " ";
      chars.push({ item: -1, off: 0 }); // separator does not belong to an item
    }
    for (let j = 0; j < chunk.length; j += 1) {
      norm += chunk[j];
      chars.push({ item: k, off: j });
    }
  });

  const claimed: [number, number][] = [];
  const rects: FlagRect[] = [];

  for (const p of pending) {
    if (p.done || p.text.length < 8) continue;

    // find first unclaimed occurrence
    let pos = norm.indexOf(p.text);
    while (pos !== -1) {
      const end = pos + p.text.length;
      const clash = claimed.some(([s, e]) => pos < e && end > s);
      if (!clash) break;
      pos = norm.indexOf(p.text, pos + 1);
    }
    if (pos === -1) continue;
    const end = pos + p.text.length;
    p.done = true;
    claimed.push([pos, end]);

    const perItem = new Map<number, { s: number; e: number }>();
    for (let i = pos; i < end; i += 1) {
      const c = chars[i];
      if (!c || c.item < 0) continue;
      const r = perItem.get(c.item) ?? { s: Infinity, e: -1 };
      if (c.off < r.s) r.s = c.off;
      if (c.off + 1 > r.e) r.e = c.off + 1;
      perItem.set(c.item, r);
    }

    for (const [k, r] of perItem) {
      const it = vp.items[k];
      const len = normLenByItem.get(k) || 1;
      const x0 = it.x + (r.s / len) * it.w;
      const x1 = it.x + (r.e / len) * it.w;
      const w = x1 - x0;
      if (w < 0.4) continue;
      rects.push({
        x: x0 - 0.5,
        y: it.y - 0.82 * it.h,
        w: w + 1,
        h: it.h * 1.08,
        v: p.v,
      });
    }
  }
  return rects;
}
