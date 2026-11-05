import { Resend } from 'resend'

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || 'Technobirds <onboarding@resend.dev>'

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

export async function sendOtpEmail(opts: {
  to: string
  code: string
  purpose: 'register' | 'login'
}): Promise<{ ok: boolean; error?: string; devNote?: string }> {
  const client = getResendClient()

  if (!client) {
    // In development without an API key, surface a clear note. The caller
    // will return the code to the UI so the developer can still test.
    return {
      ok: false,
      error: 'RESEND_API_KEY is not set. Email not sent.',
      devNote:
        'Add RESEND_API_KEY to your .env file. In dev, the OTP is returned in the API response so you can complete the flow.',
    }
  }

  const verb = opts.purpose === 'register' ? 'verify your account' : 'sign in'
  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0a0a0a; padding:32px 0; margin:0;">
    <div style="max-width:520px; margin:0 auto; background:#111; border:1px solid #1f1f1f; border-radius:16px; padding:40px;">
      <div style="font-family: 'JetBrains Mono', monospace; letter-spacing:2px; color:#00ff9d; font-size:11px; margin-bottom:24px;">TECHNOBIRDS // FORENSICS</div>
      <h1 style="color:#fff; font-size:22px; font-weight:600; margin:0 0 16px 0;">Your verification code</h1>
      <p style="color:#a1a1aa; font-size:15px; line-height:1.6; margin:0 0 32px 0;">
        Use the code below to ${verb}. This code expires in 10 minutes.
      </p>
      <div style="background:#000; border:1px solid #262626; border-radius:12px; padding:28px; text-align:center;">
        <div style="font-family: 'JetBrains Mono', monospace; font-size:42px; letter-spacing:14px; color:#00ff9d; font-weight:600;">${opts.code}</div>
      </div>
      <p style="color:#52525b; font-size:12px; line-height:1.5; margin:32px 0 0 0;">
        If you didn't request this code, you can safely ignore this email. Never share this code with anyone.
      </p>
      <hr style="border:none; border-top:1px solid #1f1f1f; margin:32px 0;" />
      <p style="color:#3f3f46; font-size:11px; margin:0;">Technobirds Technology · Document Forensics</p>
    </div>
  </body>
</html>`

  const { error } = await client.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject: `Your Technobirds code: ${opts.code}`,
    html,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
