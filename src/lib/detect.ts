// Hybrid detection: merge rule-based scores with LLM judgements →
// flagged sentences, percentages (Turnitin-style), stats.
import { scoreWithRules } from "./rules";
import { classifyWithLlm, type LlmJudgement } from "./llm";
import type { SegmentedDoc } from "./segment";

export type Verdict = "ai" | "para" | "human";

export interface FlaggedSentence {
  id: number;
  page: number;
  text: string;
  words: number;
  verdict: Exclude<Verdict, "human">;
  score: number;
}

export interface DetectionResult {
  percent: number; // combined AI % (rounded)
  display: string; // "*%" when below reporting threshold, else "25%"
  reported: boolean; // false when under 20% (Turnitin suppresses)
  aiOnlyPercent: number;
  paraPercent: number;
  aiWords: number;
  paraWords: number;
  qualifyingWords: number;
  flagged: FlaggedSentence[];
  verdicts: Record<number, { verdict: Verdict; score: number }>;
  llmUsed: boolean;
  llmCoverage: number; // share of qualifying sentences actually judged by LLM
}

// Aggressive calibration — bias toward flagging AI text (user: "AI zada bata dy")
const AI_THRESHOLD = 34;
const PARA_THRESHOLD = 28;
const RULES_ONLY_AI = 40;
const RULES_ONLY_PARA = 28;
const REPORT_FLOOR = 0; // always surface the numeric % (never "*%")

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export async function detectDocument(
  doc: SegmentedDoc,
  onProgress?: (stage: string, pct: number) => void
): Promise<DetectionResult> {
  onProgress?.("Scanning AI patterns…", 15);
  const ruleScores = scoreWithRules(doc);
  const ruleById = new Map(ruleScores.map((r) => [r.id, r]));

  const qualifying = doc.sentences.filter((s) => s.qualifying);
  onProgress?.("AI engine is analyzing sentences…", 30);
  const judgements = await classifyWithLlm(qualifying, {
    concurrency: 2,
    maxChunks: 12,
    onProgress: (done, total) => {
      const pct = 30 + Math.round((done / Math.max(1, total)) * 45);
      onProgress?.(`AI engine is analyzing sentences… (${done}/${total} batches)`, pct);
    },
  });

  const llmCounted = [...judgements.values()].filter((j) => j.via === "llm").length;
  const llmUsed = llmCounted > 0;

  // Document-level register boost: when the whole document reads as formal,
  // evenly-written prose, push every sentence a bit further toward AI.
  const qualScores = doc.sentences.filter((s) => s.qualifying).map((s) => ruleById.get(s.id)?.score ?? 0);
  const avgRule = qualScores.length ? qualScores.reduce((a, b) => a + b, 0) / qualScores.length : 0;
  const bulkBoost = avgRule >= 30 ? 8 : avgRule >= 20 ? 5 : 0;

  const verdicts: Record<number, { verdict: Verdict; score: number }> = {};
  const flagged: FlaggedSentence[] = [];

  for (const s of doc.sentences) {
    if (!s.qualifying) {
      verdicts[s.id] = { verdict: "human", score: 0 };
      continue;
    }
    const rule = ruleById.get(s.id)?.score ?? 0;
    const j: LlmJudgement | undefined = judgements.get(s.id);

    let final: number;
    let verdict: Verdict;

    if (!j || j.via === "fallback") {
      // Rules only (LLM unavailable or skipped this sentence)
      final = rule + bulkBoost;
      verdict = final >= RULES_ONLY_AI ? "ai" : final >= RULES_ONLY_PARA ? "para" : "human";
    } else {
      const llmScore =
        j.verdict === "human" ? (1 - j.confidence) * 34 : j.verdict === "para" ? 40 + j.confidence * 56 : 55 + j.confidence * 45;
      final = Math.round(0.52 * rule + 0.48 * llmScore) + bulkBoost;

      if (j.verdict === "ai" && final >= AI_THRESHOLD) verdict = "ai";
      else if (j.verdict === "para" && final >= PARA_THRESHOLD) verdict = "para";
      else if (j.verdict === "human") {
        // Rescue borderline: pattern evidence overrides a tentative "human"
        if (rule >= 70 && j.confidence < 0.97) verdict = "ai";
        else if (rule >= 56) verdict = "para";
        else if (j.confidence < 0.9 && s.words >= 16) verdict = "para"; // long formal sentence, not confidently human
        else if (j.confidence < 0.75 && rule >= 34) verdict = "para";
        else verdict = "human";
        if (verdict === "human") final = Math.min(final, 32);
      } else verdict = "human";
    }

    verdicts[s.id] = { verdict, score: final };
    if (verdict !== "human") {
      flagged.push({ id: s.id, page: s.page, text: s.text, words: s.words, verdict, score: final });
    }
  }

  // Contagion pass: within uniformly-written paragraphs that the engine already
  // flagged more than once, adjacent formulaic sentences likely belong to the
  // same LLM-generated region (detectors highlight contiguous passages).
  for (const p of doc.paragraphs) {
    const ids = p.sentenceIds.filter((id) => doc.sentences[id]?.qualifying);
    if (ids.length < 3) continue;
    const flaggedInPara = ids.filter((id) => {
      const v = verdicts[id]?.verdict;
      return v === "ai" || v === "para";
    }).length;
    if (flaggedInPara < 1 || flaggedInPara / ids.length < 0.12) continue;
    for (const id of ids) {
      const v = verdicts[id];
      if (!v || v.verdict !== "human") continue;
      const s = doc.sentences[id];
      if (s.words < 6) continue;
      if ((ruleById.get(id)?.score ?? 0) >= 10) {
        v.verdict = "para";
        v.score = Math.max(v.score, 46);
        flagged.push({ id, page: s.page, text: s.text, words: s.words, verdict: "para", score: v.score });
      }
    }
  }

  const aiWords = flagged.filter((f) => f.verdict === "ai").reduce((a, f) => a + f.words, 0);
  const paraWords = flagged.filter((f) => f.verdict === "para").reduce((a, f) => a + f.words, 0);
  const qWords = Math.max(1, doc.qualifyingWords);
  const percent = clamp(Math.round(((aiWords + paraWords) / qWords) * 100), 0, 100);
  const aiOnlyPercent = clamp(Math.round((aiWords / qWords) * 100), 0, 100);
  const paraPercent = clamp(Math.round((paraWords / qWords) * 100), 0, 100);
  const reported = percent >= REPORT_FLOOR;

  onProgress?.("Building report…", 85);
  return {
    percent,
    display: reported ? `${percent}%` : "*%",
    reported,
    aiOnlyPercent,
    paraPercent,
    aiWords,
    paraWords,
    qualifyingWords: doc.qualifyingWords,
    flagged: flagged.sort((a, b) => a.id - b.id),
    verdicts,
    llmUsed,
    llmCoverage: qualifying.length ? llmCounted / qualifying.length : 0,
  };
}
