import { NextRequest, NextResponse } from 'next/server'
import gplay from 'google-play-scraper'

export interface AppResult {
  appId: string
  name: string
  icon: string
  developer: string
  platform: 'ios' | 'android'
  score?: number
}

async function searchIOS(term: string): Promise<AppResult[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=10&country=US`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.results || []).map((app: Record<string, unknown>) => ({
    appId: String(app.trackId),
    name: app.trackName as string,
    icon: (app.artworkUrl60 as string || '').replace('60x60', '100x100'),
    developer: app.sellerName as string || app.artistName as string || '',
    platform: 'ios' as const,
    score: app.averageUserRating as number,
  }))
}

async function searchAndroid(term: string): Promise<AppResult[]> {
  try {
    const results = await gplay.search({ term, num: 10, country: 'us', lang: 'en' })
    return results.map((app: Record<string, unknown>) => ({
      appId: app.appId as string,
      name: app.title as string,
      icon: app.icon as string,
      developer: app.developer as string || '',
      platform: 'android' as const,
      score: app.score as number,
    }))
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const term = req.nextUrl.searchParams.get('term')?.trim()
  const platform = req.nextUrl.searchParams.get('platform') || 'both'

  if (!term) return NextResponse.json({ results: [] })

  const [ios, android] = await Promise.all([
    platform !== 'android' ? searchIOS(term) : Promise.resolve([]),
    platform !== 'ios' ? searchAndroid(term) : Promise.resolve([]),
  ])

  // Interleave results: ios[0], android[0], ios[1], android[1]...
  const results: AppResult[] = []
  const max = Math.max(ios.length, android.length)
  for (let i = 0; i < max; i++) {
    if (ios[i]) results.push(ios[i])
    if (android[i]) results.push(android[i])
  }

  return NextResponse.json({ results })
}
