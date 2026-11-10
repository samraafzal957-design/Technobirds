import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAICheckUser, findScan, canDownload } from '@/lib/aicheck-auth'
import { generateScanReport } from '@/lib/scan-report'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentAICheckUser()
  if (!user) return NextResponse.json({ error: 'Pehle login karo' }, { status: 401 })

  const scan = await findScan(id)
  if (!scan) return NextResponse.json({ error: 'Scan nahi mili' }, { status: 404 })

  const allowed = await canDownload(user.name, scan.scanId || scan.internalId)
  if (!allowed) return NextResponse.json({ error: 'Report nahi mila' }, { status: 404 })

  // Parse the persisted flagged sentences
  let flagged: Array<{ id: number; page: number; text: string; words: number; verdict: 'ai' | 'para'; score: number }> = []
  if (scan.flaggedJson) {
    try { flagged = JSON.parse(scan.flaggedJson) } catch { /* ignore parse errors */ }
  }

  try {
    const pdf = await generateScanReport({
      fileName: scan.fileName,
      scanId: scan.scanId || scan.internalId,
      aiScore: Math.round(scan.score ?? 0),
      wordCount: scan.words ?? 0,
      flagged,
      engine: 'technobirds-intelligence',
      scannedAt: scan.createdAt.toISOString(),
    })

    const fileName = `technobirds-ai-report-${(scan.scanId || scan.internalId).slice(0, 8)}.pdf`
    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err) {
    console.error('[aicheck/report] PDF generation failed:', err)
    return NextResponse.json(
      { error: 'PDF generation failed: ' + String(err) },
      { status: 500 }
    )
  }
}
