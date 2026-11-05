import { NextRequest, NextResponse } from 'next/server'
import { parseDocx } from '@/lib/docx'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File) || !file.name.endsWith('.docx')) {
    return NextResponse.json({ error: 'Please upload a .docx file' }, { status: 400 })
  }

  const buf = await file.arrayBuffer()
  try {
    const result = await parseDocx(buf)

    // Persist scan history if user is logged in
    const user = await getCurrentUser()
    if (user) {
      await db.scan.create({
        data: {
          userId: user.id,
          fileName: file.name,
          verdict: result.verdict,
          aiScore: result.aiScore,
          author: result.metadata.creator || null,
          editTime: result.metadata.editTimeMinutes,
          application: result.metadata.application || null,
        },
      })
    }

    return NextResponse.json({ ok: true, ...result, fileName: file.name })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to parse .docx: ' + (e as Error).message },
      { status: 500 }
    )
  }
}
