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
      const adTypes = 'video,video-rewarded,image,banner,full_screen,image-banner,image-interstitial,image-other'
      const stUrl = `${base}?auth_token=${encodeURIComponent(stKey)}&app_ids=${encodeURIComponent(appId)}&start_date=${start}&end_date=${end}&networks=${encodeURIComponent(network || 'Applovin')}&countries=${countryStr}&ad_types=${adTypes}&limit=50`

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
        // ad_units is an array of ad unit objects, each with a nested creatives[] array
        // Flatten: merge ad_unit metadata onto each nested creative
        // ST returns ad_units[], each with a nested creatives[] for media URLs
        // Flatten and normalize field names to match the UI's expectations
        const adUnits = stData.ad_units || stData.creatives || stData.data || []
        const today = new Date()
        creatives = adUnits.flatMap((unit: Record<string, unknown>) => {
          const unitCreatives = (unit.creatives as Record<string, unknown>[]) || [unit]
          return unitCreatives.map((c: Record<string, unknown>) => {
            // Compute days ago from date strings
            const firstSeenStr = (unit.first_seen_at || c.first_seen_at) as string | undefined
            const lastSeenStr = (unit.last_seen_at || c.last_seen_at) as string | undefined
            const daysDiff = (dateStr: string | undefined) => {
              if (!dateStr) return undefined
              const diff = Math.floor((today.getTime() - new Date(dateStr).getTime()) / 86400000)
              return diff >= 0 ? diff : undefined
            }
            const firstDaysAgo = daysDiff(firstSeenStr)
            const lastDaysAgo = daysDiff(lastSeenStr)
            const daysSeen = (firstDaysAgo != null && lastDaysAgo != null)
              ? firstDaysAgo - lastDaysAgo
              : undefined
            return {
              ...c,
              id: c.id || unit.id,
              network: unit.network || c.network,
              creative_type: (unit.ad_type || c.ad_type || c.creative_type) as string,
              impression_share: unit.share as number ?? c.impression_share,
              first_seen_days_ago: firstDaysAgo,
              days_seen: daysSeen,
              first_seen_at: firstSeenStr,
              last_seen_at: lastSeenStr,
              thumb_url: c.thumb_url,
              preview_url: c.preview_url,
              creative_url: c.creative_url,
              video_duration: c.video_duration,
            }
          })
        })
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

      // Enrich each creative with computed producer signals before sending to Claude
      const todayMs = new Date().getTime()
      const enrichedForClaude = creatives.slice(0, 50).map((c, i) => {
        const firstMs = c.first_seen_at ? new Date(c.first_seen_at as string).getTime() : null
        const lastMs = c.last_seen_at ? new Date(c.last_seen_at as string).getTime() : null
        const agedays = firstMs ? Math.floor((todayMs - firstMs) / 86400000) : null
        const lastSeenDaysAgo = lastMs ? Math.floor((todayMs - lastMs) / 86400000) : null
        const dur = c.video_duration as number | undefined

        // Detect producer-relevant signals
        const signals: string[] = []
        if (agedays != null && agedays > 60 && lastSeenDaysAgo != null && lastSeenDaysAgo <= 14)
          signals.push('ZOMBIE_REACTIVATED: launched ' + agedays + 'd ago, still spending in last 14d')
        if (agedays != null && agedays > 120 && lastSeenDaysAgo != null && lastSeenDaysAgo <= 7)
          signals.push('EVERGREEN_LONG_RUNNER: 4+ months old, actively spending this week')
        if (dur != null && dur < 20 && (c.network === 'Applovin' || c.network === 'Unity'))
          signals.push('SHORT_VIDEO_ANOMALY: only ' + dur + 's — unusually short for ' + c.network + ' (typically 30-59s preferred)')
        if (dur != null && dur > 60)
          signals.push('LONG_VIDEO: ' + dur + 's — longer than typical; likely deep-funnel or tutorial hook')
        if (agedays != null && agedays <= 14 && (c.impression_share as number) > 0.05)
          signals.push('NEW_HIGH_SPENDER: launched ' + agedays + 'd ago, already high impression share — fast scaler')
        if ((c.creative_type === 'image' || c.creative_type === 'banner') && (c.network === 'Applovin' || c.network === 'Unity' || c.network === 'Mintegral'))
          signals.push('STATIC_ON_VIDEO_NETWORK: image/banner outperforming on a video-dominant network')
        if (c.creative_type === 'video-rewarded')
          signals.push('REWARDED_FORMAT: opt-in rewarded placement — audience is highly engaged, copy tested for motivation')
        const imp = c.impression_share as number
        if (imp != null && imp > 0.15)
          signals.push('DOMINANT_CREATIVE: ' + (imp * 100).toFixed(1) + '% impression share — likely their #1 spend driver')

        return `#${i + 1}: id=${c.id}, type=${c.creative_type || 'unknown'}, network=${c.network || 'unknown'}, ` +
          `impression_share=${imp != null ? (imp * 100).toFixed(1) + '%' : 'n/a'}, ` +
          `age=${agedays != null ? agedays + 'd' : 'n/a'}, last_seen=${lastSeenDaysAgo != null ? lastSeenDaysAgo + 'd ago' : 'n/a'}, ` +
          `video_duration=${dur != null ? dur + 's' : 'n/a'}` +
          (signals.length ? '\n  SIGNALS: ' + signals.join(' | ') : '')
      }).join('\n')

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a senior UA creative strategist and creative producer advisor for a casual mobile game studio (think merge, match-3, city builders, survival idle — NOT shooters or RPGs).

