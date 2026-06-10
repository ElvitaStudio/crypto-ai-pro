# -*- coding: utf-8 -*-
"""
Central configuration for all bots.
Each strategy has its own section; shared settings are at the top.
"""

# ============================================================
#  AI COUNCIL  (OpenRouter)
# ============================================================
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (one level up from crypto_bot/)
load_dotenv(Path(__file__).parent.parent / ".env")

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

# Models that vote on each signal. Majority (>50%) must approve.
AI_COUNCIL_MODELS = [
    "anthropic/claude-haiku-4-5",        # fast, cheap
    "openai/gpt-4o-mini",                 # fast, cheap
]

AI_COUNCIL_ENABLED = False  # disabled: strategies generate low-volume signals that AI always rejects
AI_COUNCIL_TIMEOUT_SEC = 10 # per model request timeout

# ============================================================
#  SHARED EXCHANGE
# ============================================================
EXCHANGE_TYPE = "future"          # Binance Futures
RATE_LIMIT = True

# ============================================================
#  UNIFIED TELEGRAM CHANNEL
#  All strategies send to one channel in a consistent format.
# ============================================================
UNIFIED_BOT_TOKEN    = os.environ.get("UNIFIED_BOT_TOKEN",    "7615835464:AAEQIMdf3mD9ym0TyO3ZtZ8p1UD8VQrFSYs")
UNIFIED_CHANNEL      = os.environ.get("UNIFIED_CHANNEL",      "-1002728849341")
UNIFIED_RESULTS_CHANNEL = os.environ.get("UNIFIED_RESULTS_CHANNEL", "-1002728849341")  # same channel for TP/SL

# ── Legacy per-strategy config (kept for reference, no longer used by runner)
TELEGRAM = {
    "volume_level": {
        "token": "7550542378:AAERLC0CFYXYq2ivK1yPuMktFTtxA3AO5Zg",
        "signal_channel": "-1003521529329",
        "results_channel": "-1003439293125",
    },
    "multi": {
        "token": "8433497142:AAFFdThNXlzBDF5rlGR89X35eL3FCA4LKpE",
        "signal_channel": "-1002734712902",
        "results_channel": None,
    },
    "vwap_channel": {
        "token": "7852773083:AAEAuQQQxIfurVjgQZdKTvNmgIDw_visFG8",
        "signal_channel": "-1002455674147",
        "results_channel": None,
    },
    "fractal": {
        "token": "7615835464:AAEQIMdf3mD9ym0TyO3ZtZ8p1UD8VQrFSYs",
        "signal_channel": "-1002728849341",
        "results_channel": None,
    },
}

# ============================================================
#  SHARED SCANNER
# ============================================================
TOP_COINS_REFRESH_INTERVAL = 15   # iterations between coin list refresh

# ============================================================
#  STRATEGY: VOLUME + LEVEL  (from bot.py)
# ============================================================
VOLUME_LEVEL = {
    "timeframe": "5m",
    "chart_timeframe": "15m",
    "limit": 50,
    "chart_limit": 100,
    "coins_to_scan": 40,
    "vol_multiplier": 5.0,
    "price_change_perc": 1.5,
    "level_distance_perc": 1.0,
    "scan_interval_sec": 1800,
    "db_file": "data/training_volume.csv",
    "trades_file": "data/trades_volume.json",
    # AI filter thresholds
    "long_rsi_max": 60,        # buy when RSI < 60 (not overbought)
    "long_adx_max": 50,        # allow strong trends
    "long_vol_ratio_min": 1.5, # above-average volume
    "long_vol_ratio_max": 20.0,
    "short_rsi_min": 30,       # short when RSI > 30 (not extreme oversold)
    "short_rsi_max": 85,
    "short_adx_max": 70,
    "short_vol_ratio_min": 1.5,
    "short_vol_ratio_max": 20.0,
}

# ============================================================
#  STRATEGY: MULTI (Sniper / Trend / SFP)  (from multibot.py)
# ============================================================
MULTI = {
    "timeframe": "15m",
    "chart_timeframe": "1h",
    "limit": 300,
    "coins_to_scan": 80,
    "scan_interval_sec": 1800,
    "risk_min_perc": 0.2,
    "risk_max_perc": 3.0,
    "rsi_overbought": 65,   # was 70 — earlier reversal signal
    "rsi_oversold": 35,     # was 30 — earlier bounce signal
    "adx_trend_min": 30,    # was 25 — require confirmed trend
}

# ============================================================
#  STRATEGY: VWAP CHANNEL  (from nexusbot.py)
# ============================================================
VWAP_CHANNEL = {
    "timeframe": "15m",
    "limit": 100,
    "coins_to_scan": 60,
    "std_dev_mult": 2.5,   # was 2.0 — require stronger deviation from VWAP
    "scan_interval_sec": 1800,
    "min_rr": 3.0,          # was 1.0 — align with global gate
}

# ============================================================
#  STRATEGY: FRACTAL LEVELS  (from titanbot.py)
# ============================================================
FRACTAL = {
    "timeframe": "15m",
    "limit": 200,
    "coins_to_scan": 50,
    "fractal_window": 5,
    "level_proximity_perc": 0.8,
    "scan_interval_sec": 1800,
    "sl_buffer_perc": 0.5,
    "rr_ratio": 3.0,
}
