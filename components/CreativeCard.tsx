'use client'

import { STCreative } from '@/types'

interface Props {
  creative: STCreative & { insight: string }
  appId: string
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
  const status = getStatus(c)
  const { label, className } = STATUS_CONFIG[status]
  const network = c.network || c.ad_network || '—'
  const format = c.creative_type || c.type || '—'
  const imp = c.impression_share != null ? `${(c.impression_share * 100).toFixed(1)}%` : '—'
  const days = c.days_seen != null ? `${c.days_seen}d` : '—'
  const age = c.first_seen_days_ago != null ? `${c.first_seen_days_ago}d ago` : '—'
  const cid = c.creative_id || c.id || 'creative'

  return (
    <div className="creative-card">
      <div className="card-header">
        <div>
          <div className="card-id">{cid}</div>
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
          <span className="metric-val">{age}</span>
          <span className="metric-lbl">First seen</span>
        </div>
      </div>

      <div className="insight-box">
        <div className="insight-label">Claude insight</div>
        <p className="insight-text">{c.insight}</p>
      </div>
    </div>
  )
}
