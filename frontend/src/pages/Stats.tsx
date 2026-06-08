import { useEffect, useState } from 'react'
import { fetchSummary, fetchStrategies, fetchSignals } from '../api'
import type { Summary, StrategyStat, Signal } from '../types'

// ── Signal history modal ──────────────────────────────────────────────────────

const STATUS_CONFIG = {
  WIN:  { label: 'TP',      bg: '#0a3620', color: '#3fb950', dot: '🟢' },
  LOSS: { label: 'SL',      bg: '#3d1515', color: '#f85149', dot: '🔴' },
  OPEN: { label: 'Открыт',  bg: '#1c2a3a', color: '#58a6ff', dot: '🔵' },
}

function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString('ru', { maximumFractionDigits: 1 })
  if (n >= 1)    return n.toFixed(2)
  return n.toFixed(4)
}

function timeAgo(ts: number) {
  const diff = Date.now() / 1000 - ts
  if (diff < 3600)  return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return `${Math.floor(diff / 86400)} дн назад`
}

function SignalRow({ s, onClick }: { s: Signal; onClick: () => void }) {
  const cfg = STATUS_CONFIG[s.status]
  return (
    <div style={st.row} onClick={onClick}>
      <div style={st.rowLeft}>
        <span style={{ ...st.dirBadge, background: s.direction === 'LONG' ? '#0a3620' : '#3d1515', color: s.direction === 'LONG' ? '#3fb950' : '#f85149' }}>
          {s.direction}
        </span>
        <div>
          <div style={st.rowSymbol}>{s.symbol}</div>
          <div style={st.rowTime}>{timeAgo(s.timestamp)} · {s.strategy}</div>
        </div>
      </div>
      <div style={st.rowRight}>
        <span style={{ ...st.statusBadge, background: cfg.bg, color: cfg.color }}>
          {cfg.dot} {cfg.label}
        </span>
        {s.pnl_pct !== null && (
          <span style={{ color: s.pnl_pct >= 0 ? '#3fb950' : '#f85149', fontSize: 13, fontWeight: 700 }}>
            {s.pnl_pct >= 0 ? '+' : ''}{s.pnl_pct}%
          </span>
        )}
      </div>
    </div>
  )
}

