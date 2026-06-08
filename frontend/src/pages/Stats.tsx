import { useEffect, useState } from 'react'
import { fetchSummary, fetchStrategies } from '../api'
import type { Summary, StrategyStat } from '../types'

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={styles.box}>
      <span style={styles.boxLabel}>{label}</span>
      <span style={styles.boxValue}>{value}</span>
      {sub && <span style={styles.boxSub}>{sub}</span>}
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
  const [summary, setSummary] = useState<Summary | null>(null)
  const [strategies, setStrategies] = useState<StrategyStat[]>([])

  useEffect(() => {
    fetchSummary().then(setSummary).catch(() => {})
    fetchStrategies().then(setStrategies).catch(() => {})
  }, [])

  if (!summary) return <div style={styles.loading}>Загрузка...</div>

  return (
    <div>
      <h2 style={styles.title}>Статистика</h2>

      <div style={styles.grid}>
        <StatBox label="Всего сигналов" value={summary.total_signals} />
        <StatBox label="Win Rate" value={`${summary.win_rate}%`} />
        <StatBox label="Победы" value={summary.total_wins} sub="WIN" />
        <StatBox label="Потери" value={summary.total_losses} sub="LOSS" />
        <StatBox label="Открытые" value={summary.total_open} sub="OPEN" />
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
          {strategies.map((s) => <StratRow key={s.strategy} s={s} />)}
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  subTitle: { fontSize: 15, fontWeight: 600, marginBottom: 12, opacity: 0.7 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  box: {
    background: 'rgba(255,255,255,0.05)', borderRadius: 12,
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4,
  },
  boxLabel: { fontSize: 11, opacity: 0.45, textTransform: 'uppercase' },
  boxValue: { fontSize: 22, fontWeight: 700 },
  boxSub: { fontSize: 11, opacity: 0.4 },
  aiBlocked: {
    background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.2)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 20,
  },
  stratRow: {
    background: 'rgba(255,255,255,0.04)', borderRadius: 10,
    padding: '12px 14px', marginBottom: 8,
  },
  stratName: { fontSize: 14, fontWeight: 600, marginBottom: 8 },
  bar: {
    height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 8,
  },
  barFill: { height: '100%', background: '#26a17b', borderRadius: 2 },
  stratStats: { display: 'flex', alignItems: 'center', fontSize: 13, gap: 4 },
  loading: { textAlign: 'center', opacity: 0.4, marginTop: 60 },
}
