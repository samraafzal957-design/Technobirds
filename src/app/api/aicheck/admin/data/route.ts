import { NextResponse } from 'next/server'
import { getCurrentAICheckUser, adminListAll } from '@/lib/aicheck-auth'

export async function GET() {
  const user = await getCurrentAICheckUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const data = await adminListAll()
  return NextResponse.json(data)
}
