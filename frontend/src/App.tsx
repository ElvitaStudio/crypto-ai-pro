import { useState } from 'react'
import type { Page } from './types'
import { Dashboard } from './pages/Dashboard'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { Paywall, TrialBanner } from './components/Paywall'
import { useAccess } from './hooks/useAccess'

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'feed', label: 'Сигналы', icon: '📡' },
  { id: 'stats', label: 'Статистика', icon: '📈' },
  { id: 'settings', label: 'Настройки', icon: '⚙️' },
]

export function App() {
  const [page, setPage] = useState<Page>('feed')
  const access = useAccess()

  // Block access when expired
  if (access.status === 'expired') {
    return <Paywall access={access} />
  }

  return (
    <div style={styles.root}>
      {/* Trial countdown banner */}
      {access.status === 'trial' && access.hoursLeft !== null && (
        <TrialBanner hoursLeft={access.hoursLeft} />
      )}
      <div style={styles.content}>
        {page === 'feed' && <Dashboard />}
        {page === 'stats' && <Stats />}
        {page === 'settings' && <Settings />}
      </div>

      <nav style={styles.nav}>
        {NAV.map((item) => (
          <button
            key={item.id}
            style={{ ...styles.navBtn, ...(page === item.id ? styles.navActive : {}) }}
            onClick={() => setPage(item.id)}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            <span style={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    maxWidth: 480, margin: '0 auto',
  },
  content: {
    flex: 1, overflowY: 'auto', padding: '16px 16px 0',
  },
  nav: {
    display: 'flex', borderTop: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  navBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 2, padding: '10px 0', background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'color 0.15s',
  },
  navActive: { color: '#fff' },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 11 },
}
