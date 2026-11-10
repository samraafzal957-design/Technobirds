// LLM-based sentence classification (backend only).
// Uses Groq (free forever, no credit card, 1,000 req/day) via OpenAI-compatible API.
// Requires GROQ_API_KEY env var. Falls back to rules-only if not set or on failure.
import type { Sentence } from "./segment";

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

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Models to try in order (first that works wins)
const GROQ_MODELS = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "qwen-2.5-32b"];

const SYSTEM_PROMPT = `You are a precise AI-writing forensics engine used by an academic integrity tool (like Turnitin's AI detection). You receive numbered sentences from one document. For EACH sentence judge whether the wording was likely produced by a large language model (ChatGPT, Gemini, Claude, etc.), possibly after an AI-paraphrase tool, or reads like naturally human-written text.

Judge "ai" when several of these markers co-occur: canned phrases ("plays a crucial role", "serves as a testament to", "it is important to note", "underscores", "serves as"), AI vocabulary (delve, tapestry, pivotal, landscape, robust, foster, showcase, holistic, interplay, meticulously), "not only ... but also" parallelisms, rule-of-three lists ("X, Y, and Z"), vague attributions ("experts argue", "studies have shown"), participial tails ("highlighting...", "ensuring...", "reflecting..."), formulaic transitions (Furthermore, Moreover, Additionally), hedged generic claims, and uniform formal rhythm.

IMPORTANT calibration — bias toward "ai": fluent, generic, evenly-structured academic prose IS the signature of LLM-generated academic writing, and modern student submissions are overwhelmingly LLM-drafted. Default to "ai" for: literature-review style sentences, significance/implication statements, smooth formal transitions between ideas, hypothesis/mechanism interpretations ("This may be because...", "This suggests that...", "The results indicate that..."), and any well-polished sentence that could apply to many papers without concrete verifiable detail. A sentence only earns "human" when it contains concrete, specific, verifiable content: exact statistics tied to a named dataset/source, personal experience, idiosyncratic or imperfect phrasing, irregular rhythm, contractions, colloquialisms, or plain factual/data statements (table descriptions, variable definitions, formulas). When unsure between "human" and "ai", choose "ai".

Language: the submission may be in English, Urdu, Roman Urdu, or any other language. Judge AI-generation patterns regardless of language — polished, uniform, formally structured prose in ANY language is AI-like; error-rich, idiosyncratic, or personally-voiced text is human.

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

// Call Groq via OpenAI-compatible fetch. No SDK needed.
async function callGroq(chunk: Chunk): Promise<LlmJudgement[]> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  let lastErr: unknown;
  for (const model of GROQ_MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: chunk.prompt },
            ],
            temperature: 0.3,
            max_tokens: 4096,
            top_p: 0.95,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Groq ${model} ${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        const parsed = parseJsonArray(content);
        const byId = new Map<number, LlmJudgement>();
        for (const p of parsed) {
          const id = chunk.ids.includes(p.i) ? p.i : null;
          if (id === null) continue;
          const v: LlmVerdict = p.v === "ai" || p.v === "para" ? p.v : "human";
          byId.set(id, { id, verdict: v, confidence: p.c, via: "llm" });
        }
        return chunk.ids.map(
          (id) => byId.get(id) ?? { id, verdict: "human" as LlmVerdict, confidence: 0.5, via: "fallback" as const }
        );
      } catch (e) {
        lastErr = e;
        const wait = attempt === 0 ? 1000 : 2000;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Groq call failed");
}

/**
 * Classify sentences in bounded-parallel batches.
 * Falls back to "human/0.5" per sentence on LLM failure (rules still apply at merge).
 */
export async function classifyWithLlm(
  sentences: Sentence[],
  opts: { concurrency?: number; maxChunks?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<Map<number, LlmJudgement>> {
  const concurrency = opts.concurrency ?? 2;
  const maxChunks = opts.maxChunks ?? 12;
  const byId = new Map(sentences.map((s) => [s.id, s]));
  const allChunks = buildChunks(sentences, byId);
  const chunks = allChunks.slice(0, maxChunks);
  const results = new Map<number, LlmJudgement>();

  for (const c of allChunks.slice(maxChunks)) {
    for (const id of c.ids) results.set(id, { id, verdict: "human", confidence: 0.5, via: "fallback" });
  }

  if (chunks.length === 0) return results;

  // No GROQ_API_KEY → skip LLM, rules-only mode
  if (!process.env.GROQ_API_KEY) {
    for (const c of chunks) {
      for (const id of c.ids) results.set(id, { id, verdict: "human", confidence: 0.5, via: "fallback" });
    }
    return results;
  }

  let done = 0;
  let consecutiveFailures = 0;
  const queue = [...chunks];
  const failed: Chunk[] = [];

  async function worker(seed: number) {
    await new Promise((r) => setTimeout(r, seed * 300));
    while (queue.length > 0) {
      const chunk = queue.shift()!;
      try {
        const judgements = await callGroq(chunk);
        for (const j of judgements) results.set(j.id, j);
        consecutiveFailures = 0;
      } catch {
        failed.push(chunk);
        consecutiveFailures += 1;
        await new Promise((r) => setTimeout(r, consecutiveFailures >= 4 ? 5000 : 2000));
        if (consecutiveFailures >= 4) consecutiveFailures = 1;
      }
      done += 1;
      opts.onProgress?.(done, chunks.length);
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, (_, i) => worker(i)));

  if (failed.length > 0) {
    const retryQueue = [...new Set(failed)];
    await new Promise((r) => setTimeout(r, 2000));
    for (const chunk of retryQueue) {
      try {
        const judgements = await callGroq(chunk);
        for (const j of judgements) results.set(j.id, j);
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  for (const c of chunks) {
    for (const id of c.ids) {
      if (!results.has(id)) results.set(id, { id, verdict: "human", confidence: 0.5, via: "fallback" });
    }
  }
  return results;
}
