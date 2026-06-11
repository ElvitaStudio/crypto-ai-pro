import { useState, useEffect, useCallback, useRef } from 'react'
import { useLang } from '../i18n/LangContext'
import type { AccessStatus } from '../hooks/useAccess'

const BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? ''
const REFRESH_INTERVAL_MS = 30_000
const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA']
const TIMEFRAMES = ['1м', '5м', '15м', '1ч', '4ч', '1д'] as const
const TF_MAP: Record<string, string> = { '1м': '1m', '5м': '5m', '15м': '15m', '1ч': '1h', '4ч': '4h', '1д': '1d' }

interface ScreenerCandle { o: number; h: number; l: number; c: number; v: number }
interface ScreenerItem {
  symbol: string
  price: number
  change24h: number
  high24h: number
  low24h: number
  volume24h: number
  rsi: number | null
  adx: number | null
  vol_ratio: number | null
  trend1h: 'UP' | 'DOWN' | 'NEUTRAL'
  candles: ScreenerCandle[]
}

interface Props {
  accessStatus:   AccessStatus
  onProClick:     () => void
  onOpenChart:    (symbol: string) => void
  onOpenAnalysis: (symbol: string) => void
}

// ── Mini candlestick chart ──────────────────────────────────────────────────

function MiniChart({ candles, change24h }: { candles: ScreenerCandle[]; change24h: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isUp = change24h >= 0
  const color = isUp ? '#26a17b' : '#e74c3c'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || candles.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const lows  = candles.map(c => c.l)
    const highs = candles.map(c => c.h)
    const minP  = Math.min(...lows)
    const maxP  = Math.max(...highs)
    const range = maxP - minP || 1

    const pad   = 4
    const cW    = (W - pad * 2) / candles.length
    const toY   = (p: number) => pad + (1 - (p - minP) / range) * (H - pad * 2)

    candles.forEach((c, i) => {
      const x     = pad + i * cW + cW / 2
      const bodyW = Math.max(cW * 0.6, 1)
      const bullish = c.c >= c.o
      const col   = bullish ? '#26a17b' : '#e74c3c'

      // Wick
      ctx.strokeStyle = col
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.moveTo(x, toY(c.h))
      ctx.lineTo(x, toY(c.l))
      ctx.stroke()

      // Body
      const top    = toY(Math.max(c.o, c.c))
      const bottom = toY(Math.min(c.o, c.c))
      const bodyH  = Math.max(bottom - top, 1)
      ctx.fillStyle = col
      ctx.fillRect(x - bodyW / 2, top, bodyW, bodyH)
    })

    // Gradient overlay (fade left edge)
    const grad = ctx.createLinearGradient(0, 0, 60, 0)
    grad.addColorStop(0, 'rgba(13,17,23,0.8)')
    grad.addColorStop(1, 'rgba(13,17,23,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 60, H)
  }, [candles, color])

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={72}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

// ── Price formatter ─────────────────────────────────────────────────────────

function fmt(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (price >= 1)    return price.toFixed(4)
  if (price >= 0.01) return price.toFixed(5)
  return price.toFixed(6)
}

// ── Row component ───────────────────────────────────────────────────────────

function ScreenerRow({
  item, onChart, onAnalysis,
}: {
  item: ScreenerItem
  onChart:    () => void
  onAnalysis: () => void
}) {
  const isUp = item.change24h >= 0
  const now  = new Date()
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

  return (
    <div style={rowStyles.wrap}>
      {/* Mini chart background */}
      <div style={rowStyles.chartArea}>
        <MiniChart candles={item.candles} change24h={item.change24h} />
      </div>

      {/* Overlay content */}
      <div style={rowStyles.overlay}>
        {/* Top row: symbol + price badge */}
        <div style={rowStyles.topRow}>
          <div style={rowStyles.symbolWrap}>
            <span style={rowStyles.symbol}>{item.symbol}</span>
            <span style={rowStyles.pair}>/USDT</span>
          </div>
          <div style={{ ...rowStyles.priceBadge, background: isUp ? '#1a4a36' : '#4a1a1a', border: `1px solid ${isUp ? '#26a17b' : '#e74c3c'}` }}>
            <span style={{ ...rowStyles.priceVal, color: isUp ? '#3dffa0' : '#ff6b6b' }}>
              {fmt(item.price)}
            </span>
            <span style={{ ...rowStyles.priceTime, color: isUp ? '#26a17b' : '#e74c3c' }}>
              {timeStr}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div style={rowStyles.statsRow}>
          <StatLine label="Изм(24h)" value={`${isUp ? '+' : ''}${item.change24h.toFixed(2)}%`} color={isUp ? '#3dffa0' : '#ff6b6b'} />
          <StatLine label="Об(24h)"  value={`${item.volume24h}M$`} />
          <StatLine label="RSI"      value={item.rsi != null ? item.rsi.toFixed(1) : '—'} color={item.rsi != null && item.rsi > 60 ? '#f0a500' : item.rsi != null && item.rsi < 40 ? '#26a17b' : undefined} />
          <StatLine label="ADX"      value={item.adx != null ? item.adx.toFixed(1) : '—'} />
        </div>

        {/* Bottom: trend + buttons */}
        <div style={rowStyles.bottomRow}>
          <TrendBadge trend={item.trend1h} />
          <button style={rowStyles.btnChart} onClick={onChart}>📈 График</button>
        </div>
      </div>
    </div>
  )
}

function StatLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={rowStyles.statLine}>
      <span style={rowStyles.statLabel}>{label}</span>
      <span style={{ ...rowStyles.statVal, color: color ?? 'rgba(255,255,255,0.7)' }}>{value}</span>
    </div>
  )
}

