import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { generateOtpCode, hashPassword } from '@/lib/auth'
import { sendOtpEmail } from '@/lib/resend'

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(80).optional(),
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
  const { email, password, name } = parsed.data
  const lowerEmail = email.toLowerCase()

  const existing = await db.user.findUnique({ where: { email: lowerEmail } })
  if (existing) {
    return NextResponse.json(
      { error: 'An account with that email already exists.' },
      { status: 409 }
    )
  }

  const passwordHash = await hashPassword(password)
  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

  // Invalidate any prior unused codes for this email
  await db.authCode.updateMany({
    where: { email: lowerEmail, consumedAt: null },
    data: { consumedAt: new Date() },
  })

  await db.authCode.create({
    data: {
      email: lowerEmail,
      code,
      purpose: 'register',
      meta: JSON.stringify({ passwordHash, name: name ?? null }),
      expiresAt,
    },
  })

  const result = await sendOtpEmail({ to: email, code, purpose: 'register' })

  if (!result.ok && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      ok: true,
      message: 'OTP generated. Email not sent (no RESEND_API_KEY in dev). Use the dev code below.',
      devCode: code,
      devNote: result.devNote,
    })
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to send OTP email' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, message: 'OTP sent to your email.' })
}
