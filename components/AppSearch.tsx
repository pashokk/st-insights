'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { AppResult } from '@/app/api/search-apps/route'

interface Props {
  onSelect: (appId: string, platform: 'ios' | 'android') => void
}

const PLATFORM_OPTIONS = [
  { value: 'both',    label: 'Both stores' },
  { value: 'ios',     label: 'App Store' },
  { value: 'android', label: 'Google Play' },
]

export default function AppSearch({ onSelect }: Props) {
  const [term, setTerm] = useState('')
  const [platform, setPlatform] = useState('both')
  const [results, setResults] = useState<AppResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string, plat: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search-apps?term=${encodeURIComponent(q)}&platform=${plat}`)
      const data = await res.json()
      setResults(data.results || [])
      setOpen(true)
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(term, platform), 450)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [term, platform, search])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSelect(app: AppResult) {
    onSelect(app.appId, app.platform)
    setOpen(false)
    setTerm('')
    setResults([])
  }

  return (
    <div className="app-search-wrap" ref={wrapRef}>
      <div className="app-search-row">
        <div className="app-search-input-wrap">
          <span className="search-icon">⌕</span>
          <input
            className="app-search-input"
            type="text"
            placeholder="Search app store… e.g. Whiteout Survival"
            value={term}
            onChange={e => setTerm(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
          />
          {loading && <span className="search-spinner" />}
        </div>
        <div className="platform-tabs">
          {PLATFORM_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`platform-tab ${platform === opt.value ? 'active' : ''}`}
              onClick={() => setPlatform(opt.value)}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {open && results.length > 0 && (
        <ul className="app-search-dropdown">
          {results.map(app => (
            <li key={`${app.platform}-${app.appId}`} className="app-search-item" onClick={() => handleSelect(app)}>
              <img src={app.icon} alt="" className="app-search-icon" />
              <div className="app-search-info">
                <div className="app-search-name">{app.name}</div>
                <div className="app-search-meta">{app.developer}</div>
              </div>
              <div className="app-search-right">
                <span className={`app-platform-badge ${app.platform}`}>
                  {app.platform === 'ios' ? '🍎 iOS' : '🤖 Android'}
                </span>
                <span className="app-search-id">{app.appId}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && term.length > 1 && (
        <div className="app-search-empty">No apps found for "{term}"</div>
      )}
    </div>
  )
}
