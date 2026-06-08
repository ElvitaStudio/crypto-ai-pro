import type { Signal, StrategyStat, Summary } from './types'

const BASE = '/api'

export async function fetchSignals(params?: {
  limit?: number
  strategy?: string
  status?: string
}): Promise<Signal[]> {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.strategy) q.set('strategy', params.strategy)
  if (params?.status) q.set('status', params.status)
  const res = await fetch(`${BASE}/signals?${q}`)
  return res.json()
}

export async function fetchSignal(id: number): Promise<Signal> {
  const res = await fetch(`${BASE}/signals/${id}`)
  return res.json()
}

export async function fetchSummary(): Promise<Summary> {
  const res = await fetch(`${BASE}/stats/summary`)
  return res.json()
}

export async function fetchStrategies(): Promise<StrategyStat[]> {
  const res = await fetch(`${BASE}/stats/strategies`)
  return res.json()
}

export async function fetchSettings(): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}/settings`)
  return res.json()
}

export async function updateSettings(updates: Record<string, string>): Promise<void> {
  await fetch(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  })
}

export async function fetchChartData(symbol: string, timeframe = '15m', limit = 200) {
  const slug = symbol.replace('/', '-')
  const res = await fetch(`${BASE}/chart/${slug}?timeframe=${timeframe}&limit=${limit}`)
  if (!res.ok) throw new Error(`Chart fetch failed: ${res.status}`)
  return res.json()
}
