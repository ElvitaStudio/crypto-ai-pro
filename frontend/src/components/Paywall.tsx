import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { AccessInfo } from '../hooks/useAccess'

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000'

const STARS_AMOUNTS: Record<string, number> = {
  '1m': 999,
  '3m': 2499,
  '6m': 4499,
}

// ── Wallet addresses ──────────────────────────────────────────────────────────
const WALLETS: Record<string, string> = {
  TRC20: 'TSagcELBycpN6PX95KTLTB1VVzNJD7wqYo',
  ERC20: '0x36c5296909929643280619b8f95400b3e1a0b61b',
  BEP20: '0x36c5296909929643280619b8f95400b3e1a0b61b',
}

const NETWORK_INFO: Record<string, { label: string; fee: string; recommended: boolean }> = {
  TRC20: { label: 'TRC-20 (Tron)',     fee: '~$1',    recommended: true  },
  ERC20: { label: 'ERC-20 (Ethereum)', fee: '~$5-15', recommended: false },
  BEP20: { label: 'BEP-20 (BSC)',      fee: '~$0.5',  recommended: false },
}

// ── Plans ─────────────────────────────────────────────────────────────────────
interface Plan {
  id: '1m' | '3m' | '6m'
  label: string
  months: number
  pricePerMonth: number
  total: number
  discount: number | null
  badge: string | null
}

const PLANS: Plan[] = [
  { id: '1m', label: '1 месяц',   months: 1,  pricePerMonth: 19.99, total: 19.99, discount: null, badge: null     },
  { id: '3m', label: '3 месяца',  months: 3,  pricePerMonth: 16.99, total: 50.97, discount: 15,   badge: '🔥 -15%' },
  { id: '6m', label: '6 месяцев', months: 6,  pricePerMonth: 14.99, total: 89.94, discount: 25,   badge: '💎 -25%' },
]

const FEATURES = [
  { icon: '⚡', text: 'Безлимитный AI анализ' },
  { icon: '🔔', text: 'Сигналы авто-сканера в Telegram' },
  { icon: '⏱',  text: 'Авто-сканер каждые 5 минут' },
  { icon: '📊', text: 'Все индикаторы и инструменты' },
  { icon: '🆕', text: 'Ранний доступ к новым функциям' },
]

// ── Unique payment amount per user ────────────────────────────────────────────
function uniqueAmount(base: number, telegramId: number): number {
  const suffix = (telegramId % 900) / 10000
  return parseFloat((base + suffix).toFixed(4))
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  access: AccessInfo & { telegramId: number; refresh: () => void }
}

type PayMethod = 'stars' | 'usdt'

