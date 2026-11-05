import { NextResponse } from 'next/server'
import { listUsers } from '@/lib/aicheck-auth'

export async function GET() {
  const users = await listUsers()
  return NextResponse.json({ users })
}
