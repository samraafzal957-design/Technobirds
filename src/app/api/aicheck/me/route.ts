import { NextResponse } from 'next/server'
import { getCurrentAICheckUser } from '@/lib/aicheck-auth'

export async function GET() {
  const u = await getCurrentAICheckUser()
  if (!u) return NextResponse.json({ user: null }, { status: 200 })
  return NextResponse.json({ user: u })
}
