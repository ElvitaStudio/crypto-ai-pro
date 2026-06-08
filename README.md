# 📊 MarketPulse Pro — Telegram Mini App

> AI-powered crypto trading signals with live charts, volume analysis, and smart signal filtering — delivered as a Telegram Mini App with paid access via USDT or Telegram Stars.

![preview](https://img.shields.io/badge/Platform-Telegram_Mini_App-2CA5E0?style=for-the-badge&logo=telegram)
![stack](https://img.shields.io/badge/Stack-React_+_FastAPI-61DAFB?style=for-the-badge)
![license](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## ✨ Features

### 📡 Trading Signals
- Real-time BUY / SELL signals with Entry, Stop-Loss, and Take-Profit levels
- Multi-asset: BTC, ETH, SOL, BNB, XRP, DOGE and 80+ more pairs
- 4 independent strategies scanning in parallel (30-min intervals)
- **AI Council** — 3 models vote on each signal (Claude, GPT-4o, Gemini Flash)
- **Signal Quality Gate** — cooldown, R:R filter, and HTF trend alignment before AI
- Auto-close at TP/SL with WebSocket real-time status updates

### 📊 Signal Quality Pipeline
```
Strategy scan → Quality Gate → AI Council → Signal saved → WebSocket push
                  ↓                ↓
           [cooldown 4h]    [3 models vote]
           [R:R ≥ 2.0]      [majority wins]
           [HTF trend 1h]   [prompt w/ indicators]
```

### 📈 Live Charts
- Full-screen interactive candlestick charts powered by **LightweightCharts v5**
- **Cumulative Volume Delta (CVD)** — see buy vs sell pressure
- **Volume Profile** — left-side POC / VAH / VAL levels
- **Supply & Demand zones** — canvas overlay
- **Heatmap** 🔥 — price-time volume density map (toggle button)
- Live price from Binance Futures (updates every 5s)

### 🔬 Technical Analysis Panel
- Per-signal "Analysis" button → full bottom sheet breakdown
- Strategy explanation (what pattern was detected and why)
- Key levels with % distance and R:R quality score
- Visual indicator gauges: RSI, ADX, Volume ratio with context notes
- AI Council votes with model reasoning

### 📊 Statistics
- Win Rate, total signals, P&L summary
- **Take-Profit history** — list of winning signals (last 3 days)
- **Stop-Loss history** — list of losing signals (last 3 days)
- Performance breakdown by strategy

### 📖 Built-in Guide
- Interactive accordion guide for every section of the app
- SVG illustrations for each indicator: CVD, Volume Profile, Supply/Demand, Heatmap
- Available in RU and EN

### 🌐 RU / EN Language Support
- Full UI translation via React Context
- Persisted in `localStorage`
- Switcher in the top-right of the dashboard

### 🔐 Access & Payments
- **24-hour free trial** on first open — no registration
- **USDT crypto payments**: TRC-20, ERC-20, BEP-20
- **Telegram Stars** — native in-app payment (instant, no crypto needed)
- Automatic payment verification via TronGrid API
- Expiry reminders: bot message 3 days before, hourly popup in last 24h
- Blinking FREE / PRO badge in header → taps to Pro page

### 💎 Subscription Plans
| Plan | Price | Stars |
|------|-------|-------|
| 1 month | $19.99 | 999 ⭐ |
| 3 months | $50.97 (-15% 🔥) | 2499 ⭐ |
| 6 months | $89.94 (-25% 💎) | 4499 ⭐ |

### ⚙️ Admin Panel (`/admin`)
- **Users** — full list with Telegram ID, @username, VIP status and expiry
- **VIP management** — grant access for any user for any number of days
- **Broadcast** — send to all or selected users with up to 5 file attachments
- **Payment settings** — manage payment methods and wallet addresses
- Password-protected with show/hide toggle

---

## 🤖 Signal Quality System

### 4 Strategies

| Strategy | Timeframe | What it detects |
|----------|-----------|-----------------|
| 📊 Volume + Level | 5m/15m | Volume anomaly (5×) + 24h level breakout |
| 🔫 Multi Sniper | 15m | BB breakout, trend pullback, SFP liquidity sweep |
| 🌌 Nexus VWAP | 15m | Statistical deviation from VWAP channel |
| 🏛 Titan Fractal | 15m | Fractal level retest with strong candle confirmation |

### Signal Gate (pre-AI filter)

Before any signal reaches the AI Council it must pass:

1. **Cooldown** — same symbol cannot generate a new signal within 4 hours
2. **Minimum R:R** — reward must be ≥ 2× the risk
3. **HTF Trend** — 1h EMA-50 filter: LONGs only when price > EMA, SHORTs only when price < EMA

### AI Council

3 models vote in parallel via OpenRouter:
- `anthropic/claude-haiku-4-5`
- `openai/gpt-4o-mini`
- `google/gemini-flash-2.0`

Prompt includes: entry/SL/TP with %, R:R ratio, RSI, ADX, volume ratio, HTF trend alignment note.
Strict majority (2/3) required to approve.

---

## 🏗 Architecture

```
Crypto/
├── api/                        # FastAPI backend
│   ├── main.py                 # App entry + WebSocket + TP/SL price monitor
│   ├── database.py
│   ├── models.py
│   └── routers/
│       ├── signals.py
│       ├── stats.py
│       ├── chart.py            # OHLCV + Volume Profile + S&D zones
│       ├── access.py           # Trial / USDT payment / expiry reminders
│       ├── stars.py            # Telegram Stars payment
│       └── admin.py            # Admin panel API
│
├── crypto_bot/                 # Signal scanner (runs as separate process)
│   ├── main.py                 # BotRunner threads for each strategy
│   ├── config.py               # Strategy parameters & thresholds
│   ├── pandas_ta.py            # pandas_ta compatibility shim (uses `ta` lib)
│   ├── core/
│   │   ├── ai_council.py       # Multi-model voting with rich context prompt
│   │   ├── signal_gate.py      # Cooldown + R:R + HTF trend filter
│   │   ├── signal_db.py        # Shared SQLite writer
│   │   ├── tracker.py          # Open trade TP/SL tracking
│   │   ├── exchange.py         # ccxt Binance wrapper
│   │   └── telegram.py         # Telegram notification sender
│   └── strategies/
│       ├── base.py
│       ├── volume_level.py     # RSI/ADX/vol features → AI
│       ├── multi.py            # BB + EMA + SFP patterns
│       ├── vwap_channel.py     # VWAP + LinReg channel
│       └── fractal.py          # Fractal levels + RSI/ADX features
│
├── frontend/                   # React + Vite + TypeScript Mini App
│   └── src/
│       ├── components/
│       │   ├── LiveChart.tsx         # Full-screen chart (LWC v5)
│       │   ├── HeatmapChart.tsx      # Volume heatmap canvas
│       │   ├── TechAnalysis.tsx      # Technical analysis bottom sheet
│       │   ├── Paywall.tsx           # Plans + USDT + Stars
│       │   ├── ExpiryPopup.tsx       # Hourly expiry reminder popup
│       │   └── SignalCard.tsx        # Signal feed card with smart price format
│       ├── hooks/
│       │   ├── useAccess.ts
│       │   └── useSignalFeed.ts      # WS feed (init/new/update events)
│       ├── i18n/
│       │   ├── translations.ts       # RU + EN string table
│       │   └── LangContext.tsx       # Language context + localStorage persist
│       ├── pages/
│       │   ├── Dashboard.tsx         # Signal feed with filter buttons
│       │   ├── Stats.tsx             # Statistics + signal history modal
│       │   ├── Pro.tsx               # Pro features + pricing + CTA
│       │   ├── Guide.tsx             # Interactive guide with SVG illustrations
│       │   └── Settings.tsx
│       └── admin/                    # Admin panel (/admin route)
│
├── data/
│   └── signals.db
├── .env
└── .env.example
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Telegram Bot ([@BotFather](https://t.me/BotFather))
- OpenRouter API key (for AI council)

### 1. Clone & configure

```bash
git clone https://github.com/ElvitaStudio/crypto-ai-pro.git
cd crypto-ai-pro
cp .env.example .env
# Fill in .env with your tokens, wallet addresses, OpenRouter key
```

### 2. Backend

```bash
pip install -r api/requirements.txt
pip install python-dotenv python-multipart ccxt pandas ta
uvicorn api.main:app --port 8000
```

### 3. Signal Bot

```bash
pip install -r crypto_bot/requirements.txt
python3 crypto_bot/main.py
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

- Mini App → [http://localhost:5173](http://localhost:5173)
- Admin Panel → [http://localhost:5173/admin](http://localhost:5173/admin)

### 5. Register Telegram webhook (after deploy)

```bash
curl -X POST https://your-domain.com/stars/set-webhook
```

---

## ⚙️ Environment Variables

```env
# Wallet addresses
USDT_WALLET_TRC20=your_trc20_address
USDT_WALLET_BEP20=your_bep20_address
USDT_WALLET_ERC20=your_erc20_address

# Subscription prices (USDT)
PRICE_1M=19.99
PRICE_3M=50.97
PRICE_6M=89.94

# Trial
TRIAL_HOURS=24

# Telegram Bot
BOT_TOKEN=123456:ABC-your-token
WEBHOOK_URL=https://your-domain.com

# Admin Panel
ADMIN_TOKEN=your_strong_password

# OpenRouter (AI Council)
OPENROUTER_API_KEY=sk-or-...

# TronGrid (optional, increases rate limit)
TRONGRID_API_KEY=
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/signals` | List trading signals |
| `GET` | `/stats/summary` | Overall statistics |
| `GET` | `/stats/strategies` | Per-strategy breakdown |
| `GET` | `/access/check` | Check user access + hours until expiry |
| `POST` | `/access/trial` | Start free trial |
| `GET` | `/access/payment-info` | Get USDT payment details |
| `POST` | `/stars/invoice` | Create Telegram Stars invoice |
| `POST` | `/webhook/telegram` | Telegram bot webhook |
| `POST` | `/admin/login` | Admin login |
| `GET` | `/admin/users` | List all users |
| `POST` | `/admin/users/{id}/vip` | Grant/revoke VIP |
| `POST` | `/admin/broadcast` | Send broadcast message |
| `GET/POST/PUT/DELETE` | `/admin/payment-methods` | Manage payment methods |
| `WS` | `/ws/signals` | Live signal feed (init / new / update events) |

---

## 📦 Tech Stack

**Frontend**
- React 18 + TypeScript + Vite
- LightweightCharts v5 (TradingView)
- React Context i18n (RU/EN)

**Backend**
- FastAPI + Uvicorn
- SQLite (stdlib `sqlite3`)
- ccxt — Binance Futures OHLCV + price monitoring
- python-telegram-bot v21
- python-dotenv

**Signal Bot**
- ccxt — market data
- pandas + ta (technical indicators)
- OpenRouter — Claude / GPT-4o / Gemini AI voting

**Integrations**
- Binance Futures API — live prices & OHLCV
- TronGrid API — TRC-20 payment verification
- Telegram Bot API — Stars payments + notifications + broadcasts
- OpenRouter — multi-model AI signal analysis

---

## 📄 License

MIT © 2026
