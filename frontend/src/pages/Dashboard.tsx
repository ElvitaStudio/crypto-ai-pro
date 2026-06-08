import { useState } from 'react'
import { useSignalFeed } from '../hooks/useSignalFeed'
import { SignalCard } from '../components/SignalCard'

const FILTERS = ['ALL', 'OPEN', 'WIN', 'LOSS'] as const
type Filter = typeof FILTERS[number]

export function Dashboard() {
  const { signals, connected } = useSignalFeed()
  const [filter, setFilter] = useState<Filter>('ALL')

  const visible = filter === 'ALL' ? signals : signals.filter((s) => s.status === filter)

  return (
    <div>
      <div style={styles.header}>
        <span className="logo-animated" style={styles.title}>MarketPulse Pro</span>
        <span style={{ ...styles.dot, background: connected ? '#26a17b' : '#e74c3c' }} />
        <span style={styles.dotLabel}>{connected ? 'Live' : 'Off'}</span>
      </div>

      <div style={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f}
            style={{ ...styles.filterBtn, ...(filter === f ? styles.filterActive : {}) }}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div style={styles.empty}>Нет сигналов</div>
      ) : (
        visible.map((s) => <SignalCard key={`${s.id}-${s.timestamp}`} signal={s} />)
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: 800, flex: 1, letterSpacing: '-0.5px' },
  dot: { width: 8, height: 8, borderRadius: '50%' },
  dotLabel: { fontSize: 12, opacity: 0.6 },
  filters: { display: 'flex', gap: 6, marginBottom: 14 },
  filterBtn: {
    padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent', color: 'inherit', fontSize: 13, cursor: 'pointer',
  },
  filterActive: {
    background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.3)',
  },
  empty: { textAlign: 'center', opacity: 0.4, marginTop: 60, fontSize: 15 },
}
