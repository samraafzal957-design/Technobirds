import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAICheckUser, adminCreateUser } from '@/lib/aicheck-auth'

export async function POST(req: NextRequest) {
  const user = await getCurrentAICheckUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { name } = await req.json().catch(() => ({}))
  if (!name) return NextResponse.json({ error: 'Naam do' }, { status: 400 })
  const r = await adminCreateUser(String(name))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ name, code: r.code, hours: r.hours })
}
