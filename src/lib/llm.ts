// LLM-based sentence classification (backend only).
// Uses z-ai-web-dev-sdk if available; otherwise falls back gracefully to
// rules-only detection. This makes the engine work on Vercel/serverless
// where the SDK config file may not exist.
import type { Sentence } from "./segment";

// Lazy-load the SDK so the module can be imported even when the SDK
// is not installed or configured. We only try to use it at runtime.
let _ZaiModule: any = null;
let _zaiLoadFailed = false;
async function getZai(): Promise<any | null> {
  if (_zaiLoadFailed) return null;
  if (_ZaiModule) return _ZaiModule;
  try {
    const mod = await import("z-ai-web-dev-sdk");
    _ZaiModule = mod.default || mod;
    return _ZaiModule;
  } catch {
    _zaiLoadFailed = true;
    return null;
  }
}

export type LlmVerdict = "ai" | "para" | "human";
export interface LlmJudgement {
  id: number;
  verdict: LlmVerdict;
  confidence: number; // 0..1
  via: "llm" | "fallback";
}

interface Chunk {
  ids: number[];
  prompt: string;
}

const SYSTEM_PROMPT = `You are a precise AI-writing forensics engine used by an academic integrity tool (like Turnitin's AI detection). You receive numbered sentences from one document. For EACH sentence judge whether the wording was likely produced by a large language model (ChatGPT, Gemini, Claude, etc.), possibly after an AI-paraphrase tool, or reads like naturally human-written text.

Judge "ai" when several of these markers co-occur: canned phrases ("plays a crucial role", "serves as a testament to", "it is important to note", "underscores", "serves as"), AI vocabulary (delve, tapestry, pivotal, landscape, robust, foster, showcase, holistic, interplay, meticulously), "not only ... but also" parallelisms, rule-of-three lists ("X, Y, and Z"), vague attributions ("experts argue", "studies have shown"), participial tails ("highlighting...", "ensuring...", "reflecting..."), formulaic transitions (Furthermore, Moreover, Additionally), hedged generic claims, and uniform formal rhythm.

IMPORTANT calibration — bias toward "ai": fluent, generic, evenly-structured academic prose IS the signature of LLM-generated academic writing, and modern student submissions are overwhelmingly LLM-drafted. Default to "ai" for: literature-review style sentences, significance/implication statements, smooth formal transitions between ideas, hypothesis/mechanism interpretations ("This may be because...", "This suggests that...", "The results indicate that..."), and any well-polished sentence that could apply to many papers without concrete verifiable detail. A sentence only earns "human" when it contains concrete, specific, verifiable content: exact statistics tied to a named dataset/source, personal experience, idiosyncratic or imperfect phrasing, irregular rhythm, contractions, colloquialisms, or plain factual/data statements (table descriptions, variable definitions, formulas). When unsure between "human" and "ai", choose "ai".

Thesis/dissertation register: results-interpretation and mechanism sentences ("This may be because...", "indicating that...", "The results show that...", "Combined with..., it can be shown that...") and generic conclusions that restate findings in smooth formal wording are typically LLM-drafted in student submissions — judge them "ai" when the surrounding sentences are AI-like. Conversely, short descriptive sentences that merely report numbers or define a variable are "human".

Language: the submission may be in English, Urdu, Roman Urdu, or any other language. Judge AI-generation patterns regardless of language — polished, uniform, formally structured prose in ANY language is AI-like; error-rich, idiosyncratic, or personally-voiced text is human. Standard-English methodology/results paragraphs ("The data were collected...", "Results are presented in the tables below...") are the most commonly LLM-drafted sections in student work and should default to "ai" unless they contain exact verifiable detail.

Verdicts: "ai" = likely LLM-generated (or LLM-revised). "para" = likely LLM-generated then heavily AI-paraphrased (spun synonyms, strained phrasing, but AI structure). "human" = likely human-written. Confidence c: how sure you are (0.00-1.00).

Return ONLY a JSON array, one object per input sentence, in the same order: [{"i":<sentence number>,"v":"ai"|"para"|"human","c":<0.00-1.00>}]. No other text.`;

function buildChunks(sentences: Sentence[], byId: Map<number, Sentence>, maxChars = 3200, maxSentences = 24): Chunk[] {
  const chunks: Chunk[] = [];
  let ids: number[] = [];
  let chars = 0;
  for (const s of sentences) {
    if (ids.length >= maxSentences || chars + s.text.length > maxChars) {
      if (ids.length > 0) chunks.push(makeChunk(ids, byId));
      ids = [];
      chars = 0;
    }
    ids.push(s.id);
    chars += s.text.length + 20;
  }
  if (ids.length > 0) chunks.push(makeChunk(ids, byId));
  return chunks;
}

