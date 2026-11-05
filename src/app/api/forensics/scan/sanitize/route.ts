import { NextRequest, NextResponse } from 'next/server'
import { sanitizeDocx, type SanitizeUpdates } from '@/lib/docx'

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File) || !file.name.endsWith('.docx')) {
    return NextResponse.json({ error: 'Please upload a .docx file' }, { status: 400 })
  }

  const updatesRaw = form.get('updates')
  if (typeof updatesRaw !== 'string') {
    return NextResponse.json({ error: 'Missing metadata updates' }, { status: 400 })
  }

  let updates: SanitizeUpdates
  try {
    updates = JSON.parse(updatesRaw)
  } catch {
    return NextResponse.json({ error: 'Invalid updates JSON' }, { status: 400 })
  }

  const buf = await file.arrayBuffer()
  try {
    const out = await sanitizeDocx(buf, updates)
    return new NextResponse(out, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="sanitized_${file.name}"`,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to sanitize .docx: ' + (e as Error).message },
      { status: 500 }
    )
  }
}
