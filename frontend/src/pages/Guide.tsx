import { useState } from 'react'
import { useLang } from '../i18n/LangContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Section {
  id: string
  icon: string
  titleRu: string
  titleEn: string
  color: string
  items: GuideItem[]
}

interface GuideItem {
  icon: string
  titleRu: string
  titleEn: string
  textRu: string
  textEn: string
  visual?: React.ReactNode
}

// ── Visual illustrations ──────────────────────────────────────────────────────

function CandleChart() {
  const candles = [
    { o: 60, h: 55, l: 70, c: 58, bull: false },
    { o: 58, h: 50, l: 65, c: 52, bull: true },
    { o: 52, h: 45, l: 58, c: 47, bull: true },
    { o: 47, h: 38, l: 52, c: 40, bull: true },
    { o: 40, h: 35, l: 55, c: 50, bull: false },
    { o: 50, h: 42, l: 56, c: 44, bull: true },
  ]
  return (
    <svg viewBox="0 0 120 80" style={{ width: '100%', height: 80 }}>
      {candles.map((c, i) => {
        const x = 10 + i * 18
        const color = c.bull ? '#3fb950' : '#f85149'
        const bodyTop = Math.min(c.o, c.c)
        const bodyH = Math.abs(c.o - c.c) || 2
        return (
          <g key={i}>
            <line x1={x + 4} y1={c.h} x2={x + 4} y2={c.l} stroke={color} strokeWidth={1} />
            <rect x={x} y={bodyTop} width={8} height={bodyH} fill={color} rx={1} />
          </g>
        )
      })}
      {/* Entry line */}
      <line x1={0} y1={47} x2={120} y2={47} stroke="#60a5fa" strokeWidth={1} strokeDasharray="3 2" />
      <rect x={82} y={41} width={36} height={12} fill="#1d4ed8" rx={3} />
      <text x={100} y={50} fill="#fff" fontSize={6} textAnchor="middle">ENTRY</text>
      {/* TP line */}
      <line x1={0} y1={35} x2={120} y2={35} stroke="#3fb950" strokeWidth={1} strokeDasharray="3 2" />
      <rect x={82} y={29} width={36} height={12} fill="#14532d" rx={3} />
      <text x={100} y={38} fill="#3fb950" fontSize={6} textAnchor="middle">TP ✓</text>
      {/* SL line */}
      <line x1={0} y1={62} x2={120} y2={62} stroke="#f85149" strokeWidth={1} strokeDasharray="3 2" />
      <rect x={82} y={56} width={36} height={12} fill="#7f1d1d" rx={3} />
      <text x={100} y={65} fill="#f85149" fontSize={6} textAnchor="middle">SL ✗</text>
    </svg>
  )
}

function CVDChart() {
  const points = [50, 48, 45, 46, 42, 38, 36, 38, 40, 44, 42, 40]
  const path = points.map((y, i) => `${i === 0 ? 'M' : 'L'}${i * 10 + 5},${y}`).join(' ')
  const area = `${path} L${(points.length - 1) * 10 + 5},80 L5,80 Z`

  const volBars = [20, 35, 28, 40, 32, 38, 25, 42, 30, 36, 28, 33]
  const buyBars = [12, 20, 18, 25, 18, 28, 12, 35, 20, 28, 18, 25]

  return (
    <svg viewBox="0 0 120 85" style={{ width: '100%', height: 85 }}>
      {/* Volume bars */}
      {volBars.map((h, i) => (
        <g key={i}>
          <rect x={i * 10 + 2} y={80 - h} width={8} height={h}
            fill="rgba(139,148,158,0.3)" rx={1} />
          <rect x={i * 10 + 2} y={80 - buyBars[i]} width={8} height={buyBars[i]}
            fill="rgba(63,185,80,0.5)" rx={1} />
        </g>
      ))}
      {/* CVD line */}
      <path d={area} fill="rgba(96,165,250,0.15)" />
      <path d={path} fill="none" stroke="#60a5fa" strokeWidth={2} strokeLinejoin="round" />
      {/* Labels */}
      <text x={4} y={8} fill="#60a5fa" fontSize={6}>CVD</text>
      <text x={4} y={16} fill="#3fb950" fontSize={5}>■ Buy</text>
      <text x={28} y={16} fill="#8b949e" fontSize={5}>■ Sell</text>
    </svg>
  )
}

