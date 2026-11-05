import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Admin auth via a header token (separate from regular user sessions).
// Set ADMIN_TOKEN in your env. In dev, falls back to a known dev token.
function getAdminToken(): string {
  return process.env.ADMIN_TOKEN || 'dev-admin-token-please-change'
}

export async function GET(req: NextRequest) {
  // Try Authorization header first (Bearer token), then fall back to ?token= query param.
  // Some deployments/proxies strip Authorization headers, so supporting both keeps admin login working.
  const authHeader = req.headers.get('authorization') || ''
  const headerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const queryToken = req.nextUrl.searchParams.get('token')?.trim() || ''
  const token = headerToken || queryToken

  const expected = getAdminToken()
  if (!token || token !== expected) {
    return NextResponse.json(
      { error: 'Unauthorized', hint: 'Make sure ADMIN_TOKEN env var is set in Vercel and matches what you typed.' },
      { status: 401 }
    )
  }

  // Pull all scans with user info, newest first, capped at 200 rows
  const scans = await db.scan.findMany({
    take: 200,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, name: true } } },
  })

  return NextResponse.json({
    scans: scans.map((s) => ({
      id: s.id,
      fileName: s.fileName,
      verdict: s.verdict,
      aiScore: s.aiScore,
      author: s.author,
      editTime: s.editTime,
      application: s.application,
      createdAt: s.createdAt.toISOString(),
      user: s.user ? { email: s.user.email, name: s.user.name } : null,
    })),
  })
}
