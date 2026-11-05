import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAICheckUser, getAllScansForReport, getUsersSummaryForReport } from '@/lib/aicheck-auth'
import { generateReportPdf } from '@/lib/report-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = await getCurrentAICheckUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  let scans = await getAllScansForReport()
  const filterUser = typeof req.nextUrl.searchParams.get('user') === 'string' && req.nextUrl.searchParams.get('user')!.trim()
    ? req.nextUrl.searchParams.get('user')!.trim() : null
  if (filterUser) scans = scans.filter(s => s.user.name === filterUser)

  const users = await getUsersSummaryForReport()
  const buf = await generateReportPdf({
    scans: scans.map(s => ({
      t: s.createdAt.toISOString(),
      user: s.user.name,
      file: s.fileName,
      score: s.score,
      words: s.words,
      status: s.status,
      scanId: s.scanId,
    })),
    users,
    generatedAt: new Date().toISOString(),
    filterUser,
  })

  const today = new Date().toISOString().slice(0, 10)
  const scopePart = filterUser ? `-${filterUser.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : ''
  const filename = `technobirds-scans-report${scopePart}-${today}.pdf`
  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
