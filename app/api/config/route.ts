import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    stKeyConfigured: !!process.env.SENSORTOWER_API_KEY,
  })
}
