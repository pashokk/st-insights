'use client'

import { STCreative } from '@/types'

interface Props {
  creative: STCreative & { insight: string; signals?: string[] }
  appId: string
}

const SIGNAL_LABELS: Record<string, { label: string; className: string }> = {
  ZOMBIE_REACTIVATED:    { label: '🧟 Zombie reactivated',    className: 'sig-zombie' },
  EVERGREEN_LONG_RUNNER: { label: '🌲 Evergreen runner',      className: 'sig-evergreen' },
  SHORT_VIDEO_ANOMALY:   { label: '⚡ Short video anomaly',   className: 'sig-short' },
  LONG_VIDEO:            { label: '📽 Long video',            className: 'sig-long' },
  NEW_HIGH_SPENDER:      { label: '🚀 New high spender',      className: 'sig-new' },
  STATIC_ON_VIDEO_NETWORK: { label: '🖼 Static on video net', className: 'sig-static' },
  REWARDED_FORMAT:       { label: '🎁 Rewarded format',       className: 'sig-rewarded' },
  DOMINANT_CREATIVE:     { label: '👑 Dominant creative',     className: 'sig-dominant' },
}

function getStatus(c: STCreative) {
  const age = c.first_seen_days_ago ?? 999
  if (age <= 7) return 'new'
  if ((c.impression_share ?? 0) > 0.04) return 'top'
  return 'rising'
}

const STATUS_CONFIG = {
  new: { label: 'New', className: 'badge-new' },
  rising: { label: 'Rising', className: 'badge-rising' },
  top: { label: 'Top spend', className: 'badge-top' },
}

export default function CreativeCard({ creative: c, appId }: Props) {
  const signals = c.signals || []
  const status = getStatus(c)
  const { label, className } = STATUS_CONFIG[status]
  const network = c.network || c.ad_network || '—'
  const format = c.creative_type || c.type || '—'
  const imp = c.impression_share != null ? `${(c.impression_share * 100).toFixed(1)}%` : '—'
  const days = c.days_seen != null ? `${c.days_seen}d` : '—'
  const firstSeenStr = c.first_seen_at as string | undefined
  const firstSeen = firstSeenStr
    ? firstSeenStr.slice(0, 10)
    : c.first_seen_days_ago != null
      ? `${c.first_seen_days_ago}d ago`
      : '—'
  const cid = c.creative_id || c.id || 'creative'
  const thumb = c.thumb_url
  const preview = c.preview_url
  const mediaUrl = c.creative_url
  const isVideo = format === 'video' || format === 'video-rewarded'

  return (
    <div className="creative-card">
      {thumb && (
        <a
          href={mediaUrl || preview || thumb}
          target="_blank"
          rel="noopener noreferrer"
          className="card-thumb-wrap"
        >
          <img src={thumb} alt="creative thumbnail" className="card-thumb" />
          {isVideo && <span className="thumb-play">▶</span>}
        </a>
      )}

      <div className="card-header">
        <div>
          <div className="card-id">{cid.slice(0, 16)}</div>
          <div className="card-app">{appId}</div>
        </div>
      </div>

      <div className="badges">
        <span className={`badge ${className}`}>{label}</span>
        <span className="badge badge-neutral">{network}</span>
        <span className="badge badge-neutral">{format}</span>
      </div>

      <div className="metrics-row">
        <div className="metric">
          <span className="metric-val">{imp}</span>
          <span className="metric-lbl">Impression share</span>
        </div>
        <div className="metric">
          <span className="metric-val">{days}</span>
          <span className="metric-lbl">Days seen</span>
        </div>
        <div className="metric">
          <span className="metric-val">{firstSeen}</span>
          <span className="metric-lbl">First seen</span>
        </div>
      </div>

      {signals.length > 0 && (
        <div className="signals-row">
          {signals.map(sig => {
            const cfg = SIGNAL_LABELS[sig] || { label: sig, className: 'sig-default' }
            return <span key={sig} className={`signal-badge ${cfg.className}`}>{cfg.label}</span>
          })}
        </div>
      )}

      <div className="insight-box">
        <div className="insight-label">Claude insight</div>
        <p className="insight-text">{c.insight}</p>
      </div>
    </div>
  )
}
