import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    available: !!process.env.SCOPELENS_COOKIE,
    unavailableReason: process.env.SCOPELENS_COOKIE
      ? null
      : 'AI Check is temporarily unavailable. The upstream AI detection service is not connected.',
  })
}
