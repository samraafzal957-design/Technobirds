import { NextRequest, NextResponse } from 'next/server'
import { login, getCurrentAICheckUser } from '@/lib/aicheck-auth'

export async function POST(req: NextRequest) {
  const { name, password } = await req.json().catch(() => ({}))
  if (!name || !password) return NextResponse.json({ error: 'Name aur password do' }, { status: 400 })
  const r = await login(String(name), String(password))
  if (!r.ok) return NextResponse.json({ error: r.error, needsSetup: r.needsSetup }, { status: r.needsSetup ? 409 : 401 })
  const u = await getCurrentAICheckUser()
  return NextResponse.json({ ok: true, name: u?.name, admin: u?.isAdmin })
}
