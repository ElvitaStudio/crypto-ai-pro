import type { Signal } from '../types'

interface Props {
  signal: Signal
  onClose: () => void
}

const MODEL_LABELS: Record<string, string> = {
  'anthropic/claude-haiku-4-5': 'Claude Haiku',
  'openai/gpt-4o-mini': 'GPT-4o Mini',
  'google/gemini-flash-2.0': 'Gemini Flash',
}

export function AIDetail({ signal, onClose }: Props) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.handle} />
        <h3 style={styles.title}>AI Совет — {signal.symbol}</h3>
        <p style={styles.summary}>{signal.ai_summary}</p>

        <div style={styles.votes}>
          {signal.ai_votes.map((vote, i) => (
            <div key={i} style={{ ...styles.voteCard, borderColor: vote.approved ? '#26a17b44' : '#e74c3c44' }}>
              <div style={styles.voteHeader}>
                <span style={styles.voteIcon}>{vote.approved ? '✅' : '❌'}</span>
                <span style={styles.modelName}>{MODEL_LABELS[vote.model] ?? vote.model.split('/')[1]}</span>
                <span style={{ ...styles.confidence, color: vote.approved ? '#26a17b' : '#e74c3c' }}>
                  {vote.confidence}%
                </span>
              </div>
              <p style={styles.reasoning}>{vote.reasoning}</p>
            </div>
          ))}
        </div>

        {Object.keys(signal.features).length > 0 && (
          <>
            <h4 style={styles.featTitle}>Рыночные данные</h4>
            <div style={styles.features}>
              {Object.entries(signal.features).map(([k, v]) => (
                <div key={k} style={styles.feat}>
                  <span style={styles.featKey}>{k}</span>
                  <span style={styles.featVal}>{typeof v === 'number' ? v.toFixed(2) : v}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <button style={styles.closeBtn} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-end', zIndex: 100,
  },
  sheet: {
    background: '#16213e', width: '100%', borderRadius: '20px 20px 0 0',
    padding: '12px 16px 32px', maxHeight: '85vh', overflowY: 'auto',
  },
  handle: {
    width: 40, height: 4, background: 'rgba(255,255,255,0.2)',
    borderRadius: 2, margin: '0 auto 16px',
  },
  title: { fontSize: 17, fontWeight: 700, marginBottom: 4 },
  summary: { fontSize: 13, opacity: 0.6, marginBottom: 16 },
  votes: { display: 'flex', flexDirection: 'column', gap: 10 },
  voteCard: {
    border: '1px solid',
    borderRadius: 10, padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
  },
  voteHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  voteIcon: { fontSize: 16 },
  modelName: { fontWeight: 600, fontSize: 14, flex: 1 },
  confidence: { fontWeight: 700, fontSize: 14 },
  reasoning: { fontSize: 13, opacity: 0.75, lineHeight: 1.4 },
  featTitle: { fontSize: 14, fontWeight: 600, marginTop: 18, marginBottom: 8, opacity: 0.7 },
  features: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  feat: {
    background: 'rgba(255,255,255,0.04)', borderRadius: 8,
    padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2,
  },
  featKey: { fontSize: 10, opacity: 0.45, textTransform: 'uppercase' },
  featVal: { fontSize: 14, fontWeight: 600 },
  closeBtn: {
    marginTop: 20, width: '100%', padding: '14px',
    background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12,
    color: 'inherit', fontSize: 15, cursor: 'pointer',
  },
}
