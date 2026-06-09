# 📊 MarketPulse Pro — Crypto AI Signals

> AI-powered crypto trading signals with live charts, CVD analysis, and smart signal filtering.
> Available as a **Telegram Mini App** and a standalone **Web Application** with email registration.

![platform](https://img.shields.io/badge/Platform-Web_+_Telegram-2CA5E0?style=for-the-badge&logo=telegram)
![stack](https://img.shields.io/badge/Stack-React_+_FastAPI-61DAFB?style=for-the-badge)
![license](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## ✨ Features

### 🌐 Web Application (new)
- Standalone website — works without Telegram
- **Email + password** registration
- JWT authentication (7-day tokens stored in `localStorage`)
- Premium dashboard: collapsible sidebar, access status card, user card
- **USDT pair search** — filter signals by ticker in real time
- Stats summary row: Total / Open / Win / Loss / Win Rate
- Colored filter chips with open-signal count badge
- Responsive: desktop sidebar + mobile bottom nav
- Landing page with hero, feature grid, pricing table
- Shared `web_users` table — USDT payments work for web users too

### 📡 Trading Signals
- Real-time BUY / SELL signals with Entry, Stop-Loss, and Take-Profit levels
- Multi-asset: BTC, ETH, SOL, BNB, XRP, DOGE and 80+ more pairs
- 4 independent strategies scanning in parallel (30-min intervals)
- **AI Council** — 3 models vote on each signal (Claude, GPT-4o, Gemini Flash)
- **Signal Quality Gate** — cooldown, R:R filter, HTF trend alignment before AI
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
- **Cumulative Volume Delta (CVD)** — buy vs sell pressure sub-chart
- **Volume Profile** — left-side POC / VAH / VAL levels
- **Supply & Demand zones** — canvas overlay
- **Heatmap** 🔥 — price-time volume density map (toggle button)
- Live price from Binance Futures (updates every 5s)

### 🔬 Technical Analysis Panel
- Per-signal "Analysis" button → full bottom sheet breakdown
- Strategy explanation (what pattern was detected and why)
- Key levels with % distance and R:R quality score
- Visual indicator gauges: RSI, ADX, Volume ratio with context notes
- **CVD Sparkline** — SVG chart of cumulative delta for last 60 candles
  - Confirmation badge: ✓ Подтверждает / ⚠ Противоречит signal direction
  - Stats: start / current / change values in thousands
  - Context explanation: buyer/seller dominance vs signal direction
- AI Council votes with model reasoning

### 📊 Statistics
- Win Rate, total signals, P&L summary
- Take-Profit history — list of winning signals (last 3 days)
- Stop-Loss history — list of losing signals (last 3 days)
- Performance breakdown by strategy

### 📖 Built-in Guide
- Interactive accordion guide for every section of the app
- SVG illustrations for each indicator: CVD, Volume Profile, Supply/Demand, Heatmap
- Available in RU and EN

### 🌍 RU / EN Language Support
- Full UI translation via React Context
- Persisted in `localStorage`
- Switcher in header (Mini App) and signal feed top bar (Web)

### 🔐 Access & Payments
- **24-hour free trial** — no registration required (Mini App) or email only (Web)
- **USDT crypto payments**: TRC-20, ERC-20, BEP-20 (works for Telegram and Web users)
- **Telegram Stars** — native in-app payment (Mini App only)
- Automatic payment verification via TronGrid API
- Expiry reminders: bot message 3 days before, hourly popup in last 24h
- Sidebar access card shows days remaining / trial countdown

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
├── api/                          # FastAPI backend
│   ├── main.py                   # App entry + WebSocket + TP/SL price monitor
│   ├── auth_deps.py              # JWT encode/decode, bcrypt, get_current_web_user
│   ├── database.py
│   ├── models.py
│   └── routers/
│       ├── auth.py               # /auth/register, /auth/login, /auth/me
│       ├── signals.py
│       ├── stats.py
│       ├── chart.py              # OHLCV + CVD delta + Volume Profile + S&D zones
│       ├── access.py             # Trial / USDT payment for Telegram + Web users
│       ├── stars.py              # Telegram Stars payment
│       └── admin.py              # Admin panel API
│
├── crypto_bot/                   # Signal scanner (runs as separate process)
│   ├── main.py                   # BotRunner threads for each strategy
│   ├── config.py                 # Strategy parameters & thresholds
│   ├── pandas_ta.py              # pandas_ta compatibility shim (uses `ta` lib)
│   ├── core/
│   │   ├── ai_council.py         # Multi-model voting with rich context prompt
│   │   ├── signal_gate.py        # Cooldown + R:R + HTF trend filter
│   │   ├── signal_db.py          # Shared SQLite writer
│   │   ├── tracker.py            # Open trade TP/SL tracking
│   │   ├── exchange.py           # ccxt Binance wrapper
│   │   └── telegram.py           # Telegram notification sender
│   └── strategies/
│       ├── base.py
│       ├── volume_level.py
│       ├── multi.py
│       ├── vwap_channel.py
│       └── fractal.py
│
├── frontend/                     # React + Vite + TypeScript
│   ├── index.html                # Mini App entry
│   ├── website.html              # Web App entry (dual Vite build)
│   └── src/
│       ├── components/
│       │   ├── LiveChart.tsx           # Full-screen chart (LWC v5)
│       │   ├── HeatmapChart.tsx        # Volume heatmap canvas
│       │   ├── TechAnalysis.tsx        # Analysis panel + CVD sparkline
│       │   ├── Paywall.tsx             # Plans + USDT + Stars
│       │   ├── ExpiryPopup.tsx         # Expiry reminder popup
│       │   └── SignalCard.tsx          # Signal card with smart price format
│       ├── hooks/
│       │   ├── useAccess.ts            # Telegram access hook
│       │   ├── useWebAccess.ts         # JWT-authenticated access hook
│       │   └── useSignalFeed.ts        # WS feed (init/new/update events)
│       ├── i18n/
│       │   ├── translations.ts
│       │   └── LangContext.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx           # Mini App signal feed
│       │   ├── Stats.tsx
│       │   ├── Pro.tsx
│       │   ├── Guide.tsx               # Interactive guide with SVG illustrations
│       │   └── Settings.tsx
│       ├── web/                        # Web App (standalone website)
│       │   ├── main.tsx                # Web entry point
│       │   ├── WebApp.tsx              # React Router root
│       │   ├── AuthContext.tsx         # JWT state: login/register/logout
│       │   ├── components/
│       │   │   ├── Navbar.tsx          # Top nav for public pages
│       │   │   ├── ProtectedRoute.tsx  # Redirect to /login if unauthenticated
│       │   │   └── WebSignalFeed.tsx   # Signal feed with search + stats
│       │   └── pages/
│       │       ├── LandingPage.tsx     # Hero + features + pricing
│       │       ├── LoginPage.tsx       # Email + password login
│       │       ├── RegisterPage.tsx    # Registration form
│       │       └── WebDashboard.tsx    # Premium sidebar dashboard
│       └── admin/                      # Admin panel (/admin route)
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
# Fill in .env with your tokens, wallet addresses, keys
```

### 2. Backend

```bash
pip3 install python-dotenv python-multipart fastapi uvicorn ccxt pandas ta \
             python-jose bcrypt httpx python-telegram-bot
uvicorn api.main:app --port 8000 --reload
```

### 3. Signal Bot

```bash
pip3 install ccxt pandas ta requests
python3 crypto_bot/main.py
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

| URL | What |
|-----|------|
| `http://localhost:5173` | Telegram Mini App |
| `http://localhost:5173/website.html` | Web Application |
| `http://localhost:5173/admin` | Admin Panel |

### 5. Register Telegram webhook (after deploy)

```bash
curl -X POST https://your-domain.com/stars/set-webhook
```

---

## ⚙️ Environment Variables

```env
# ── Wallet addresses ──────────────────────────────────────────────
USDT_WALLET_TRC20=your_trc20_address
USDT_WALLET_BEP20=your_bep20_address
USDT_WALLET_ERC20=your_erc20_address

# ── Subscription prices (USDT) ────────────────────────────────────
PRICE_1M=19.99
PRICE_3M=50.97
PRICE_6M=89.94

# ── Trial ─────────────────────────────────────────────────────────
TRIAL_HOURS=24

# ── Telegram Bot ──────────────────────────────────────────────────
BOT_TOKEN=123456:ABC-your-token
WEBHOOK_URL=https://your-domain.com

# ── Admin Panel ───────────────────────────────────────────────────
ADMIN_TOKEN=your_strong_password

# ── OpenRouter (AI Council) ───────────────────────────────────────
OPENROUTER_API_KEY=sk-or-...

# ── TronGrid API (optional) ───────────────────────────────────────
TRONGRID_API_KEY=

# ── Web Auth (JWT) ────────────────────────────────────────────────
# Generate: python3 -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=change_me_strong_random_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

Frontend `.env` (create `frontend/.env`):
```env
VITE_API_URL=http://localhost:8000
```

---

## 🔌 API Reference

### Auth (Web)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register with email + password |
| `POST` | `/auth/login` | Login, returns JWT |
| `GET` | `/auth/me` | Get current user profile |

### Access
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/access/check` | Telegram user access status |
| `POST` | `/access/trial` | Start Telegram trial |
| `GET` | `/access/web/check` | Web user access status (JWT) |
| `POST` | `/access/web/trial` | Start web trial (JWT) |
| `GET` | `/access/web/payment-info` | Payment details for web user (JWT) |

### Signals & Charts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/signals` | List trading signals |
| `GET` | `/chart/{symbol}` | OHLCV + CVD delta + Volume Profile |
| `GET` | `/stats/summary` | Overall statistics |
| `GET` | `/stats/strategies` | Per-strategy breakdown |
| `WS` | `/ws/signals` | Live feed (init / new / update) |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/admin/login` | Admin login |
| `GET` | `/admin/users` | List all users |
| `POST` | `/admin/users/{id}/vip` | Grant/revoke VIP |
| `POST` | `/admin/broadcast` | Send broadcast message |

---

## 📦 Tech Stack

**Frontend**
- React 18 + TypeScript + Vite (dual entry: Mini App + Website)
- React Router v6 (website routing)
- LightweightCharts v5 (TradingView)
- React Context: i18n (RU/EN) + Auth (JWT)

**Backend**
- FastAPI + Uvicorn
- SQLite (`sqlite3`) — tables: `signals`, `users`, `web_users`, `payments`
- ccxt — Binance Futures OHLCV + live price monitoring
- python-jose — JWT tokens
- bcrypt — password hashing
- python-telegram-bot v21
- httpx — async HTTP (Google token verify, TronGrid)

**Signal Bot**
- ccxt — market data
- pandas + ta — technical indicators (RSI, ADX, EMA, VWAP, Bollinger Bands)
- OpenRouter — Claude / GPT-4o / Gemini parallel AI voting

**Integrations**
- Binance Futures API — live prices & OHLCV data
- TronGrid API — TRC-20 USDT payment verification
- Telegram Bot API — Stars payments, notifications, broadcasts
- OpenRouter — multi-model AI signal analysis

---

## 📄 License

MIT © 2026
