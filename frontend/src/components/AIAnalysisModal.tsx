import { useState, useEffect } from 'react'

const BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? ''

interface AIAnalysisResponse {
  symbol: string
  report: string
  indicators: {
    price: number
    change24h: number
    rsi_15m: number
    rsi_1h: number
    adx: number
    vwap: number
    vwap_dist_pct: number
    cvd_trend: string
    vol_ratio: number
    trend_1h: string
    trend_4h: string
  }
}

interface Props {
  symbol: string   // base ticker e.g. "BTC"
  onClose: () => void
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (p >= 1)    return p.toFixed(4)
  return p.toFixed(6)
}

// Simple markdown renderer for the report
function ReportText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={rStyles.reportBody}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <div key={i} style={rStyles.h2}>{line.replace('## ', '')}</div>
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <div key={i} style={rStyles.bold}>{line.replace(/\*\*/g, '')}</div>
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <div key={i} style={rStyles.bullet}>• {line.slice(2)}</div>
        }
        if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
        // Inline bold
        const parts = line.split(/\*\*(.*?)\*\*/g)
        return (
          <div key={i} style={rStyles.line}>
            {parts.map((p, j) =>
              j % 2 === 1
                ? <span key={j} style={{ fontWeight: 700, color: '#e6edf3' }}>{p}</span>
                : <span key={j}>{p}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function AIAnalysisModal({ symbol, onClose }: Props) {
  const [data, setData]     = useState<AIAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`${BASE_URL}/api/chart/ai-analysis/${symbol}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d: AIAnalysisResponse) => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [symbol])

  const ind = data?.indicators

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.sheet} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>🤖 AI Анализ</div>
            <div style={styles.subtitle}>{symbol}/USDT {ind ? `· $${fmtPrice(ind.price)}` : ''}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Indicators strip */}
        {ind && (
          <div style={styles.indRow}>
            <IndCell label="RSI 15м" value={ind.rsi_15m.toFixed(1)} color={ind.rsi_15m > 65 ? '#f0a500' : ind.rsi_15m < 35 ? '#3dffa0' : '#c9d1d9'} />
            <IndCell label="RSI 1ч"  value={ind.rsi_1h.toFixed(1)}  color={ind.rsi_1h > 65 ? '#f0a500' : ind.rsi_1h < 35 ? '#3dffa0' : '#c9d1d9'} />
            <IndCell label="ADX"     value={ind.adx.toFixed(1)}     color={ind.adx > 25 ? '#3dffa0' : '#888'} />
            <IndCell label="CVD"     value={ind.cvd_trend}          color={ind.cvd_trend === 'растёт' ? '#3dffa0' : '#ff6b6b'} />
            <IndCell label="Тренд 1ч" value={ind.trend_1h}         color={ind.trend_1h === 'UP' ? '#3dffa0' : ind.trend_1h === 'DOWN' ? '#ff6b6b' : '#888'} />
            <IndCell label="Тренд 4ч" value={ind.trend_4h}         color={ind.trend_4h === 'UP' ? '#3dffa0' : ind.trend_4h === 'DOWN' ? '#ff6b6b' : '#888'} />
          </div>
        )}

        {/* Report content */}
        <div style={styles.content}>
          {loading && (
            <div style={styles.loadingWrap}>
              <div style={styles.spinner} />
              <div style={styles.loadingText}>AI анализирует {symbol}...</div>
              <div style={styles.loadingHint}>Обычно занимает 5–10 секунд</div>
            </div>
          )}
          {error && <div style={styles.errorBox}>⚠️ {error}</div>}
          {data && <ReportText text={data.report} />}
        </div>
      </div>
    </div>
  )
}

function IndCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={iStyles.cell}>
      <span style={iStyles.label}>{label}</span>
      <span style={{ ...iStyles.value, color }}>{value}</span>
    </div>
  )
}

const iStyles: Record<string, React.CSSProperties> = {
  cell:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 },
  label: { fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.3px' },
  value: { fontSize: 12, fontWeight: 700 },
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,0.8)',
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
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '14px 16px 10px',
    borderBottom: '1px solid #21262d',
    background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(31,111,235,0.1))',
  },
  title:    { fontSize: 18, fontWeight: 800, color: '#e6edf3' },
  subtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  closeBtn: { background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer' },

  indRow: {
    display: 'flex',
    padding: '8px 12px',
    borderBottom: '1px solid #21262d',
    background: '#0d1117',
  },

  content: { flex: 1, overflowY: 'auto' as const, padding: '12px 16px' },

  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: 48, gap: 12,
  },
  spinner: {
    width: 40, height: 40, borderRadius: '50%',
    border: '3px solid rgba(124,58,237,0.2)',
    borderTop: '3px solid #7c3aed',
    animation: 'spin 1s linear infinite',
  },
  loadingText: { fontSize: 15, color: '#e6edf3', fontWeight: 600 },
  loadingHint: { fontSize: 12, color: '#555' },
  errorBox: {
    background: '#3a1a1a', color: '#f85149',
    borderRadius: 10, padding: '12px 16px', fontSize: 13,
  },
}

const rStyles: Record<string, React.CSSProperties> = {
  reportBody: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.6 },
  h2:   { fontSize: 15, fontWeight: 800, color: '#e6edf3', marginTop: 16, marginBottom: 6, borderLeft: '3px solid #7c3aed', paddingLeft: 10 },
  bold: { fontWeight: 700, color: '#e6edf3', marginBottom: 4 },
  line: { marginBottom: 2 },
  bullet: { paddingLeft: 12, marginBottom: 3, color: 'rgba(255,255,255,0.7)' },
}
