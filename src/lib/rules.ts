// Rule-based AI-writing scoring (statistical heuristics + pattern matching).
import { AI_WORDS, AI_PHRASES, AI_REGEXPS, CONTRACTIONS } from "./patterns";
import type { Sentence, SegmentedDoc } from "./segment";

export interface RuleScore {
  id: number;
  score: number; // 0..100
  hits: string[]; // matched pattern labels (for explainability)
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ");
}

function scoreSentence(text: string, words: number, paraBurstiness: number | null, paraLenCV: number | null): RuleScore {
  const norm = ` ${normalizeForMatch(text)} `;
  const hits: string[] = [];
  let points = 0;

  // 1. AI vocabulary density
  const tokens = norm.match(/[a-z][a-z'-]*/g) ?? [];
  let wordHits = 0;
  let wordPts = 0;
  for (const t of tokens) {
    const w = AI_WORDS[t.replace(/'/g, "")];
    if (w) {
      wordHits += 1;
      wordPts += w;
    }
  }
  if (wordHits > 0) {
    hits.push(`ai-vocab×${wordHits}`);
    const density = wordHits / Math.max(8, words);
    points += Math.min(38, wordPts * (2.6 + density * 7));
  }

  // 2. Canned phrases (strong)
  let phrasePts = 0;
  let phraseHits = 0;
  for (const [phrase, w] of Object.entries(AI_PHRASES)) {
    let idx = 0;
    let count = 0;
    while ((idx = norm.indexOf(phrase, idx)) !== -1) {
      const before = idx === 0 ? " " : norm[idx - 1];
      const afterIdx = idx + phrase.length;
      const after = afterIdx >= norm.length ? " " : norm[afterIdx];
      if (/[\s,;:.'"()]/.test(before) && /[\s,;:.'"()!?]/.test(after || " ")) count += 1;
      idx += phrase.length;
      if (count >= 2) break;
    }
    if (count > 0) {
      phraseHits += 1;
      phrasePts += w * Math.min(2, count);
    }
  }
  if (phraseHits > 0) {
    hits.push(`phrase×${phraseHits}`);
    points += Math.min(54, phrasePts * 3.6);
  }

  // 3. Structural regex patterns
  let rePts = 0;
  for (const { re, weight, label } of AI_REGEXPS) {
    if (re.test(norm)) {
      rePts += weight;
      hits.push(label);
    }
  }
  points += Math.min(38, rePts * 4);

  // 4. Sentence length profile — LLM sentences are long and even
  if (words >= 20 && words <= 42) points += 10;
  else if (words > 42 && words <= 70) points += 14;
  else if (words > 70) points += 8;

  // 5. Low burstiness in paragraph (uniform sentence lengths → AI tell)
  if (paraBurstiness !== null && paraLenCV !== null && words >= 12) {
    if (paraLenCV < 0.18) points += 10;
    else if (paraLenCV < 0.28) points += 6;
    else if (paraLenCV > 0.55) points -= 5; // very varied → human
  }

  // 6. Absence of contractions in long sentences (formal LLM register)
  const contractionCount = (text.match(CONTRACTIONS) ?? []).length;
  if (contractionCount === 0 && words >= 18) points += 7;
  else if (contractionCount > 0) points -= 3;

  // 7. First-person / casual human markers
  if (/\b(i|we|my|our)\b/i.test(text) && /\b(i think|i feel|in my opinion|we found|i believe|my own)\b/i.test(text)) points -= 10;
  if (/\b(hmm|kinda|sorta|gonna|wanna|yeah|okay|stuff|things like)\b/i.test(norm)) points -= 8;

  // 8. Heavy numeric/table content is not prose-AI
  const digits = (text.match(/\d/g) ?? []).length;
  if (digits / Math.max(1, text.length) > 0.18) points -= 12;

  const score = Math.max(0, Math.min(100, Math.round(points)));
  return { id: -1, score, hits };
}

/** Compute paragraph-level burstiness (sentence length uniformity). */
function paragraphStats(doc: SegmentedDoc): Map<number, { cv: number | null; burst: number | null }> {
  const map = new Map<number, { cv: number | null; burst: number | null }>();
  for (const p of doc.paragraphs) {
    const lens = p.sentenceIds
      .map((id) => doc.sentences[id])
      .filter((s) => s.qualifying && s.words >= 4)
      .map((s) => s.words);
    if (lens.length < 3) {
      map.set(p.index, { cv: null, burst: null });
      continue;
    }
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
    const sd = Math.sqrt(variance);
    const cv = mean > 0 ? sd / mean : 0;
    map.set(p.index, { cv, burst: sd });
  }
  return map;
}

export function scoreWithRules(doc: SegmentedDoc): RuleScore[] {
  const stats = paragraphStats(doc);
  return doc.sentences.map((s) => {
    if (!s.qualifying) return { id: s.id, score: 0, hits: [`skip:${s.skipReason}`] };
    const st = stats.get(s.paraIndex) ?? { cv: null, burst: null };
    const r = scoreSentence(s.text, s.words, st.burst, st.cv);
    r.id = s.id;
    return r;
  });
}
