# -*- coding: utf-8 -*-
"""
CVD Divergence + VWAP Bounce strategy.

Entry logic:
  LONG  — price at/below VWAP on 15m, bullish CVD divergence, 1h trend UP or NEUTRAL
  SHORT — price at/above VWAP on 15m, bearish CVD divergence, 1h trend DOWN or NEUTRAL

Stop  — behind nearest swing high/low (fractal)
Take  — VWAP ± 1σ band
"""

import numpy as np
import pandas as pd


# ── Constants ──────────────────────────────────────────────────────────────────

VWAP_ZONE_PCT     = 0.008   # price within 0.8% of VWAP → "at VWAP"
DIVERGENCE_WINDOW = 16      # candles to look back for divergence
MIN_CVD_SWING_PCT = 0.02    # minimum relative CVD swing (2% of range)
RSI_LONG_MAX      = 60.0
RSI_SHORT_MIN     = 40.0
MIN_ADX           = 18.0    # some trend strength required
SWING_WINDOW      = 3       # fractal window for stop placement


# ── Helpers ────────────────────────────────────────────────────────────────────

def _calc_cvd(df: pd.DataFrame) -> pd.Series:
    """Cumulative Volume Delta: estimate buy/sell split per candle."""
    candle_range = df["high"] - df["low"] + 1e-10
    body = df["close"] - df["open"]
    buy_ratio = (0.5 + (body / candle_range) * 0.5).clip(0.05, 0.95)
    buy_vol   = df["volume"] * buy_ratio
    sell_vol  = df["volume"] - buy_vol
    delta     = buy_vol - sell_vol
    return delta.cumsum()


def _calc_vwap(df: pd.DataFrame) -> tuple[pd.Series, pd.Series, pd.Series]:
    """VWAP + upper/lower 1σ bands."""
    tp     = (df["high"] + df["low"] + df["close"]) / 3
    cum_tp = (tp * df["volume"]).cumsum()
    cum_v  = df["volume"].cumsum()
    vwap   = cum_tp / cum_v

    variance = ((tp - vwap) ** 2 * df["volume"]).cumsum() / cum_v
    std      = variance.apply(lambda x: x ** 0.5 if x >= 0 else 0)

    return vwap, vwap + std, vwap - std


def _calc_rsi(close: pd.Series, length: int = 14) -> float:
    delta  = close.diff()
    gain   = delta.clip(lower=0)
    loss   = (-delta).clip(lower=0)
    avg_g  = gain.ewm(com=length - 1, min_periods=length).mean()
    avg_l  = loss.ewm(com=length - 1, min_periods=length).mean()
    rs     = avg_g / (avg_l + 1e-10)
    rsi    = 100 - 100 / (1 + rs)
    return float(rsi.iloc[-1])


def _calc_adx(df: pd.DataFrame, length: int = 14) -> float:
    high, low, close = df["high"], df["low"], df["close"]
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low  - close.shift()).abs(),
    ], axis=1).max(axis=1)

    dm_pos = (high.diff()).clip(lower=0).where(
        high.diff() > (-low.diff()).clip(lower=0), 0)
    dm_neg = (-low.diff()).clip(lower=0).where(
        (-low.diff()).clip(lower=0) > high.diff().clip(lower=0), 0)

    atr    = tr.ewm(com=length - 1, min_periods=length).mean()
    di_pos = 100 * dm_pos.ewm(com=length - 1, min_periods=length).mean() / (atr + 1e-10)
    di_neg = 100 * dm_neg.ewm(com=length - 1, min_periods=length).mean() / (atr + 1e-10)
    dx     = 100 * (di_pos - di_neg).abs() / (di_pos + di_neg + 1e-10)
    adx    = dx.ewm(com=length - 1, min_periods=length).mean()
    return float(adx.iloc[-1])


def _swing_low(series: pd.Series, window: int) -> float:
    """Most recent fractal swing low."""
    for i in range(len(series) - window - 1, window - 1, -1):
        if all(series.iloc[i] <= series.iloc[i - j] for j in range(1, window + 1)) and \
           all(series.iloc[i] <= series.iloc[i + j] for j in range(1, window + 1)):
            return float(series.iloc[i])
    return float(series.iloc[-DIVERGENCE_WINDOW:].min())


