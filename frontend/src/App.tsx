import { useState } from 'react'
import type { Page } from './types'
import { useLang } from './i18n/LangContext'
import { Dashboard } from './pages/Dashboard'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { Pro } from './pages/Pro'
import { Guide } from './pages/Guide'
import { Paywall, TrialBanner } from './components/Paywall'
import { ExpiryPopup } from './components/ExpiryPopup'
import { useAccess } from './hooks/useAccess'

export function App() {
  const [page, setPage] = useState<Page>('feed')
  const [showPaywall, setShowPaywall] = useState(false)
  const access = useAccess()
  const { t }  = useLang()

  const NAV: { id: Page; label: string; icon: string; pro?: boolean }[] = [
    { id: 'feed',     label: t('navSignals'),  icon: '📡'  },
    { id: 'stats',    label: t('navStats'),    icon: '📈'  },
    { id: 'pro',      label: t('navPro'),      icon: '💎', pro: true },
    { id: 'guide',    label: t('navGuide'),    icon: '📖'  },
    { id: 'settings', label: t('navSettings'), icon: '⚙️'  },
  ]

  // Block access when expired
  if (access.status === 'expired' || showPaywall) {
    return <Paywall access={access} />
  }

  return (
    <div style={styles.root}>
      {/* Trial countdown banner */}
      {access.status === 'trial' && access.hoursLeft !== null && (
        <TrialBanner hoursLeft={access.hoursLeft} />
      )}

      {/* Expiry popup — last 24h, shown every hour */}
      {access.status === 'active' &&
        access.hoursUntilExpiry !== null &&
        access.hoursUntilExpiry <= 24 && (
        <ExpiryPopup
          hoursUntilExpiry={access.hoursUntilExpiry}
          expiresAt={access.expiresAt}
          onRenew={() => setShowPaywall(true)}
        />
      )}

      <div style={styles.content}>
        {page === 'feed'     && <Dashboard accessStatus={access.status} onProClick={() => setPage('pro')} />}
        {page === 'stats'    && <Stats />}
        {page === 'settings' && <Settings />}
        {page === 'pro'      && (
          <Pro access={access} onUpgrade={() => setShowPaywall(true)} />
        )}
        {page === 'guide'    && <Guide />}
      </div>

      <nav style={styles.nav}>
        {NAV.map((item) => {
          const isActive = page === item.id
          return (
            <button
              key={item.id}
              style={{ ...styles.navBtn, ...(isActive ? styles.navActive : {}) }}
              onClick={() => setPage(item.id)}
            >
              {item.pro ? (
                <span style={{ ...styles.navIcon, ...(isActive ? styles.proIconActive : styles.proIcon) }}>
                  {item.icon}
                </span>
              ) : (
                <span style={styles.navIcon}>{item.icon}</span>
              )}
              {item.pro ? (
                <span style={{ ...styles.navLabel, ...(isActive ? styles.proLabelActive : styles.proLabel) }}>
                  {item.label}
                </span>
              ) : (
                <span style={styles.navLabel}>{item.label}</span>
              )}
            </button>
          )
        })}
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
  navActive:      { color: '#fff' },
  navIcon:        { fontSize: 20 },
  navLabel:       { fontSize: 11 },
  proIcon:        { fontSize: 20, filter: 'drop-shadow(0 0 4px rgba(167,139,250,0.6))' },
  proIconActive:  { fontSize: 20, filter: 'drop-shadow(0 0 8px rgba(167,139,250,1))' },
  proLabel:       { fontSize: 11, background: 'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontWeight: 700 },
  proLabelActive: { fontSize: 11, background: 'linear-gradient(90deg,#c4b5fd,#93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontWeight: 700 },
}