function TrendBadge({ trend }: { trend: ScreenerItem['trend1h'] }) {
  const map = {
    UP:      { label: '↑ Вверх',  bg: 'rgba(38,161,123,0.2)', color: '#3dffa0' },
    DOWN:    { label: '↓ Вниз',   bg: 'rgba(231,76,60,0.2)',  color: '#ff6b6b' },
    NEUTRAL: { label: '→ Боком',  bg: 'rgba(240,165,0,0.2)',  color: '#f0a500' },
  }
  const s = map[trend]
  return <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '2px 8px', background: s.bg, color: s.color }}>{s.label}</span>
}

const rowStyles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
    height: 138,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
    background: '#0d1117',
    border: '1px solid #21262d',
  },
  chartArea: {
    position: 'absolute',
    inset: 0,
    opacity: 0.55,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  symbolWrap: { display: 'flex', alignItems: 'baseline', gap: 2 },
  symbol:     { fontSize: 17, fontWeight: 800, color: '#e6edf3' },
  pair:       { fontSize: 11, color: '#555' },
  priceBadge: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    borderRadius: 6, padding: '3px 8px',
  },
  priceVal:  { fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px' },
  priceTime: { fontSize: 10, opacity: 0.8 },
  statsRow: {
    display: 'flex',
    gap: 12,
  },
  statLine:  { display: 'flex', flexDirection: 'column', gap: 1 },
  statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.3px' },
  statVal:   { fontSize: 12, fontWeight: 600 },
  bottomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  btns: { display: 'flex', gap: 5 },
  btnChart: {
    background: 'rgba(31,111,235,0.85)', color: '#fff', border: 'none',
    borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  },
  btnAnalysis: {
    background: 'rgba(35,134,54,0.85)', color: '#fff', border: 'none',
    borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  },
}

// ── Main Screener ───────────────────────────────────────────────────────────

export function Screener({ accessStatus, onProClick, onOpenChart, onOpenAnalysis }: Props) {
  const { lang, setLang } = useLang()
  const isPro = accessStatus === 'active'

  const [tf, setTf]             = useState<typeof TIMEFRAMES[number]>('5м')
  const [items, setItems]       = useState<ScreenerItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError]       = useState<string | null>(null)

  const fetchData = useCallback(async (timeframe: string) => {
    try {
      const tf_api = TF_MAP[timeframe] ?? '5m'
      const url = `${BASE_URL}/api/chart/screener/data?symbols=${DEFAULT_SYMBOLS.join(',')}&timeframe=${tf_api}`
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
    setLoading(true)
    fetchData(tf)
    const id = setInterval(() => fetchData(tf), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [tf, fetchData])

  const timeStr = lastUpdate
    ? lastUpdate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <div>
      {/* Header */}
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
          <button style={{ ...styles.langBtn, ...(lang === 'ru' ? styles.langActive : {}) }} onClick={() => setLang('ru')}>RU</button>
          <button style={{ ...styles.langBtn, ...(lang === 'en' ? styles.langActive : {}) }} onClick={() => setLang('en')}>EN</button>
        </div>
      </div>

      {/* Timeframe selector */}
      <div style={styles.tfRow}>
        {TIMEFRAMES.map(t => (
          <button
            key={t}
            style={{ ...styles.tfBtn, ...(tf === t ? styles.tfActive : {}) }}
            onClick={() => setTf(t)}
          >{t}</button>
        ))}
        <span style={styles.updateBadge}>
          {loading ? '⏳' : `🔄 ${timeStr}`}
        </span>
      </div>

      {error && <div style={styles.errorBox}>⚠️ {error}</div>}

      {/* Rows */}
      <div>
        {items.map(item => (
          <ScreenerRow
            key={item.symbol}
            item={item}
            onChart={() => onOpenChart(item.symbol)}
            onAnalysis={() => onOpenAnalysis(item.symbol)}
          />
        ))}
      </div>

      {!loading && items.length === 0 && !error && (
        <div style={styles.empty}>Нет данных</div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 },
  title:  { fontSize: 22, fontWeight: 800, flex: 1, letterSpacing: '-0.5px' },
  badge:  { display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', border: 'none', cursor: 'pointer' },
  badgePro:  { background: 'rgba(63,185,80,0.15)',  color: '#3fb950', boxShadow: '0 0 8px rgba(63,185,80,0.3)' },
  badgeFree: { background: 'rgba(248,81,73,0.15)',  color: '#f85149', boxShadow: '0 0 8px rgba(248,81,73,0.3)' },
  badgeDot:  { width: 6, height: 6, borderRadius: '50%' },
  langSwitch: { display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: 2, gap: 2 },
  langBtn:    { padding: '3px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  langActive: { background: 'rgba(255,255,255,0.15)', color: '#fff' },
  tfRow: { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 },
  tfBtn: {
    padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 12,
    fontWeight: 600, cursor: 'pointer',
  },
  tfActive: { background: '#1f6feb', borderColor: '#1f6feb', color: '#fff' },
  updateBadge: { marginLeft: 'auto', fontSize: 10, color: '#555' },
  errorBox: { background: '#3a1a1a', color: '#f85149', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13 },
  empty:    { textAlign: 'center' as const, color: '#555', padding: 40 },
}
