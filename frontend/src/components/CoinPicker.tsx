import { useState, useEffect, useMemo } from 'react'
import { LiveChart } from './LiveChart'
import { AIAnalysisModal } from './AIAnalysisModal'

const BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? ''

interface CoinListItem {
  symbol: string
  price: number
  change24h: number
  volume24h: number
  volatility24h: number
}

interface Props {
  onClose: () => void
}

function fmtVol(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}B$`
  return `${v.toFixed(0)}M$`
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (p >= 1)    return p.toFixed(3)
  return p.toFixed(5)
}

export function CoinPicker({ onClose }: Props) {
  const [coins, setCoins]     = useState<CoinListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery]     = useState('')
  const [sortCol, setSortCol] = useState<'volume24h' | 'change24h' | 'volatility24h'>('volume24h')

  // Open chart / AI states
  const [chartSymbol, setChartSymbol]   = useState<string | null>(null)
  const [aiSymbol, setAiSymbol]         = useState<string | null>(null)

  useEffect(() => {
    fetch(`${BASE_URL}/api/chart/coins/list?limit=100`)
      .then(r => r.json())
      .then((data: CoinListItem[]) => { setCoins(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    const list = q ? coins.filter(c => c.symbol.includes(q)) : coins
    return [...list].sort((a, b) => {
      if (sortCol === 'change24h') return Math.abs(b.change24h) - Math.abs(a.change24h)
      return b[sortCol] - a[sortCol]
    })
  }, [coins, query, sortCol])

  // Chart opened from coin list
  if (chartSymbol) {
    return (
      <LiveChart
        symbol={`${chartSymbol}/USDT`}
        onClose={() => setChartSymbol(null)}
      />
    )
  }

  // AI analysis modal
  if (aiSymbol) {
    return (
      <AIAnalysisModal
        symbol={aiSymbol}
        onClose={() => setAiSymbol(null)}
      />
    )
  }

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.sheet} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>🪙 Монеты</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Search */}
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Поиск монеты..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && <button style={styles.clearBtn} onClick={() => setQuery('')}>✕</button>}
        </div>

        {/* Column headers / sort */}
        <div style={styles.sortRow}>
          <span style={styles.colMoneta}>Монета</span>
          {(['volume24h', 'change24h', 'volatility24h'] as const).map(col => {
            const labels = { volume24h: 'Объём 24ч', change24h: 'Цена 24ч', volatility24h: 'Вол 24ч' }
            return (
              <button
                key={col}
                style={{ ...styles.sortBtn, ...(sortCol === col ? styles.sortActive : {}) }}
                onClick={() => setSortCol(col)}
              >
                {labels[col]}{sortCol === col ? ' ↓' : ''}
              </button>
            )
          })}
        </div>

        {/* Coin list */}
        <div style={styles.list}>
          {loading && <div style={styles.empty}>⏳ Загрузка...</div>}
          {!loading && filtered.length === 0 && <div style={styles.empty}>Ничего не найдено</div>}

          {filtered.map(coin => {
            const isUp = coin.change24h >= 0
            return (
              <div key={coin.symbol} style={styles.row}>
                {/* Click on name → chart */}
                <div style={styles.rowMain} onClick={() => setChartSymbol(coin.symbol)}>
                  <div style={styles.symbolCol}>
                    <span style={styles.symbol}>{coin.symbol}</span>
                    <span style={{ ...styles.price, color: isUp ? '#3dffa0' : '#ff6b6b' }}>
                      ${fmtPrice(coin.price)}
                    </span>
                  </div>
                  <span style={{ ...styles.vol, color: coin.volume24h >= 1000 ? '#f0a500' : '#c9d1d9' }}>
                    {fmtVol(coin.volume24h)}
                  </span>
                  <span style={{ ...styles.change, color: isUp ? '#3dffa0' : '#ff6b6b' }}>
                    {isUp ? '+' : ''}{coin.change24h.toFixed(2)}%
                  </span>
                  <span style={styles.vola}>{coin.volatility24h.toFixed(2)}%</span>
                </div>

                {/* AI button */}
                <button
                  style={styles.aiBtn}
                  onClick={e => { e.stopPropagation(); setAiSymbol(coin.symbol) }}
                >
                  🤖
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 100,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'flex-end',
  },
  sheet: {
    width: '100%', maxHeight: '92vh',
    background: '#0d1117',
    borderRadius: '16px 16px 0 0',
    border: '1px solid #21262d',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center',
    padding: '14px 16px 10px',
    borderBottom: '1px solid #21262d',
  },
  title:    { fontSize: 17, fontWeight: 800, color: '#e6edf3', flex: 1 },
  closeBtn: { background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer' },

  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 8,
    margin: '10px 16px',
    background: '#161b22', borderRadius: 10, padding: '8px 12px',
    border: '1px solid #30363d',
  },
  searchIcon:  { fontSize: 14, opacity: 0.5 },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e6edf3', fontSize: 14 },
  clearBtn:    { background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer' },

  sortRow: {
    display: 'flex', alignItems: 'center',
    padding: '4px 16px 6px',
    borderBottom: '1px solid #21262d',
    gap: 0,
  },
  colMoneta: { flex: 1, fontSize: 11, color: '#555', fontWeight: 700 },
  sortBtn: {
    fontSize: 10, fontWeight: 700, color: '#555',
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '3px 6px', borderRadius: 6, minWidth: 62, textAlign: 'right' as const,
  },
  sortActive: { color: '#1f6feb', background: 'rgba(31,111,235,0.1)' },

  list:  { flex: 1, overflowY: 'auto' as const },
  empty: { textAlign: 'center' as const, color: '#555', padding: 32, fontSize: 14 },

  row: {
    display: 'flex', alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  rowMain: {
    flex: 1, display: 'flex', alignItems: 'center',
    padding: '10px 16px',
    cursor: 'pointer',
    gap: 0,
  },
  symbolCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 1 },
  symbol:    { fontSize: 14, fontWeight: 700, color: '#e6edf3' },
  price:     { fontSize: 11, fontWeight: 500 },
  vol:    { fontSize: 12, fontWeight: 600, minWidth: 62, textAlign: 'right' as const },
  change: { fontSize: 12, fontWeight: 600, minWidth: 60, textAlign: 'right' as const },
  vola:   { fontSize: 12, color: '#888',   minWidth: 50, textAlign: 'right' as const },
  aiBtn: {
    padding: '6px 10px', marginRight: 10,
    background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)',
    borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#a78bfa',
    flexShrink: 0,
  },
}
