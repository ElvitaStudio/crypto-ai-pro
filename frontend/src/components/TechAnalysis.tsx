import { useEffect, useState } from 'react'
import type { Signal, Candle } from '../types'
import { useLang } from '../i18n/LangContext'

interface Props {
  signal: Signal
  onClose: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (!n && n !== 0) return '—'
  const abs = Math.abs(n)
  if (abs >= 10_000) return n.toFixed(1)
  if (abs >= 1_000)  return n.toFixed(2)
  if (abs >= 100)    return n.toFixed(2)
  if (abs >= 10)     return n.toFixed(3)
  if (abs >= 1)      return n.toFixed(4)
  if (abs >= 0.1)    return n.toFixed(5)
  return n.toFixed(6)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GaugeBar({
  label, value, min, max, low, high, unit = '', colorFn,
}: {
  label: string
  value: number | undefined
  min: number
  max: number
  low: number    // below this → bearish/warn
  high: number   // above this → overbought/warn
  unit?: string
  colorFn?: (v: number) => string
}) {
  if (value === undefined || value === null) return null
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  const defaultColor = value < low ? '#f85149' : value > high ? '#f39c12' : '#3fb950'
  const color = colorFn ? colorFn(value) : defaultColor

  return (
    <div style={gs.wrap}>
      <div style={gs.top}>
        <span style={gs.label}>{label}</span>
        <span style={{ ...gs.val, color }}>{value.toFixed(1)}{unit}</span>
      </div>
      <div style={gs.track}>
        {/* Low zone */}
        <div style={{ ...gs.zone, left: 0, width: `${(low / max) * 100}%`, background: 'rgba(248,81,73,0.12)' }} />
        {/* High zone */}
        <div style={{ ...gs.zone, left: `${(high / max) * 100}%`, right: 0, background: 'rgba(243,156,18,0.12)' }} />
        {/* Fill */}
        <div style={{ ...gs.fill, width: `${pct}%`, background: color }} />
        {/* Tick low */}
        <div style={{ ...gs.tick, left: `${(low / max) * 100}%` }} />
        {/* Tick high */}
        <div style={{ ...gs.tick, left: `${(high / max) * 100}%` }} />
      </div>
      <div style={gs.labels}>
        <span>{min}</span>
        <span>{low}</span>
        <span>{high}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

const gs: Record<string, React.CSSProperties> = {
  wrap: { marginBottom: 14 },
  top: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 12, color: '#8b949e' },
  val: { fontSize: 13, fontWeight: 700 },
  track: { position: 'relative', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  zone: { position: 'absolute', top: 0, bottom: 0 },
  fill: { height: '100%', borderRadius: 4, transition: 'width 0.3s' },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.25)' },
  labels: { display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 9, color: 'rgba(255,255,255,0.25)' },
}

function LevelRow({ label, value, color, pct }: { label: string; value: string; color: string; pct?: string }) {
  return (
    <div style={ls.row}>
      <div style={{ ...ls.dot, background: color }} />
      <span style={ls.label}>{label}</span>
      <span style={{ ...ls.val, color }}>{value}</span>
      {pct && <span style={{ ...ls.pct, color }}>{pct}</span>}
    </div>
  )
}

const ls: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  label: { flex: 1, fontSize: 13, color: '#8b949e' },
  val: { fontSize: 14, fontWeight: 700 },
  pct: { fontSize: 12, fontWeight: 600 },
}

function AiBadge({ approved, model, confidence, reasoning }: {
  approved: boolean; model: string; confidence: number; reasoning: string
}) {
  const MODEL_SHORT: Record<string, string> = {
    'anthropic/claude-haiku-4-5': 'Claude',
    'openai/gpt-4o-mini': 'GPT-4o',
    'google/gemini-flash-2.0': 'Gemini',
  }
  const name = MODEL_SHORT[model] ?? model.split('/')[1] ?? model
  return (
    <div style={{
      ...ab.card,
      borderColor: approved ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.25)',
      background: approved ? 'rgba(63,185,80,0.06)' : 'rgba(248,81,73,0.06)',
    }}>
      <div style={ab.head}>
        <span>{approved ? '✅' : '❌'}</span>
        <span style={ab.name}>{name}</span>
        <span style={{ ...ab.conf, color: approved ? '#3fb950' : '#f85149' }}>{confidence}%</span>
      </div>
      {reasoning && <p style={ab.text}>{reasoning}</p>}
    </div>
  )
}

