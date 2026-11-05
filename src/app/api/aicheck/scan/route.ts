import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAICheckUser, startScan, finishScan, failScan, checkLimit } from '@/lib/aicheck-auth'
import { uploadAndScan } from '@/lib/scopelens'

export const runtime = 'nodejs'
export const maxDuration = 60 // Vercel serverless ceiling

export async function POST(req: NextRequest) {
  const user = await getCurrentAICheckUser()
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  // If scopelens cookie not configured, refuse scans gracefully
  if (!process.env.SCOPELENS_COOKIE) {
    return NextResponse.json(
      {
        error: 'AI Check is temporarily unavailable.',
        detail:
          'The upstream AI detection service is not connected right now. Please check back later.',
        unavailable: true,
      },
      { status: 503 }
    )
  }

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'File nahi mili' }, { status: 400 })

  // Daily limit
  const limitCheck = await checkLimit(user.name)
  if (!limitCheck.ok) {
    return NextResponse.json({ error: `Aaj ki limit (${limitCheck.limit} scans) khatam, kal try karo` }, { status: 429 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const scan = await startScan(user.name, req.headers.get('x-forwarded-for'), file.name)

  try {
    const result = await uploadAndScan({
      name: file.name,
      buffer: buf,
      mimetype: file.type || 'application/octet-stream',
    })

    if (!result.ok || !result.scanId) {
      await failScan(scan.internalId, result.status || 500)
      return NextResponse.json({ error: result.error || 'Scan failed' }, { status: result.status || 500 })
    }

    const s = result.scan || {}
    const score = s.ai_score ?? s.aiScore ?? s.plagiarism_score ?? null
    const words = s.word_count ?? s.wordCount ?? null
    await finishScan(scan.internalId, result.scanId, score, words)

    return NextResponse.json({
      ...s,
      scanId: result.scanId,
      report_url: `/api/aicheck/report/${result.scanId}`,
    })
  } catch (err) {
    await failScan(scan.internalId, 500)
    return NextResponse.json({ error: 'Server crash', detail: String(err) }, { status: 500 })
  }
}
