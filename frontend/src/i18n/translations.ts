export type Lang = 'ru' | 'en'

export const T = {
  ru: {
    // Nav
    navSignals:    'Сигналы',
    navStats:      'Статистика',
    navPro:        'Pro',
    navSettings:   'Настройки',
    navGuide:      'Гайд',

    // Dashboard filters
    filterAll:     'Все',
    filterOpen:    'Открытые',
    filterWin:     'Тейк',
    filterLoss:    'Стоп',
    noSignals:     'Нет сигналов',
    live:          'Лайв',
    off:           'Офлайн',

    // SignalCard
    entry:         'Вход',
    stop:          'Стоп',
    take:          'Тейк',
    chart:         '📈 График',
    analysis:      'Анализ',

    // Stats
    statsTitle:       'Статистика',
    totalSignals:     'Всего сигналов',
    winRate:          'Win Rate',
    takeProfit:       'Тейк-профит',
    stopLoss:         'Стоп-лосс',
    openPositions:    'Открытые',
    totalPnl:         'Суммарный P&L',
    aiBlocked:        'AI Совет заблокировал',
    aiBlockedSuffix:  'сигналов',
    byStrategy:       'По стратегиям',
    historyTitle:     '📋 История сигналов',
    historyLast3:     'За последние 3 суток',
    historyTake:      '🟢 Тейк',
    historyStop:      '🔴 Стоп-лоссы',
    noHistory:        'Нет сигналов за 3 суток',
    tapArrow:         'tap →',

    // Detail
    direction:     'Направление',
    status:        'Статус',
    entryPrice:    'Точка входа',
    aiAnalysis:    '🤖 AI анализ',
    statusOpen:    '🔵 Открыт',
    statusWin:     '🟢 TP',
    statusLoss:    '🔴 SL',

    // Settings
    settingsTitle:     'Настройки',
    aiCouncil:         'AI Совет',
    filterViaAI:       'Фильтровать через AI',
    strategies:        'Стратегии',
    coinsToScan:       'Монет для скана',
    save:              'Сохранить',
    saved:             '✓ Сохранено',

    // Pro page
    proSubtitle:       'Профессиональный инструмент для крипто-трейдера',
    proActive:         'Pro активен',
    trialPeriod:       'Пробный период · осталось',
    hours:             'ч',
    whatsIncluded:     'Что входит в Pro',
    getPro:            '⚡ Получить Pro',
    payNote:           'Оплата USDT или Telegram Stars · Активация 1-5 мин',
    subActive:         '✅ Подписка активна',
    accessUntil:       'Доступ открыт до',
    renewSub:          '🔄 Продлить подписку',

    // Pro features
    feat1t: 'Сигналы в реальном времени',
    feat1d: 'Авто-сканер каждые 5 минут по 20+ торговым парам',
    feat2t: 'AI-фильтрация сигналов',
    feat2d: 'Несколько моделей (GPT-4, Claude, Gemini) голосуют за каждый сигнал',
    feat3t: 'Живые графики',
    feat3d: 'Свечи, CVD, Volume Profile, зоны спроса и предложения',
    feat4t: 'Карта плотностей',
    feat4d: 'Тепловая карта объёмов — видишь где крупный игрок',
    feat5t: 'Полная статистика',
    feat5d: 'Win Rate, P&L, история Тейк-профитов и Стоп-лоссов',
    feat6t: 'Push-уведомления',
    feat6d: 'Каждый новый сигнал — мгновенно в Telegram',
    feat7t: 'Без ограничений',
    feat7d: 'Все инструменты, все монеты, все таймфреймы',
    feat8t: 'Ранний доступ',
    feat8d: 'Новые функции — сначала для Pro-пользователей',

    // Paywall
    paywallTitle:    '⚡ MarketPulse Pro',
    plansLabel:      'Способ оплаты',
    autoActivation:  '✅ Активация автоматическая\nОбычно 1-5 минут после отправки.\nУведомление придёт в Telegram.',
    checkPayment:    '🔄 Проверить оплату',
    copyAddress:     '📋 Скопировать адрес',
    copied:          'Скопировано!',
    payStars:        '⭐ Оплата Telegram Stars',
    payAmount:       'К ОПЛАТЕ',
    network:         'Сеть',
    starsFor:        'Stars за',
    payWith:         '⭐ Оплатить',
    stars:           'Stars',
    creatingInvoice: 'Создаём счёт...',
    starsNote:       'Нативная оплата внутри Telegram. Быстро и безопасно.',

    // Expiry popup
    expiryTitle:   'Подписка скоро истекает',
    expiryLeft:    'До окончания осталось',
    expirySub:     'Продлите сейчас — не теряйте доступ к сигналам',
    expiryRenew:   '⚡ Продлить подписку',
    expiryLater:   'Напомнить через час',

    // Guide
    guideTitle:    'Руководство',
    guideSubtitle: 'Как пользоваться MarketPulse Pro',
  },

  en: {
    // Nav
    navSignals:    'Signals',
    navStats:      'Statistics',
    navPro:        'Pro',
    navSettings:   'Settings',
    navGuide:      'Guide',

    // Dashboard filters
    filterAll:     'ALL',
    filterOpen:    'OPEN',
    filterWin:     'WIN',
    filterLoss:    'LOSS',
    noSignals:     'No signals',
    live:          'Live',
    off:           'Off',

    // SignalCard
    entry:         'Entry',
    stop:          'Stop',
    take:          'Take',
    chart:         '📈 Chart',
    analysis:      'Analysis',

    // Stats
    statsTitle:       'Statistics',
    totalSignals:     'Total Signals',
    winRate:          'Win Rate',
    takeProfit:       'Take Profit',
    stopLoss:         'Stop Loss',
    openPositions:    'Open',
    totalPnl:         'Total P&L',
    aiBlocked:        'AI Council blocked',
    aiBlockedSuffix:  'signals',
    byStrategy:       'By Strategy',
    historyTitle:     '📋 Signal History',
    historyLast3:     'Last 3 days',
    historyTake:      '🟢 Take Profit',
    historyStop:      '🔴 Stop Losses',
    noHistory:        'No signals in the last 3 days',
    tapArrow:         'tap →',

    // Detail
    direction:     'Direction',
    status:        'Status',
    entryPrice:    'Entry Price',
    aiAnalysis:    '🤖 AI Analysis',
    statusOpen:    '🔵 Open',
    statusWin:     '🟢 TP',
    statusLoss:    '🔴 SL',

    // Settings
    settingsTitle:     'Settings',
    aiCouncil:         'AI Council',
    filterViaAI:       'Filter via AI',
    strategies:        'Strategies',
    coinsToScan:       'Coins to scan',
    save:              'Save',
    saved:             '✓ Saved',

    // Pro page
    proSubtitle:       'Professional tool for crypto traders',
    proActive:         'Pro active',
    trialPeriod:       'Trial period · left',
    hours:             'h',
    whatsIncluded:     "What's included in Pro",
    getPro:            '⚡ Get Pro',
    payNote:           'Pay via USDT or Telegram Stars · Activation 1-5 min',
    subActive:         '✅ Subscription active',
    accessUntil:       'Access valid until',
    renewSub:          '🔄 Renew subscription',

    // Pro features
    feat1t: 'Real-time signals',
    feat1d: 'Auto-scanner every 5 min across 20+ trading pairs',
    feat2t: 'AI signal filtering',
    feat2d: 'Multiple models (GPT-4, Claude, Gemini) vote on each signal',
    feat3t: 'Live charts',
    feat3d: 'Candles, CVD, Volume Profile, supply & demand zones',
    feat4t: 'Volume heatmap',
    feat4d: 'See where the big players are accumulating',
    feat5t: 'Full statistics',
    feat5d: 'Win Rate, P&L, Take Profit and Stop Loss history',
    feat6t: 'Push notifications',
    feat6d: 'Every new signal instantly in Telegram',
    feat7t: 'No limits',
    feat7d: 'All tools, all coins, all timeframes',
    feat8t: 'Early access',
    feat8d: 'New features — Pro users get them first',

    // Paywall
    paywallTitle:    '⚡ MarketPulse Pro',
    plansLabel:      'Payment method',
    autoActivation:  '✅ Activation is automatic\nUsually 1-5 minutes after sending.\nYou will receive a Telegram notification.',
    checkPayment:    '🔄 Check payment',
    copyAddress:     '📋 Copy address',
    copied:          'Copied!',
    payStars:        '⭐ Telegram Stars Payment',
    payAmount:       'AMOUNT DUE',
    network:         'Network',
    starsFor:        'Stars for',
    payWith:         '⭐ Pay',
    stars:           'Stars',
    creatingInvoice: 'Creating invoice...',
    starsNote:       'Native Telegram payment. Fast and secure.',

    // Guide
    guideTitle:    'User Guide',
    guideSubtitle: 'How to use MarketPulse Pro',

    // Expiry popup
    expiryTitle:   'Subscription expiring soon',
    expiryLeft:    'Time remaining',
    expirySub:     'Renew now — keep access to signals',
    expiryRenew:   '⚡ Renew subscription',
    expiryLater:   'Remind me in an hour',
  },
} as const

export type TranslationKey = keyof typeof T.ru
