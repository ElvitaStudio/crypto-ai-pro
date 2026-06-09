import { useState } from 'react'
import type { Page } from '../../types'
import { useLang } from '../../i18n/LangContext'
import { Stats } from '../../pages/Stats'
import { Settings } from '../../pages/Settings'
import { Pro } from '../../pages/Pro'
import { Guide } from '../../pages/Guide'
import { Paywall, TrialBanner } from '../../components/Paywall'
import { ExpiryPopup } from '../../components/ExpiryPopup'
import { WebSignalFeed } from '../components/WebSignalFeed'
import { useWebAccess } from '../../hooks/useWebAccess'
import { useAuth } from '../AuthContext'

type NavItem = { id: Page; label: string; icon: string; pro?: boolean }

const NAV_ITEMS: NavItem[] = [
  { id: 'feed',     label: 'Сигналы',    icon: '📡' },
  { id: 'stats',    label: 'Статистика', icon: '📈' },
  { id: 'pro',      label: 'Pro',        icon: '💎', pro: true },
  { id: 'guide',    label: 'Гайд',       icon: '📖' },
  { id: 'settings', label: 'Настройки',  icon: '⚙️' },
]

export function WebDashboard() {
  const [page, setPage] = useState<Page>('feed')
  const [showPaywall, setShowPaywall] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const access = useWebAccess()
  const { t } = useLang()
  const { user, logout } = useAuth()

  if (access.status === 'expired' || showPaywall) {
    return <div style={S.paywallWrap}><Paywall access={access} /></div>
  }

  const initials = user?.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '?'

  const name = user?.displayName || user?.email?.split('@')[0] || 'User'

  return (
    <div style={S.root}>

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside style={{ ...S.sidebar, width: sidebarCollapsed ? 64 : 220 }}>

        {/* Logo */}
        <div style={S.sidebarTop}>
          <div style={S.logoWrap}>
            <div style={S.logoIcon}>
              <span style={{ fontSize: 16 }}>📊</span>
            </div>
            {!sidebarCollapsed && (
              <div style={S.logoText}>
                <span style={S.logoName}>MarketPulse</span>
                <span style={S.logoPro}>PRO</span>
              </div>
            )}
          </div>
          <button style={S.collapseBtn} onClick={() => setSidebarCollapsed(v => !v)}>
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Nav */}
        <nav style={S.nav}>
          {NAV_ITEMS.map(item => {
            const isActive = page === item.id
            return (
              <button
                key={item.id}
                style={{
                  ...S.navBtn,
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(37,99,235,0.15))'
                    : 'transparent',
                  borderLeft: isActive
                    ? '2px solid #7c3aed'
                    : '2px solid transparent',
                  color: isActive ? '#e2e8f0' : 'rgba(255,255,255,0.4)',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                }}
                onClick={() => setPage(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span style={S.navIcon}>{item.icon}</span>
                {!sidebarCollapsed && (
                  <span style={item.pro ? S.proNavLabel : S.navLabel}>
                    {item.label}
                  </span>
                )}
                {isActive && !sidebarCollapsed && (
                  <span style={S.navActiveDot} />
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom: user card */}
        {!sidebarCollapsed && (
          <div style={S.sidebarBottom}>
            {/* Access status card */}
            <div style={{
              ...S.accessCard,
              background: access.status === 'active'
                ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(37,99,235,0.15))'
                : 'rgba(251,191,36,0.08)',
              borderColor: access.status === 'active'
                ? 'rgba(124,58,237,0.3)'
                : 'rgba(251,191,36,0.2)',
            }}>
              {access.status === 'active' ? (
                <>
                  <div style={S.accessTitle}>💎 PRO активен</div>
                  {access.hoursUntilExpiry !== null && (
                    <div style={S.accessSub}>
                      Осталось {Math.ceil(access.hoursUntilExpiry / 24)} дн.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ ...S.accessTitle, color: '#fbbf24' }}>
                    ⏱ Пробный период
                  </div>
                  {access.hoursLeft !== null && (
                    <div style={S.accessSub}>
                      {Math.ceil(access.hoursLeft)}ч осталось
                    </div>
                  )}
                  <button style={S.upgradeBtn} onClick={() => setShowPaywall(true)}>
                    Улучшить →
                  </button>
                </>
              )}
            </div>

            {/* User info */}
            <div style={S.userCard}>
              <div style={S.userAvatar}>
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt="" width={32} height={32} style={{ borderRadius: '50%' }} />
                  : initials
                }
              </div>
              <div style={S.userInfo}>
                <div style={S.userName}>{name}</div>
                <div style={S.userEmail}>{user?.email || ''}</div>
              </div>
              <button style={S.logoutBtn} onClick={logout} title="Выйти">
                <span style={{ fontSize: 16 }}>↩</span>
              </button>
            </div>
          </div>
        )}

        {/* Collapsed: just avatar */}
        {sidebarCollapsed && (
          <div style={{ marginTop: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ ...S.userAvatar, width: 32, height: 32, fontSize: 12 }}>{initials}</div>
            <button style={{ ...S.logoutBtn, padding: 6 }} onClick={logout} title="Выйти">↩</button>
          </div>
        )}
      </aside>

      {/* ── Main area ──────────────────────────────────────────────── */}
      <div style={S.mainArea}>

        {/* Expiry popup */}
        {access.status === 'active' && access.hoursUntilExpiry !== null && access.hoursUntilExpiry <= 24 && (
          <ExpiryPopup
            hoursUntilExpiry={access.hoursUntilExpiry}
            expiresAt={access.expiresAt}
            onRenew={() => setShowPaywall(true)}
          />
        )}

        {/* Trial banner */}
        {access.status === 'trial' && access.hoursLeft !== null && (
          <TrialBanner hoursLeft={access.hoursLeft} />
        )}

        {/* Content */}
        <div style={S.content}>
          {page === 'feed'     && <WebSignalFeed accessStatus={access.status} onProClick={() => setPage('pro')} />}
          {page === 'stats'    && <Stats />}
          {page === 'settings' && <Settings />}
          {page === 'pro'      && <Pro access={access} onUpgrade={() => setShowPaywall(true)} />}
          {page === 'guide'    && <Guide />}
        </div>
      </div>

      {/* ── Mobile bottom nav ──────────────────────────────────────── */}
      <nav style={S.mobileNav} data-mobile-nav="true">
        {NAV_ITEMS.map(item => {
          const isActive = page === item.id
          return (
            <button
              key={item.id}
              style={{ ...S.mobileNavBtn, color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.35)' }}
              onClick={() => setPage(item.id)}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 400 }}>{item.label}</span>
              {isActive && <span style={S.mobileActiveLine} />}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    background: '#080a0f',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#e2e8f0',
    overflow: 'hidden',
  },

  // ── Sidebar ────────────────────────────────────────────────────────
  sidebar: {
    flexShrink: 0,
    background: 'linear-gradient(180deg, #0d0f16 0%, #0a0c13 100%)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.2s ease',
    overflow: 'hidden',
  },

  sidebarTop: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 14px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    marginBottom: 8,
    flexShrink: 0,
  },

  logoWrap: {
    display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden',
  },
  logoIcon: {
    width: 34, height: 34, flexShrink: 0,
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
  },
  logoText: {
    display: 'flex', alignItems: 'baseline', gap: 5, overflow: 'hidden',
  },
  logoName: {
    fontSize: 14, fontWeight: 700, color: '#e2e8f0',
    whiteSpace: 'nowrap', overflow: 'hidden',
  },
  logoPro: {
    fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
    background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    padding: '1px 5px',
    border: '1px solid rgba(167,139,250,0.3)',
    borderRadius: 4,
  },

  collapseBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6, color: '#64748b',
    width: 24, height: 24,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontSize: 14, flexShrink: 0,
    padding: 0,
  },

  nav: {
    display: 'flex', flexDirection: 'column', gap: 2,
    padding: '0 10px',
    flex: 1,
    overflowY: 'auto',
  },
  navBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px',
    borderRadius: 10, border: 'none',
    cursor: 'pointer', fontSize: 13,
    transition: 'all 0.15s',
    width: '100%',
    textAlign: 'left',
    position: 'relative',
  },
  navIcon: { fontSize: 17, flexShrink: 0, width: 22, textAlign: 'center' },
  navLabel: { fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', flex: 1 },
  proNavLabel: {
    background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', flex: 1,
  },
  navActiveDot: {
    width: 5, height: 5, borderRadius: '50%',
    background: '#7c3aed',
    boxShadow: '0 0 6px #7c3aed',
    flexShrink: 0,
  },

  sidebarBottom: {
    padding: '12px 10px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    display: 'flex', flexDirection: 'column', gap: 8,
    flexShrink: 0,
  },
  accessCard: {
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid',
  },
  accessTitle: {
    fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 3,
  },
  accessSub: {
    fontSize: 11, color: '#64748b', marginBottom: 6,
  },
  upgradeBtn: {
    width: '100%',
    padding: '6px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    color: '#fff',
    fontSize: 11, fontWeight: 700,
    cursor: 'pointer',
  },

  userCard: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
  },
  userAvatar: {
    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden',
  },
  userInfo: {
    flex: 1, minWidth: 0,
    overflow: 'hidden',
  },
  userName: {
    fontSize: 13, fontWeight: 600, color: '#e2e8f0',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: 11, color: '#475569',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  logoutBtn: {
    background: 'none', border: 'none',
    color: '#475569', cursor: 'pointer',
    padding: '4px',
    borderRadius: 6,
    flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  // ── Main ───────────────────────────────────────────────────────────
  mainArea: {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', minWidth: 0,
  },
  content: {
    flex: 1, overflowY: 'auto',
    padding: '24px 28px',
    maxWidth: 1100, width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },

  // ── Mobile nav ─────────────────────────────────────────────────────
  mobileNav: {
    display: 'none',
    position: 'fixed', bottom: 0, left: 0, right: 0,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(8,10,15,0.97)',
    backdropFilter: 'blur(20px)',
    zIndex: 50,
  },
  mobileNavBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 3, padding: '10px 0 8px', background: 'none', border: 'none',
    cursor: 'pointer', position: 'relative',
    transition: 'color 0.15s',
  },
  mobileActiveLine: {
    position: 'absolute', top: 0, left: '25%', right: '25%',
    height: 2, borderRadius: 2,
    background: 'linear-gradient(90deg, #7c3aed, #2563eb)',
  },

  paywallWrap: { minHeight: '100vh', background: '#080a0f' },
}
