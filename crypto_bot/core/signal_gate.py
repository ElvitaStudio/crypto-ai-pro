# -*- coding: utf-8 -*-
"""
SignalGate — centralized quality gate for all strategies.

Responsibilities:
  1. Per-symbol cooldown  (default 4 h) — prevents signal spam on same coin
  2. Minimum R:R check    (default 2.0)
  3. Higher-timeframe trend filter (EMA-50 on 1h) — long only above, short only below
"""

import time
import pandas as pd
import pandas_ta as ta

from core.exchange import fetch_ohlcv

# ── Constants ─────────────────────────────────────────────────────────────────

COOLDOWN_SEC: int = 4 * 3600   # 4 hours per symbol
MIN_RR:       float = 2.0      # minimum reward-to-risk ratio
HTF:          str   = "1h"     # higher timeframe for trend filter
HTF_EMA_LEN:  int   = 50       # EMA period on HTF

# ── Cooldown store ────────────────────────────────────────────────────────────

_last_signal: dict[str, float] = {}   # symbol → unix timestamp


def _on_cooldown(symbol: str) -> bool:
    last = _last_signal.get(symbol, 0)
    return (time.time() - last) < COOLDOWN_SEC


def _mark_sent(symbol: str) -> None:
    _last_signal[symbol] = time.time()


# ── HTF trend ─────────────────────────────────────────────────────────────────

def _htf_trend(symbol: str) -> str:
    """
    Returns 'UP', 'DOWN', or 'NEUTRAL' based on EMA-50 on 1h chart.
    Price above EMA → UP (favour longs).
    Price below EMA → DOWN (favour shorts).
    """
    try:
        bars = fetch_ohlcv(symbol, HTF, HTF_EMA_LEN + 10)
        if not bars or len(bars) < HTF_EMA_LEN:
            return "NEUTRAL"
        df = pd.DataFrame(bars, columns=["ts", "open", "high", "low", "close", "volume"])
        ema = ta.ema(df["close"], length=HTF_EMA_LEN)
        if ema is None or ema.isna().all():
            return "NEUTRAL"
        price = df["close"].iloc[-1]
        ema_val = float(ema.iloc[-1])
        if price > ema_val * 1.002:    # small buffer to avoid noise at EMA
            return "UP"
        if price < ema_val * 0.998:
            return "DOWN"
        return "NEUTRAL"
    except Exception:
        return "NEUTRAL"


# ── Public API ────────────────────────────────────────────────────────────────

def check(signal: dict) -> tuple[bool, str]:
    """
    Run all quality checks on a signal dict.

    Returns (passed: bool, reason: str).
    Call _mark_sent() only after the signal is actually saved/sent.
    """
    symbol    = signal["symbol"]
    direction = signal["direction"]
    entry     = signal["entry"]
    sl        = signal["sl"]
    tp        = signal["tp"]

    # ── 1. Cooldown ──────────────────────────────────────────────────────────
    if _on_cooldown(symbol):
        return False, f"cooldown ({symbol})"

    # ── 2. Minimum R:R ───────────────────────────────────────────────────────
    risk   = abs(entry - sl)
    reward = abs(tp - entry)
    if risk == 0:
        return False, "zero risk"
    rr = reward / risk
    if rr < MIN_RR:
        return False, f"R:R {rr:.2f} < {MIN_RR}"

    # ── 3. HTF trend alignment ───────────────────────────────────────────────
    # Reconstruct the ccxt symbol (base/USDT) if needed
    ccxt_sym = symbol if "/" in symbol else f"{symbol.replace('USDT','')}/USDT"
    trend = _htf_trend(ccxt_sym)

    if trend == "DOWN" and direction == "LONG":
        return False, f"HTF trend DOWN — skipping LONG on {symbol}"
    if trend == "UP" and direction == "SHORT":
        return False, f"HTF trend UP — skipping SHORT on {symbol}"

    # Attach HTF trend info to signal so AI council can use it in its prompt
    signal["htf_trend"] = trend

    return True, "ok"


def mark_sent(symbol: str) -> None:
    """Call this after a signal passes check() and is committed to DB."""
    _mark_sent(symbol)
