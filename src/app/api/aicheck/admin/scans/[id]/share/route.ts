import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAICheckUser, findScan, createShare, revokeShares } from '@/lib/aicheck-auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentAICheckUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const scan = await findScan(id)
  if (!scan) return NextResponse.json({ error: 'Scan nahi mili' }, { status: 404 })
  const { password } = await req.json().catch(() => ({}))
  const token = await createShare(scan.id, password ? String(password) : null, user.name)
  return NextResponse.json({ url: `/s/${token}`, token, hasPassword: !!password })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentAICheckUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const scan = await findScan(id)
  if (!scan) return NextResponse.json({ error: 'Scan nahi mili' }, { status: 404 })
  const removed = await revokeShares(scan.id)
  return NextResponse.json({ removed })
}
