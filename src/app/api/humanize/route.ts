import { NextRequest, NextResponse } from 'next/server'
import { ruleClean, scan, systemPrompt, llmRewrite, TONES, llmAvailable } from '@/lib/humanizer'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_CHARS = 8000

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const text = String(body?.text || '').trim()
  const tone = body?.tone && TONES[body.tone] ? body.tone : 'casual'

  if (!text) return NextResponse.json({ error: 'Paste some text first.' }, { status: 400 })
  if (text.length > MAX_CHARS) {
    return NextResponse.json({ error: `Keep it under ${MAX_CHARS} characters.` }, { status: 400 })
  }

  const before = scan(text)
  const useLLM = llmAvailable()

  // ---------- Rule-only mode (no API key) ----------
  if (!useLLM) {
    const cleaned = ruleClean(text)
    const after = scan(cleaned)
    return NextResponse.json({
      output: cleaned,
      before,
      after,
      mode: 'rules-only',
      note: 'No GEMINI_API_KEY set — running deterministic rule cleanup only. Add GEMINI_API_KEY (free from aistudio.google.com/apikey) for full LLM rewrites.',
    })
  }

  // ---------- LLM mode (Gemini) ----------
  try {
    const cleaned1 = ruleClean(text)
    let out = ruleClean(await llmRewrite(systemPrompt(tone), `<text>\n${cleaned1}\n</text>`))
    let after = scan(out)

    // One targeted retry if flagged patterns remain
    const fixable = after.filter((r) => r.retry)
    if (fixable.length) {
      const list = fixable.map((r) => `- ${r.label}: ${r.samples.join(' | ')}`).join('\n')
      const retry = await llmRewrite(
        systemPrompt(tone),
        `This draft still has patterns that read as machine-written:\n${list}\n\nRewrite it to remove them without changing the meaning.\n\n<text>\n${out}\n</text>`
      )
      out = ruleClean(retry)
      after = scan(out)
    }

    return NextResponse.json({ output: out, before, after, mode: 'llm' })
  } catch (e) {
    // Fall back to rule-only on LLM failure so the user still gets something
    const cleaned = ruleClean(text)
    const after = scan(cleaned)
    return NextResponse.json({
      output: cleaned,
      before,
      after,
      mode: 'rules-fallback',
      note: `LLM call failed (${(e as Error).message}). Used rule cleanup only.`,
    })
  }
}
