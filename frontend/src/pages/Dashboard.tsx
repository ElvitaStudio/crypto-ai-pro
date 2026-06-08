import { useState } from 'react'
import { useSignalFeed } from '../hooks/useSignalFeed'
import { SignalCard } from '../components/SignalCard'
import type { AccessStatus } from '../hooks/useAccess'

const FILTERS = ['ALL', 'OPEN', 'WIN', 'LOSS'] as const
type Filter = typeof FILTERS[number]

interface Props {
  accessStatus: AccessStatus
  onProClick: () => void
}

export function Dashboard({ accessStatus, onProClick }: Props) {
  const { signals, connected } = useSignalFeed()
  const [filter, setFilter] = useState<Filter>('ALL')

  const visible = filter === 'ALL' ? signals : signals.filter((s) => s.status === filter)
  const isPro   = accessStatus === 'active'

  return (
    <div>
      <div style={styles.header}>
        <span className="logo-animated" style={styles.title}>MarketPulse Pro</span>

        {/* Status badge */}
        <button
          style={{ ...styles.badge, ...(isPro ? styles.badgePro : styles.badgeFree) }}
          onClick={onProClick}
        >
          <span style={{ ...styles.badgeDot, background: isPro ? '#3fb950' : '#f85149' }} />
          {isPro ? 'PRO' : 'FREE'}
        </button>

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
  header:    { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 },
  title:     { fontSize: 22, fontWeight: 800, flex: 1, letterSpacing: '-0.5px' },
  dot:       { width: 8, height: 8, borderRadius: '50%' },
  dotLabel:  { fontSize: 12, opacity: 0.6 },

  badge: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 800, letterSpacing: '0.5px',
    border: 'none', cursor: 'pointer',
    animation: 'badgePulse 2s ease-in-out infinite',
  },
  badgePro: {
    background: 'rgba(63,185,80,0.15)',
    color: '#3fb950',
    boxShadow: '0 0 8px rgba(63,185,80,0.3)',
  },
  badgeFree: {
    background: 'rgba(248,81,73,0.15)',
    color: '#f85149',
    boxShadow: '0 0 8px rgba(248,81,73,0.3)',
  },
  badgeDot: {
    width: 6, height: 6, borderRadius: '50%',
    animation: 'badgePulse 2s ease-in-out infinite',
  },

  filters:      { display: 'flex', gap: 6, marginBottom: 14 },
  filterBtn:    { padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'inherit', fontSize: 13, cursor: 'pointer' },
  filterActive: { background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.3)' },
  empty:        { textAlign: 'center' as const, opacity: 0.4, marginTop: 60, fontSize: 15 },
}