function makeChunk(ids: number[], byId: Map<number, Sentence>): Chunk {
  const lines = ids.map((id) => `[${id}] ${byId.get(id)?.text ?? ""}`).join("\n");
  return { ids, prompt: `Sentences:\n${lines}\n\nReturn the JSON array now.` };
}

function parseJsonArray(raw: string): { i: number; v: string; c: number }[] {
  if (!raw) return [];
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((o) => o && typeof o === "object")
      .map((o) => ({ i: Number(o.i), v: String(o.v ?? "human"), c: Math.max(0, Math.min(1, Number(o.c) || 0.5)) }));
  } catch {
    return [];
  }
}

async function callLlm(
  zai: any,
  chunk: Chunk
): Promise<LlmJudgement[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: SYSTEM_PROMPT },
          { role: "user", content: chunk.prompt },
        ],
        thinking: { type: "disabled" },
      });
      const content = completion.choices[0]?.message?.content ?? "";
      const parsed = parseJsonArray(content);
      const byId = new Map<number, LlmJudgement>();
      for (const p of parsed) {
        const id = chunk.ids.includes(p.i) ? p.i : null;
        if (id === null) continue;
        const v: LlmVerdict = p.v === "ai" || p.v === "para" ? p.v : "human";
        byId.set(id, { id, verdict: v, confidence: p.c, via: "llm" });
      }
      // Anything the model skipped → neutral fallback
      return chunk.ids.map(
        (id) => byId.get(id) ?? { id, verdict: "human" as LlmVerdict, confidence: 0.5, via: "fallback" as const }
      );
    } catch (e) {
      lastErr = e;
      // Rate-limited or transient: patient exponential backoff, then retry
      const wait = attempt >= 2 ? 25000 + Math.random() * 8000 : 5000 * (attempt + 1) + Math.random() * 1500;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("LLM call failed");
}

/**
 * Classify sentences in bounded-parallel batches.
 * Falls back to "human/0.5" per sentence on repeated LLM failure (rules still apply at merge).
 */
export async function classifyWithLlm(
  sentences: Sentence[],
  opts: { concurrency?: number; maxChunks?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<Map<number, LlmJudgement>> {
  const concurrency = opts.concurrency ?? 2;
  const maxChunks = opts.maxChunks ?? 34;
  const byId = new Map(sentences.map((s) => [s.id, s]));
  const allChunks = buildChunks(sentences, byId);
  const chunks = allChunks.slice(0, maxChunks);
  const results = new Map<number, LlmJudgement>();

  // Overflow chunks (very long docs): mark fallback, rules decide later
  for (const c of allChunks.slice(maxChunks)) {
    for (const id of c.ids) results.set(id, { id, verdict: "human", confidence: 0.5, via: "fallback" });
  }

  if (chunks.length === 0) return results;

  let zai: any;
  try {
    const ZAIClass = await getZai();
    if (!ZAIClass) throw new Error("z-ai-web-dev-sdk not available");
    zai = await ZAIClass.create();
  } catch {
    // SDK not available — fall back to rules-only detection
    for (const c of chunks) for (const id of c.ids) results.set(id, { id, verdict: "human", confidence: 0.5, via: "fallback" });
    return results;
  }

  let done = 0;
  let consecutiveFailures = 0;
  const queue = [...chunks];
  const failed: Chunk[] = [];

  async function worker(seed: number) {
    await new Promise((r) => setTimeout(r, seed * 700)); // stagger starts
    while (queue.length > 0) {
      const chunk = queue.shift()!;
      try {
        const judgements = await callLlm(zai, chunk);
        for (const j of judgements) results.set(j.id, j);
        consecutiveFailures = 0;
      } catch {
        failed.push(chunk); // second chance later
        consecutiveFailures += 1;
        // Long cooldown when the rate limiter keeps pushing back, then continue
        await new Promise((r) => setTimeout(r, consecutiveFailures >= 4 ? 30000 : 8000));
        if (consecutiveFailures >= 4) consecutiveFailures = 1;
      }
      done += 1;
      opts.onProgress?.(done, chunks.length);
      await new Promise((r) => setTimeout(r, 250 + Math.random() * 350)); // gentle pacing
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, (_, i) => worker(i)));

  // Second-chance sweep: retry failed chunks sequentially with patience
  if (failed.length > 0) {
    const retryQueue = [...new Set(failed)];
    await new Promise((r) => setTimeout(r, 10000));
    for (const chunk of retryQueue) {
      try {
        const judgements = await callLlm(zai, chunk);
        for (const j of judgements) results.set(j.id, j);
      } catch {
        break; // give up on this sweep
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  // Anything still unjudged → fallback (rules decide later)
  for (const c of chunks) {
    for (const id of c.ids) {
      if (!results.has(id)) results.set(id, { id, verdict: "human", confidence: 0.5, via: "fallback" });
    }
  }
  return results;
}
