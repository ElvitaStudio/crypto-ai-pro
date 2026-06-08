import { useState, useEffect, useCallback } from 'react'

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000'

interface User {
  telegram_id: number
  username:    string | null
  vip_status:  'active' | 'expired' | 'none'
  vip_until:   string | null
  trial_end:   string | null
  created_at:  string | null
}

interface Props { token: string }

export function UsersPage({ token }: Props) {
  const [users, setUsers]     = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [grantId, setGrantId] = useState<number | null>(null)
  const [days, setDays]       = useState(30)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')

  const headers = { Authorization: `Bearer ${token}` }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/admin/users`, { headers })
      const data = await res.json()
      setUsers(data.users ?? [])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const grantVip = async (telegram_id: number, d: number) => {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch(`${API}/admin/users/${telegram_id}/vip`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: d }),
      })
      const data = await res.json()
      setMsg(data.message ?? 'Готово')
      setGrantId(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  const filtered = users.filter(u =>
    !search ||
    String(u.telegram_id).includes(search) ||
    (u.username ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const vipCount  = users.filter(u => u.vip_status === 'active').length

  return (
    <div>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>👥 Пользователи</h2>
          <div style={s.stats}>
            Всего: <b>{users.length}</b> · VIP активных: <b style={{ color: '#3fb950' }}>{vipCount}</b>
          </div>
        </div>
        <button style={s.refreshBtn} onClick={load}>↻ Обновить</button>
      </div>

      {/* Search */}
      <input
        style={s.search}
        placeholder="🔍 Поиск по ID или @username..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {msg && <div style={s.toast}>{msg}</div>}

      {/* Table */}
      {loading ? (
        <div style={s.empty}>Загрузка...</div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Telegram ID', 'Username', 'VIP статус', 'VIP до', 'Trial до', 'Регистрация', 'Действия'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.telegram_id} style={s.tr}>
                  <td style={s.td}><code style={s.code}>{u.telegram_id}</code></td>
                  <td style={s.td}>{u.username ? <span style={s.tag}>@{u.username}</span> : <span style={s.na}>—</span>}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...(u.vip_status === 'active' ? s.badgeGreen : u.vip_status === 'expired' ? s.badgeRed : s.badgeGray) }}>
                      {u.vip_status === 'active' ? '✅ Активен' : u.vip_status === 'expired' ? '❌ Истёк' : '○ Нет'}
                    </span>
                  </td>
                  <td style={s.td}>{u.vip_until ?? <span style={s.na}>—</span>}</td>
                  <td style={s.td}>{u.trial_end ?? <span style={s.na}>—</span>}</td>
                  <td style={s.td}>{u.created_at ?? <span style={s.na}>—</span>}</td>
                  <td style={s.td}>
                    {grantId === u.telegram_id ? (
                      <div style={s.grantRow}>
                        <input
                          style={s.daysInput}
                          type="number"
                          min={0}
                          value={days}
                          onChange={e => setDays(Number(e.target.value))}
                        />
                        <span style={{ color: '#8b949e', fontSize: 12 }}>дн.</span>
                        <button style={s.confirmBtn} disabled={saving} onClick={() => grantVip(u.telegram_id, days)}>
                          {saving ? '...' : '✓'}
                        </button>
                        <button style={s.cancelBtn} onClick={() => setGrantId(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={s.actionsRow}>
                        <button style={s.vipBtn} onClick={() => { setGrantId(u.telegram_id); setDays(30) }}>
                          ⭐ VIP
                        </button>
                        {u.vip_status === 'active' && (
                          <button style={s.revokeBtn} onClick={() => grantVip(u.telegram_id, 0)}>
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={s.empty}>Пользователи не найдены</div>}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title:     { margin: 0, fontSize: 22, fontWeight: 700 },
  stats:     { color: '#8b949e', fontSize: 14, marginTop: 4 },
  refreshBtn:{ padding: '8px 16px', borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 13 },
  search:    { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' as const, outline: 'none' },
  toast:     { background: '#238636', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontSize: 14 },
  tableWrap: { overflowX: 'auto' as const, borderRadius: 12, border: '1px solid #30363d' },
  table:     { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th:        { padding: '10px 14px', background: '#161b22', color: '#8b949e', textAlign: 'left' as const, fontWeight: 600, borderBottom: '1px solid #30363d', whiteSpace: 'nowrap' as const },
  tr:        { borderBottom: '1px solid #21262d' },
  td:        { padding: '10px 14px', verticalAlign: 'middle' as const },
  code:      { background: '#21262d', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 },
  tag:       { color: '#58a6ff' },
  na:        { color: '#484f58' },
  badge:     { padding: '3px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  badgeGreen:{ background: '#1a4a2e', color: '#3fb950' },
  badgeRed:  { background: '#3d1515', color: '#f85149' },
  badgeGray: { background: '#21262d', color: '#6e7681' },
  actionsRow:{ display: 'flex', gap: 6 },
  vipBtn:    { padding: '5px 10px', borderRadius: 6, border: '1px solid #30363d', background: '#21262d', color: '#f0f6fc', fontSize: 12, cursor: 'pointer' },
  revokeBtn: { padding: '5px 8px', borderRadius: 6, border: '1px solid #3d1515', background: '#3d1515', color: '#f85149', fontSize: 12, cursor: 'pointer' },
  grantRow:  { display: 'flex', alignItems: 'center', gap: 6 },
  daysInput: { width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13 },
  confirmBtn:{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#238636', color: '#fff', fontSize: 13, cursor: 'pointer' },
  cancelBtn: { padding: '4px 10px', borderRadius: 6, border: 'none', background: '#21262d', color: '#8b949e', fontSize: 13, cursor: 'pointer' },
  empty:     { padding: '40px', textAlign: 'center' as const, color: '#484f58' },
}