const ab: Record<string, React.CSSProperties> = {
  card: { border: '1px solid', borderRadius: 10, padding: '10px 12px', marginBottom: 8 },
  head: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  name: { flex: 1, fontWeight: 600, fontSize: 13 },
  conf: { fontWeight: 700, fontSize: 13 },
  text: { fontSize: 12, color: '#8b949e', margin: 0, lineHeight: 1.5 },
}

// ── Strategy descriptions ─────────────────────────────────────────────────────

const STRATEGY_INFO: Record<string, { icon: string; ru: string; en: string }> = {
  VolumeLevel: {
    icon: '📊',
    ru: 'Стратегия отслеживает аномальный рост объёма на ключевых уровнях поддержки/сопротивления. Сигнал возникает когда объём превышает среднее в 2+ раза именно в момент теста уровня.',
    en: 'Tracks abnormal volume spikes at key support/resistance levels. Signal fires when volume exceeds the average by 2× or more exactly at a level test.',
  },
  Multi: {
    icon: '🔫',
    ru: 'Мультифильтрная стратегия: требует одновременного совпадения нескольких условий — RSI, Bollinger Bands, EMA и объём. Чем больше совпадений — тем сильнее сигнал.',
    en: 'Multi-filter strategy requiring simultaneous alignment of RSI, Bollinger Bands, EMA and volume. More confluences = stronger signal.',
  },
  NexusVWAP: {
    icon: '🌌',
    ru: 'Отслеживает отклонение цены от VWAP-канала. Сигнал появляется при возврате к VWAP после значительного отклонения — статистически цена стремится к "справедливой стоимости".',
    en: 'Tracks price deviation from the VWAP channel. Signal fires on return to VWAP after significant deviation — price statistically tends toward "fair value".',
  },
  TitanFractal: {
    icon: '🏛',
    ru: 'Фрактальная стратегия определяет локальные экстремумы структуры рынка. Сигнал формируется на пробое фрактального уровня с подтверждением объёмом и трендом.',
    en: 'Fractal strategy identifies local market structure extremes. Signal forms on fractal level breakout confirmed by volume and trend.',
  },
}

// ── Indicator context ─────────────────────────────────────────────────────────

function getRsiContext(rsi: number, dir: string, lang: 'ru' | 'en'): string {
  const isLong = dir === 'LONG'
  if (lang === 'ru') {
    if (rsi < 30) return isLong ? `RSI ${rsi.toFixed(0)} — зона перепроданности. Сильный аргумент для лонга — продавцы истощены.` : `RSI ${rsi.toFixed(0)} — перепроданность. Нетипично для шорта.`
    if (rsi > 70) return isLong ? `RSI ${rsi.toFixed(0)} — перекупленность. Лонг рискованный.` : `RSI ${rsi.toFixed(0)} — зона перекупленности. Сильный аргумент для шорта.`
    return `RSI ${rsi.toFixed(0)} — нейтральная зона. Нет экстремальных условий.`
  }
  if (rsi < 30) return isLong ? `RSI ${rsi.toFixed(0)} — oversold. Strong case for long — sellers exhausted.` : `RSI ${rsi.toFixed(0)} — oversold. Atypical for a short.`
  if (rsi > 70) return isLong ? `RSI ${rsi.toFixed(0)} — overbought. Long is risky.` : `RSI ${rsi.toFixed(0)} — overbought. Strong case for short.`
  return `RSI ${rsi.toFixed(0)} — neutral zone. No extreme conditions.`
}

function getAdxContext(adx: number, lang: 'ru' | 'en'): string {
  if (lang === 'ru') {
    if (adx < 20) return `ADX ${adx.toFixed(0)} — слабый тренд. Рынок в боковике, сигнал менее надёжен.`
    if (adx > 40) return `ADX ${adx.toFixed(0)} — очень сильный тренд. Отличные условия для трендовых стратегий.`
    return `ADX ${adx.toFixed(0)} — умеренный тренд. Хорошие условия для входа.`
  }
  if (adx < 20) return `ADX ${adx.toFixed(0)} — weak trend. Market is ranging, signal is less reliable.`
  if (adx > 40) return `ADX ${adx.toFixed(0)} — very strong trend. Ideal conditions for trend strategies.`
  return `ADX ${adx.toFixed(0)} — moderate trend. Good entry conditions.`
}

