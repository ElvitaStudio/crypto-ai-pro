import { useState, useEffect, useMemo } from 'react'

const BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? ''

interface CoinListItem {
  symbol: string
  price: number
  change24h: number
  volume24h: number
  volatility24h: number
}

interface Props {
  selected: string[]
  onClose:  () => void
  onApply:  (symbols: string[]) => void
}

function fmtVol(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}B$`
  return `${v}M$`
}

export function CoinPicker({ selected, onClose, onApply }: Props) {
  const [coins, setCoins]       = useState<CoinListItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [query, setQuery]       = useState('')
  const [checked, setChecked]   = useState<Set<string>>(new Set(selected))
  const [sortCol, setSortCol]   = useState<'volume24h' | 'change24h' | 'volatility24h'>('volume24h')

  useEffect(() => {
    fetch(`${BASE_URL}/api/chart/coins/list?limit=100`)
      .then(r => r.json())
      .then((data: CoinListItem[]) => { setCoins(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    const list = q ? coins.filter(c => c.symbol.includes(q)) : coins
    return [...list].sort((a, b) => b[sortCol] - a[sortCol])
  }, [coins, query, sortCol])

  function toggle(sym: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(sym)) next.delete(sym)
      else next.add(sym)
      return next
    })
  }

  function handleApply() {
    onApply([...checked])
    onClose()
  }

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.sheet} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>Монеты</span>
          <span style={styles.counter}>{checked.size} выбрано</span>
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
          {query && (
            <button style={styles.clearBtn} onClick={() => setQuery('')}>✕</button>
          )}
        </div>

        {/* Sort tabs */}
        <div style={styles.sortRow}>
          <span style={styles.colLabel}>Монета</span>
          {(['volume24h', 'change24h', 'volatility24h'] as const).map(col => {
            const labels = { volume24h: 'Объём 24ч', change24h: 'Цена 24ч', volatility24h: 'Вол 24ч' }
            return (
              <button
                key={col}
                style={{ ...styles.sortBtn, ...(sortCol === col ? styles.sortActive : {}) }}
                onClick={() => setSortCol(col)}
              >
                {labels[col]} {sortCol === col ? '↓' : ''}
              </button>
            )
          })}
        </div>

        {/* List */}
        <div style={styles.list}>
          {loading && <div style={styles.empty}>⏳ Загрузка...</div>}
          {!loading && filtered.length === 0 && <div style={styles.empty}>Ничего не найдено</div>}
          {filtered.map(coin => {
            const isChecked = checked.has(coin.symbol)
            const isUp = coin.change24h >= 0
            return (
              <div
                key={coin.symbol}
                style={{ ...styles.row, ...(isChecked ? styles.rowChecked : {}) }}
                onClick={() => toggle(coin.symbol)}
              >
                <div style={styles.rowLeft}>
                  <div style={{ ...styles.checkbox, ...(isChecked ? styles.checkboxOn : {}) }}>
                    {isChecked && <span style={styles.checkmark}>✓</span>}
                  </div>
                  <span style={styles.symbol}>{coin.symbol}</span>
                </div>
                <span style={{ ...styles.vol, color: coin.volume24h >= 1000 ? '#f0a500' : '#c9d1d9' }}>
                  {fmtVol(coin.volume24h)}
                </span>
                <span style={{ ...styles.change, color: isUp ? '#3dffa0' : '#ff6b6b' }}>
                  {isUp ? '+' : ''}{coin.change24h.toFixed(2)}%
                </span>
                <span style={styles.vola}>{coin.volatility24h.toFixed(2)}%</span>
              </div>
            )
          })}
        </div>

        {/* Apply button */}
        <div style={styles.footer}>
          <button style={styles.resetBtn} onClick={() => setChecked(new Set())}>Сбросить</button>
          <button style={styles.applyBtn} onClick={handleApply}>
            Применить ({checked.size})
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 100,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'flex-end',
  },
  sheet: {
    width: '100%', maxHeight: '88vh',
    background: '#0d1117',
    borderRadius: '16px 16px 0 0',
    border: '1px solid #21262d',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '14px 16px 10px',
    borderBottom: '1px solid #21262d',
  },
  title:   { fontSize: 17, fontWeight: 800, color: '#e6edf3', flex: 1 },
  counter: { fontSize: 12, color: '#888', background: '#161b22', borderRadius: 10, padding: '2px 8px' },
  closeBtn: { background: 'none', border: 'none', color: '#888', fontSize: 16, cursor: 'pointer', padding: 4 },

  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 8,
    margin: '10px 16px',
    background: '#161b22', borderRadius: 10, padding: '8px 12px',
    border: '1px solid #30363d',
  },
  searchIcon:  { fontSize: 14, opacity: 0.5 },
  searchInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: '#e6edf3', fontSize: 14,
  },
  clearBtn: { background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer' },

  sortRow: {
    display: 'flex', alignItems: 'center',
    padding: '4px 16px 6px',
    borderBottom: '1px solid #21262d',
    gap: 4,
  },
  colLabel: { flex: 1, fontSize: 11, color: '#555', fontWeight: 700 },
  sortBtn: {
    fontSize: 10, fontWeight: 700, color: '#555',
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '3px 6px', borderRadius: 6, minWidth: 64, textAlign: 'right' as const,
  },
  sortActive: { color: '#1f6feb', background: 'rgba(31,111,235,0.1)' },

  list: { flex: 1, overflowY: 'auto' as const },
  empty: { textAlign: 'center' as const, color: '#555', padding: 32, fontSize: 14 },

  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    transition: 'background 0.1s',
  },
  rowChecked: { background: 'rgba(31,111,235,0.08)' },
  rowLeft: { flex: 1, display: 'flex', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 18, height: 18, borderRadius: 5,
    border: '1.5px solid #30363d',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxOn: { background: '#1f6feb', borderColor: '#1f6feb' },
  checkmark:  { color: '#fff', fontSize: 11, fontWeight: 900 },
  symbol: { fontSize: 14, fontWeight: 700, color: '#e6edf3' },
  vol:    { fontSize: 12, fontWeight: 600, minWidth: 58, textAlign: 'right' as const },
  change: { fontSize: 12, fontWeight: 600, minWidth: 58, textAlign: 'right' as const },
  vola:   { fontSize: 12, color: '#888',   minWidth: 50, textAlign: 'right' as const },

  footer: {
    display: 'flex', gap: 10, padding: '12px 16px',
    borderTop: '1px solid #21262d',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
  },
  resetBtn: {
    flex: 0, padding: '10px 18px', borderRadius: 10,
    background: 'rgba(255,255,255,0.06)', border: '1px solid #30363d',
    color: '#888', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  applyBtn: {
    flex: 1, padding: '10px 0', borderRadius: 10,
    background: '#1f6feb', border: 'none',
    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
}
