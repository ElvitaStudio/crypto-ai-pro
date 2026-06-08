import { useState, useEffect, useCallback, useRef } from 'react'

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000'

interface UserRow { telegram_id: number; username: string | null }
interface Props   { token: string }

export function BroadcastPage({ token }: Props) {
  const [users, setUsers]       = useState<UserRow[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [text, setText]         = useState('')
  const [files, setFiles]       = useState<File[]>([])
  const [sending, setSending]   = useState(false)
  const [result, setResult]     = useState<{ sent: number; failed: number } | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const headers = { Authorization: `Bearer ${token}` }

  const loadUsers = useCallback(async () => {
    const res = await fetch(`${API}/admin/users`, { headers })
    const data = await res.json()
    setUsers(data.users ?? [])
  }, [token])

  useEffect(() => { loadUsers() }, [loadUsers])

  const toggleUser = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll  = () => setSelected(new Set(users.map(u => u.telegram_id)))
  const deselectAll = () => setSelected(new Set())

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return
    const arr = Array.from(newFiles)
    setFiles(prev => {
      const combined = [...prev, ...arr]
      return combined.slice(0, 5)
    })
  }

  const removeFile = (i: number) =>
    setFiles(prev => prev.filter((_, idx) => idx !== i))

  const send = async () => {
    if (!text.trim()) return
    setSending(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('text', text)
      form.append(
        'target_ids',
        selected.size === users.length ? 'all' : [...selected].join(',')
      )
      files.forEach(f => form.append('files', f))

      const res = await fetch(`${API}/admin/broadcast`, {
        method: 'POST',
        headers,
        body: form,
      })
      const data = await res.json()
      setResult({ sent: data.sent, failed: data.failed })
      setText('')
      setFiles([])
    } finally {
      setSending(false)
    }
  }

  const filtered = users.filter(u =>
    !userSearch ||
    String(u.telegram_id).includes(userSearch) ||
    (u.username ?? '').toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <div>
      <h2 style={s.title}>📢 Рассылка</h2>

      <div style={s.grid}>
        {/* Left — recipients */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>Получатели</span>
            <span style={s.count}>{selected.size} / {users.length}</span>
          </div>
          <div style={s.selActions}>
            <button style={s.selBtn} onClick={selectAll}>Выбрать всех</button>
            <button style={s.selBtn} onClick={deselectAll}>Снять всех</button>
          </div>
          <input
            style={s.search}
            placeholder="Поиск..."
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
          />
          <div style={s.userList}>
            {filtered.map(u => (
              <label key={u.telegram_id} style={s.userRow}>
                <input
                  type="checkbox"
                  checked={selected.has(u.telegram_id)}
                  onChange={() => toggleUser(u.telegram_id)}
                  style={{ accentColor: '#238636' }}
                />
                <div style={s.userInfo}>
                  <span style={s.userId}>{u.telegram_id}</span>
                  {u.username && <span style={s.userTag}>@{u.username}</span>}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Right — message */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>Сообщение</span>
            <span style={s.count}>HTML разметка поддерживается</span>
          </div>

          <textarea
            style={s.textarea}
            placeholder="Введите текст сообщения...&#10;&#10;Поддерживается HTML: <b>жирный</b>, <i>курсив</i>, <a href='...'>ссылка</a>"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
          />

          {/* File upload */}
          <div style={s.fileSection}>
            <div style={s.fileHeader}>
              <span style={{ color: '#8b949e', fontSize: 13 }}>Файлы (до 5)</span>
              <button
                style={s.fileAddBtn}
                onClick={() => fileRef.current?.click()}
                disabled={files.length >= 5}
              >+ Добавить</button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.zip"
                style={{ display: 'none' }}
                onChange={e => addFiles(e.target.files)}
              />
            </div>
            {files.length > 0 && (
              <div style={s.fileList}>
                {files.map((f, i) => (
                  <div key={i} style={s.fileItem}>
                    <span style={s.fileIcon}>
                      {f.type.startsWith('image') ? '🖼' : f.type.startsWith('video') ? '🎥' : '📄'}
                    </span>
                    <span style={s.fileName}>{f.name}</span>
                    <span style={s.fileSize}>{(f.size / 1024).toFixed(0)} KB</span>
                    <button style={s.fileRemove} onClick={() => removeFile(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview of recipients summary */}
          <div style={s.summary}>
            {selected.size === 0
              ? <span style={{ color: '#f85149' }}>⚠️ Никто не выбран</span>
              : selected.size === users.length
              ? <span style={{ color: '#3fb950' }}>✅ Все {users.length} пользователей</span>
              : <span style={{ color: '#e3b341' }}>📨 {selected.size} пользователей</span>
            }
          </div>

          {result && (
            <div style={{ ...s.result, background: result.failed ? '#2d1a0e' : '#0d2818' }}>
              ✅ Отправлено: <b>{result.sent}</b>
              {result.failed > 0 && <span style={{ color: '#f85149' }}> · Ошибок: {result.failed}</span>}
            </div>
          )}

          <button
            style={{ ...s.sendBtn, opacity: (!text.trim() || selected.size === 0 || sending) ? 0.5 : 1 }}
            disabled={!text.trim() || selected.size === 0 || sending}
            onClick={send}
          >
            {sending ? '⏳ Отправка...' : `📢 Отправить (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  title:      { margin: '0 0 24px', fontSize: 22, fontWeight: 700 },
  grid:       { display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 },
  panel:      { background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 },
  panelHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontSize: 15, fontWeight: 700 },
  count:      { fontSize: 12, color: '#6e7681' },
  selActions: { display: 'flex', gap: 8 },
  selBtn:     { flex: 1, padding: '6px', borderRadius: 6, border: '1px solid #30363d', background: '#21262d', color: '#8b949e', fontSize: 12, cursor: 'pointer' },
  search:     { padding: '8px 12px', borderRadius: 8, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none' },
  userList:   { overflowY: 'auto' as const, maxHeight: 420, display: 'flex', flexDirection: 'column', gap: 2 },
  userRow:    { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 6, cursor: 'pointer' },
  userInfo:   { display: 'flex', flexDirection: 'column', gap: 1 },
  userId:     { fontSize: 13, fontFamily: 'monospace', color: '#f0f6fc' },
  userTag:    { fontSize: 12, color: '#58a6ff' },
  textarea:   { width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 14, resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', lineHeight: 1.6 },
  fileSection:{ display: 'flex', flexDirection: 'column', gap: 8 },
  fileHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  fileAddBtn: { padding: '4px 12px', borderRadius: 6, border: '1px solid #30363d', background: '#21262d', color: '#f0f6fc', fontSize: 12, cursor: 'pointer' },
  fileList:   { display: 'flex', flexDirection: 'column', gap: 6 },
  fileItem:   { display: 'flex', alignItems: 'center', gap: 8, background: '#21262d', borderRadius: 8, padding: '6px 10px' },
  fileIcon:   { fontSize: 16 },
  fileName:   { flex: 1, fontSize: 13, color: '#f0f6fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  fileSize:   { fontSize: 11, color: '#6e7681', whiteSpace: 'nowrap' as const },
  fileRemove: { background: 'none', border: 'none', color: '#6e7681', cursor: 'pointer', fontSize: 14, padding: '0 2px' },
  summary:    { padding: '10px 14px', background: '#21262d', borderRadius: 8, fontSize: 13 },
  result:     { padding: '10px 14px', borderRadius: 8, fontSize: 13, color: '#f0f6fc' },
  sendBtn:    { padding: '12px', borderRadius: 10, border: 'none', background: '#238636', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
}
