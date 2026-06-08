import { useState } from 'react'
import type { Signal } from '../types'
import { AIDetail } from './AIDetail'
import { LiveChart } from './LiveChart'

interface Props {
  signal: Signal
}

const STRATEGY_LABELS: Record<string, string> = {
  VolumeLevel: '📊 Volume',
  Multi: '🔫 Multi',
  NexusVWAP: '🌌 VWAP',
  TitanFractal: '🏛 Fractal',
}

function statusColor(status: string) {
  if (status === 'WIN') return '#26a17b'
  if (status === 'LOSS') return '#e74c3c'
  return '#f39c12'
}

function dirColor(dir: string) {
  return dir === 'LONG' ? '#26a17b' : '#e74c3c'
}

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function AIBadge({ signal }: { signal: Signal }) {
  if (!signal.ai_votes.length) return null
  const passed = signal.ai_votes.filter((v) => v.approved).length
  const total = signal.ai_votes.length
  return (
    <span style={{ fontSize: 11, opacity: 0.75 }}>
      {signal.ai_votes.map((v) => (v.approved ? '✅' : '❌')).join('')} {passed}/{total}
    </span>
  )
}

export function SignalCard({ signal }: Props) {
  const [showAI, setShowAI] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const rr = Math.abs(signal.tp - signal.entry) / Math.abs(signal.entry - signal.sl)

  return (
    <>
      <div style={styles.card}>
        <div style={styles.row}>
          <span style={{ ...styles.dir, background: dirColor(signal.direction) }}>
            {signal.direction}
          </span>
          <span style={styles.symbol}>{signal.symbol}</span>
          <span style={{ ...styles.status, color: statusColor(signal.status) }}>
            {signal.status === 'WIN' ? `+${signal.pnl_pct?.toFixed(1)}%` :
             signal.status === 'LOSS' ? `${signal.pnl_pct?.toFixed(1)}%` :
             '●'}
          </span>
        </div>

        <div style={styles.row}>
          <span style={styles.tag}>{STRATEGY_LABELS[signal.strategy] ?? signal.strategy}</span>
          <span style={styles.time}>{fmtDate(signal.timestamp)} {fmtTime(signal.timestamp)}</span>
        </div>

        <div style={styles.levels}>
          <div style={styles.level}>
            <span style={styles.label}>Вход</span>
            <span>{signal.entry}</span>
          </div>
          <div style={styles.level}>
            <span style={styles.label}>Стоп</span>
            <span style={{ color: '#e74c3c' }}>{signal.sl}</span>
          </div>
          <div style={styles.level}>
            <span style={styles.label}>Тейк</span>
            <span style={{ color: '#26a17b' }}>{signal.tp.toFixed(4)}</span>
          </div>
          <div style={styles.level}>
            <span style={styles.label}>R:R</span>
            <span>1:{rr.toFixed(1)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button style={{ ...styles.actionBtn, flex: 1 }} onClick={() => setShowChart(true)}>
            📈 График
          </button>
          {signal.ai_votes.length > 0 && (
            <button style={{ ...styles.actionBtn, flex: 2 }} onClick={() => setShowAI(true)}>
              <AIBadge signal={signal} />
              <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 6 }}>AI →</span>
            </button>
          )}
        </div>
      </div>

      {showChart && (
        <LiveChart
          symbol={signal.symbol}
          signalEntry={signal.entry}
          signalSl={signal.sl}
          signalTp={signal.tp}
          signalDirection={signal.direction}
          onClose={() => setShowChart(false)}
        />
      )}
      {showAI && <AIDetail signal={signal} onClose={() => setShowAI(false)} />}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 10,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  dir: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    color: '#fff',
    letterSpacing: 0.5,
  },
  symbol: {
    fontWeight: 700,
    fontSize: 15,
    flex: 1,
  },
  status: {
    fontWeight: 700,
    fontSize: 13,
  },
  tag: {
    fontSize: 11,
    opacity: 0.6,
    background: 'rgba(255,255,255,0.07)',
    padding: '2px 7px',
    borderRadius: 5,
  },
  time: {
    fontSize: 11,
    opacity: 0.45,
    marginLeft: 'auto',
  },
  levels: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 4,
    marginTop: 4,
  },
  level: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 12,
  },
  label: {
    fontSize: 10,
    opacity: 0.45,
    textTransform: 'uppercase',
  },
  actionBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    color: 'inherit',
    textAlign: 'left' as const,
    display: 'flex',
    alignItems: 'center',
    fontSize: 12,
    gap: 4,
  },
}
