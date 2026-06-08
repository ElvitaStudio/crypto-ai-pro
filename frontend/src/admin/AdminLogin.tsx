import { useState } from 'react'

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000'

interface Props { onLogin: (token: string) => void }

export function AdminLogin({ onLogin }: Props) {
  const [password, setPassword] = useState('')
  const [show, setShow]         = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) throw new Error('Wrong password')
      const { token } = await res.json()
      onLogin(token)
    } catch {
      setError('Неверный пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={s.logo}>⚙️</div>
        <h2 style={s.title}>Admin Panel</h2>
        <p style={s.sub}>Crypto AI Pro</p>
        <form onSubmit={submit} style={s.form}>
          <div style={s.inputWrap}>
            <input
              style={s.input}
              type={show ? 'text' : 'password'}
              placeholder="Пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            <button type="button" style={s.eyeBtn} onClick={() => setShow(v => !v)}>
              {show ? '🙈' : '👁'}
            </button>
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button style={s.btn} disabled={loading || !password}>
            {loading ? 'Вход...' : 'Войти →'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:  { minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card:  { background: '#161b22', border: '1px solid #30363d', borderRadius: 16, padding: '40px 36px', width: 340, textAlign: 'center' },
  logo:  { fontSize: 48, marginBottom: 12 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: '#f0f6fc' },
  sub:   { margin: '4px 0 24px', color: '#6e7681', fontSize: 14 },
  form:  { display: 'flex', flexDirection: 'column', gap: 12 },
  inputWrap: { position: 'relative' as const },
  input: { width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const },
  eyeBtn: { position: 'absolute' as const, right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 },
  error: { color: '#f85149', fontSize: 13 },
  btn:   { padding: '12px', borderRadius: 10, border: 'none', background: '#238636', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
}
