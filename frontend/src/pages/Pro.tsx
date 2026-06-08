import type { AccessInfo } from '../hooks/useAccess'
import { Paywall } from '../components/Paywall'

interface Props {
  access: AccessInfo & { telegramId: number; refresh: () => void }
  onUpgrade: () => void
}

const FEATURES = [
  {
    icon: '📡',
    title: 'Сигналы в реальном времени',
    desc: 'Авто-сканер каждые 5 минут по 20+ торговым парам',
  },
  {
    icon: '🤖',
    title: 'AI-фильтрация сигналов',
    desc: 'Несколько моделей (GPT-4, Claude, Gemini) голосуют за каждый сигнал',
  },
  {
    icon: '📊',
    title: 'Живые графики',
    desc: 'Свечи, CVD, Volume Profile, зоны спроса и предложения',
  },
  {
    icon: '🔥',
    title: 'Карта плотностей',
    desc: 'Тепловая карта объёмов — видишь где крупный игрок',
  },
  {
    icon: '📈',
    title: 'Полная статистика',
    desc: 'Win Rate, P&L, история Тейк-профитов и Стоп-лоссов',
  },
  {
    icon: '🔔',
    title: 'Push-уведомления',
    desc: 'Каждый новый сигнал — мгновенно в Telegram',
  },
  {
    icon: '⚡',
    title: 'Без ограничений',
    desc: 'Все инструменты, все монеты, все таймфреймы',
  },
  {
    icon: '🆕',
    title: 'Ранний доступ',
    desc: 'Новые функции — сначала для Pro-пользователей',
  },
]

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

export function Pro({ access, onUpgrade }: Props) {
  const isActive = access.status === 'active'
  const isTrial  = access.status === 'trial'

  return (
    <div style={s.root}>
      {/* Hero */}
      <div style={s.hero}>
        <div style={s.heroGlow} />
        <div style={s.heroContent}>
          <span className="logo-animated" style={s.heroTitle}>MarketPulse Pro</span>
          <p style={s.heroSub}>Профессиональный инструмент для крипто-трейдера</p>

          {/* Status badge */}
          {isActive ? (
            <div style={s.activeBadge}>
              <span style={s.activeDot} />
              <span>Pro активен</span>
              {access.expiresAt && (
                <span style={s.activeUntil}>
                  · до {new Date(access.expiresAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })}
                </span>
              )}
            </div>
          ) : isTrial ? (
            <div style={s.trialBadge}>
              ⏱ Пробный период · осталось {Math.floor(access.hoursLeft ?? 0)} ч
            </div>
          ) : null}
        </div>
      </div>

      {/* Features grid */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Что входит в Pro</div>
        <div style={s.grid}>
          {FEATURES.map((f, i) => (
            <div key={i} style={s.card}>
              <span style={s.cardIcon}>{f.icon}</span>
              <div style={s.cardTitle}>{f.title}</div>
              <div style={s.cardDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA — only for non-active users */}
      {!isActive && (
        <div style={s.ctaSection}>
          <div style={s.plans}>
            <div style={s.planRow}>
              <span style={s.planLabel}>1 месяц</span>
              <span style={s.planPrice}>$19.99</span>
            </div>
            <div style={{ ...s.planRow, ...s.planRowFeatured }}>
              <span style={s.planLabel}>3 месяца <span style={s.discount}>−15% 🔥</span></span>
              <span style={s.planPrice}>$50.97</span>
            </div>
            <div style={s.planRow}>
              <span style={s.planLabel}>6 месяцев <span style={s.discount}>−25% 💎</span></span>
              <span style={s.planPrice}>$89.94</span>
            </div>
          </div>
          <button style={s.ctaBtn} onClick={onUpgrade}>
            ⚡ Получить Pro
          </button>
          <p style={s.ctaNote}>Оплата USDT или Telegram Stars · Активация 1-5 мин</p>
        </div>
      )}

      {/* Active — manage section */}
      {isActive && (
        <div style={s.manageSection}>
          <div style={s.manageTitle}>✅ Подписка активна</div>
          <p style={s.manageDesc}>
            Доступ открыт до {access.expiresAt
              ? new Date(access.expiresAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
              : '—'}
          </p>
          <button style={s.renewBtn} onClick={onUpgrade}>
            🔄 Продлить подписку
          </button>
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { paddingBottom: 20 },

  // Hero
  hero: { position: 'relative' as const, marginBottom: 28, paddingTop: 8 },
  heroGlow: {
    position: 'absolute' as const, top: -20, left: '50%', transform: 'translateX(-50%)',
    width: 280, height: 140, borderRadius: '50%',
    background: 'radial-gradient(ellipse, rgba(139,92,246,0.25) 0%, transparent 70%)',
    pointerEvents: 'none' as const,
  },
  heroContent: { position: 'relative' as const, textAlign: 'center' as const, padding: '20px 0 10px' },
  heroTitle: { fontSize: 30, fontWeight: 900, display: 'block', marginBottom: 8, letterSpacing: '-1px' },
  heroSub:   { color: '#8b949e', fontSize: 14, margin: '0 0 16px' },

  activeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(63,185,80,0.12)', border: '1px solid rgba(63,185,80,0.3)',
    borderRadius: 20, padding: '6px 14px', fontSize: 13, color: '#3fb950',
  },
  activeDot:  { width: 7, height: 7, borderRadius: '50%', background: '#3fb950', boxShadow: '0 0 6px #3fb950' },
  activeUntil:{ color: '#6e7681' },
  trialBadge: {
    display: 'inline-block',
    background: 'rgba(227,179,65,0.12)', border: '1px solid rgba(227,179,65,0.3)',
    borderRadius: 20, padding: '6px 14px', fontSize: 13, color: '#e3b341',
  },

  // Features
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 13, color: '#6e7681', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 14 },
  grid:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  card:         {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14, padding: '14px 12px', display: 'flex', flexDirection: 'column' as const, gap: 5,
  },
  cardIcon:  { fontSize: 22 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#f0f6fc', lineHeight: 1.3 },
  cardDesc:  { fontSize: 12, color: '#6e7681', lineHeight: 1.4 },

  // CTA
  ctaSection: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 16px', display: 'flex', flexDirection: 'column' as const, gap: 14 },
  plans:      { display: 'flex', flexDirection: 'column' as const, gap: 8 },
  planRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' },
  planRowFeatured: { background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' },
  planLabel:  { fontSize: 14, color: '#f0f6fc' },
  planPrice:  { fontSize: 16, fontWeight: 700, color: '#f0f6fc' },
  discount:   { fontSize: 12, color: '#a78bfa' },
  ctaBtn:     {
    padding: '15px', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 800,
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    color: '#fff', letterSpacing: '0.3px',
    boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
  },
  ctaNote:    { fontSize: 12, color: '#484f58', textAlign: 'center' as const, margin: 0 },

  // Active manage
  manageSection: { background: 'rgba(63,185,80,0.06)', border: '1px solid rgba(63,185,80,0.2)', borderRadius: 16, padding: '20px 16px', display: 'flex', flexDirection: 'column' as const, gap: 10, alignItems: 'center', textAlign: 'center' as const },
  manageTitle:   { fontSize: 17, fontWeight: 700, color: '#3fb950' },
  manageDesc:    { fontSize: 14, color: '#8b949e', margin: 0 },
  renewBtn:      { padding: '12px 24px', borderRadius: 12, border: '1px solid rgba(63,185,80,0.3)', background: 'rgba(63,185,80,0.1)', color: '#3fb950', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
}