function SignalDetail({ s, onClose }: { s: Signal; onClose: () => void }) {
  const cfg = STATUS_CONFIG[s.status]
  return (
    <div style={st.detailOverlay} onClick={onClose}>
      <div style={st.detailCard} onClick={e => e.stopPropagation()}>
        <div style={st.detailHeader}>
          <div>
            <div style={st.detailSymbol}>{s.symbol}</div>
            <div style={st.detailSub}>{s.strategy} · {timeAgo(s.timestamp)}</div>
          </div>
          <button style={st.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={st.detailGrid}>
          <div style={st.detailItem}>
            <span style={st.detailLabel}>Направление</span>
            <span style={{ color: s.direction === 'LONG' ? '#3fb950' : '#f85149', fontWeight: 700 }}>
              {s.direction}
            </span>
          </div>
          <div style={st.detailItem}>
            <span style={st.detailLabel}>Статус</span>
            <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.dot} {cfg.label}</span>
          </div>
          <div style={st.detailItem}>
            <span style={st.detailLabel}>Точка входа</span>
            <span style={st.detailVal}>${fmt(s.entry)}</span>
          </div>
          <div style={st.detailItem}>
            <span style={st.detailLabel}>Take Profit</span>
            <span style={{ color: '#3fb950', fontWeight: 600 }}>${fmt(s.tp)}</span>
          </div>
          <div style={st.detailItem}>
            <span style={st.detailLabel}>Stop Loss</span>
            <span style={{ color: '#f85149', fontWeight: 600 }}>${fmt(s.sl)}</span>
          </div>
          {s.pnl_pct !== null && (
            <div style={st.detailItem}>
              <span style={st.detailLabel}>P&L</span>
              <span style={{ color: s.pnl_pct >= 0 ? '#3fb950' : '#f85149', fontWeight: 700, fontSize: 18 }}>
                {s.pnl_pct >= 0 ? '+' : ''}{s.pnl_pct}%
              </span>
            </div>
          )}
        </div>

        {s.ai_summary && (
          <div style={st.aiBox}>
            <div style={st.aiLabel}>🤖 AI анализ</div>
            <div style={st.aiText}>{s.ai_summary}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function SignalsModal({ onClose, initialFilter = 'ALL' }: { onClose: () => void; initialFilter?: 'ALL' | 'OPEN' | 'WIN' | 'LOSS' }) {
  const [signals, setSignals]   = useState<Signal[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'ALL' | 'OPEN' | 'WIN' | 'LOSS'>(initialFilter)
  const [selected, setSelected] = useState<Signal | null>(null)

  useEffect(() => {
    fetchSignals({ limit: 200 })
      .then(all => {
        const cutoff = Date.now() / 1000 - 3 * 86400
        setSignals(all.filter(s => s.timestamp >= cutoff))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'ALL' ? signals : signals.filter(s => s.status === filter)

  const counts = {
    ALL:  signals.length,
    OPEN: signals.filter(s => s.status === 'OPEN').length,
    WIN:  signals.filter(s => s.status === 'WIN').length,
    LOSS: signals.filter(s => s.status === 'LOSS').length,
  }

  return (
    <>
      <div style={st.modalOverlay} onClick={onClose}>
        <div style={st.modal} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={st.modalHeader}>
            <div>
              <div style={st.modalTitle}>
                {filter === 'WIN' ? '🟢 Тейк-профиты' : filter === 'LOSS' ? '🔴 Стоп-лоссы' : '📋 История сигналов'}
              </div>
              <div style={st.modalSub}>За последние 3 суток · {filtered.length} сигналов</div>
            </div>
            <button style={st.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Filter tabs */}
          <div style={st.filterRow}>
            {(['ALL', 'OPEN', 'WIN', 'LOSS'] as const).map(f => (
              <button
                key={f}
                style={{ ...st.filterBtn, ...(filter === f ? st.filterActive : {}) }}
                onClick={() => setFilter(f)}
              >
                {f === 'ALL' ? 'Все' : f === 'OPEN' ? '🔵 Открытые' : f === 'WIN' ? '🟢 TP' : '🔴 SL'}
                <span style={st.filterCount}>{counts[f]}</span>
              </button>
            ))}
          </div>

          {/* List */}
          <div style={st.list}>
            {loading && <div style={st.empty}>Загрузка...</div>}
            {!loading && filtered.length === 0 && (
              <div style={st.empty}>Нет сигналов за 3 суток</div>
            )}
            {filtered.map(s => (
              <SignalRow key={s.id} s={s} onClick={() => setSelected(s)} />
            ))}
          </div>
        </div>
      </div>

      {selected && <SignalDetail s={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

// ── Stats page ────────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, onClick }: {
  label: string; value: string | number; sub?: string; onClick?: () => void
}) {
  return (
    <div style={{ ...styles.box, ...(onClick ? styles.boxClickable : {}) }} onClick={onClick}>
      <span style={styles.boxLabel}>{label}</span>
      <span style={styles.boxValue}>{value}</span>
      {sub && <span style={styles.boxSub}>{sub}</span>}
      {onClick && <span style={styles.boxHint}>tap →</span>}
    </div>
  )
}

function StratRow({ s }: { s: StrategyStat }) {
  const barW = Math.min(s.win_rate, 100)
  return (
    <div style={styles.stratRow}>
      <div style={styles.stratName}>{s.strategy}</div>
      <div style={styles.bar}>
        <div style={{ ...styles.barFill, width: `${barW}%` }} />
      </div>
      <div style={styles.stratStats}>
        <span style={{ color: '#26a17b' }}>{s.wins}W</span>
        <span style={{ opacity: 0.4 }}>/</span>
        <span style={{ color: '#e74c3c' }}>{s.losses}L</span>
        <span style={{ opacity: 0.6, marginLeft: 'auto' }}>{s.win_rate}%</span>
        <span style={{ color: s.avg_pnl >= 0 ? '#26a17b' : '#e74c3c', marginLeft: 8 }}>
          {s.avg_pnl >= 0 ? '+' : ''}{s.avg_pnl}%
        </span>
      </div>
    </div>
  )
}

export function Stats() {
  const [summary, setSummary]       = useState<Summary | null>(null)
  const [strategies, setStrategies] = useState<StrategyStat[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'OPEN' | 'WIN' | 'LOSS'>('ALL')

  useEffect(() => {
    fetchSummary().then(setSummary).catch(() => {})
    fetchStrategies().then(setStrategies).catch(() => {})
  }, [])

  if (!summary) return <div style={styles.loading}>Загрузка...</div>

  return (
    <div>
      <h2 style={styles.title}>Статистика</h2>

      <div style={styles.grid}>
        <StatBox
          label="Всего сигналов"
          value={summary.total_signals}
          onClick={() => { setHistoryFilter('ALL'); setShowHistory(true) }}
        />
        <StatBox label="Win Rate" value={`${summary.win_rate}%`} />
        <StatBox
          label="Тейк-профит"
          value={summary.total_wins}
          sub="WIN"
          onClick={() => { setHistoryFilter('WIN'); setShowHistory(true) }}
        />
        <StatBox
          label="Стоп-лосс"
          value={summary.total_losses}
          sub="LOSS"
          onClick={() => { setHistoryFilter('LOSS'); setShowHistory(true) }}
        />
        <StatBox label="Открытые" value={summary.total_open}   sub="OPEN" />
        <StatBox
          label="Суммарный P&L"
          value={`${summary.total_pnl >= 0 ? '+' : ''}${summary.total_pnl}%`}
        />
      </div>

      {summary.ai_blocked > 0 && (
        <div style={styles.aiBlocked}>
          🤖 AI Совет заблокировал <b>{summary.ai_blocked}</b> сигналов
        </div>
      )}

      {strategies.length > 0 && (
        <>
          <h3 style={styles.subTitle}>По стратегиям</h3>
          {strategies.map(s => <StratRow key={s.strategy} s={s} />)}
        </>
      )}

      {showHistory && <SignalsModal initialFilter={historyFilter} onClose={() => setShowHistory(false)} />}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  title:    { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  subTitle: { fontSize: 15, fontWeight: 600, marginBottom: 12, opacity: 0.7 },
  grid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  box:      { background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' as const },
  boxClickable: { cursor: 'pointer', border: '1px solid rgba(88,166,255,0.3)', background: 'rgba(88,166,255,0.07)' },
  boxLabel: { fontSize: 11, opacity: 0.45, textTransform: 'uppercase' as const },
  boxValue: { fontSize: 22, fontWeight: 700 },
  boxSub:   { fontSize: 11, opacity: 0.4 },
  boxHint:  { fontSize: 10, color: '#58a6ff', opacity: 0.7 },
  aiBlocked:{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 20 },
  stratRow: { background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 },
  stratName:{ fontSize: 14, fontWeight: 600, marginBottom: 8 },
  bar:      { height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 8 },
  barFill:  { height: '100%', background: '#26a17b', borderRadius: 2 },
  stratStats:{ display: 'flex', alignItems: 'center', fontSize: 13, gap: 4 },
  loading:  { textAlign: 'center' as const, opacity: 0.4, marginTop: 60 },
}

const st: Record<string, React.CSSProperties> = {
  // Modal
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' },
  modal:        { background: '#0d1117', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' as const },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 16px 12px' },
  modalTitle:   { fontSize: 17, fontWeight: 700, color: '#f0f6fc' },
  modalSub:     { fontSize: 12, color: '#6e7681', marginTop: 2 },
  closeBtn:     { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 20, width: 32, height: 32, color: '#8b949e', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  // Filters
  filterRow:    { display: 'flex', gap: 6, padding: '0 16px 12px', overflowX: 'auto' as const },
  filterBtn:    { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8b949e', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  filterActive: { background: 'rgba(88,166,255,0.15)', borderColor: '#58a6ff', color: '#f0f6fc' },
  filterCount:  { background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '1px 6px', fontSize: 11 },

  // List
  list: { overflowY: 'auto' as const, flex: 1, padding: '0 16px 24px' },
  empty:{ textAlign: 'center' as const, color: '#484f58', padding: 40, fontSize: 14 },

  // Row
  row:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' },
  rowLeft:    { display: 'flex', alignItems: 'center', gap: 10 },
  dirBadge:   { padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 },
  rowSymbol:  { fontSize: 15, fontWeight: 600, color: '#f0f6fc' },
  rowTime:    { fontSize: 11, color: '#6e7681', marginTop: 2 },
  rowRight:   { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 4 },
  statusBadge:{ padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 },

  // Detail overlay
  detailOverlay:{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' },
  detailCard:   { background: '#161b22', borderRadius: '20px 20px 0 0', width: '100%', padding: '20px 16px 40px', border: '1px solid #30363d' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  detailSymbol: { fontSize: 22, fontWeight: 700, color: '#f0f6fc' },
  detailSub:    { fontSize: 12, color: '#6e7681', marginTop: 3 },
  detailGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  detailItem:   { background: '#0d1117', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column' as const, gap: 4 },
  detailLabel:  { fontSize: 11, color: '#6e7681', textTransform: 'uppercase' as const },
  detailVal:    { fontSize: 16, fontWeight: 700, color: '#f0f6fc' },
  aiBox:        { background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.2)', borderRadius: 10, padding: '12px 14px' },
  aiLabel:      { fontSize: 12, color: '#e3b341', fontWeight: 600, marginBottom: 6 },
  aiText:       { fontSize: 13, color: '#d1d5db', lineHeight: 1.5 },
}