export function Paywall({ access }: Props) {
  const [plan, setPlan]       = useState<Plan>(PLANS[1])
  const [method, setMethod]   = useState<PayMethod>('usdt')
  const [network, setNetwork] = useState('TRC20')
  const [view, setView]       = useState<'plans' | 'payment'>('plans')
  const [copied, setCopied]   = useState(false)
  const [starsLoading, setStarsLoading] = useState(false)
  const [starsError, setStarsError]     = useState<string | null>(null)

  const payWithStars = async () => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg) {
      setStarsError('Откройте приложение в Telegram')
      return
    }
    setStarsLoading(true)
    setStarsError(null)
    try {
      const res = await fetch(`${API}/stars/invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(access.telegramId),
        },
        body: JSON.stringify({ plan: plan.id }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { invoice_link } = await res.json()
      tg.openInvoice(invoice_link, (status: string) => {
        if (status === 'paid') {
          setTimeout(() => access.refresh(), 2000)
        }
      })
    } catch (err) {
      setStarsError('Ошибка создания счёта. Попробуйте позже.')
    } finally {
      setStarsLoading(false)
    }
  }

  const wallet  = WALLETS[network]
  const amount  = uniqueAmount(plan.total, access.telegramId)
  const amountStr = amount.toFixed(4)

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Payment screen ──────────────────────────────────────────────────────────
  if (view === 'payment') {
    return (
      <div style={s.root}>
        <div style={s.container}>
          {/* Header */}
          <div style={s.payHeader}>
            <button style={s.backBtn} onClick={() => setView('plans')}>← Назад</button>
            <span style={s.payTitle}>⚡ MarketPulse Pro</span>
          </div>

          {/* Method tabs */}
          <div style={s.methodRow}>
            <button
              style={{ ...s.methodBtn, ...(method === 'stars' ? s.methodActive : {}) }}
              onClick={() => setMethod('stars')}
            >⭐ Telegram Stars</button>
            <button
              style={{ ...s.methodBtn, ...(method === 'usdt' ? s.methodActive : {}) }}
              onClick={() => setMethod('usdt')}
            >💎 USDT Крипто</button>
          </div>

          {method === 'stars' ? (
            <div style={s.starsBox}>
              <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>⭐</div>
              <div style={{ color: '#f9fafb', fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>
                Оплата Telegram Stars
              </div>
              <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
                {STARS_AMOUNTS[plan.id].toLocaleString()} Stars за {plan.label}
              </div>
              {starsError && (
                <div style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
                  {starsError}
                </div>
              )}
              <button
                style={{ ...s.ctaBtn, opacity: starsLoading ? 0.6 : 1 }}
                disabled={starsLoading}
                onClick={payWithStars}
              >
                {starsLoading ? 'Создаём счёт...' : `⭐ Оплатить ${STARS_AMOUNTS[plan.id].toLocaleString()} Stars`}
              </button>
              <p style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
                Нативная оплата внутри Telegram. Быстро и безопасно.
              </p>
            </div>
          ) : (
            <>
              {/* Network selector */}
              <div style={s.networkRow}>
                {Object.keys(WALLETS).map(net => (
                  <button
                    key={net}
                    style={{ ...s.netBtn, ...(network === net ? s.netActive : {}) }}
                    onClick={() => setNetwork(net)}
                  >{net}</button>
                ))}
              </div>

              {/* Recommended badge */}
              {NETWORK_INFO[network].recommended && (
                <div style={s.recBadge}>✅ Рекомендуем · Комиссия {NETWORK_INFO[network].fee}</div>
              )}
              {!NETWORK_INFO[network].recommended && (
                <div style={{ ...s.recBadge, background: '#1c1f2e', color: '#6b7280' }}>
                  Комиссия {NETWORK_INFO[network].fee}
                </div>
              )}

              {/* QR */}
              <div style={s.qrWrap}>
                <QRCodeSVG value={wallet} size={180} bgColor="#ffffff" fgColor="#000000" level="M" />
              </div>

              {/* Address */}
              <button style={s.addrBtn} onClick={() => copy(wallet)}>
                <span style={s.addrText}>{wallet}</span>
              </button>
              <button style={s.copyAddrBtn} onClick={() => copy(wallet)}>
                📋 {copied ? 'Скопировано!' : 'Скопировать адрес'}
              </button>

              {/* Amount */}
              <div style={s.amountBox}>
                <div style={s.amountLabel}>К ОПЛАТЕ</div>
                <div style={s.amountVal}>{amountStr} <span style={{ fontSize: 22 }}>USDT</span></div>
                <div style={s.amountNet}>Сеть: {network}</div>
              </div>

              {/* Auto activation note */}
              <div style={s.autoNote}>
                ✅ Активация автоматическая<br />
                Обычно 1-5 минут после отправки.<br />
                Уведомление придёт в Telegram.
              </div>

              <button style={s.refreshBtn} onClick={access.refresh}>
                🔄 Проверить оплату
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Plans screen ─────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      <div style={s.container}>
        {/* Logo */}
        <div style={s.logoRow}>
          <span style={s.logoIcon}>📊</span>
          <div>
            <div style={s.logoTitle}>MarketPulse Pro</div>
            <div style={s.logoSub}>MarketPulse Pro</div>
          </div>
        </div>

        {/* Plans */}
        <div style={s.plansList}>
          {PLANS.map(p => (
            <button
              key={p.id}
              style={{ ...s.planCard, ...(plan.id === p.id ? s.planSelected : {}) }}
              onClick={() => setPlan(p)}
            >
              <div style={s.planLeft}>
                <div style={s.planName}>{p.label}</div>
                <div style={s.planPrice}>
                  <span style={s.planPriceNum}>${p.pricePerMonth}</span>
                  <span style={s.planPriceSub}> / мес</span>
                </div>
                {p.months > 1 && (
                  <div style={s.planTotal}>итого ${p.total}</div>
                )}
              </div>
              <div style={s.planRight}>
                {p.badge && (
                  <span style={{ ...s.planBadge, background: p.id === '3m' ? '#7f1d1d' : '#1e3a5f' }}>
                    {p.badge}
                  </span>
                )}
                <div style={{ ...s.planRadio, ...(plan.id === p.id ? s.planRadioActive : {}) }} />
              </div>
            </button>
          ))}
        </div>

        {/* Features */}
        <div style={s.featuresBox}>
          <div style={s.featuresTitle}>ЧТО ВКЛЮЧЕНО В PRO:</div>
          {FEATURES.map((f, i) => (
            <div key={i} style={s.featureRow}>
              <span style={s.featureIcon}>{f.icon}</span>
              <span style={s.featureText}>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Payment method preview */}
        <div style={s.methodSection}>
          <div style={s.featuresTitle}>Способ оплаты</div>
          <div style={s.methodRow}>
            <button style={{ ...s.methodBtn, ...(method === 'stars' ? s.methodActive : {}) }}
              onClick={() => setMethod('stars')}>⭐ Telegram Stars</button>
            <button style={{ ...s.methodBtn, ...(method === 'usdt' ? s.methodActive : {}) }}
              onClick={() => setMethod('usdt')}>💎 USDT Крипто</button>
          </div>
          {method === 'usdt' && (
            <div style={s.networkRow}>
              {Object.keys(WALLETS).map(net => (
                <button key={net}
                  style={{ ...s.netBtn, ...(network === net ? s.netActive : {}) }}
                  onClick={() => setNetwork(net)}>{net}</button>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <button style={s.ctaBtn} onClick={() => setView('payment')}>
          Оплатить ${plan.total} → {plan.months} мес
        </button>

        <p style={s.trialNote}>После оплаты доступ откроется автоматически</p>
      </div>
    </div>
  )
}

// ── Trial banner ──────────────────────────────────────────────────────────────
export function TrialBanner({ hoursLeft }: { hoursLeft: number }) {
  const h = Math.floor(hoursLeft)
  const m = Math.floor((hoursLeft - h) * 60)
  const label = h > 0 ? `${h}ч ${m}м` : `${m} мин`
  const urgent = hoursLeft < 3
  return (
    <div style={{
      padding: '7px 16px', textAlign: 'center', fontSize: 13,
      background: urgent ? '#450a0a' : '#0f172a',
      borderBottom: `1px solid ${urgent ? '#ef4444' : '#1f2937'}`,
      color: urgent ? '#fca5a5' : '#9ca3af',
    }}>
      {urgent ? '⚠️' : '⏱'} Пробный период: осталось{' '}
      <b style={{ color: urgent ? '#f87171' : '#e5e7eb' }}>{label}</b>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root:      { position: 'fixed', inset: 0, background: '#0d1117', zIndex: 500, overflowY: 'auto' },
  container: { maxWidth: 420, margin: '0 auto', padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 },

  // Plans view
  logoRow:   { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' },
  logoIcon:  { fontSize: 36 },
  logoTitle: { fontSize: 18, fontWeight: 700, color: '#f9fafb' },
  logoSub:   { fontSize: 13, color: '#6b7280' },

  plansList:   { display: 'flex', flexDirection: 'column', gap: 10 },
  planCard:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 14, border: '1.5px solid #1f2937', background: '#161b22', cursor: 'pointer', textAlign: 'left' },
  planSelected:{ borderColor: '#3b82f6', background: '#0f1f3d' },
  planLeft:    { display: 'flex', flexDirection: 'column', gap: 3 },
  planName:    { fontSize: 16, fontWeight: 600, color: '#f9fafb' },
  planPrice:   { display: 'flex', alignItems: 'baseline' },
  planPriceNum:{ fontSize: 20, fontWeight: 700, color: '#f9fafb' },
  planPriceSub:{ fontSize: 13, color: '#6b7280' },
  planTotal:   { fontSize: 12, color: '#6b7280' },
  planRight:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  planBadge:   { fontSize: 12, fontWeight: 700, color: '#f9fafb', padding: '3px 8px', borderRadius: 20 },
  planRadio:   { width: 20, height: 20, borderRadius: 10, border: '2px solid #374151', background: 'transparent' },
  planRadioActive: { border: '6px solid #3b82f6', background: '#f9fafb' },

  featuresBox:  { background: '#161b22', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  featuresTitle:{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  featureRow:   { display: 'flex', alignItems: 'center', gap: 12 },
  featureIcon:  { fontSize: 18, width: 24, textAlign: 'center' },
  featureText:  { fontSize: 14, color: '#d1d5db' },

  methodSection:{ display: 'flex', flexDirection: 'column', gap: 10 },
  methodRow:    { display: 'flex', gap: 8 },
  methodBtn:    { flex: 1, padding: '10px 8px', borderRadius: 10, border: '1.5px solid #1f2937', background: '#161b22', color: '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  methodActive: { background: '#2563eb', borderColor: '#2563eb', color: '#fff' },

  networkRow:   { display: 'flex', gap: 8 },
  netBtn:       { flex: 1, padding: '8px 4px', borderRadius: 8, border: '1.5px solid #1f2937', background: '#161b22', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  netActive:    { background: '#2563eb', borderColor: '#2563eb', color: '#fff' },

  ctaBtn:      { background: '#2563eb', border: 'none', borderRadius: 14, padding: '15px', fontSize: 16, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  trialNote:   { fontSize: 12, color: '#374151', textAlign: 'center', margin: 0 },

  // Payment view
  payHeader:   { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn:     { background: 'none', border: 'none', color: '#6b7280', fontSize: 14, cursor: 'pointer', padding: 0 },
  payTitle:    { fontSize: 17, fontWeight: 700, color: '#f9fafb' },

  recBadge:    { background: '#064e3b', color: '#6ee7b7', fontSize: 13, padding: '6px 12px', borderRadius: 8, textAlign: 'center' },
  starsBox:    { background: '#161b22', borderRadius: 14, padding: 32, textAlign: 'center' },

  qrWrap:      { background: '#fff', borderRadius: 16, padding: 16, alignSelf: 'center', display: 'flex' },
  addrBtn:     { background: '#161b22', border: '1px solid #1f2937', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', width: '100%' },
  addrText:    { fontSize: 13, color: '#9ca3af', wordBreak: 'break-all', display: 'block', textAlign: 'left' },
  copyAddrBtn: { background: '#1f2937', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, color: '#e5e7eb', cursor: 'pointer', fontWeight: 600, width: '100%' },

  amountBox:   { background: '#0a1f14', border: '1.5px solid #26a17b50', borderRadius: 14, padding: '16px', textAlign: 'center' },
  amountLabel: { fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  amountVal:   { fontSize: 32, fontWeight: 800, color: '#f9fafb', letterSpacing: '-1px' },
  amountNet:   { fontSize: 13, color: '#6b7280', marginTop: 4 },

  autoNote:    { background: '#064e3b', color: '#6ee7b7', fontSize: 13, padding: '12px 16px', borderRadius: 10, textAlign: 'center', lineHeight: 1.6 },
  refreshBtn:  { background: '#1f2937', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, color: '#e5e7eb', cursor: 'pointer', fontWeight: 600, width: '100%' },
}
