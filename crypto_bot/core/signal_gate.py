# -*- coding: utf-8 -*-
"""
SignalGate — centralized quality gate for all strategies.

Responsibilities:
  1. Per-symbol cooldown  (6 h) — prevents signal spam on same coin
  2. Minimum R:R check    (3.0) — only high-reward setups
  3. Higher-timeframe trend filter (EMA-50 on 1h and 4h)
  4. Quality Score gate   (≥ 4 / 6 points) — multi-criteria scoring
"""

import time
import pandas as pd
import pandas_ta as ta

from core.exchange import fetch_ohlcv

# ── Constants ─────────────────────────────────────────────────────────────────

COOLDOWN_SEC:      int   = 4 * 3600   # 4 h per symbol
MIN_RR:            float = 2.5        # minimum R:R
HTF_1H:            str   = "1h"
HTF_4H:            str   = "4h"
HTF_EMA_LEN:       int   = 50
MIN_QUALITY_SCORE: int   = 3          # need ≥ 3 out of 6 points

# Quality score thresholds
ADX_TREND_MIN:    float = 20.0   # moderate trend
RSI_LONG_MAX:     float = 65.0   # don't buy overbought
RSI_SHORT_MIN:    float = 35.0   # don't sell oversold
VOL_RATIO_MIN:    float = 1.5    # above-average volume
RR_BONUS_MIN:     float = 3.5    # bonus point for excellent R:R

# ── Cooldown store ────────────────────────────────────────────────────────────

_last_signal: dict[str, float] = {}   # symbol → unix timestamp


def _on_cooldown(symbol: str) -> bool:
    last = _last_signal.get(symbol, 0)
    return (time.time() - last) < COOLDOWN_SEC


def _mark_sent(symbol: str) -> None:
    _last_signal[symbol] = time.time()


# ── HTF trend ─────────────────────────────────────────────────────────────────

def _htf_trend(symbol: str, timeframe: str) -> str:
    """
    Returns 'UP', 'DOWN', or 'NEUTRAL' based on EMA-50 on given timeframe.
    Price above EMA → UP. Price below EMA → DOWN.
    """
    try:
        bars = fetch_ohlcv(symbol, timeframe, HTF_EMA_LEN + 10)
        if not bars or len(bars) < HTF_EMA_LEN:
            return "NEUTRAL"
        df = pd.DataFrame(bars, columns=["ts", "open", "high", "low", "close", "volume"])
        ema = ta.ema(df["close"], length=HTF_EMA_LEN)
        if ema is None or ema.isna().all():
            return "NEUTRAL"
        price   = df["close"].iloc[-1]
        ema_val = float(ema.iloc[-1])
        if price > ema_val * 1.002:
            return "UP"
        if price < ema_val * 0.998:
            return "DOWN"
        return "NEUTRAL"
    except Exception:
        return "NEUTRAL"


def _ccxt_symbol(raw: str) -> str:
    return raw if "/" in raw else f"{raw.replace('USDT', '')}/USDT"


# ── Quality Score ─────────────────────────────────────────────────────────────

