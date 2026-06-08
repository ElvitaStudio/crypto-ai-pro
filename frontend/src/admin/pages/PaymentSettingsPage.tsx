import { useState, useEffect, useCallback } from 'react'

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000'

interface PaymentMethod {
  id:        number
  network:   string
  currency:  string
  address:   string
  label:     string
  fee_info:  string
  is_active: number
}

const EMPTY: Omit<PaymentMethod, 'id'> = {
  network: 'TRC20', currency: 'USDT', address: '', label: '', fee_info: '', is_active: 1,
}

interface Props { token: string }

export function PaymentSettingsPage({ token }: Props) {
  const [methods, setMethods]   = useState<PaymentMethod[]>([])
  const [editing, setEditing]   = useState<number | null>(null)   // id or -1 for new
  const [form, setForm]         = useState<Omit<PaymentMethod,'id'>>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const load = useCallback(async () => {
    const res  = await fetch(`${API}/admin/payment-methods`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    setMethods(data.methods ?? [])
  }, [token])

  useEffect(() => { load() }, [load])

  const startEdit = (m: PaymentMethod) => {
    setEditing(m.id)
    setForm({ network: m.network, currency: m.currency, address: m.address, label: m.label, fee_info: m.fee_info, is_active: m.is_active })
  }

  const startAdd = () => {
    setEditing(-1)
    setForm(EMPTY)
  }

  const cancel = () => setEditing(null)

  const save = async () => {
    if (!form.address.trim()) return
    setSaving(true)
    setMsg('')
    try {
      const body = JSON.stringify({ ...form, is_active: Boolean(form.is_active) })
      if (editing === -1) {
        await fetch(`${API}/admin/payment-methods`, { method: 'POST', headers, body })
        setMsg('Способ оплаты добавлен')
      } else {
        await fetch(`${API}/admin/payment-methods/${editing}`, { method: 'PUT', headers, body })
        setMsg('Сохранено')
      }
      setEditing(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('Удалить этот способ оплаты?')) return
    await fetch(`${API}/admin/payment-methods/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setMsg('Удалено')
    load()
  }

  const toggle = async (m: PaymentMethod) => {
    await fetch(`${API}/admin/payment-methods/${m.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...m, is_active: !m.is_active }),
    })
    load()
  }

  const set = (field: keyof typeof EMPTY, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.title}>💳 Способы оплаты</h2>
        <button style={s.addBtn} onClick={startAdd}>+ Добавить</button>
      </div>

      {msg && <div style={s.toast}>{msg}</div>}

      {/* Edit / Add form */}
      {editing !== null && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>{editing === -1 ? '➕ Новый способ' : '✏️ Редактирование'}</h3>
          <div style={s.formGrid}>
            <label style={s.label}>
              Сеть
              <select style={s.select} value={form.network} onChange={e => set('network', e.target.value)}>
                {['TRC20','ERC20','BEP20','SOLANA','TON','BTC'].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label style={s.label}>
              Валюта
              <input style={s.input} value={form.currency} onChange={e => set('currency', e.target.value)} placeholder="USDT" />
            </label>
            <label style={{ ...s.label, gridColumn: '1 / -1' }}>
              Адрес кошелька *
              <input style={s.input} value={form.address} onChange={e => set('address', e.target.value)} placeholder="0x... или T..." />
            </label>
            <label style={s.label}>
              Название (для UI)
              <input style={s.input} value={form.label} onChange={e => set('label', e.target.value)} placeholder="TRC-20 (Tron)" />
            </label>
            <label style={s.label}>
              Информация о комиссии
              <input style={s.input} value={form.fee_info} onChange={e => set('fee_info', e.target.value)} placeholder="~$1" />
            </label>
          </div>
          <div style={s.formActions}>
            <label style={s.checkLabel}>
              <input
                type="checkbox"
                checked={Boolean(form.is_active)}
                onChange={e => set('is_active', e.target.checked ? 1 : 0)}
              />
              Активен
            </label>
            <button style={s.cancelBtn} onClick={cancel}>Отмена</button>
            <button
              style={{ ...s.saveBtn, opacity: !form.address.trim() || saving ? 0.5 : 1 }}
              disabled={!form.address.trim() || saving}
              onClick={save}
            >
              {saving ? 'Сохранение...' : '💾 Сохранить'}
            </button>
          </div>
        </div>
      )}

      {/* Methods list */}
      <div style={s.list}>
        {methods.length === 0 && (
          <div style={s.empty}>Нет способов оплаты. Нажмите «+ Добавить».</div>
        )}
        {methods.map(m => (
          <div key={m.id} style={{ ...s.card, opacity: m.is_active ? 1 : 0.5 }}>
            <div style={s.cardLeft}>
              <div style={s.cardTop}>
                <span style={s.netBadge}>{m.network}</span>
                <span style={s.curBadge}>{m.currency}</span>
                {m.label && <span style={s.cardLabel}>{m.label}</span>}
                {m.fee_info && <span style={s.feeBadge}>Комиссия: {m.fee_info}</span>}
                <span style={{ ...s.statusDot, background: m.is_active ? '#3fb950' : '#6e7681' }} title={m.is_active ? 'Активен' : 'Отключён'} />
              </div>
              <div style={s.address}>{m.address}</div>
            </div>
            <div style={s.cardActions}>
              <button style={s.actionBtn} onClick={() => toggle(m)} title={m.is_active ? 'Отключить' : 'Включить'}>
                {m.is_active ? '⏸' : '▶'}
              </button>
              <button style={s.actionBtn} onClick={() => startEdit(m)}>✏️</button>
              <button style={{ ...s.actionBtn, color: '#f85149' }} onClick={() => remove(m.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:      { margin: 0, fontSize: 22, fontWeight: 700 },
  addBtn:     { padding: '9px 18px', borderRadius: 8, border: 'none', background: '#238636', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  toast:      { background: '#238636', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 },
  formCard:   { background: '#161b22', border: '1px solid #388bfd', borderRadius: 12, padding: 24, marginBottom: 24 },
  formTitle:  { margin: '0 0 16px', fontSize: 16, fontWeight: 700 },
  formGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 },
  label:      { display: 'flex', flexDirection: 'column' as const, gap: 6, fontSize: 13, color: '#8b949e' },
  input:      { padding: '9px 12px', borderRadius: 8, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 14, outline: 'none' },
  select:     { padding: '9px 12px', borderRadius: 8, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 14, outline: 'none' },
  formActions:{ display: 'flex', alignItems: 'center', gap: 12 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#f0f6fc', cursor: 'pointer', marginRight: 'auto' },
  cancelBtn:  { padding: '8px 16px', borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', fontSize: 14, cursor: 'pointer' },
  saveBtn:    { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#238636', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  list:       { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  card:       { background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  cardLeft:   { flex: 1, minWidth: 0 },
  cardTop:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' as const },
  netBadge:   { background: '#1f4da8', color: '#79c0ff', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 },
  curBadge:   { background: '#0a3620', color: '#3fb950', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 },
  cardLabel:  { color: '#8b949e', fontSize: 13 },
  feeBadge:   { color: '#e3b341', fontSize: 12 },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  address:    { fontFamily: 'monospace', fontSize: 13, color: '#8b949e', wordBreak: 'break-all' as const },
  cardActions:{ display: 'flex', gap: 6 },
  actionBtn:  { padding: '6px 10px', borderRadius: 6, border: '1px solid #30363d', background: '#21262d', color: '#8b949e', fontSize: 15, cursor: 'pointer' },
  empty:      { padding: 40, textAlign: 'center' as const, color: '#484f58', background: '#161b22', borderRadius: 12 },
}
