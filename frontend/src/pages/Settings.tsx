import { useEffect, useState } from 'react'
import { fetchSettings, updateSettings } from '../api'

type Settings = Record<string, string>

const STRATEGY_KEYS = ['volume_level', 'multi', 'vwap_channel', 'fractal'] as const
const STRATEGY_LABELS: Record<string, string> = {
  volume_level: '📊 Volume + Level',
  multi: '🔫 Multi (Sniper/Trend/SFP)',
  vwap_channel: '🌌 Nexus VWAP',
  fractal: '🏛 Titan Fractal',
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <div style={{ ...styles.toggle, background: checked ? '#26a17b' : 'rgba(255,255,255,0.1)' }}
           onClick={() => onChange(!checked)}>
        <div style={{ ...styles.thumb, transform: checked ? 'translateX(20px)' : 'translateX(2px)' }} />
      </div>
    </div>
  )
}

function NumberRow({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <div style={styles.numCtrl}>
        <button style={styles.numBtn} onClick={() => onChange(Math.max(min, value - 10))}>−</button>
        <span style={styles.numVal}>{value}</span>
        <button style={styles.numBtn} onClick={() => onChange(Math.min(max, value + 10))}>+</button>
      </div>
    </div>
  )
}

export function Settings() {
  const [settings, setSettings] = useState<Settings>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchSettings().then(setSettings).catch(() => {})
  }, [])

  function set(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    await updateSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h2 style={styles.title}>Настройки</h2>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>AI Совет</h3>
        <Toggle
          label="Фильтровать через AI"
          checked={settings['ai_council_enabled'] === 'true'}
          onChange={(v) => set('ai_council_enabled', String(v))}
        />
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Стратегии</h3>
        {STRATEGY_KEYS.map((key) => (
          <Toggle
            key={key}
            label={STRATEGY_LABELS[key]}
            checked={settings[`${key}_enabled`] !== 'false'}
            onChange={(v) => set(`${key}_enabled`, String(v))}
          />
        ))}
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Монет для скана</h3>
        {STRATEGY_KEYS.map((key) => (
          <NumberRow
            key={key}
            label={STRATEGY_LABELS[key]}
            value={parseInt(settings[`${key}_coins`] ?? '40')}
            min={10}
            max={200}
            onChange={(v) => set(`${key}_coins`, String(v))}
          />
        ))}
      </div>

      <button style={{ ...styles.saveBtn, background: saved ? '#26a17b' : 'rgba(255,255,255,0.1)' }} onClick={save}>
        {saved ? '✓ Сохранено' : 'Сохранить'}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  section: {
    background: 'rgba(255,255,255,0.04)', borderRadius: 14,
    padding: '4px 14px', marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13, opacity: 0.45, textTransform: 'uppercase',
    padding: '12px 0 8px', letterSpacing: 0.5,
  },
  row: {
    display: 'flex', alignItems: 'center', padding: '12px 0',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  rowLabel: { flex: 1, fontSize: 14 },
  toggle: {
    width: 44, height: 26, borderRadius: 13, cursor: 'pointer',
    position: 'relative', transition: 'background 0.2s',
  },
  thumb: {
    position: 'absolute', top: 3, width: 20, height: 20,
    borderRadius: '50%', background: '#fff', transition: 'transform 0.2s',
  },
  numCtrl: { display: 'flex', alignItems: 'center', gap: 12 },
  numBtn: {
    width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent', color: 'inherit', fontSize: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  numVal: { fontSize: 16, fontWeight: 600, minWidth: 32, textAlign: 'center' },
  saveBtn: {
    width: '100%', padding: '14px', borderRadius: 14, border: 'none',
    color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    transition: 'background 0.3s',
  },
}