function getVolContext(vol: number, lang: 'ru' | 'en'): string {
  if (lang === 'ru') {
    if (vol >= 3) return `Объём в ${vol.toFixed(1)}× выше нормы — аномальная активность. Высокая вероятность продолжения движения.`
    if (vol >= 2) return `Объём в ${vol.toFixed(1)}× выше нормы — заметный импульс. Движение подкреплено участниками.`
    return `Объём в ${vol.toFixed(1)}× от нормы — стандартная активность.`
  }
  if (vol >= 3) return `Volume ${vol.toFixed(1)}× above normal — anomalous activity. High continuation probability.`
  if (vol >= 2) return `Volume ${vol.toFixed(1)}× above normal — noticeable impulse. Move is backed by participants.`
  return `Volume ${vol.toFixed(1)}× normal — standard activity.`
}

// ── CVD helpers ───────────────────────────────────────────────────────────────

const BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? ''

/** Normalize symbol to base ticker: "TAO/USDT" → "TAO", "TAOUSDT" → "TAO" */
function toBaseTicker(symbol: string): string {
  return symbol.replace(/\/USDT$/i, '').replace(/USDT$/i, '')
}

/** Fetch candles and compute cumulative delta from buy/sell volume. */
function useCvd(symbol: string, timeframe = '15m', limit = 60) {
  const [candles, setCandles] = useState<Candle[] | null>(null)
  const [loading, setLoading] = useState(true)
  const base = toBaseTicker(symbol)

  useEffect(() => {
    setLoading(true)
    fetch(`${BASE_URL}/api/chart/${encodeURIComponent(base)}?timeframe=${timeframe}&limit=${limit}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.candles) setCandles(data.candles)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [base, timeframe, limit])

  if (!candles || candles.length === 0) return { cvd: null, loading }

  // Compute cumulative delta from per-candle delta field
  let cum = 0
  const cvd = candles.map(c => {
    cum += (c.delta ?? 0)
    return cum
  })

  return { cvd, loading }
}

/** SVG sparkline for CVD. */
function CvdSparkline({ cvd, direction }: { cvd: number[]; direction: 'LONG' | 'SHORT' }) {
  const W = 280
  const H = 56
  const PAD = 4

  const min = Math.min(...cvd)
  const max = Math.max(...cvd)
  const range = max - min || 1

  const pts = cvd.map((v, i) => {
    const x = PAD + (i / (cvd.length - 1)) * (W - PAD * 2)
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  })
  const polyline = pts.join(' ')
  const lastVal  = cvd[cvd.length - 1]
  const prevVal  = cvd[cvd.length - 4] ?? cvd[0]
  const trend    = lastVal > prevVal ? 'UP' : lastVal < prevVal ? 'DOWN' : 'FLAT'
  const aligned  = (direction === 'LONG' && trend === 'UP') || (direction === 'SHORT' && trend === 'DOWN')
  const lineColor = trend === 'UP' ? '#3fb950' : trend === 'DOWN' ? '#f85149' : '#8b949e'

  // Fill polygon: line + baseline
  const lastPt  = pts[pts.length - 1].split(',')
  const firstPt = pts[0].split(',')
  const fillPts = `${polyline} ${lastPt[0]},${H} ${firstPt[0]},${H}`

  return (
    <div style={cvdS.wrap}>
      <div style={cvdS.header}>
        <span style={cvdS.title}>〽 CVD</span>
        <span style={{ ...cvdS.trendBadge, background: aligned ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)', color: aligned ? '#3fb950' : '#f85149', borderColor: aligned ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)' }}>
          {aligned ? '✓ Подтверждает' : '⚠ Противоречит'}
        </span>
        <span style={{ ...cvdS.trendArrow, color: lineColor }}>
          {trend === 'UP' ? '↑' : trend === 'DOWN' ? '↓' : '→'}
        </span>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {/* Zero line */}
        <line
          x1={PAD} y1={PAD + (1 - (0 - min) / range) * (H - PAD * 2)}
          x2={W - PAD} y2={PAD + (1 - (0 - min) / range) * (H - PAD * 2)}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3"
        />
        {/* Fill */}
        <polygon points={fillPts} fill={lineColor} opacity="0.08" />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Last dot */}
        <circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill={lineColor} />
      </svg>

      <div style={cvdS.stats}>
        <span style={cvdS.stat}>
          <span style={cvdS.statLabel}>Старт </span>
          <span style={{ color: '#8b949e' }}>{cvd[0] > 0 ? '+' : ''}{(cvd[0] / 1000).toFixed(1)}K</span>
        </span>
        <span style={cvdS.stat}>
          <span style={cvdS.statLabel}>Сейчас </span>
          <span style={{ color: lineColor }}>{lastVal > 0 ? '+' : ''}{(lastVal / 1000).toFixed(1)}K</span>
        </span>
        <span style={cvdS.stat}>
          <span style={cvdS.statLabel}>Изменение </span>
          <span style={{ color: lineColor }}>{lastVal - cvd[0] > 0 ? '+' : ''}{((lastVal - cvd[0]) / 1000).toFixed(1)}K</span>
        </span>
      </div>
    </div>
  )
}

function getCvdContext(cvd: number[], direction: 'LONG' | 'SHORT', lang: 'ru' | 'en'): string {
  const last  = cvd[cvd.length - 1]
  const prev  = cvd[Math.max(0, cvd.length - 10)]
  const delta = last - prev
  const trend = delta > 0 ? 'UP' : delta < 0 ? 'DOWN' : 'FLAT'
  const isLong = direction === 'LONG'
  const aligned = (isLong && trend === 'UP') || (!isLong && trend === 'DOWN')

  if (lang === 'ru') {
    if (aligned) {
      return trend === 'UP'
        ? 'CVD растёт — покупатели доминируют последние свечи. Совпадает с направлением лонга.'
        : 'CVD падает — продавцы доминируют последние свечи. Совпадает с направлением шорта.'
    }
    return trend === 'UP'
      ? 'CVD растёт — покупатели активны, но сигнал шорт. Возможное расхождение.'
      : trend === 'DOWN'
      ? 'CVD падает — продавцы давят, но сигнал лонг. Возможное расхождение.'
      : 'CVD в равновесии — нет явного перевеса покупателей или продавцов.'
  }
  if (aligned) {
    return trend === 'UP'
      ? 'CVD rising — buyers dominating recent candles. Aligned with LONG direction.'
      : 'CVD falling — sellers dominating recent candles. Aligned with SHORT direction.'
  }
  return trend === 'UP'
    ? 'CVD rising — buyers active, but signal is SHORT. Possible divergence.'
    : trend === 'DOWN'
    ? 'CVD falling — sellers pressing, but signal is LONG. Possible divergence.'
    : 'CVD flat — no clear buyer or seller dominance.'
}

const cvdS: Record<string, React.CSSProperties> = {
  wrap: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: '12px 14px',
  },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 13, fontWeight: 700, color: '#e6edf3', flex: 0 },
  trendBadge: {
    flex: 1, textAlign: 'center',
    fontSize: 11, fontWeight: 700, padding: '2px 10px',
    borderRadius: 20, border: '1px solid',
  },
  trendArrow: { fontSize: 18, fontWeight: 800, lineHeight: 1 },
  stats: { display: 'flex', justifyContent: 'space-between', marginTop: 8 },
  stat: { fontSize: 12 },
  statLabel: { color: '#6e7681' },
}

// ── Main component ────────────────────────────────────────────────────────────

export function TechAnalysis({ signal, onClose }: Props) {
  const { lang } = useLang()
  const isLong = signal.direction === 'LONG'
  const rr = Math.abs(signal.tp - signal.entry) / Math.abs(signal.entry - signal.sl)
  const slPct = Math.abs((signal.sl - signal.entry) / signal.entry * 100)
  const tpPct = Math.abs((signal.tp - signal.entry) / signal.entry * 100)

  const feat = signal.features ?? {}
  const rsi = feat.rsi as number | undefined
  const adx = feat.adx as number | undefined
  const volRatio = feat.vol_ratio as number | undefined
  const distEma = feat.dist_ema as number | undefined

  const { cvd, loading: cvdLoading } = useCvd(signal.symbol)

  const stratKey = signal.strategy.replace('Strategy', '') as keyof typeof STRATEGY_INFO
  const stratInfo = STRATEGY_INFO[signal.strategy] ?? STRATEGY_INFO[stratKey]

  const approvedCount = signal.ai_votes.filter(v => v.approved).length

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />

        {/* Header */}
        <div style={s.header}>
          <span style={{ ...s.dirBadge, background: isLong ? '#26a17b' : '#e74c3c' }}>
            {isLong ? '▲ LONG' : '▼ SHORT'}
          </span>
          <div style={s.headerInfo}>
            <span style={s.symbol}>{signal.symbol}</span>
            <span style={s.headerSub}>
              {lang === 'ru' ? 'Технический анализ' : 'Technical Analysis'}
            </span>
          </div>
          {approvedCount > 0 && (
            <div style={s.aiScore}>
              <span style={s.aiScoreNum}>{approvedCount}/{signal.ai_votes.length}</span>
              <span style={s.aiScoreLabel}>AI</span>
            </div>
          )}
        </div>

        {/* Conclusion box */}
        <div style={{
          ...s.conclusion,
          borderColor: isLong ? 'rgba(63,185,80,0.4)' : 'rgba(248,81,73,0.4)',
          background: isLong ? 'rgba(63,185,80,0.08)' : 'rgba(248,81,73,0.08)',
        }}>
          <span style={{ fontSize: 20 }}>{isLong ? '🟢' : '🔴'}</span>
          <p style={s.conclusionText}>
            {signal.ai_summary ?? (
              lang === 'ru'
                ? `Сигнал ${isLong ? 'ЛОНГ' : 'ШОРТ'} по ${signal.symbol}. Стратегия ${stratInfo?.icon ?? ''} обнаружила паттерн с${approvedCount > 0 ? ` подтверждением AI ${approvedCount}/${signal.ai_votes.length}` : ''}. Вход на уровне ${fmtPrice(signal.entry)}.`
                : `${isLong ? 'LONG' : 'SHORT'} signal on ${signal.symbol}. Strategy ${stratInfo?.icon ?? ''} detected a pattern${approvedCount > 0 ? ` with AI confirmation ${approvedCount}/${signal.ai_votes.length}` : ''}. Entry at ${fmtPrice(signal.entry)}.`
            )}
          </p>
        </div>

        {/* Strategy */}
        {stratInfo && (
          <div style={s.section}>
            <h4 style={s.sectionTitle}>
              {lang === 'ru' ? '📐 Стратегия' : '📐 Strategy'}
            </h4>
            <div style={s.stratCard}>
              <span style={s.stratIcon}>{stratInfo.icon}</span>
              <p style={s.stratText}>{lang === 'ru' ? stratInfo.ru : stratInfo.en}</p>
            </div>
          </div>
        )}

        {/* Levels */}
        <div style={s.section}>
          <h4 style={s.sectionTitle}>
            {lang === 'ru' ? '🎯 Ключевые уровни' : '🎯 Key levels'}
          </h4>
          <LevelRow
            label={lang === 'ru' ? 'Вход' : 'Entry'}
            value={fmtPrice(signal.entry)}
            color="#60a5fa"
          />
          <LevelRow
            label={lang === 'ru' ? 'Тейк-профит' : 'Take Profit'}
            value={fmtPrice(signal.tp)}
            color="#3fb950"
            pct={`+${tpPct.toFixed(2)}%`}
          />
          <LevelRow
            label={lang === 'ru' ? 'Стоп-лосс' : 'Stop Loss'}
            value={fmtPrice(signal.sl)}
            color="#f85149"
            pct={`-${slPct.toFixed(2)}%`}
          />
          <div style={{ ...ls.row, borderBottom: 'none' }}>
            <div style={{ ...ls.dot, background: '#f59e0b' }} />
            <span style={ls.label}>{lang === 'ru' ? 'Риск / Прибыль' : 'Risk / Reward'}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>1 : {rr.toFixed(1)}</span>
            <span style={{ fontSize: 12, color: rr >= 2 ? '#3fb950' : '#8b949e' }}>
              {rr >= 3 ? (lang === 'ru' ? '🔥 Отлично' : '🔥 Excellent') :
               rr >= 2 ? (lang === 'ru' ? '✓ Хорошо' : '✓ Good') :
               lang === 'ru' ? '⚠ Осторожно' : '⚠ Caution'}
            </span>
          </div>
        </div>

        {/* Indicators */}
        {(rsi !== undefined || adx !== undefined || volRatio !== undefined) && (
          <div style={s.section}>
            <h4 style={s.sectionTitle}>
              {lang === 'ru' ? '📊 Индикаторы' : '📊 Indicators'}
            </h4>

            {rsi !== undefined && (
              <>
                <GaugeBar label="RSI (14)" value={rsi} min={0} max={100} low={30} high={70} />
                <p style={s.indicNote}>{getRsiContext(rsi, signal.direction, lang)}</p>
              </>
            )}

            {adx !== undefined && (
              <>
                <GaugeBar label="ADX (14)" value={adx} min={0} max={60} low={20} high={40}
                  colorFn={v => v < 20 ? '#8b949e' : v > 40 ? '#3fb950' : '#60a5fa'} />
                <p style={s.indicNote}>{getAdxContext(adx, lang)}</p>
              </>
            )}

            {volRatio !== undefined && (
              <>
                <GaugeBar label={lang === 'ru' ? 'Объём (×норма)' : 'Volume (×avg)'} value={volRatio}
                  min={0} max={5} low={1} high={3} unit="×"
                  colorFn={v => v >= 3 ? '#f59e0b' : v >= 2 ? '#3fb950' : '#8b949e'} />
                <p style={s.indicNote}>{getVolContext(volRatio, lang)}</p>
              </>
            )}

            {distEma !== undefined && (
              <div style={s.featRow}>
                <span style={s.featLabel}>{lang === 'ru' ? 'Откл. от EMA' : 'EMA deviation'}</span>
                <span style={{ ...s.featVal, color: Math.abs(distEma) > 0.03 ? '#f39c12' : '#60a5fa' }}>
                  {(distEma * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* CVD */}
        <div style={s.section}>
          <h4 style={s.sectionTitle}>
            {lang === 'ru' ? '〽 Кумулятивная дельта (CVD)' : '〽 Cumulative Volume Delta (CVD)'}
          </h4>
          {cvdLoading ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#8b949e', fontSize: 12 }}>
              Загрузка CVD…
            </div>
          ) : cvd ? (
            <>
              <CvdSparkline cvd={cvd} direction={signal.direction} />
              <p style={{ ...s.indicNote, marginTop: 8 }}>
                {getCvdContext(cvd, signal.direction, lang)}
              </p>
            </>
          ) : (
            <div style={{ color: '#6e7681', fontSize: 12, padding: '8px 0' }}>
              {lang === 'ru' ? 'Данные CVD недоступны' : 'CVD data unavailable'}
            </div>
          )}
        </div>

        {/* AI votes */}
        {signal.ai_votes.length > 0 && (
          <div style={s.section}>
            <h4 style={s.sectionTitle}>
              {lang === 'ru' ? '🤖 Голосование AI-совета' : '🤖 AI Council votes'}
            </h4>
            {signal.ai_votes.map((v, i) => (
              <AiBadge key={i} {...v} />
            ))}
          </div>
        )}

        <button style={s.closeBtn} onClick={onClose}>
          {lang === 'ru' ? 'Закрыть' : 'Close'}
        </button>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'flex-end', zIndex: 200,
  },
  sheet: {
    background: '#0d1117',
    width: '100%', borderRadius: '20px 20px 0 0',
    padding: '12px 16px 40px', maxHeight: '90vh', overflowY: 'auto',
    border: '1px solid rgba(255,255,255,0.08)',
    borderBottom: 'none',
  },
  handle: {
    width: 40, height: 4, background: 'rgba(255,255,255,0.2)',
    borderRadius: 2, margin: '0 auto 18px',
  },

  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  dirBadge: { fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 8, color: '#fff', letterSpacing: 0.5 },
  headerInfo: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 2 },
  symbol: { fontSize: 18, fontWeight: 800, color: '#f0f6fc' },
  headerSub: { fontSize: 11, color: '#8b949e' },
  aiScore: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '6px 10px' },
  aiScoreNum: { fontSize: 16, fontWeight: 800, color: '#a78bfa' },
  aiScoreLabel: { fontSize: 10, color: '#8b949e' },

  conclusion: {
    display: 'flex', gap: 10, padding: '12px 14px',
    borderRadius: 12, border: '1px solid', marginBottom: 18,
    alignItems: 'flex-start',
  },
  conclusionText: { margin: 0, fontSize: 13, lineHeight: 1.55, color: '#e6edf3' },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 10 },

  stratCard: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  stratIcon: { fontSize: 24, flexShrink: 0 },
  stratText: { fontSize: 13, color: '#8b949e', lineHeight: 1.55, margin: 0 },

  indicNote: { fontSize: 12, color: '#6e7681', margin: '-8px 0 14px', lineHeight: 1.5 },

  featRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  featLabel: { fontSize: 12, color: '#8b949e' },
  featVal: { fontSize: 13, fontWeight: 600 },

  closeBtn: {
    marginTop: 8, width: '100%', padding: '14px',
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, color: '#e6edf3', fontSize: 15, cursor: 'pointer',
  },
}