function VolumeProfileChart() {
  const bars = [
    { vol: 15, buy: 8,  poc: false },
    { vol: 25, buy: 15, poc: false },
    { vol: 45, buy: 28, poc: false },
    { vol: 70, buy: 48, poc: true  },
    { vol: 55, buy: 30, poc: false },
    { vol: 35, buy: 18, poc: false },
    { vol: 20, buy: 10, poc: false },
    { vol: 12, buy: 6,  poc: false },
  ]
  const maxVol = 70
  const prices = ['1.21', '1.19', '1.17', '1.16 POC', '1.14', '1.12', '1.10', '1.09']

  return (
    <svg viewBox="0 0 130 88" style={{ width: '100%', height: 88 }}>
      {bars.map((b, i) => {
        const y = 4 + i * 10
        const w = (b.vol / maxVol) * 65
        const wBuy = (b.buy / maxVol) * 65
        return (
          <g key={i}>
            <rect x={45} y={y} width={w} height={7}
              fill={b.poc ? 'rgba(250,204,21,0.4)' : 'rgba(139,148,158,0.25)'} rx={1} />
            <rect x={45} y={y} width={wBuy} height={7}
              fill={b.poc ? 'rgba(250,204,21,0.7)' : 'rgba(63,185,80,0.45)'} rx={1} />
            {b.poc && (
              <rect x={44} y={y - 1} width={w + 2} height={9}
                fill="none" stroke="#facc15" strokeWidth={0.8} rx={1} />
            )}
            <text x={42} y={y + 6} fill={b.poc ? '#facc15' : '#8b949e'}
              fontSize={5} textAnchor="end">{prices[i]}</text>
          </g>
        )
      })}
      <text x={48} y={4} fill="#facc15" fontSize={5.5}>POC — Point of Control</text>
      <line x1={45} y1={36} x2={112} y2={36} stroke="#facc15" strokeWidth={0.5} strokeDasharray="2 2" />
    </svg>
  )
}

function HeatmapViz() {
  const rows = 4
  const cols = 8
  const data = [
    [0.2, 0.5, 0.8, 1.0, 0.9, 0.6, 0.3, 0.1],
    [0.3, 0.7, 0.9, 0.7, 0.5, 0.8, 0.4, 0.2],
    [0.1, 0.4, 0.6, 0.8, 1.0, 0.7, 0.5, 0.3],
    [0.2, 0.3, 0.5, 0.6, 0.7, 0.9, 0.6, 0.2],
  ]
  const colors = (v: number) => {
    if (v > 0.8) return '#f59e0b'
    if (v > 0.6) return '#f97316'
    if (v > 0.4) return '#3b82f6'
    if (v > 0.2) return '#1d4ed8'
    return '#0f172a'
  }
  return (
    <svg viewBox="0 0 120 55" style={{ width: '100%', height: 55 }}>
      <text x={0} y={8} fill="#8b949e" fontSize={5}>Объём ликвидаций по уровням цены</text>
      {data.map((row, ri) =>
        row.map((v, ci) => (
          <rect key={`${ri}-${ci}`}
            x={ci * 15 + 1} y={ri * 10 + 12}
            width={13} height={8}
            fill={colors(v)} rx={1} opacity={0.85 + v * 0.15}
          />
        ))
      )}
      {/* Legend */}
      <text x={0} y={53} fill="#1d4ed8" fontSize={4.5}>■ мало</text>
      <text x={22} y={53} fill="#3b82f6" fontSize={4.5}>■</text>
      <text x={32} y={53} fill="#f97316" fontSize={4.5}>■</text>
      <text x={42} y={53} fill="#f59e0b" fontSize={4.5}>■ много</text>
    </svg>
  )
}

