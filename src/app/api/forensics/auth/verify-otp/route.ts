import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth'

const Body = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  password: z.string().optional(), // required for login
})

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }
  const { email, code, password } = parsed.data
  const lowerEmail = email.toLowerCase()

  const record = await db.authCode.findFirst({
    where: { email: lowerEmail, code, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired code.' }, { status: 400 })
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 })
  }

  // Mark code as consumed
  await db.authCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  })

  if (record.purpose === 'register') {
    // Create the user account
    let meta: { passwordHash?: string; name?: string | null } = {}
    try {
      meta = JSON.parse(record.meta ?? '{}')
    } catch {
      meta = {}
    }
    if (!meta.passwordHash) {
      return NextResponse.json({ error: 'Registration data missing. Please start over.' }, { status: 400 })
    }

    // Re-check that the email isn't already taken (race guard)
    const existing = await db.user.findUnique({ where: { email: lowerEmail } })
    if (existing) {
      return NextResponse.json({ error: 'Account already exists. Try logging in instead.' }, { status: 409 })
    }

    const user = await db.user.create({
      data: {
        email: lowerEmail,
        name: meta.name ?? null,
        passwordHash: meta.passwordHash,
      },
    })

    const jwt = await createSession(user.id)
    await setSessionCookie(jwt)

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
    })
  } else if (record.purpose === 'login') {
    if (!password) {
      return NextResponse.json({ error: 'Password required for login.' }, { status: 400 })
    }
    const user = await db.user.findUnique({ where: { email: lowerEmail } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 400 })
    }
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 400 })
    }

    const jwt = await createSession(user.id)
    await setSessionCookie(jwt)

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
    })
  }

  return NextResponse.json({ error: 'Unknown purpose.' }, { status: 400 })
}