def _swing_high(series: pd.Series, window: int) -> float:
    """Most recent fractal swing high."""
    for i in range(len(series) - window - 1, window - 1, -1):
        if all(series.iloc[i] >= series.iloc[i - j] for j in range(1, window + 1)) and \
           all(series.iloc[i] >= series.iloc[i + j] for j in range(1, window + 1)):
            return float(series.iloc[i])
    return float(series.iloc[-DIVERGENCE_WINDOW:].max())


def _htf_trend(df_1h: pd.DataFrame) -> str:
    """1h trend based on VWAP and last 3 CVD candles."""
    vwap, _, _ = _calc_vwap(df_1h)
    last_price = float(df_1h["close"].iloc[-1])
    last_vwap  = float(vwap.iloc[-1])

    cvd = _calc_cvd(df_1h)
    cvd_slope = float(cvd.iloc[-1]) - float(cvd.iloc[-4])

    if last_price > last_vwap * 1.002 and cvd_slope > 0:
        return "UP"
    if last_price < last_vwap * 0.998 and cvd_slope < 0:
        return "DOWN"
    return "NEUTRAL"


def _detect_divergence(df: pd.DataFrame, cvd: pd.Series) -> str:
    """
    Returns 'BULLISH', 'BEARISH', or 'NONE'.

    Splits the window into two halves and compares extremes:
    Bullish — second half price min < first half (lower low)
              BUT second half CVD min > first half (higher low)
    Bearish — second half price max > first half (higher high)
              BUT second half CVD max < first half (lower high)
    """
    window = DIVERGENCE_WINDOW
    half   = window // 2

    price = df["close"].iloc[-window:]
    cvd_w = cvd.iloc[-window:]

    # Split into first and second half
    p_first  = price.iloc[:half]
    p_second = price.iloc[half:]
    c_first  = cvd_w.iloc[:half]
    c_second = cvd_w.iloc[half:]

    cvd_range = float(cvd_w.max() - cvd_w.min()) + 1e-10
    min_swing = cvd_range * MIN_CVD_SWING_PCT

    # Bullish divergence: price made lower low but CVD made higher low
    p_low_1 = float(p_first.min())
    p_low_2 = float(p_second.min())
    c_low_1 = float(c_first.min())
    c_low_2 = float(c_second.min())

    if p_low_2 < p_low_1 * 1.001 and c_low_2 > c_low_1 + min_swing:
        return "BULLISH"

    # Bearish divergence: price made higher high but CVD made lower high
    p_hi_1 = float(p_first.max())
    p_hi_2 = float(p_second.max())
    c_hi_1 = float(c_first.max())
    c_hi_2 = float(c_second.max())

    if p_hi_2 > p_hi_1 * 0.999 and c_hi_2 < c_hi_1 - min_swing:
        return "BEARISH"

    return "NONE"


# ── Main signal function ───────────────────────────────────────────────────────