function SupplyDemandViz() {
  return (
    <svg viewBox="0 0 120 85" style={{ width: '100%', height: 85 }}>
      {/* Price candles sketch */}
      {[45, 42, 38, 40, 44, 48, 52, 50, 46].map((y, i) => {
        const x = 8 + i * 12
        const bull = i % 2 === 0
        return (
          <g key={i}>
            <line x1={x + 4} y1={y - 5} x2={x + 4} y2={y + 5} stroke={bull ? '#3fb950' : '#f85149'} strokeWidth={1} />
            <rect x={x} y={y - 3} width={8} height={6}
              fill={bull ? '#3fb950' : '#f85149'} rx={1} />
          </g>
        )
      })}
      {/* Supply zone (resistance) */}
      <rect x={0} y={28} width={120} height={12}
        fill="rgba(248,81,73,0.18)" />
      <line x1={0} y1={28} x2={120} y2={28} stroke="#f85149" strokeWidth={0.8} strokeDasharray="3 2" />
      <line x1={0} y1={40} x2={120} y2={40} stroke="#f85149" strokeWidth={0.8} strokeDasharray="3 2" />
      <text x={2} y={36} fill="#f85149" fontSize={5.5}>SUPPLY ZONE</text>

      {/* Demand zone (support) */}
      <rect x={0} y={60} width={120} height={12}
        fill="rgba(63,185,80,0.18)" />
      <line x1={0} y1={60} x2={120} y2={60} stroke="#3fb950" strokeWidth={0.8} strokeDasharray="3 2" />
      <line x1={0} y1={72} x2={120} y2={72} stroke="#3fb950" strokeWidth={0.8} strokeDasharray="3 2" />
      <text x={2} y={68} fill="#3fb950" fontSize={5.5}>DEMAND ZONE</text>

      {/* Arrow bounce from demand */}
      <path d="M 60 72 L 60 48" stroke="#60a5fa" strokeWidth={1.5}
        markerEnd="url(#arrow)" strokeDasharray="2 2" />
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#60a5fa" />
        </marker>
      </defs>
    </svg>
  )
}

