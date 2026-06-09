import { useState, useMemo } from 'react'
import { useSignalFeed } from '../../hooks/useSignalFeed'
import { SignalCard } from '../../components/SignalCard'
import { useLang } from '../../i18n/LangContext'
import type { TranslationKey } from '../../i18n/translations'
import type { AccessStatus } from '../../hooks/useAccess'

const FILTERS = ['ALL', 'OPEN', 'WIN', 'LOSS'] as const
type Filter = typeof FILTERS[number]

const FILTER_KEYS: Record<Filter, TranslationKey> = {
  ALL:  'filterAll',
  OPEN: 'filterOpen',
  WIN:  'filterWin',
  LOSS: 'filterLoss',
}

const FILTER_COLORS: Record<Filter, { bg: string; color: string; border: string }> = {
  ALL:  { bg: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: 'rgba(124,58,237,0.4)' },
  OPEN: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  WIN:  { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80', border: 'rgba(34,197,94,0.3)'  },
  LOSS: { bg: 'rgba(239,68,68,0.12)',  color: '#f87171', border: 'rgba(239,68,68,0.3)'  },
}

interface Props {
  accessStatus: AccessStatus
  onProClick: () => void
}

export function WebSignalFeed({ accessStatus, onProClick }: Props) {
  const { signals, connected } = useSignalFeed()
  const { lang, setLang, t } = useLang()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = filter === 'ALL' ? signals : signals.filter(s => s.status === filter)
    const q = search.trim().toUpperCase()
    if (q) list = list.filter(s => s.symbol.toUpperCase().includes(q))
    return list
  }, [signals, filter, search])

  const isPro = accessStatus === 'active'

  // Summary counts
  const openCount = signals.filter(s => s.status === 'OPEN').length
  const winCount  = signals.filter(s => s.status === 'WIN').length
  const lossCount = signals.filter(s => s.status === 'LOSS').length
  const winRate   = winCount + lossCount > 0
    ? Math.round(winCount / (winCount + lossCount) * 100)
    : null

  return (
    <div style={S.root}>

      {/* ── Top bar ───────────────────────────────────────────── */}
      <div style={S.topBar}>
        <div style={S.topBarLeft}>
          <h1 style={S.pageTitle}>Сигналы</h1>
          <div style={{ ...S.liveChip, background: connected ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', borderColor: connected ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.2)', color: connected ? '#4ade80' : '#64748b' }}>
            <span style={{ ...S.liveDot, background: connected ? '#4ade80' : '#475569', boxShadow: connected ? '0 0 6px #4ade80' : 'none' }} />
            {connected ? 'Live' : 'Offline'}
          </div>
        </div>

        <div style={S.topBarRight}>
          {/* Language */}
          <div style={S.langSwitch}>
            {(['ru', 'en'] as const).map(l => (
              <button key={l} style={{ ...S.langBtn, ...(lang === l ? S.langActive : {}) }} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {/* PRO / FREE */}
          <button style={{ ...S.accessBadge, ...(isPro ? S.proBadge : S.freeBadge) }} onClick={onProClick}>
            {isPro ? '💎 PRO' : '🔓 FREE'}
          </button>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      <div style={S.statsRow}>
        {[
          { label: 'Всего', value: signals.length, color: '#a78bfa' },
          { label: 'Открыто', value: openCount, color: '#fbbf24' },
          { label: 'Тейк', value: winCount, color: '#4ade80' },
          { label: 'Стоп', value: lossCount, color: '#f87171' },
          ...(winRate !== null ? [{ label: 'Win rate', value: `${winRate}%`, color: '#38bdf8' }] : []),
        ].map(stat => (
          <div key={stat.label} style={S.statCard}>
            <div style={{ ...S.statValue, color: stat.color }}>{stat.value}</div>
            <div style={S.statLabel}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Search + Filters ──────────────────────────────────── */}
      <div style={S.controlsRow}>
        {/* Search */}
        <div style={S.searchWrap}>
          <span style={S.searchIcon}>🔍</span>
          <input
            style={S.searchInput}
            type="text"
            placeholder="Поиск пары… BTC, ETH, SOL"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button style={S.searchClear} onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {/* Filter chips */}
        <div style={S.filters}>
          {FILTERS.map(f => {
            const isActive = filter === f
            const c = FILTER_COLORS[f]
            return (
              <button
                key={f}
                style={{
                  ...S.filterChip,
                  background:   isActive ? c.bg : 'rgba(255,255,255,0.04)',
                  color:        isActive ? c.color : 'rgba(255,255,255,0.4)',
                  borderColor:  isActive ? c.border : 'rgba(255,255,255,0.08)',
                }}
                onClick={() => setFilter(f)}
              >
                {t(FILTER_KEYS[f])}
                {f === 'OPEN' && openCount > 0 && (
                  <span style={{ ...S.filterCount, background: c.bg, color: c.color }}>{openCount}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Signal list ───────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={S.empty}>
          {search ? (
            <>
              <div style={S.emptyIcon}>🔍</div>
              <div>Пара <strong style={{ color: '#a78bfa' }}>{search.toUpperCase()}</strong> не найдена</div>
              <button style={S.emptyBtn} onClick={() => setSearch('')}>Сбросить поиск</button>
            </>
          ) : (
            <>
              <div style={S.emptyIcon}>📡</div>
              <div>{t('noSignals')}</div>
            </>
          )}
        </div>
      ) : (
        <div style={S.list}>
          {filtered.map(s => (
            <SignalCard key={`${s.id}-${s.timestamp}`} signal={s} />
          ))}
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: 0 },

  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  topBarLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  topBarRight: { display: 'flex', alignItems: 'center', gap: 10 },

  pageTitle: {
    fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: 0,
    letterSpacing: '-0.3px',
  },

  liveChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 20,
    border: '1px solid',
    fontSize: 12, fontWeight: 600,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: '50%',
    flexShrink: 0,
  },

  langSwitch: {
    display: 'flex', background: 'rgba(255,255,255,0.05)',
    borderRadius: 8, padding: 2, gap: 1,
    border: '1px solid rgba(255,255,255,0.07)',
  },
  langBtn: {
    padding: '3px 9px', borderRadius: 6, border: 'none',
    background: 'transparent', color: 'rgba(255,255,255,0.35)',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.5px',
  },
  langActive: { background: 'rgba(124,58,237,0.3)', color: '#c4b5fd' },

  accessBadge: {
    padding: '5px 14px', borderRadius: 20,
    border: '1px solid', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', letterSpacing: '0.3px',
  },
  proBadge: {
    background: 'rgba(124,58,237,0.15)', color: '#a78bfa',
    borderColor: 'rgba(124,58,237,0.4)',
  },
  freeBadge: {
    background: 'rgba(239,68,68,0.1)', color: '#f87171',
    borderColor: 'rgba(239,68,68,0.3)',
  },

  statsRow: {
    display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap',
  },
  statCard: {
    flex: 1, minWidth: 80,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '14px 16px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 22, fontWeight: 800, lineHeight: 1.1, marginBottom: 4,
  },
  statLabel: {
    fontSize: 11, color: '#64748b', fontWeight: 500,
  },

  controlsRow: {
    display: 'flex', gap: 12, marginBottom: 16,
    alignItems: 'center', flexWrap: 'wrap',
  },
  searchWrap: {
    position: 'relative',
    flex: 1, minWidth: 200,
    display: 'flex', alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute', left: 12,
    fontSize: 14, pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '10px 36px 10px 36px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, background 0.2s',
  },
  searchClear: {
    position: 'absolute', right: 10,
    background: 'none', border: 'none',
    color: '#64748b', cursor: 'pointer',
    fontSize: 12, padding: '4px 6px',
    borderRadius: 4,
  },

  filters: {
    display: 'flex', gap: 6, flexShrink: 0,
  },
  filterChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 20,
    border: '1px solid', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  filterCount: {
    padding: '1px 6px', borderRadius: 10,
    fontSize: 11, fontWeight: 700,
  },

  list: { display: 'flex', flexDirection: 'column', gap: 0 },

  empty: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: '60px 20px',
    color: '#475569', fontSize: 14, textAlign: 'center',
  },
  emptyIcon: { fontSize: 40 },
  emptyBtn: {
    marginTop: 4, padding: '8px 18px',
    borderRadius: 8, border: '1px solid rgba(124,58,237,0.3)',
    background: 'rgba(124,58,237,0.1)', color: '#a78bfa',
    fontSize: 13, cursor: 'pointer',
  },
}