def _quality_score(signal: dict, trend_4h: str, rr: float) -> tuple[int, list[str]]:
    """
    Scores a signal on 6 criteria. Returns (score, details).

    Criteria:
      +2  4h HTF trend aligns with direction
      +1  ADX > 25 (strong trend)
      +1  RSI in correct zone (LONG < 58, SHORT > 42)
      +1  Volume ratio > 1.5 (above-average activity)
      +1  R:R ≥ 4.0 (bonus for excellent risk-reward)
    Max = 6, threshold = MIN_QUALITY_SCORE (4)
    """
    direction = signal["direction"]
    features  = signal.get("features", {})
    rsi       = features.get("rsi")
    adx       = features.get("adx")
    vol_ratio = features.get("vol_ratio")

    score   = 0
    details = []

    # +2  4h HTF aligned
    if trend_4h == "UP" and direction == "LONG":
        score += 2
        details.append("+2 4h trend ↑ aligns with LONG")
    elif trend_4h == "DOWN" and direction == "SHORT":
        score += 2
        details.append("+2 4h trend ↓ aligns with SHORT")
    elif trend_4h == "NEUTRAL":
        score += 1
        details.append("+1 4h trend neutral (partial)")
    else:
        details.append(f"+0 4h trend {trend_4h} OPPOSES {direction}")

    # +1  ADX > 25
    if adx is not None and adx >= ADX_TREND_MIN:
        score += 1
        details.append(f"+1 ADX {adx:.1f} ≥ {ADX_TREND_MIN} (trend confirmed)")
    else:
        details.append(f"+0 ADX {f'{adx:.1f}' if adx is not None else '?'} < {ADX_TREND_MIN}")

    # +1  RSI zone
    if rsi is not None:
        if direction == "LONG" and rsi <= RSI_LONG_MAX:
            score += 1
            details.append(f"+1 RSI {rsi:.1f} ≤ {RSI_LONG_MAX} (room to grow)")
        elif direction == "SHORT" and rsi >= RSI_SHORT_MIN:
            score += 1
            details.append(f"+1 RSI {rsi:.1f} ≥ {RSI_SHORT_MIN} (room to fall)")
        else:
            details.append(f"+0 RSI {rsi:.1f} not in zone for {direction}")
    else:
        details.append("+0 RSI unavailable")

    # +1  Volume ratio
    if vol_ratio is not None and vol_ratio >= VOL_RATIO_MIN:
        score += 1
        details.append(f"+1 Vol ratio {vol_ratio:.1f}× ≥ {VOL_RATIO_MIN}")
    else:
        details.append(f"+0 Vol ratio {f'{vol_ratio:.1f}' if vol_ratio is not None else '?'}× < {VOL_RATIO_MIN}")

    # +1  Excellent R:R bonus
    if rr >= RR_BONUS_MIN:
        score += 1
        details.append(f"+1 R:R {rr:.2f} ≥ {RR_BONUS_MIN} (bonus)")
    else:
        details.append(f"+0 R:R {rr:.2f} < {RR_BONUS_MIN} (no bonus)")

    return score, details


# ── Public API ────────────────────────────────────────────────────────────────

def check(signal: dict) -> tuple[bool, str]:
    """
    Run all quality checks on a signal dict.

    Returns (passed: bool, reason: str).
    Call mark_sent() only after the signal is actually saved/sent.
    """
    symbol    = signal["symbol"]
    direction = signal["direction"]
    entry     = signal["entry"]
    sl        = signal["sl"]
    tp        = signal["tp"]
    ccxt_sym  = _ccxt_symbol(symbol)

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

    # ── 3. HTF trends (both soft — affect quality score, no hard block) ────────
    # CvdVwap is mean-reversion: price returns to VWAP regardless of trend direction.
    # Hard trend blocks were killing all signals in trending markets.
    trend_1h = _htf_trend(ccxt_sym, HTF_1H)
    trend_4h = _htf_trend(ccxt_sym, HTF_4H)

    # ── 5. Quality Score ─────────────────────────────────────────────────────
    score, details = _quality_score(signal, trend_4h, rr)
    score_str = f"{score}/{MIN_QUALITY_SCORE + 2}"  # show out of max (6)

    if score < MIN_QUALITY_SCORE:
        reason = f"Quality score {score}/6 < {MIN_QUALITY_SCORE} | " + " | ".join(details)
        return False, reason

    # ── Attach context to signal for AI council prompt ───────────────────────
    signal["htf_trend"]      = trend_1h
    signal["htf_trend_4h"]   = trend_4h
    signal["quality_score"]  = score
    signal["quality_details"] = details

    print(f"[Gate] {symbol} PASS score={score_str} | " + " | ".join(details))
    return True, "ok"


def mark_sent(symbol: str) -> None:
    """Call this after a signal passes check() and is committed to DB."""
    _mark_sent(symbol)
