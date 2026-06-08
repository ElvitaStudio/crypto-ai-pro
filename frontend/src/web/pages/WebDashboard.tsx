import { useState } from 'react'
import type { Page } from '../../types'
import { useLang } from '../../i18n/LangContext'
import { Dashboard } from '../../pages/Dashboard'
import { Stats } from '../../pages/Stats'
import { Settings } from '../../pages/Settings'
import { Pro } from '../../pages/Pro'
import { Guide } from '../../pages/Guide'
import { Paywall, TrialBanner } from '../../components/Paywall'
import { ExpiryPopup } from '../../components/ExpiryPopup'
import { useWebAccess } from '../../hooks/useWebAccess'
import type { AccessInfo } from '../../hooks/useAccess'
import { useAuth } from '../AuthContext'

export function WebDashboard() {
  const [page, setPage] = useState<Page>('feed')
  const [showPaywall, setShowPaywall] = useState(false)
  const access = useWebAccess()
  const { t } = useLang()
  const { user, logout } = useAuth()

  const NAV: { id: Page; label: string; icon: string; pro?: boolean }[] = [
    { id: 'feed',     label: t('navSignals'),  icon: '📡'  },
    { id: 'stats',    label: t('navStats'),    icon: '📈'  },
    { id: 'pro',      label: t('navPro'),      icon: '💎', pro: true },
    { id: 'guide',    label: t('navGuide'),    icon: '📖'  },
    { id: 'settings', label: t('navSettings'), icon: '⚙️'  },
  ]

  if (access.status === 'expired' || showPaywall) {
    return (
      <div style={S.paywallWrap}>
        <Paywall access={access} />
      </div>
    )
  }

  const initials = user?.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <div style={S.root}>
      {/* Top web header */}
      <header style={S.header}>
        <div style={S.headerLogo}>
          <div style={S.logoIcon}>📊</div>
          <span style={S.logoText}>MarketPulse Pro</span>
        </div>
        <div style={S.headerRight}>
          {access.status === 'trial' && access.hoursLeft !== null && (
            <div style={S.trialChip}>
              ⏱ {Math.ceil(access.hoursLeft)}ч бесплатно
            </div>
          )}
          {access.status === 'active' && (
            <div style={S.activeChip}>💎 PRO</div>
          )}
          <div style={S.avatar} title={user?.displayName || user?.email || ''}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" width={30} height={30} style={{ borderRadius: '50%' }} />
              : initials
            }
          </div>
          <button style={S.logoutBtn} onClick={logout} title="Выйти">
            ↩
          </button>
        </div>
      </header>

      {/* Expiry popup */}
      {access.status === 'active' &&
        access.hoursUntilExpiry !== null &&
        access.hoursUntilExpiry <= 24 && (
        <ExpiryPopup
          hoursUntilExpiry={access.hoursUntilExpiry}
          expiresAt={access.expiresAt}
          onRenew={() => setShowPaywall(true)}
        />
      )}

      <div style={S.body}>
        {/* Sidebar nav on desktop */}
        <aside style={S.sidebar} data-sidebar="true">
          {NAV.map(item => {
            const isActive = page === item.id
            return (
              <button
                key={item.id}
                style={{ ...S.sideBtn, ...(isActive ? S.sideBtnActive : {}) }}
                onClick={() => setPage(item.id)}
              >
                <span style={S.sideIcon}>{item.icon}</span>
                <span style={item.pro ? S.proLabel : S.sideLabel}>{item.label}</span>
              </button>
            )
          })}
        </aside>

        {/* Main content */}
        <main style={S.main}>
          {access.status === 'trial' && access.hoursLeft !== null && (
            <TrialBanner hoursLeft={access.hoursLeft} />
          )}
          <div style={S.pageWrap}>
            {page === 'feed'     && <Dashboard accessStatus={access.status} onProClick={() => setPage('pro')} />}
            {page === 'stats'    && <Stats />}
            {page === 'settings' && <Settings />}
            {page === 'pro'      && <Pro access={access} onUpgrade={() => setShowPaywall(true)} />}
            {page === 'guide'    && <Guide />}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav style={S.mobileNav} data-mobile-nav="true">
        {NAV.map(item => {
          const isActive = page === item.id
          return (
            <button
              key={item.id}
              style={{ ...S.mobileNavBtn, ...(isActive ? S.mobileNavActive : {}) }}
              onClick={() => setPage(item.id)}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 10 }}>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column',
    height: '100vh',
    background: '#0d0f14',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#e2e8f0',
  },
  header: {
    height: 56,
    background: 'rgba(13,15,20,0.97)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 20px',
    flexShrink: 0,
  },
  headerLogo: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  logoIcon: {
    width: 28, height: 28,
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14,
  },
  logoText: {
    fontWeight: 700, fontSize: 15, color: '#fff',
  },
  headerRight: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  trialChip: {
    padding: '3px 10px', borderRadius: 20,
    background: 'rgba(251,191,36,0.12)',
    border: '1px solid rgba(251,191,36,0.25)',
    color: '#fbbf24', fontSize: 11, fontWeight: 600,
  },
  activeChip: {
    padding: '3px 10px', borderRadius: 20,
    background: 'rgba(124,58,237,0.15)',
    border: '1px solid rgba(124,58,237,0.35)',
    color: '#a78bfa', fontSize: 11, fontWeight: 700,
  },
  avatar: {
    width: 30, height: 30, borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden',
    cursor: 'pointer',
  },
  logoutBtn: {
    background: 'none', border: 'none', color: '#64748b',
    cursor: 'pointer', fontSize: 16, padding: '4px 6px',
  },
  body: {
    flex: 1, display: 'flex', overflow: 'hidden',
  },
  sidebar: {
    width: 180, flexShrink: 0,
    padding: '16px 10px',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column', gap: 4,
    overflowY: 'auto',
  },
  sideBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 10,
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.45)', fontSize: 13,
    transition: 'all 0.15s', textAlign: 'left',
    width: '100%',
  },
  sideBtnActive: {
    background: 'rgba(124,58,237,0.15)',
    color: '#fff',
  },
  sideIcon: { fontSize: 18, width: 22, textAlign: 'center' },
  sideLabel: {},
  proLabel: {
    background: 'linear-gradient(90deg,#a78bfa,#60a5fa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 700,
  },
  main: {
    flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },
  pageWrap: {
    flex: 1, overflowY: 'auto', padding: '16px',
    maxWidth: 960, width: '100%', margin: '0 auto',
  },
  mobileNav: {
    display: 'none',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
  },
  mobileNavBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 2, padding: '10px 0', background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
  },
  mobileNavActive: { color: '#fff' },
  paywallWrap: { minHeight: '100vh', background: '#0d0f14' },
}
