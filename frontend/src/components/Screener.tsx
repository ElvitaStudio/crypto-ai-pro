import { useState, useEffect, useCallback } from 'react'
import { useLang } from '../i18n/LangContext'
import type { AccessStatus } from '../hooks/useAccess'

const BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? ''
const REFRESH_INTERVAL_MS = 30_000
const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA']

interface ScreenerItem {
  symbol: string
  price: number
  change24h: number
  high24h: number
  low24h: number
  volume24h: number  // in millions
  rsi: number | null
  adx: number | null
  vol_ratio: number | null
  trend1h: 'UP' | 'DOWN' | 'NEUTRAL'
}

interface Props {
  accessStatus:   AccessStatus
  onProClick:     () => void
  onOpenChart:    (symbol: string) => void
  onOpenAnalysis: (symbol: string) => void
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (price >= 1)    return price.toFixed(4)
  return price.toFixed(6)
}

function TrendBadge({ trend }: { trend: ScreenerItem['trend1h'] }) {
  const map = {
    UP:      { label: '↑ Вверх',  bg: '#1a3a2a', color: '#3fb950' },
    DOWN:    { label: '↓ Вниз',   bg: '#3a1a1a', color: '#f85149' },
    NEUTRAL: { label: '→ Боком',  bg: '#2a2a1a', color: '#d29922' },
  }
  const s = map[trend]
  return (
    <span style={{ ...styles.pill, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function ChangeBadge({ value }: { value: number }) {
  const isPos = value >= 0
  return (
    <span style={{
      ...styles.pill,
      background: isPos ? '#1a3a2a' : '#3a1a1a',
      color:      isPos ? '#3fb950' : '#f85149',
    }}>
      {isPos ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

export function Screener({ accessStatus, onProClick, onOpenChart, onOpenAnalysis }: Props) {
  const { lang, setLang } = useLang()
  const isPro = accessStatus === 'active'

  const [items, setItems]           = useState<ScreenerItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError]           = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const url = `${BASE_URL}/api/chart/screener/data?symbols=${DEFAULT_SYMBOLS.join(',')}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ScreenerItem[] = await res.json()
      setItems(data)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchData])

  const timeStr = lastUpdate
    ? lastUpdate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <div style={styles.container}>
      {/* Header — same style as Dashboard */}
      <div style={styles.header}>
        <span className="logo-animated" style={styles.title}>MarketPulse Pro</span>

        <button
          style={{ ...styles.badge, ...(isPro ? styles.badgePro : styles.badgeFree) }}
          onClick={onProClick}
        >
          <span style={{ ...styles.badgeDot, background: isPro ? '#3fb950' : '#f85149' }} />
          {isPro ? 'PRO' : 'FREE'}
        </button>

        <div style={styles.langSwitch}>
          <button
            style={{ ...styles.langBtn, ...(lang === 'ru' ? styles.langActive : {}) }}
            onClick={() => setLang('ru')}
          >RU</button>
          <button
            style={{ ...styles.langBtn, ...(lang === 'en' ? styles.langActive : {}) }}
            onClick={() => setLang('en')}
          >EN</button>
        </div>

        <span style={styles.updateTime}>
          {loading ? '⏳' : `🔄 ${timeStr}`}
        </span>
      </div>

      {error && (
        <div style={styles.errorBox}>⚠️ {error}</div>
      )}

      {/* Cards */}
      {items.map(item => (
        <div key={item.symbol} style={styles.card}>
          <div style={styles.cardTop}>
            <div style={styles.symbolRow}>
              <span style={styles.symbol}>{item.symbol}</span>
              <span style={styles.pair}>/USDT</span>
            </div>
            <div style={styles.priceRow}>
              <span style={styles.price}>${formatPrice(item.price)}</span>
              <ChangeBadge value={item.change24h} />
            </div>
          </div>

          <div style={styles.statsRow}>
            <StatCell label="RSI" value={item.rsi != null ? item.rsi.toFixed(1) : '—'} />
            <StatCell label="ADX" value={item.adx != null ? item.adx.toFixed(1) : '—'} />
            <StatCell label="Vol×" value={item.vol_ratio != null ? item.vol_ratio.toFixed(2) : '—'} />
            <StatCell label="Объём" value={item.volume24h != null ? `$${item.volume24h}M` : '—'} />
          </div>

          <div style={styles.cardBottom}>
            <TrendBadge trend={item.trend1h} />
            <div style={styles.actionBtns}>
              <button
                style={styles.btnChart}
                onClick={() => onOpenChart(item.symbol)}
              >
                📈 График
              </button>
              <button
                style={styles.btnAnalysis}
                onClick={() => onOpenAnalysis(item.symbol)}
              >
                🔍 Анализ
              </button>
            </div>
          </div>
        </div>
      ))}

      {!loading && items.length === 0 && !error && (
        <div style={styles.empty}>Нет данных</div>
      )}
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCell}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px 8px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    flex: 1,
    letterSpacing: '-0.5px',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.5px',
    border: 'none',
    cursor: 'pointer',
  },
  badgePro:  { background: 'rgba(63,185,80,0.15)',  color: '#3fb950', boxShadow: '0 0 8px rgba(63,185,80,0.3)'  },
  badgeFree: { background: 'rgba(248,81,73,0.15)',  color: '#f85149', boxShadow: '0 0 8px rgba(248,81,73,0.3)' },
  badgeDot:  { width: 6, height: 6, borderRadius: '50%' },
  langSwitch: { display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: 2, gap: 2 },
  langBtn:    { padding: '3px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.5px' },
  langActive: { background: 'rgba(255,255,255,0.15)', color: '#fff' },
  updateTime: {
    fontSize: 11,
    color: '#888',
    whiteSpace: 'nowrap' as const,
  },
  errorBox: {
    background: '#3a1a1a',
    color: '#f85149',
    borderRadius: 8,
    padding: '8px 12px',
    marginBottom: 12,
    fontSize: 13,
  },
  card: {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 10,
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  symbolRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 2,
  },
  symbol: {
    fontSize: 18,
    fontWeight: 700,
    color: '#e6edf3',
  },
  pair: {
    fontSize: 12,
    color: '#666',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: 600,
    color: '#e6edf3',
  },
  pill: {
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 6,
    padding: '2px 7px',
  },
  statsRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
  },
  statCell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: '#0d1117',
    borderRadius: 8,
    padding: '5px 4px',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: 600,
    color: '#c9d1d9',
  },
  cardBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionBtns: {
    display: 'flex',
    gap: 6,
  },
  btnChart: {
    background: '#1f6feb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnAnalysis: {
    background: '#238636',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center',
    color: '#666',
    padding: 32,
  },
}
