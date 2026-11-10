import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAICheckUser, findScan, canDownload } from '@/lib/aicheck-auth'
import { buildReport } from '@/lib/report'
import type { ParsedDoc } from '@/lib/parse'
import type { SegmentedDoc, Sentence, Paragraph } from '@/lib/segment'
import type { DetectionResult, FlaggedSentence } from '@/lib/detect'

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
  let flagged: FlaggedSentence[] = []
  if (scan.flaggedJson) {
    try { flagged = JSON.parse(scan.flaggedJson) } catch { /* ignore */ }
  }

  // Reconstruct enough of ParsedDoc / SegmentedDoc / DetectionResult to feed
  // buildReport. We don't have the original document text anymore (we only
  // persisted the flagged sentences), so we build a minimal doc from those
  // sentences. This means:
  //   - The "submission pages" will only show the flagged text (not the full
  //     original document), highlighted in cyan/purple.
  //   - The cover + overview pages will have correct stats.
  // This is a trade-off — to show the FULL original document in the report,
  // we'd need to persist the entire parsed text (could be large) or re-run
  // detection on the original file. For now, flagged-text-only is fine.

  const aiWords = flagged.filter(f => f.verdict === 'ai').reduce((a, f) => a + f.words, 0)
  const paraWords = flagged.filter(f => f.verdict === 'para').reduce((a, f) => a + f.words, 0)
  const totalWords = scan.words ?? (aiWords + paraWords)
  const percent = Math.round(scan.score ?? 0)
  const aiOnlyPercent = totalWords > 0 ? Math.round((aiWords / totalWords) * 100) : 0
  const paraPercent = totalWords > 0 ? Math.round((paraWords / totalWords) * 100) : 0

  // Build a minimal ParsedDoc — just enough for buildReport to render
  // submission pages with the flagged text.
  const flaggedText = flagged.map(f => f.text).join(' ')
  const fullText = flaggedText || '(no flagged text)'
  const pages = flagged.length > 0
    ? [{ page: 1, text: flaggedText }]
    : [{ page: 1, text: '(no AI-generated content detected)' }]

  const parsedDoc: ParsedDoc = {
    fileName: scan.fileName,
    fileSizeKb: '—',
    pages,
    fullText,
    wordCount: totalWords,
    charCount: fullText.length,
    pageCount: 1,
    source: 'txt',
    visual: null, // no visual pages on Vercel (no pdftoppm/LibreOffice)
  }

  // Build a minimal SegmentedDoc — sentences + paragraphs from flagged list
  const sentences: Sentence[] = flagged.map((f, i) => ({
    id: i,
    page: 1,
    paraIndex: 0,
    text: f.text,
    words: f.words,
    qualifying: true,
  }))
  // If no flagged sentences, add one placeholder so the report has content
  if (sentences.length === 0) {
    sentences.push({
      id: 0, page: 1, paraIndex: 0,
      text: '(no AI-generated content was detected in this document)',
      words: 8, qualifying: true,
    })
  }
  const paragraphs: Paragraph[] = [{
    index: 0, page: 1, text: fullText,
    sentenceIds: sentences.map(s => s.id),
  }]
  const segDoc: SegmentedDoc = {
    sentences,
    paragraphs,
    qualifyingWords: totalWords,
    totalWords,
  }

  // Build DetectionResult
  const verdicts: Record<number, { verdict: 'ai' | 'para' | 'human'; score: number }> = {}
  for (const s of sentences) {
    const f = flagged[s.id]
    verdicts[s.id] = f
      ? { verdict: f.verdict, score: f.score }
      : { verdict: 'human', score: 0 }
  }
  const detResult: DetectionResult = {
    percent,
    display: percent >= 20 ? `${percent}%` : '*%',
    reported: percent >= 0,
    aiOnlyPercent,
    paraPercent,
    aiWords,
    paraWords,
    qualifyingWords: totalWords,
    flagged,
    verdicts,
    llmUsed: false,
    llmCoverage: 0,
  }

  try {
    const pdf = await buildReport(parsedDoc, segDoc, detResult, {
      submissionId: scan.scanId || scan.internalId,
      submissionDate: new Date(scan.createdAt).toLocaleString(),
      downloadDate: new Date().toLocaleString(),
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
      { error: 'PDF generation failed: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    )
  }
}
