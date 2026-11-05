import { NextRequest, NextResponse } from 'next/server'
import { getShareByToken } from '@/lib/aicheck-auth'
import crypto from 'crypto'

const sha = (s: string) => crypto.createHash('sha256').update(String(s)).update('aicheck-v1').digest('hex')

// Public GET: if no password needed, returns scan summary; if password needed, asks for it.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const share = await getShareByToken(token)
  if (!share) return NextResponse.json({ error: 'Link expire ho gaya ya galat hai' }, { status: 404 })
  if (!share.scan) return NextResponse.json({ error: 'Scan abhi available nahi' }, { status: 404 })

  const needsPassword = !!share.passwordHash
  if (needsPassword) {
    return NextResponse.json({ needsPassword: true, fileName: share.scan.fileName })
  }
  return NextResponse.json({
    needsPassword: false,
    scan: {
      t: share.scan.createdAt.toISOString(),
      user: share.scan.user.name,
      file: share.scan.fileName,
      score: share.scan.score,
      words: share.scan.words,
      status: share.scan.status,
      scanId: share.scan.scanId,
    },
  })
}

// Public POST: submit password to unlock.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const share = await getShareByToken(token)
  if (!share) return NextResponse.json({ error: 'Link galat hai' }, { status: 404 })
  if (!share.passwordHash) return NextResponse.json({ error: 'Is link ko password ki zarurat nahi' }, { status: 400 })
  const { password } = await req.json().catch(() => ({}))
  if (!sha(String(password || '')) === share.passwordHash) {
    return NextResponse.json({ error: 'Password galat hai' }, { status: 401 })
  }
  if (!share.scan) return NextResponse.json({ error: 'Scan abhi available nahi' }, { status: 404 })
  return NextResponse.json({
    ok: true,
    scan: {
      t: share.scan.createdAt.toISOString(),
      user: share.scan.user.name,
      file: share.scan.fileName,
      score: share.scan.score,
      words: share.scan.words,
      status: share.scan.status,
      scanId: share.scan.scanId,
    },
  })
}
