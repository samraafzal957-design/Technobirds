import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAICheckUser, deleteScans, deleteFailedScans } from '@/lib/aicheck-auth'

export async function POST(req: NextRequest) {
  const user = await getCurrentAICheckUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
  const failedOnly = !!body?.failedOnly

  if (failedOnly) {
    const deleted = await deleteFailedScans()
    return NextResponse.json({ deleted })
  }
  if (ids.length === 0) return NextResponse.json({ error: 'ids array do ya failedOnly:true do' }, { status: 400 })
  const deleted = await deleteScans(ids)
  return NextResponse.json({ deleted })
}
