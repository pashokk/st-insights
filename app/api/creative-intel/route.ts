import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

function getDateRange(days: number) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { start: fmt(start), end: fmt(end) }
}

export async function POST(req: NextRequest) {
  try {
    const { appIds, stKey, platform, days, sortBy, network, countries, context } = await req.json()

    if (!stKey) return NextResponse.json({ error: 'Missing SensorTower API key' }, { status: 400 })
    if (!appIds?.length) return NextResponse.json({ error: 'Missing app IDs' }, { status: 400 })

    const { start, end } = getDateRange(Number(days) || 14)
    const allResults: AppResult[] = []

    for (const appId of appIds) {
      const base = `https://api.sensortower.com/v1/${platform || 'ios'}/ad_intel/creatives`
      const countryStr = (countries || 'US,GB,JP,DE,FR,KR,BR,AU,CA,MX').split(',').map((c: string) => c.trim()).join(',')
      // Append countries as raw comma-separated string (not URL-encoded) so ST accepts it
      const stUrl = `${base}?auth_token=${encodeURIComponent(stKey)}&app_ids=${encodeURIComponent(appId)}&start_date=${start}&end_date=${end}&limit=50&sort_by=${sortBy || 'first_seen_at'}&networks=${encodeURIComponent(network || 'Applovin')}&countries=${countryStr}`

      console.log('ST URL:', `${base}?app_ids=${appId}&start_date=${start}&end_date=${end}&networks=${network || 'Applovin'}&countries=${countryStr}`)

      let creatives: STCreative[] = []
      try {
        const stRes = await fetch(stUrl)
        if (!stRes.ok) {
          const errText = await stRes.text()
          return NextResponse.json(
            { error: `SensorTower API error for ${appId}: ${stRes.status} — ${errText.slice(0, 200)}` },
            { status: 502 }
          )
        }
        console.log('ST URL:', stUrl)
        const stData = await stRes.json()
        console.log('ST response:', JSON.stringify(stData).slice(0, 800))
        creatives = stData.ad_units || stData.creatives || stData.data || []
      } catch (fetchErr) {
        return NextResponse.json(
          { error: `Failed to reach SensorTower for ${appId}: ${String(fetchErr)}` },
          { status: 502 }
        )
      }

      if (!creatives.length) {
        allResults.push({ appId, creatives: [], summary: 'No creatives found for this app in the selected period.' })
        continue
      }

      const creativeSummary = creatives.slice(0, 8).map((c, i) =>
        `#${i + 1}: id=${c.creative_id || c.id}, type=${c.creative_type || c.type || 'unknown'}, network=${c.network || c.ad_network || 'unknown'}, impression_share=${c.impression_share != null ? (c.impression_share * 100).toFixed(1) + '%' : 'n/a'}, days_seen=${c.days_seen ?? 'n/a'}, first_seen_days_ago=${c.first_seen_days_ago ?? 'n/a'}`
      ).join('\n')

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are a senior UA creative strategist analyzing competitor ad creatives for a mobile game studio. Given SensorTower metadata, produce actionable insights for a creative producer.

Per creative: 1-2 sentences on what makes it likely performant, what hook or format it probably uses, and one concrete action the producer can test today. Be specific and tactical.

Respond ONLY with valid JSON — no markdown, no preamble, no backticks:
{"creatives":[{"id":"...","insight":"..."}],"summary":"2-3 sentence strategic pattern summary across all creatives for this app"}`,
        messages: [{
          role: 'user',
          content: `App: ${appId}\n${context ? `Producer context: ${context}\n` : ''}Creatives:\n${creativeSummary}`
        }]
      })

      const raw = (msg.content[0] as { type: string; text: string }).text.replace(/```json|```/g, '').trim()
      let analysis: { creatives: { id: string; insight: string }[]; summary: string }
      try {
        analysis = JSON.parse(raw)
      } catch {
        analysis = { creatives: [], summary: raw.slice(0, 300) }
      }

      const insightMap: Record<string, string> = {}
      analysis.creatives?.forEach((c, idx) => {
        insightMap[c.id] = c.insight
        insightMap[`#${idx + 1}`] = c.insight
      })

      const enriched = creatives.slice(0, 6).map((c, idx) => {
        const id = c.creative_id || c.id || ''
        return {
          ...c,
          insight: insightMap[id] || insightMap[`#${idx + 1}`] || 'No insight generated.'
        }
      })

      allResults.push({ appId, creatives: enriched, summary: analysis.summary || '' })
    }

    return NextResponse.json({ results: allResults })
  } catch (err) {
    console.error('creative-intel route error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Types
interface STCreative {
  creative_id?: string
  id?: string
  creative_type?: string
  type?: string
  network?: string
  ad_network?: string
  impression_share?: number
  days_seen?: number
  first_seen_days_ago?: number
  insight?: string
  [key: string]: unknown
}

interface AppResult {
  appId: string
  creatives: (STCreative & { insight: string })[]
  summary: string
}
