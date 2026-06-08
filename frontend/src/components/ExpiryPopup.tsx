import { useState, useEffect } from 'react'

const POPUP_KEY = 'expiry_popup_last_shown'
const HOUR_MS   = 60 * 60 * 1000

interface Props {
  hoursUntilExpiry: number
  expiresAt: string | null
  onRenew: () => void
}

export function ExpiryPopup({ hoursUntilExpiry, expiresAt, onRenew }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Show only in last 24 hours
    if (hoursUntilExpiry > 24) return

    const lastShown = Number(localStorage.getItem(POPUP_KEY) ?? 0)
    const now       = Date.now()

    if (now - lastShown >= HOUR_MS) {
      setVisible(true)
      localStorage.setItem(POPUP_KEY, String(now))
    }
  }, [hoursUntilExpiry])

  if (!visible) return null

  const h = Math.floor(hoursUntilExpiry)
  const m = Math.floor((hoursUntilExpiry - h) * 60)
  const timeStr = h > 0 ? `${h} ч ${m} мин` : `${m} минут`

  const expiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })
    : ''

  return (
    <div style={s.overlay} onClick={() => setVisible(false)}>
      <div style={s.popup} onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button style={s.closeBtn} onClick={() => setVisible(false)}>✕</button>

        {/* Icon */}
        <div style={s.icon}>⏰</div>

        {/* Text */}
        <h3 style={s.title}>Подписка скоро истекает</h3>
        <p style={s.desc}>
          До окончания осталось <b style={{ color: '#f87171' }}>{timeStr}</b>
          {expiryDate && <> · {expiryDate}</>}
        </p>
        <p style={s.subdesc}>
          Продлите сейчас — не теряйте доступ к сигналам
        </p>

        {/* Actions */}
        <button style={s.renewBtn} onClick={() => { setVisible(false); onRenew() }}>
          ⚡ Продлить подписку
        </button>
        <button style={s.laterBtn} onClick={() => setVisible(false)}>
          Напомнить через час
        </button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.75)',
    zIndex: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 20px',
  },
  popup: {
    background: '#161b22',
    border: '1px solid rgba(248,113,113,0.4)',
    borderRadius: 20,
    padding: '28px 20px 20px',
    width: '100%', maxWidth: 360,
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', gap: 10,
    position: 'relative' as const,
    boxShadow: '0 0 40px rgba(248,113,113,0.15)',
  },
  closeBtn: {
    position: 'absolute' as const, top: 14, right: 14,
    background: 'rgba(255,255,255,0.08)', border: 'none',
    borderRadius: 20, width: 30, height: 30,
    color: '#8b949e', fontSize: 14, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  icon:     { fontSize: 44, lineHeight: 1 },
  title:    { fontSize: 18, fontWeight: 800, color: '#f0f6fc', margin: 0, textAlign: 'center' as const },
  desc:     { fontSize: 14, color: '#d1d5db', textAlign: 'center' as const, margin: 0, lineHeight: 1.5 },
  subdesc:  { fontSize: 13, color: '#6e7681', textAlign: 'center' as const, margin: 0 },
  renewBtn: {
    width: '100%', padding: '14px',
    borderRadius: 12, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    color: '#fff', fontSize: 15, fontWeight: 800,
    boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
    marginTop: 6,
  },
  laterBtn: {
    width: '100%', padding: '10px',
    borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: '#6e7681', fontSize: 13,
    cursor: 'pointer',
  },
}
