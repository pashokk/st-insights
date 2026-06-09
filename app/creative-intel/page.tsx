'use client'

import { useState } from 'react'
import CreativeCard from '@/components/CreativeCard'
import { AppResult, FormState, AnalysisResponse } from '@/types'

const DEFAULT_FORM: FormState = {
  stKey: '',
  appIds: '',
  platform: 'ios',
  days: '30',
  sortBy: 'share',
  network: 'Applovin',
  context: '',
}

export default function CreativeIntelPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [results, setResults] = useState<AppResult[]>([])

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [key]: e.target.value }))

  async function run() {
    setError('')
    setResults([])
    setStatus('')

    if (!form.stKey.trim()) { setError('Enter your SensorTower API key.'); return }
    const appIds = form.appIds.split('\n').map(s => s.trim()).filter(Boolean)
    if (!appIds.length) { setError('Enter at least one app ID.'); return }

    setLoading(true)
    setStatus(`Fetching & analyzing ${appIds.length} app${appIds.length > 1 ? 's' : ''}…`)

    try {
      const res = await fetch('/api/creative-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appIds,
          stKey: form.stKey.trim(),
          platform: form.platform,
          days: Number(form.days),
          sortBy: form.sortBy,
          network: form.network,
          context: form.context.trim(),
        }),
      })

      const data: AnalysisResponse = await res.json()

      if (data.error) {
        setError(data.error)
        setStatus('')
        setLoading(false)
        return
      }

      const all = data.results || []
      const total = all.reduce((n, r) => n + r.creatives.length, 0)
      setResults(all)
      setStatus(`Found ${total} creative${total !== 1 ? 's' : ''} across ${all.length} app${all.length !== 1 ? 's' : ''}.`)
    } catch (err) {
      setError(String(err))
      setStatus('')
    }

    setLoading(false)
  }

  const totalCreatives = results.reduce((n, r) => n + r.creatives.length, 0)

  return (
    <main className="page">
      <div className="page-inner">

        <header className="page-header">
          <div className="header-eyebrow">Appodeal Accelerator</div>
          <h1>Creative Intelligence</h1>
          <p className="header-sub">
            Competitor creative analysis powered by SensorTower + Claude
          </p>
        </header>

        <section className="config-section">
          <div className="field full">
            <label htmlFor="stKey">SensorTower API key</label>
            <input
              id="stKey"
              type="password"
              placeholder="your-sensortower-api-key"
              value={form.stKey}
              onChange={set('stKey')}
              autoComplete="off"
            />
            <span className="field-note">Used server-side only — never exposed to the browser</span>
          </div>

          <div className="field full">
            <label htmlFor="appIds">Competitor app IDs <span className="field-note-inline">(one per line — iOS bundle ID or Android package name)</span></label>
            <textarea
              id="appIds"
              placeholder={'1635760774\ncom.example.game2'}
              value={form.appIds}
              onChange={set('appIds')}
              rows={4}
            />
          </div>

          <div className="fields-row">
            <div className="field">
              <label htmlFor="platform">Platform</label>
              <select id="platform" value={form.platform} onChange={set('platform')}>
                <option value="ios">iOS</option>
                <option value="android">Android</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="days">Date range</label>
              <select id="days" value={form.days} onChange={set('days')}>
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="sortBy">Sort by</label>
              <select id="sortBy" value={form.sortBy} onChange={set('sortBy')}>
                <option value="share">Impression share</option>
                <option value="first_seen_at">Newest first</option>
                <option value="last_seen_at">Most recent</option>
                <option value="duration">Duration</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="network">Ad network</label>
              <select id="network" value={form.network} onChange={set('network')}>
                <option value="Applovin">AppLovin</option>
                <option value="Admob">AdMob</option>
                <option value="Instagram">Instagram</option>
                <option value="Mopub">MoPub</option>
                <option value="Adcolony">AdColony</option>
                <option value="Chartboost">Chartboost</option>
                <option value="Pinterest">Pinterest</option>
              </select>
            </div>
          </div>

          <div className="field full">
            <label htmlFor="context">Creative producer context <span className="field-note-inline">(optional)</span></label>
            <textarea
              id="context"
              placeholder="e.g. We make casual puzzle games. Looking for new video hooks, gameplay loops, formats we haven't tested yet…"
              value={form.context}
              onChange={set('context')}
              rows={2}
            />
          </div>

          <button
            className="run-btn"
            onClick={run}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Analyzing…
              </>
            ) : (
              'Find top creatives'
            )}
          </button>
        </section>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        {status && !loading && (
          <p className="status-line">{status}</p>
        )}

        {results.length > 0 && (
          <section className="results-section">

            {results.some(r => r.summary) && (
              <div className="summary-block">
                <h2 className="section-title">Strategic summary</h2>
                {results.filter(r => r.summary).map(r => (
                  <div key={r.appId} className="summary-entry">
                    <div className="summary-app">{r.appId}</div>
                    <p className="summary-text">{r.summary}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="results-header">
              <h2 className="section-title">Top creatives</h2>
              <span className="results-count">{totalCreatives} found</span>
            </div>

            <div className="cards-grid">
              {results.flatMap(r =>
                r.creatives.map((c, i) => (
                  <CreativeCard
                    key={`${r.appId}-${c.creative_id || c.id || i}`}
                    creative={c}
                    appId={r.appId}
                  />
                ))
              )}
            </div>

          </section>
        )}

      </div>
    </main>
  )
}
