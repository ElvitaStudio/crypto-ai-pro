export interface AIVote {
  model: string
  approved: boolean
  confidence: number
  reasoning: string
}

export interface Signal {
  id: number
  timestamp: number
  strategy: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  entry: number
  sl: number
  tp: number
  features: Record<string, number>
  ai_approved: boolean
  ai_votes: AIVote[]
  ai_summary: string | null
  status: 'OPEN' | 'WIN' | 'LOSS'
  closed_at: number | null
  pnl_pct: number | null
}

export interface StrategyStat {
  strategy: string
  total: number
  wins: number
  losses: number
  open: number
  win_rate: number
  avg_pnl: number
}

export interface Summary {
  total_signals: number
  total_wins: number
  total_losses: number
  total_open: number
  win_rate: number
  total_pnl: number
  ai_blocked: number
}

// Chart types
export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  delta: number
}

export interface VolumeProfileBar {
  price: number
  volume: number
  buy_vol: number
  sell_vol: number
  is_hvn: boolean
  is_poc: boolean
}

export interface ChartLevel {
  price: number
  type: 'SUPPORT' | 'RESISTANCE' | 'VAH' | 'VAL' | 'POC' | 'HIGH_24H' | 'LOW_24H'
  strength: number
}

export interface Zone {
  price_top: number
  price_bot: number
  zone_type: 'SUPPLY' | 'DEMAND'
  volume: number
}

export interface ChartData {
  symbol: string
  timeframe: string
  candles: Candle[]
  volume_profile: VolumeProfileBar[]
  levels: ChartLevel[]
  zones: Zone[]
  poc: number
  vah: number
  val: number
}

export type Page = 'screener' | 'feed' | 'stats' | 'pro' | 'settings' | 'guide'