def generate_signal(
    symbol: str,
    df_15m: pd.DataFrame,
    df_1h:  pd.DataFrame,
) -> dict | None:
    """
    Returns a signal dict or None.

    df_15m / df_1h must have columns: open, high, low, close, volume
    """
    if len(df_15m) < 50 or len(df_1h) < 30:
        return None

    # ── 1h HTF trend ──────────────────────────────────────────────────────────
    trend_1h = _htf_trend(df_1h)

    # ── 15m indicators ────────────────────────────────────────────────────────
    vwap_15, vwap_up, vwap_dn = _calc_vwap(df_15m)
    cvd_15   = _calc_cvd(df_15m)
    rsi      = _calc_rsi(df_15m["close"])
    adx      = _calc_adx(df_15m)

    last_close = float(df_15m["close"].iloc[-1])
    last_vwap  = float(vwap_15.iloc[-1])
    last_vwap_up = float(vwap_up.iloc[-1])
    last_vwap_dn = float(vwap_dn.iloc[-1])

    price_to_vwap_pct = abs(last_close - last_vwap) / last_vwap

    # CVD slope: last 3 candles
    cvd_slope = float(cvd_15.iloc[-1]) - float(cvd_15.iloc[-4])
    cvd_slope_norm = cvd_slope / (df_15m["volume"].iloc[-20:].mean() + 1e-10)

    # Divergence
    divergence = _detect_divergence(df_15m, cvd_15)

    # ── ADX filter ────────────────────────────────────────────────────────────
    if adx < MIN_ADX:
        return None

    direction: str | None = None
    reasoning = ""

    # ── LONG conditions ───────────────────────────────────────────────────────
    # Note: 1h trend is NOT a hard block here — Gate scores it as quality factor.
    # CvdVwap is a mean-reversion strategy: price overshoots VWAP then returns.
    long_at_vwap = last_close <= last_vwap * (1 + VWAP_ZONE_PCT)
    long_cvd_up  = cvd_slope_norm > 0
    long_div     = divergence == "BULLISH"
    long_rsi     = rsi < RSI_LONG_MAX

    if long_at_vwap and long_cvd_up and long_div and long_rsi:
        direction = "LONG"
        reasoning = (f"VWAP bounce LONG. CVD bullish divergence. "
                     f"RSI={rsi:.1f}, ADX={adx:.1f}, 1h={trend_1h}")

    # ── SHORT conditions ──────────────────────────────────────────────────────
    short_at_vwap  = last_close >= last_vwap * (1 - VWAP_ZONE_PCT)
    short_cvd_down = cvd_slope_norm < 0
    short_div      = divergence == "BEARISH"
    short_rsi      = rsi > RSI_SHORT_MIN

    if short_at_vwap and short_cvd_down and short_div and short_rsi:
        direction = "SHORT"
        reasoning = (f"VWAP bounce SHORT. CVD bearish divergence. "
                     f"RSI={rsi:.1f}, ADX={adx:.1f}, 1h={trend_1h}")

    if direction is None:
        return None

    # ── Stop / Take ───────────────────────────────────────────────────────────
    if direction == "LONG":
        sl_swing = _swing_low(df_15m["low"], SWING_WINDOW) * 0.9995
        # Clamp: stop must be 0.5%–3% below entry
        sl = max(last_close * 0.97, min(sl_swing, last_close * 0.995))
        tp = last_vwap_up                                          # VWAP +1σ
        if tp <= last_close * 1.005:
            tp = last_close * 1.02                                 # fallback 2%
    else:
        sl_swing = _swing_high(df_15m["high"], SWING_WINDOW) * 1.0005
        # Clamp: stop must be 0.5%–3% above entry
        sl = min(last_close * 1.03, max(sl_swing, last_close * 1.005))
        tp = last_vwap_dn                                          # VWAP -1σ
        if tp >= last_close * 0.995:
            tp = last_close * 0.98                                 # fallback 2%

    risk   = abs(last_close - sl)
    reward = abs(tp - last_close)
    if risk == 0 or reward / risk < 1.5:
        return None   # minimum R:R 1.5

    vol_ratio = float(df_15m["volume"].iloc[-1] / (df_15m["volume"].iloc[-20:].mean() + 1e-10))

    return {
        "symbol":        symbol,
        "direction":     direction,
        "entry":         round(last_close, 8),
        "sl":            round(sl, 8),
        "tp":            round(tp, 8),
        "strategy_name": "CvdVwap",
        "reasoning":     reasoning,
        "htf_trend":     trend_1h,
        "htf_trend_4h":  trend_1h,   # reuse 1h as 4h proxy for gate compatibility
        "features": {
            "rsi":       round(rsi, 1),
            "adx":       round(adx, 1),
            "vol_ratio": round(vol_ratio, 2),
            "cvd_slope": round(cvd_slope_norm, 3),
            "vwap_dist": round(price_to_vwap_pct * 100, 2),
        },
    }
