import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

const S = {
  page: {
    minHeight: '100vh',
    background: '#0d0f14',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 16px 40px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 36,
  },
  logoIcon: {
    width: 48, height: 48,
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    borderRadius: 14,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, marginBottom: 12,
  },
  title: {
    fontSize: 24, fontWeight: 700, color: '#e2e8f0',
    textAlign: 'center' as const, marginBottom: 6,
  },
  subtitle: {
    fontSize: 13, color: '#64748b',
    textAlign: 'center' as const, marginBottom: 28,
  },
  label: {
    display: 'block', fontSize: 13, fontWeight: 500,
    color: '#94a3b8', marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: 16,
    transition: 'border-color 0.2s',
  },
  submitBtn: {
    width: '100%',
    padding: '13px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    marginTop: 4,
  },
  error: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#f87171',
    fontSize: 13,
    marginBottom: 16,
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: 24,
    fontSize: 13,
    color: '#64748b',
  },
  link: { color: '#a78bfa', textDecoration: 'none' },
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={S.logoIcon}>📊</div>
          <div style={S.title}>Войти</div>
          <div style={S.subtitle}>Добро пожаловать обратно</div>
        </div>

        {error && <div style={S.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={S.label}>Email</label>
          <input
            style={S.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
          <label style={S.label}>Пароль</label>
          <input
            style={S.input}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button style={S.submitBtn} type="submit" disabled={loading}>
            {loading ? 'Входим...' : 'Войти →'}
          </button>
        </form>

        <div style={S.footer}>
          Нет аккаунта?{' '}
          <Link to="/register" style={S.link}>Зарегистрироваться бесплатно</Link>
        </div>
      </div>
    </div>
  )
}