function SignalFlowViz() {
  const steps = [
    { label: 'Скан\n20+ монет', icon: '🔍', color: '#7c3aed' },
    { label: 'Паттерн\nнайден', icon: '📊', color: '#2563eb' },
    { label: 'AI совет\n3 модели', icon: '🤖', color: '#0891b2' },
    { label: 'Сигнал\nотправлен', icon: '📡', color: '#059669' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 0' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{
            flex: 1, background: `${s.color}22`, border: `1px solid ${s.color}55`,
            borderRadius: 8, padding: '6px 4px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 18 }}>{s.icon}</div>
            <div style={{ fontSize: 9, color: '#8b949e', lineHeight: 1.3, whiteSpace: 'pre' }}>{s.label}</div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ color: '#8b949e', fontSize: 12, margin: '0 2px' }}>›</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Guide data ────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'signals',
    icon: '📡',
    titleRu: 'Сигналы',
    titleEn: 'Signals',
    color: '#3b82f6',
    items: [
      {
        icon: '🔄',
        titleRu: 'Как генерируются сигналы',
        titleEn: 'How signals are generated',
        textRu: 'Каждые 5 минут бот сканирует 20–80 монет по 4 стратегиям. При обнаружении паттерна — сигнал голосует AI-совет из 3 моделей (Claude, GPT-4, Gemini). Только одобренные большинством сигналы попадают в ленту.',
        textEn: 'Every 5 minutes the bot scans 20–80 coins across 4 strategies. When a pattern is detected, 3 AI models vote (Claude, GPT-4, Gemini). Only majority-approved signals appear in the feed.',
        visual: <SignalFlowViz />,
      },
      {
        icon: '📋',
        titleRu: 'Карточка сигнала',
        titleEn: 'Signal card',
        textRu: 'Каждая карточка содержит: монету и направление (LONG/SHORT), точку входа, Стоп-лосс (SL) и Тейк-профит (TP). Нажав "График" — откроется полноэкранный интерактивный чарт с индикаторами.',
        textEn: 'Each card shows: coin + direction (LONG/SHORT), entry price, Stop-Loss (SL) and Take-Profit (TP). Tap "Chart" to open a full-screen interactive chart with all indicators.',
        visual: <CandleChart />,
      },
      {
        icon: '🏷️',
        titleRu: 'Статусы сигналов',
        titleEn: 'Signal statuses',
        textRu: '🔵 Открытые — позиция ещё активна. Следим за ценой.\n🟢 Тейк-профит — цена достигла TP. Сделка в плюсе.\n🔴 Стоп-лосс — цена достигла SL. Убыток зафиксирован.\n\nСтатус обновляется автоматически — без ручного вмешательства.',
        textEn: '🔵 Open — position is still active. Watching price.\n🟢 Take Profit — price hit TP. Trade closed positive.\n🔴 Stop Loss — price hit SL. Loss recorded.\n\nStatus updates automatically — no manual action needed.',
      },
      {
        icon: '🔍',
        titleRu: 'Фильтры',
        titleEn: 'Filters',
        textRu: 'Кнопки вверху позволяют фильтровать ленту:\n• Все — показывает всё\n• Открытые — только активные позиции\n• Тейк — успешно закрытые\n• Стоп — закрытые с убытком',
        textEn: 'Filter buttons at the top:\n• All — show everything\n• Open — only active positions\n• Win — successfully closed\n• Loss — closed at a loss',
      },
    ],
  },
  {
    id: 'charts',
    icon: '📊',
    titleRu: 'Индикаторы на графике',
    titleEn: 'Chart indicators',
    color: '#8b5cf6',
    items: [
      {
        icon: '🕯️',
        titleRu: 'Японские свечи',
        titleEn: 'Candlestick chart',
        textRu: 'Каждая свеча = один временной период. Зелёная — цена выросла. Красная — цена упала. Тело свечи показывает разницу открытия/закрытия. Тени (хвосты) — максимум и минимум за период.',
        textEn: 'Each candle = one time period. Green = price rose. Red = price fell. The body shows open/close difference. Wicks show the high and low for the period.',
        visual: <CandleChart />,
      },
      {
        icon: '📈',
        titleRu: 'CVD — Cumulative Volume Delta',
        titleEn: 'CVD — Cumulative Volume Delta',
        textRu: 'CVD показывает разницу между объёмом покупок и продаж нарастающим итогом.\n\n🔺 CVD растёт → покупатели доминируют\n🔻 CVD падает → продавцы давят\n\nЕсли цена растёт, а CVD падает — скрытое давление продавцов. Возможный разворот.',
        textEn: 'CVD shows the cumulative difference between buy and sell volume.\n\n🔺 CVD rising → buyers are in control\n🔻 CVD falling → sellers are pressing\n\nIf price rises but CVD falls — hidden selling pressure. Possible reversal.',
        visual: <CVDChart />,
      },
      {
        icon: '📦',
        titleRu: 'Volume Profile — профиль объёма',
        titleEn: 'Volume Profile',
        textRu: 'Горизонтальные бары показывают сколько объёма прошло на каждом ценовом уровне.\n\n🟡 POC (Point of Control) — уровень с максимальным объёмом. Цена часто возвращается к нему.\nVAH/VAL — верхняя и нижняя граница зоны, где прошло 70% всего объёма.\nHVN — зоны высокого объёма. Здесь сильный магнит для цены.',
        textEn: 'Horizontal bars show how much volume traded at each price level.\n\n🟡 POC (Point of Control) — the level with highest volume. Price often returns to it.\nVAH/VAL — upper/lower boundary of the zone containing 70% of all volume.\nHVN — high volume nodes. Strong price magnets.',
        visual: <VolumeProfileChart />,
      },
      {
        icon: '🟩',
        titleRu: 'Зоны Спроса и Предложения',
        titleEn: 'Supply & Demand Zones',
        textRu: '🟥 Supply Zone (красная) — зона сильного предложения. Продавцы активны. Цена обычно отбивается вниз.\n\n🟩 Demand Zone (зелёная) — зона спроса. Покупатели поглощают продажи. Цена отталкивается вверх.\n\nЗоны строятся по HVN-узлам профиля объёма.',
        textEn: '🟥 Supply Zone (red) — heavy selling pressure zone. Price usually bounces down.\n\n🟩 Demand Zone (green) — buying interest zone. Buyers absorb selling. Price bounces up.\n\nZones are built from HVN nodes in the volume profile.',
        visual: <SupplyDemandViz />,
      },
      {
        icon: '🔥',
        titleRu: 'Тепловая карта (Heatmap)',
        titleEn: 'Liquidation Heatmap',
        textRu: 'Показывает где сконцентрированы ордера ликвидации на рынке фьючерсов.\n\n🟠 Жёлто-оранжевые зоны — крупные скопления ликвидаций. Цена "охотится" за ними.\n🔵 Синие зоны — меньший объём ликвидаций.\n\nПопав в жёлтую зону, цена резко ускоряется — крупные игроки тут.',
        textEn: 'Shows where liquidation orders are concentrated in the futures market.\n\n🟠 Yellow-orange zones — large liquidation clusters. Price "hunts" them.\n🔵 Blue zones — smaller liquidation volume.\n\nWhen price hits a yellow zone, it accelerates sharply — big players are there.',
        visual: <HeatmapViz />,
      },
    ],
  },
  {
    id: 'stats',
    icon: '📈',
    titleRu: 'Статистика',
    titleEn: 'Statistics',
    color: '#10b981',
    items: [
      {
        icon: '🏆',
        titleRu: 'Win Rate',
        titleEn: 'Win Rate',
        textRu: 'Процент прибыльных сделок от общего числа закрытых. Win Rate выше 55% считается хорошим результатом для торговых систем. Мы отслеживаем его отдельно по каждой стратегии.',
        textEn: 'Percentage of profitable trades out of all closed. Above 55% is considered good for trading systems. We track it separately for each strategy.',
      },
      {
        icon: '💰',
        titleRu: 'Тейк-профиты и Стоп-лоссы',
        titleEn: 'Take Profits & Stop Losses',
        textRu: 'Кнопки "Тейк-профит" и "Стоп-лосс" открывают список всех закрытых сделок за 3 суток. Для каждой — монета, направление, точка входа, результат в %, длительность сделки.',
        textEn: 'The "Take Profit" and "Stop Loss" buttons open a list of all closed trades in the last 3 days. Each shows: coin, direction, entry, result in %, trade duration.',
      },
      {
        icon: '🤖',
        titleRu: 'AI-совет',
        titleEn: 'AI Council',
        textRu: 'Счётчик показывает сколько сигналов AI-совет заблокировал. Это важный показатель — AI отфильтровывает слабые паттерны, повышая Win Rate остальных сигналов.',
        textEn: 'Counter shows how many signals the AI council blocked. This is key — AI filters out weak patterns, boosting the Win Rate of remaining signals.',
      },
      {
        icon: '📊',
        titleRu: 'Стратегии',
        titleEn: 'Strategies',
        textRu: '📊 Volume + Level — объёмные аномалии + пробой ключевых уровней\n🔫 Multi Sniper — несколько подтверждений одновременно\n🌌 Nexus VWAP — отклонение от VWAP-канала\n🏛 Titan Fractal — фрактальные структуры на высоких таймфреймах',
        textEn: '📊 Volume + Level — volume anomalies + key level breakouts\n🔫 Multi Sniper — multiple simultaneous confirmations\n🌌 Nexus VWAP — deviation from VWAP channel\n🏛 Titan Fractal — fractal structures on high timeframes',
      },
    ],
  },
  {
    id: 'settings',
    icon: '⚙️',
    titleRu: 'Настройки',
    titleEn: 'Settings',
    color: '#f59e0b',
    items: [
      {
        icon: '🤖',
        titleRu: 'AI-совет (фильтр)',
        titleEn: 'AI Council (filter)',
        textRu: 'Включает/выключает AI-фильтрацию сигналов. При выключении — все сигналы от стратегий попадают в ленту без голосования. Полезно для теста, но снижает качество.\n\nРекомендуется держать включённым.',
        textEn: 'Enables/disables AI signal filtering. When off — all strategy signals appear without voting. Useful for testing but reduces quality.\n\nRecommended: keep enabled.',
      },
      {
        icon: '🔧',
        titleRu: 'Стратегии',
        titleEn: 'Strategies',
        textRu: 'Включение/выключение отдельных стратегий. Если какая-то стратегия давно не давала хороших результатов — можно временно отключить её и оставить только прибыльные.',
        textEn: 'Enable/disable individual strategies. If a strategy hasn\'t performed well lately — temporarily disable it and keep only profitable ones.',
      },
      {
        icon: '🔭',
        titleRu: 'Монет для скана',
        titleEn: 'Coins to scan',
        textRu: 'Количество монет которые каждая стратегия анализирует за один прогон. Больше монет = больше сигналов, но выше нагрузка. Диапазон 40–80 оптимален.',
        textEn: 'Number of coins each strategy analyzes per scan cycle. More coins = more signals but higher load. Range 40–80 is optimal.',
      },
    ],
  },
  {
    id: 'pro',
    icon: '💎',
    titleRu: 'Pro доступ',
    titleEn: 'Pro access',
    color: '#a78bfa',
    items: [
      {
        icon: '🎯',
        titleRu: 'Пробный период',
        titleEn: 'Trial period',
        textRu: 'После первого входа вы получаете 24 часа бесплатного Pro-доступа. Это время покажет все возможности приложения — живые сигналы, графики, AI-анализ. По окончании trial — нужна оплата.',
        textEn: 'After first login you get 24 hours of free Pro access. This shows all app features — live signals, charts, AI analysis. After the trial ends — payment required.',
      },
      {
        icon: '💳',
        titleRu: 'Оплата USDT',
        titleEn: 'USDT payment',
        textRu: 'Поддерживаем TRC-20 (Tron), ERC-20 (Ethereum) и BEP-20 (BSC).\n\n1. Выберите сеть\n2. Скопируйте адрес кошелька\n3. Отправьте ровно нужную сумму\n4. Активация через 1–5 минут автоматически',
        textEn: 'We support TRC-20 (Tron), ERC-20 (Ethereum) and BEP-20 (BSC).\n\n1. Choose network\n2. Copy wallet address\n3. Send the exact amount\n4. Automatic activation in 1–5 minutes',
      },
      {
        icon: '⭐',
        titleRu: 'Telegram Stars',
        titleEn: 'Telegram Stars',
        textRu: 'Нативная оплата внутри Telegram — самый быстрый способ. Stars можно купить прямо в Telegram.\n\n1. Выберите план\n2. Нажмите "Оплатить Stars"\n3. Подтвердите в Telegram\n4. Доступ открывается мгновенно',
        textEn: 'Native Telegram payment — fastest method. Stars can be purchased directly in Telegram.\n\n1. Choose a plan\n2. Tap "Pay with Stars"\n3. Confirm in Telegram\n4. Access unlocked instantly',
      },
      {
        icon: '🔔',
        titleRu: 'Уведомления об истечении',
        titleEn: 'Expiry reminders',
        textRu: 'Бот автоматически напоминает:\n• За 3 суток — ежедневно в Telegram\n• В последние 24 часа — всплывающее окно в приложении раз в час\n\nЧтобы не потерять доступ — продлите заблаговременно.',
        textEn: 'The bot reminds automatically:\n• 3 days before — daily Telegram message\n• Last 24 hours — in-app popup every hour\n\nRenew early to avoid losing access.',
      },
    ],
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function Guide() {
  const { lang, t } = useLang()
  const [openSection, setOpenSection] = useState<string | null>('signals')
  const [openItem, setOpenItem] = useState<string | null>(null)

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>{t('guideTitle')}</h2>
        <p style={s.subtitle}>{t('guideSubtitle')}</p>
      </div>

      {/* Sections */}
      {SECTIONS.map(section => {
        const isSectionOpen = openSection === section.id
        return (
          <div key={section.id} style={s.sectionWrap}>
            {/* Section header */}
            <button
              style={{
                ...s.sectionBtn,
                background: isSectionOpen
                  ? `linear-gradient(135deg, ${section.color}22, ${section.color}11)`
                  : 'rgba(255,255,255,0.04)',
                borderColor: isSectionOpen ? `${section.color}55` : 'rgba(255,255,255,0.08)',
              }}
              onClick={() => setOpenSection(isSectionOpen ? null : section.id)}
            >
              <span style={{ fontSize: 22 }}>{section.icon}</span>
              <span style={{ ...s.sectionTitle, color: isSectionOpen ? '#fff' : 'rgba(255,255,255,0.8)' }}>
                {lang === 'ru' ? section.titleRu : section.titleEn}
              </span>
              <span style={{ ...s.sectionCount, color: section.color }}>
                {section.items.length} {lang === 'ru' ? 'разд.' : 'topics'}
              </span>
              <span style={{ ...s.chevron, transform: isSectionOpen ? 'rotate(90deg)' : 'none' }}>›</span>
            </button>

            {/* Items */}
            {isSectionOpen && (
              <div style={s.itemsWrap}>
                {section.items.map((item, idx) => {
                  const itemKey = `${section.id}-${idx}`
                  const isOpen = openItem === itemKey
                  const title = lang === 'ru' ? item.titleRu : item.titleEn
                  const text = lang === 'ru' ? item.textRu : item.textEn

                  return (
                    <div key={itemKey} style={s.item}>
                      <button
                        style={s.itemBtn}
                        onClick={() => setOpenItem(isOpen ? null : itemKey)}
                      >
                        <span style={s.itemIcon}>{item.icon}</span>
                        <span style={s.itemTitle}>{title}</span>
                        <span style={{
                          ...s.chevron,
                          color: section.color,
                          transform: isOpen ? 'rotate(90deg)' : 'none',
                          fontSize: 16,
                        }}>›</span>
                      </button>

                      {isOpen && (
                        <div style={s.itemBody}>
                          {item.visual && (
                            <div style={{
                              ...s.visual,
                              border: `1px solid ${section.color}33`,
                            }}>
                              {item.visual}
                            </div>
                          )}
                          {text.split('\n').map((line, li) => (
                            line.trim() === ''
                              ? <div key={li} style={{ height: 6 }} />
                              : <p key={li} style={s.textLine}>{line}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  header: {
    textAlign: 'center',
    padding: '8px 0 20px',
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    margin: '0 0 4px',
    background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: 13,
    color: '#8b949e',
    margin: 0,
  },
  sectionWrap: {
    marginBottom: 10,
  },
  sectionBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    border: '1px solid',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left' as const,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: 600,
  },
  chevron: {
    fontSize: 20,
    color: '#8b949e',
    transition: 'transform 0.2s',
    fontWeight: 300,
  },
  itemsWrap: {
    marginTop: 4,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  item: {
    borderRadius: 12,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  itemBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  itemIcon: {
    fontSize: 18,
    width: 26,
    textAlign: 'center' as const,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    color: '#e6edf3',
  },
  itemBody: {
    padding: '0 14px 14px 50px',
  },
  visual: {
    borderRadius: 10,
    padding: '8px 10px',
    marginBottom: 10,
    background: 'rgba(0,0,0,0.3)',
  },
  textLine: {
    fontSize: 13,
    color: '#8b949e',
    margin: '0 0 2px',
    lineHeight: 1.55,
  },
}
