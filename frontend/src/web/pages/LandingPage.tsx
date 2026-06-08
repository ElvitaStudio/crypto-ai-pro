import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI Совет из 3 моделей',
    desc: 'Claude, GPT-4o и Gemini голосуют за каждый сигнал. Только большинство пропускает в ленту.',
  },
  {
    icon: '📡',
    title: 'Реальные сигналы 24/7',
    desc: '4 стратегии сканируют 80+ пар каждые 30 минут. Точка входа, стоп и тейк для каждого сигнала.',
  },
  {
    icon: '📊',
    title: 'Живые графики',
    desc: 'CVD, объёмный профиль, зоны спроса/предложения и тепловая карта прямо в браузере.',
  },
  {
    icon: '🔬',
    title: 'Технический анализ',
    desc: 'RSI, ADX, объёмный перевес — детальная панель к каждому сигналу с объяснением стратегии.',
  },
  {
    icon: '🔐',
    title: 'HTF Trend Filter',
    desc: 'Фильтр по EMA-50 на 1h + минимальный R:R 2.0 + 4-часовой кулдаун на символ.',
  },
  {
    icon: '💳',
    title: 'Оплата USDT или картой',
    desc: 'TRC-20, BEP-20, ERC-20 или через Telegram Stars. Автоматическое подтверждение оплаты.',
  },
]

const PLANS = [
  { id: '1m', label: '1 месяц', price: '$19.99', stars: '999 ⭐', popular: false },
  { id: '3m', label: '3 месяца', price: '$50.97', stars: '2499 ⭐', badge: '-15% 🔥', popular: true },
  { id: '6m', label: '6 месяцев', price: '$89.94', stars: '4499 ⭐', badge: '-25% 💎', popular: false },
]

const STATS = [
  { value: '80+', label: 'торговых пар' },
  { value: '4', label: 'AI стратегии' },
  { value: '3', label: 'AI модели голосуют' },
  { value: '24ч', label: 'бесплатный доступ' },
]

const S = {
  page: {
    minHeight: '100vh',
    background: '#0d0f14',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  hero: {
    padding: '120px 24px 80px',
    textAlign: 'center' as const,
    maxWidth: 760,
    margin: '0 auto',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 14px',
    borderRadius: 20,
    background: 'rgba(124,58,237,0.18)',
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.05em',
    marginBottom: 24,
  },
  h1: {
    fontSize: 'clamp(36px, 6vw, 60px)',
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: 20,
    background: 'linear-gradient(135deg, #fff 40%, #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  sub: {
    fontSize: 18,
    color: '#8892a4',
    lineHeight: 1.6,
    marginBottom: 40,
  },
  ctaRow: {
    display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const,
  },
  ctaPrimary: {
    padding: '14px 32px',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'opacity 0.2s',
  },
  ctaSecondary: {
    padding: '14px 32px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#a0a8b8',
    fontWeight: 600,
    fontSize: 15,
    textDecoration: 'none',
    display: 'inline-block',
  },
  statsRow: {
    display: 'flex', justifyContent: 'center', gap: '48px',
    flexWrap: 'wrap' as const,
    padding: '40px 24px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    margin: '0 24px',
  },
  statItem: {
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 800,
    background: 'linear-gradient(135deg, #7c3aed, #38bdf8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  statLabel: {
    fontSize: 13, color: '#64748b', marginTop: 4,
  },
  section: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '80px 24px',
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: 12,
  },
  sectionSub: {
    textAlign: 'center' as const,
    color: '#8892a4',
    fontSize: 15,
    marginBottom: 48,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 20,
  },
  featureCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 24,
    transition: 'border-color 0.2s, background 0.2s',
  },
  featureIcon: { fontSize: 28, marginBottom: 12 },
  featureTitle: { fontWeight: 700, fontSize: 15, marginBottom: 8 },
  featureDesc: { color: '#8892a4', fontSize: 13, lineHeight: 1.6 },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 20,
    maxWidth: 800,
    margin: '0 auto',
  },
  planCard: (popular: boolean) => ({
    background: popular
      ? 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(37,99,235,0.15))'
      : 'rgba(255,255,255,0.04)',
    border: popular
      ? '1px solid rgba(124,58,237,0.4)'
      : '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 28,
    position: 'relative' as const,
    textAlign: 'center' as const,
  }),
  planBadge: {
    position: 'absolute' as const,
    top: -12, left: '50%',
    transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 12px',
    borderRadius: 20,
    whiteSpace: 'nowrap' as const,
  },
  planLabel: { fontSize: 14, color: '#8892a4', marginBottom: 8 },
  planPrice: { fontSize: 36, fontWeight: 800, marginBottom: 4 },
  planStars: { fontSize: 12, color: '#64748b', marginBottom: 20 },
  planBtn: (popular: boolean) => ({
    display: 'block',
    padding: '12px',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: 14,
    background: popular
      ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
      : 'rgba(255,255,255,0.07)',
    color: '#fff',
  }),
  footer: {
    textAlign: 'center' as const,
    padding: '40px 24px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    color: '#475569',
    fontSize: 13,
  },
}

export function LandingPage() {
  const { user } = useAuth()

  return (
    <div style={S.page}>
      {/* Hero */}
      <div style={S.hero}>
        <div style={S.badge}>🚀 AI-powered Crypto Signals</div>
        <h1 style={S.h1}>
          Торгуй крипту<br />с умом AI
        </h1>
        <p style={S.sub}>
          MarketPulse Pro — платформа сигналов с тремя AI-моделями, живыми графиками
          и полным техническим анализом. Первые 24 часа бесплатно.
        </p>
        <div style={S.ctaRow}>
          {user ? (
            <Link to="/dashboard" style={S.ctaPrimary}>
              Открыть дашборд →
            </Link>
          ) : (
            <>
              <Link to="/register" style={S.ctaPrimary}>
                Начать бесплатно →
              </Link>
              <Link to="/login" style={S.ctaSecondary}>
                Войти
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={S.statsRow}>
        {STATS.map(s => (
          <div key={s.label} style={S.statItem}>
            <div style={S.statValue}>{s.value}</div>
            <div style={S.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>Всё необходимое для торговли</h2>
        <p style={S.sectionSub}>
          Четыре стратегии, три AI-модели, живые графики и полный теханализ — в одном месте
        </p>
        <div style={S.featuresGrid}>
          {FEATURES.map(f => (
            <div key={f.title} style={S.featureCard}>
              <div style={S.featureIcon}>{f.icon}</div>
              <div style={S.featureTitle}>{f.title}</div>
              <div style={S.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div style={{ ...S.section, paddingTop: 0 }}>
        <h2 style={S.sectionTitle}>Тарифы</h2>
        <p style={S.sectionSub}>Первые 24 часа — бесплатно. Без карты.</p>
        <div style={S.plansGrid}>
          {PLANS.map(p => (
            <div key={p.id} style={S.planCard(p.popular)}>
              {p.badge && <div style={S.planBadge}>{p.badge}</div>}
              <div style={S.planLabel}>{p.label}</div>
              <div style={S.planPrice}>{p.price}</div>
              <div style={S.planStars}>или {p.stars}</div>
              <Link to="/register" style={S.planBtn(p.popular)}>
                Выбрать план
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={S.footer}>
        © 2026 MarketPulse Pro · Торговля криптовалютами сопряжена с рисками
      </footer>
    </div>
  )
}
