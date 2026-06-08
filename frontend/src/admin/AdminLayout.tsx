import { useState } from 'react'
import { UsersPage }   from './pages/UsersPage'
import { BroadcastPage } from './pages/BroadcastPage'
import { PaymentSettingsPage } from './pages/PaymentSettingsPage'

type Tab = 'users' | 'broadcast' | 'payments'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'users',     icon: '👥', label: 'Пользователи' },
  { id: 'broadcast', icon: '📢', label: 'Рассылка'     },
  { id: 'payments',  icon: '💳', label: 'Оплата'       },
]

interface Props { token: string; onLogout: () => void }

export function AdminLayout({ token, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('users')

  return (
    <div style={s.root}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.brand}>
          <span style={{ fontSize: 22 }}>📊</span>
          <span style={s.brandText}>Admin</span>
        </div>
        <nav style={s.nav}>
          {TABS.map(t => (
            <button
              key={t.id}
              style={{ ...s.navBtn, ...(tab === t.id ? s.navActive : {}) }}
              onClick={() => setTab(t.id)}
            >
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <button style={s.logoutBtn} onClick={onLogout}>← Выйти</button>
      </aside>

      {/* Content */}
      <main style={s.main}>
        {tab === 'users'     && <UsersPage token={token} />}
        {tab === 'broadcast' && <BroadcastPage token={token} />}
        {tab === 'payments'  && <PaymentSettingsPage token={token} />}
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:      { display: 'flex', minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontFamily: 'system-ui, sans-serif' },
  sidebar:   { width: 220, background: '#161b22', borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column', padding: '20px 12px' },
  brand:     { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 20 },
  brandText: { fontSize: 17, fontWeight: 700, color: '#f0f6fc' },
  nav:       { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  navBtn:    { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: '#8b949e', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left' },
  navActive: { background: '#21262d', color: '#f0f6fc' },
  logoutBtn: { padding: '10px 14px', borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#6e7681', fontSize: 13, cursor: 'pointer', marginTop: 8 },
  main:      { flex: 1, padding: '32px 36px', overflowY: 'auto' },
}
