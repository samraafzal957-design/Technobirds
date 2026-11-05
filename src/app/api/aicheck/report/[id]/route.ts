import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAICheckUser, canDownload } from '@/lib/aicheck-auth'
import { getReportPdfUrl, fetchPdfBuffer } from '@/lib/scopelens'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentAICheckUser()
  if (!user) return NextResponse.json({ error: 'Pehle login karo' }, { status: 401 })
  const allowed = await canDownload(user.name, id)
  if (!allowed) return NextResponse.json({ error: 'Report nahi mila' }, { status: 404 })

  const urlResult = await getReportPdfUrl(id)
  if (!urlResult.ok || !urlResult.url) {
    return NextResponse.json({ error: urlResult.error || 'Report nahi mili' }, { status: 504 })
  }

  const pdfResult = await fetchPdfBuffer(urlResult.url)
  if (!pdfResult.ok || !pdfResult.buffer) {
    return NextResponse.json({ error: pdfResult.error || 'Download fail' }, { status: 502 })
  }

  const fileName = (urlResult.fileName || `report-${id.slice(0, 8)}.pdf`).replace(/[\r\n"\\/]/g, '_')
  const ascii = fileName.replace(/[^\x20-\x7E]/g, '_')
  return new NextResponse(pdfResult.buffer, {
    status: 200,
    headers: {
      'Content-Type': pdfResult.contentType || 'application/pdf',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