Your job: analyze competitor ad creative metadata from SensorTower and produce specific, actionable producer insights that help a creative team decide WHAT to shoot/design next.

For each creative, detect and explain any of these patterns:
- ZOMBIE_REACTIVATED: old creative that suddenly resumed spending — what about it might be timeless? What hook likely worked?
- EVERGREEN_LONG_RUNNER: running 4+ months — this is a proven performer; what format/concept makes it durable?
- SHORT_VIDEO_ANOMALY: under 20s on a network preferring 30-59s — something in those first seconds hooks hard; what's likely in it?
- LONG_VIDEO: 60s+ video — unusual; likely a tutorial, gameplay loop, or emotional story arc
- NEW_HIGH_SPENDER: just launched but already high spend — competitor found a winner fast; what creative direction does the genre/network suggest?
- STATIC_ON_VIDEO_NETWORK: image outperforming on video-heavy networks — the visual is doing all the work; what makes a static win here?
- REWARDED_FORMAT: opt-in rewarded ad — audience chose to watch; copy must trigger FOMO, curiosity, or reward anticipation
- DOMINANT_CREATIVE: 15%+ impression share — this is their main spend horse right now; clone the concept direction

For each creative: 2-3 sentences. Name the signal if detected. Say what creative direction to reproduce for a casual game. Give one concrete brief a producer can act on today.

Respond ONLY with valid JSON — no markdown, no preamble, no backticks:
{"creatives":[{"id":"...","insight":"...","signals":["SIGNAL_NAME"]}],"summary":"3-4 sentence strategic read: what patterns dominate, what format/concept is winning, top 1-2 things to reproduce this week"}`,
        messages: [{
          role: 'user',
          content: `App: ${appId}\nPlatform: ${platform || 'ios'}\nNetwork filter: ${network || 'Applovin'}\n${context ? `Producer context: ${context}\n` : ''}Creatives:\n${enrichedForClaude}`
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

      const signalsMap: Record<string, string[]> = {}
      analysis.creatives?.forEach((c, idx) => {
        const sigs = (c as {id: string; insight: string; signals?: string[]}).signals || []
        signalsMap[c.id] = sigs
        signalsMap[`#${idx + 1}`] = sigs
      })

      const enriched = creatives.slice(0, 50).map((c, idx) => {
        const id = c.creative_id || c.id || ''
        return {
          ...c,
          insight: insightMap[id] || insightMap[`#${idx + 1}`] || 'No insight generated.',
          signals: signalsMap[id] || signalsMap[`#${idx + 1}`] || [],
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
  first_seen_at?: string
  last_seen_at?: string
  thumb_url?: string
  preview_url?: string
  creative_url?: string
  video_duration?: number
  insight?: string
  [key: string]: unknown
}

interface AppResult {
  appId: string
  creatives: (STCreative & { insight: string })[]
  summary: string
}
