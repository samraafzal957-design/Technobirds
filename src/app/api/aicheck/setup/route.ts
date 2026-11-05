import { NextRequest, NextResponse } from 'next/server'
import { setup, getCurrentAICheckUser } from '@/lib/aicheck-auth'

export async function POST(req: NextRequest) {
  const { name, code, password } = await req.json().catch(() => ({}))
  if (!name || !code || !password) return NextResponse.json({ error: 'Name, code aur password do' }, { status: 400 })
  const r = await setup(String(name), String(code), String(password))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 401 })
  const u = await getCurrentAICheckUser()
  return NextResponse.json({ ok: true, name: u?.name, admin: u?.isAdmin })
}
