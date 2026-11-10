import { NextResponse } from 'next/server'

export async function GET() {
  // AI Check now runs locally — always available.
  // (No longer depends on scopelens.ai cookie.)
  return NextResponse.json({
    available: true,
    engine: 'technobirds-intelligence',
    accuracy: '~80%',
    note: 'Using local rules + LLM hybrid engine. ~80% accurate.',
  })
}
