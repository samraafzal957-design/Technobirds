import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAICheckUser, updateScan, findScan } from '@/lib/aicheck-auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentAICheckUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const scan = await findScan(id)
  if (!scan) return NextResponse.json({ error: 'Scan nahi mili' }, { status: 404 })

  const updates: { status?: string; score?: number | null; words?: number | null } = {}
  if (body.status != null) {
    if (!['running', 'done', 'failed'].includes(body.status)) {
      return NextResponse.json({ error: 'Status sirf running/done/failed ho sakta hai' }, { status: 400 })
    }
    updates.status = body.status
  }
  if (body.score != null && body.score !== '') {
    const n = Number(body.score)
    if (Number.isNaN(n) || n < 0 || n > 100) return NextResponse.json({ error: 'AI % 0-100' }, { status: 400 })
    updates.score = n
  } else if (body.score === '' || body.score === null) {
    updates.score = null
  }
  if (body.words != null && body.words !== '') {
    const n = Number(body.words)
    if (!Number.isInteger(n) || n < 0 || n > 1000000) return NextResponse.json({ error: 'Words galat' }, { status: 400 })
    updates.words = n
  } else if (body.words === '' || body.words === null) {
    updates.words = null
  }
  await updateScan(id, updates)
  return NextResponse.json({ ok: true })
}
