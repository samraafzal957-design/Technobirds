import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAICheckUser, startScan, finishScan, failScan, checkLimit } from '@/lib/aicheck-auth'
import { parseDocument } from '@/lib/parse'
import { segmentDocument } from '@/lib/segment'
import { detectDocument } from '@/lib/detect'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const user = await getCurrentAICheckUser()
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'File nahi mili' }, { status: 400 })

  // Daily limit
  const limitCheck = await checkLimit(user.name)
  if (!limitCheck.ok) {
    return NextResponse.json(
      { error: `Aaj ki limit (${limitCheck.limit} scans) khatam, kal try karo` },
      { status: 429 }
    )
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const scan = await startScan(user.name, req.headers.get('x-forwarded-for'), file.name)

  try {
    // Parse → segment → detect (all local, no external API needed)
    const parsed = await parseDocument(buf, file.name, file.size)
    const seg = segmentDocument(parsed)
    const result = await detectDocument(seg)

    // Serialize flagged sentences for the PDF report
    const flaggedJson = JSON.stringify(result.flagged.map(f => ({
      id: f.id, page: f.page, text: f.text, words: f.words, verdict: f.verdict, score: f.score,
    })))

    await finishScan(
      scan.internalId,
      scan.internalId, // use internalId as scanId since no external ID
      result.percent,
      parsed.wordCount,
      flaggedJson
    )

    return NextResponse.json({
      ok: true,
      scanId: scan.internalId,
      ai_score: result.percent,
      aiScore: result.percent,
      word_count: parsed.wordCount,
      wordCount: parsed.wordCount,
      status: 'completed',
      flagged: result.flagged,
      report_url: `/api/aicheck/report/${scan.internalId}`,
      engine: 'technobirds-intelligence',
      llm_used: result.llmUsed,
    })
  } catch (err) {
    await failScan(scan.internalId, 500)
    console.error('[aicheck/scan] error:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: 'Scan failed', detail: errMsg },
      { status: 500 }
    )
  }
}
