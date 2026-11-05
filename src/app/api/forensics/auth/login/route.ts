import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { generateOtpCode } from '@/lib/auth'
import { sendOtpEmail } from '@/lib/resend'

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
  const { email } = parsed.data
  const lowerEmail = email.toLowerCase()

  // We don't verify the password here. We verify it AFTER the OTP is confirmed
  // to avoid leaking which emails are registered. But we DO need the user to
  // exist; if they don't, we still send a fake-success response to avoid
  // email enumeration.
  const user = await db.user.findUnique({ where: { email: lowerEmail } })

  if (!user) {
    // Don't reveal that the account doesn't exist
    return NextResponse.json({
      ok: true,
      message: 'If that email is registered, an OTP is on the way.',
    })
  }

  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await db.authCode.updateMany({
    where: { email: lowerEmail, consumedAt: null },
    data: { consumedAt: new Date() },
  })

  await db.authCode.create({
    data: {
      email: lowerEmail,
      code,
      purpose: 'login',
      expiresAt,
    },
  })

  const result = await sendOtpEmail({ to: email, code, purpose: 'login' })

  if (!result.ok && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      ok: true,
      message: 'OTP generated. Email not sent in dev mode. Use the dev code below.',
      devCode: code,
      devNote: result.devNote || result.error || 'Email sending failed — check RESEND_API_KEY and recipient address.',
    })
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to send OTP email' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    message: 'If that email is registered, an OTP is on the way.',
  })
}
