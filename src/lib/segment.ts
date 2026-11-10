// Segmentation: paragraphs + sentences with original-page mapping,
// and Turnitin-style "qualifying text" filtering (long-form prose only).
import type { ParsedDoc } from "./parse";

export interface Sentence {
  id: number;
  page: number;
  paraIndex: number;
  text: string;
  words: number;
  qualifying: boolean;
  skipReason?: string;
}

export interface Paragraph {
  index: number;
  page: number;
  text: string;
  sentenceIds: number[];
}

export interface SegmentedDoc {
  sentences: Sentence[];
  paragraphs: Paragraph[];
  qualifyingWords: number;
  totalWords: number;
}

const MAX_SENTENCE_WORDS = 120;

function splitParagraphs(pageText: string): string[] {
  let paras = pageText.split(/\n{2,}/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
  if (paras.length <= 1) {
    // PDF text often loses blank lines: fall back to single newlines
    paras = pageText.split(/\n/).map((p) => p.trim()).filter(Boolean);
  }
  return paras;
}

function looksLikeHeading(p: string): boolean {
  const words = p.split(/\s+/).filter(Boolean).length;
  if (words <= 14 && !/[.!?]"?$/.test(p)) return true; // no terminal punctuation, short
  if (/^(chapter|abstract|content|contents|reference|references|appendix|keywords|introduction|conclusion|acknowledg)/i.test(p) && words <= 6) return true;
  return false;
}

function looksLikeToc(p: string): boolean {
  return (p.match(/\.{4,}/g)?.length ?? 0) >= 1 || /\.{3,}\s*\d+$/.test(p);
}

function looksLikeReference(p: string): boolean {
  return (
    /^\[\d+\]/.test(p) ||
    /^\(\d{4}[a-z]?\)/.test(p) ||
    /^(references|bibliography|works cited)/i.test(p) ||
    /https?:\/\/\S+/.test(p) ||
    /doi:\S+/i.test(p) ||
    /\bISBN\b/i.test(p) ||
    /retrieved from/i.test(p) ||
    (/^\S{1,4}(,\s*S\.|\s&\s|\set\s+al\.)/i.test(p) && /\(\d{4}\)/.test(p))
  );
}

function looksLikeListItem(p: string): boolean {
  return /^([-–—•*·]|\d{1,2}[.)]\s|([a-h])\)\s)/.test(p);
}

function isMostlyNumbersOrSymbols(p: string): boolean {
  const letters = (p.match(/[A-Za-z]/g) ?? []).length;
  return letters / Math.max(1, p.length) < 0.55;
}

function splitSentences(paragraph: string): string[] {
  // Protect common abbreviations
  const prot = paragraph
    .replace(/\b(e\.g|i\.e|etc|vs|Dr|Prof|Mr|Mrs|Ms|St|Fig|Eq|al|No|Vol|pp|p|ed|eds|Ch|Inc|Ltd|Co|Jr|Sr)\.\s/g, "$1\u0001 ")
    .replace(/\b(\d{1,4})\.(\d)\b/g, "$1\u0001$2");
  const raw = prot.split(/(?<=[.!?])["')\]]?\s+(?=["'(\[]?[A-Z0-9])/);
  const out: string[] = [];
  for (let r of raw) {
    r = r.replace(/\u0001/g, ".").trim();
    if (!r) continue;
    // Break overly long runs (PDF may merge sentences without space)
    if (r.split(/\s+/).length > MAX_SENTENCE_WORDS) {
      let cur: string[] = [];
      for (const w of r.split(/\s+/)) {
        cur.push(w);
        if (cur.length >= 45 && /[.!?;]$/.test(w)) {
          out.push(cur.join(" ").replace(/[;]$/, "."));
          cur = [];
        }
      }
      if (cur.length) out.push(cur.join(" "));
    } else {
      out.push(r);
    }
  }
  // Merge fragments (< 4 words) into previous sentence
  const merged: string[] = [];
  for (const s of out) {
    const prev = merged[merged.length - 1];
    if (prev && (s.split(/\s+/).length < 4 || /[,;:]$/.test(prev))) {
      merged[merged.length - 1] = `${prev} ${s}`;
    } else {
      merged.push(s);
    }
  }
  return merged.filter((s) => s.trim().length > 1);
}

export function segmentDocument(doc: ParsedDoc): SegmentedDoc {
  const sentences: Sentence[] = [];
  const paragraphs: Paragraph[] = [];
  let sid = 0;

  for (const page of doc.pages) {
    for (const paraText of splitParagraphs(page.text)) {
      if (looksLikeToc(paraText)) continue;
      const parts = splitSentences(paraText);
      if (parts.length === 0) continue;

      const paraWords = paraText.split(/\s+/).filter(Boolean).length;
      const isHeading = parts.length === 1 && looksLikeHeading(paraText) && paraWords <= 14;
      const isRef = looksLikeReference(paraText);
      const isList = looksLikeListItem(paraText) && paraWords < 120;
      const isJunk = isMostlyNumbersOrSymbols(paraText);

      const pIndex = paragraphs.length;
      const para: Paragraph = { index: pIndex, page: page.page, text: paraText, sentenceIds: [] };
      const idsInPara: number[] = [];

      for (const sText of parts) {
        const words = sText.split(/\s+/).filter(Boolean).length;
        let qualifying = true;
        let skipReason: string | undefined;
        if (isJunk) { qualifying = false; skipReason = "symbols"; }
        else if (isRef && paraWords < 80) { qualifying = false; skipReason = "reference"; }
        else if (isList && words < 40) { qualifying = false; skipReason = "list"; }
        else if (isHeading) { qualifying = false; skipReason = "heading"; }
        else if (words < 8) { qualifying = false; skipReason = "short"; }
        else if (words > 160) { qualifying = false; skipReason = "oversize"; }
        else if (paraWords < 25 && parts.length === 1) { qualifying = false; skipReason = "fragment"; }

        const s: Sentence = { id: sid++, page: page.page, paraIndex: pIndex, text: sText, words, qualifying, skipReason };
        sentences.push(s);
        para.sentenceIds.push(s.id);
        idsInPara.push(s.id);
      }
      paragraphs.push(para);
    }
  }

  const qualifyingWords = sentences.reduce((a, s) => a + (s.qualifying ? s.words : 0), 0);
  const totalWords = sentences.reduce((a, s) => a + s.words, 0);
  return { sentences, paragraphs, qualifyingWords, totalWords };
}
