import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

const S = {
  nav: {
    position: 'fixed' as const,
    top: 0, left: 0, right: 0,
    height: 60,
    background: 'rgba(13,15,20,0.95)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    zIndex: 100,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textDecoration: 'none',
    color: '#fff',
    fontWeight: 700,
    fontSize: 16,
  },
  logoIcon: {
    width: 28, height: 28,
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14,
  },
  right: {
    display: 'flex', alignItems: 'center', gap: 12,
  },
  avatar: {
    width: 32, height: 32,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 600, color: '#fff',
    overflow: 'hidden' as const,
  },
  name: {
    fontSize: 13, color: '#a0a8b8',
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 8,
    border: 'none',
    background: 'rgba(124,58,237,0.18)',
    color: '#a78bfa',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
}

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const initials = user?.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <nav style={S.nav}>
      <Link to="/" style={S.logo}>
        <div style={S.logoIcon}>📊</div>
        MarketPulse Pro
      </Link>

      <div style={S.right}>
        {user ? (
          <>
            <div style={S.avatar}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" width={32} height={32} style={{ borderRadius: '50%' }} />
                : initials
              }
            </div>
            <span style={S.name}>{user.displayName || user.email}</span>
            <button style={S.btn} onClick={handleLogout}>Выйти</button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ ...S.btn, textDecoration: 'none', display: 'inline-block' }}>
              Войти
            </Link>
            <Link to="/register" style={{
              ...S.btn,
              background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
              color: '#fff',
              textDecoration: 'none',
              display: 'inline-block',
            }}>
              Попробовать бесплатно
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
