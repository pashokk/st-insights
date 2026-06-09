export interface STCreative {
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
  signals?: string[]
  insight?: string
  [key: string]: unknown
}

export interface AppResult {
  appId: string
  creatives: (STCreative & { insight: string })[]
  summary: string
}

export interface AnalysisResponse {
  results?: AppResult[]
  error?: string
}

export interface FormState {
  stKey: string
  appIds: string
  platform: 'ios' | 'android'
  days: '7' | '14' | '30' | '60' | '90'
  sortBy: string
  network: string
  countries: string
  context: string
}
