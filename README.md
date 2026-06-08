# 📊 MarketPulse Pro — Telegram Mini App

> AI-powered crypto trading signals with live charts, volume analysis, and smart filtering — delivered as a Telegram Mini App with paid access via USDT or Telegram Stars.

![preview](https://img.shields.io/badge/Platform-Telegram_Mini_App-2CA5E0?style=for-the-badge&logo=telegram)
![stack](https://img.shields.io/badge/Stack-React_+_FastAPI-61DAFB?style=for-the-badge)
![license](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## ✨ Features

### 📡 Trading Signals
- Real-time BUY / SELL signals with Entry, Stop-Loss, and Take-Profit levels
- Multi-asset: BTC, ETH, SOL, BNB, XRP, DOGE and more
- AI analysis via OpenRouter (multi-model — GPT-4, Claude, Gemini)
- Auto-scanner every 5 minutes

### 📈 Live Charts
- Full-screen interactive candlestick charts powered by **LightweightCharts v5**
- **Cumulative Volume Delta (CVD)** as candlestick overlay — see who's in control
- **Volume Profile** — left-side POC / VAH / VAL levels
- **Supply & Demand zones** — canvas overlay with fractals
- **Heatmap** 🔥 — price-time volume density map (toggle button)
- Live price from Binance Futures (updates every 5s)

### 📊 Statistics
- Win Rate, total signals, P&L summary
- **Take-Profit history** — tap card → full list of winning signals for last 3 days
- **Stop-Loss history** — tap card → full list of losing signals for last 3 days
- Signal detail sheet: Entry / TP / SL / P&L / AI summary
- Filter tabs: All / Open / TP / SL
- Performance breakdown by strategy

### 🔐 Access & Payments
- **24-hour free trial** on first open — no registration
- **USDT crypto payments**: TRC-20, ERC-20, BEP-20
- **Telegram Stars** — native in-app payment (instant, no crypto needed)
- Automatic payment verification via TronGrid API
- Unique sub-cent amount per user (no memo needed for TRC-20)
- Countdown banner during trial (turns red under 3 hours)

### 💎 Subscription Plans
| Plan | Price | Stars |
|------|-------|-------|
| 1 month | $19.99 | 999 ⭐ |
| 3 months | $50.97 (-15% 🔥) | 2499 ⭐ |
| 6 months | $89.94 (-25% 💎) | 4499 ⭐ |

### ⚙️ Admin Panel (`/admin`)
- **Users** — full list with Telegram ID, @username, VIP status and expiry date
- **VIP management** — grant or revoke access for any user for any number of days
- **Broadcast** — send messages to all or selected users with up to 5 file attachments (HTML supported)
- **Payment settings** — add, edit, enable/disable, delete payment methods and wallet addresses
- Password-protected login with show/hide password toggle

---

## 🏗 Architecture

```
Crypto/
├── api/                        # FastAPI backend
│   ├── main.py                 # App entry point + WebSocket + dotenv
│   ├── database.py             # SQLite connection helper
│   ├── models.py               # Pydantic models
│   └── routers/
│       ├── signals.py          # Trading signals CRUD
│       ├── stats.py            # Performance statistics
│       ├── chart.py            # OHLCV + indicator data
│       ├── access.py           # Trial / USDT payment / access control
│       ├── stars.py            # Telegram Stars payment + webhook
│       └── admin.py            # Admin panel API (users, broadcast, payments)
│
├── frontend/                   # React + Vite + TypeScript Mini App
│   └── src/
│       ├── components/
│       │   ├── LiveChart.tsx         # Full-screen chart (LWC v5)
│       │   ├── HeatmapChart.tsx      # Volume heatmap canvas
│       │   ├── Paywall.tsx           # Plans + USDT + Stars payments
│       │   └── SignalCard.tsx        # Signal feed card
│       ├── hooks/
│       │   └── useAccess.ts          # Trial/paid access state
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Stats.tsx             # Stats + signal history modal
│       │   └── Settings.tsx
│       └── admin/                    # Admin panel (route: /admin)
│           ├── AdminApp.tsx
│           ├── AdminLogin.tsx
│           ├── AdminLayout.tsx
│           └── pages/
│               ├── UsersPage.tsx
│               ├── BroadcastPage.tsx
│               └── PaymentSettingsPage.tsx
│
├── data/
│   └── signals.db              # SQLite database
├── .env                        # Secrets (not committed)
└── .env.example                # Environment variables template
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Telegram Bot ([@BotFather](https://t.me/BotFather))

### 1. Clone & configure

```bash
git clone https://github.com/ElvitaStudio/crypto-ai-pro.git
cd crypto-ai-pro
cp .env.example .env
# Fill in .env with your tokens and wallet addresses
```

### 2. Backend

```bash
pip install -r api/requirements.txt
pip install python-dotenv python-multipart python-telegram-bot
uvicorn api.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

- Mini App → [http://localhost:5173](http://localhost:5173)
- Admin Panel → [http://localhost:5173/admin](http://localhost:5173/admin)

### 4. Register Telegram webhook (after deploy)

```bash
curl -X POST https://your-domain.com/stars/set-webhook
```

---

## ⚙️ Environment Variables

Create `.env` in project root (see `.env.example`):

```env
# Wallet addresses
USDT_WALLET_TRC20=your_trc20_wallet_address
USDT_WALLET_BEP20=your_bep20_wallet_address
USDT_WALLET_ERC20=your_erc20_wallet_address

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
| `GET` | `/access/check` | Check user access status |
| `POST` | `/access/trial` | Start free trial |
| `GET` | `/access/payment-info` | Get USDT payment details |
| `POST` | `/stars/invoice` | Create Telegram Stars invoice |
| `POST` | `/webhook/telegram` | Telegram bot webhook |
| `POST` | `/admin/login` | Admin login |
| `GET` | `/admin/users` | List all users |
| `POST` | `/admin/users/{id}/vip` | Grant/revoke VIP |
| `POST` | `/admin/broadcast` | Send broadcast message |
| `GET/POST/PUT/DELETE` | `/admin/payment-methods` | Manage payment methods |
| `WS` | `/ws/signals` | Live signal feed |

---

## 📦 Tech Stack

**Frontend**
- React 18 + TypeScript + Vite
- LightweightCharts v5 (TradingView)
- qrcode.react

**Backend**
- FastAPI + Uvicorn
- SQLite (via stdlib `sqlite3`)
- httpx (async HTTP)
- python-telegram-bot v21
- python-dotenv

**Integrations**
- Binance Futures API — live prices & OHLCV
- TronGrid API — TRC-20 payment verification
- Telegram Bot API — Stars payments + notifications + broadcasts
- OpenRouter — multi-model AI signal analysis

---

## 📄 License

MIT © 2026
