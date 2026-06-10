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

VWAP_ZONE_PCT     = 0.004   # price within 0.4% of VWAP → "at VWAP"
DIVERGENCE_WINDOW = 12      # candles to look back for divergence
MIN_CVD_SWING_PCT = 0.005   # minimum CVD swing to count as divergence
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

    Bullish  — price LL but CVD HL (buyers absorbing sell pressure)
    Bearish  — price HH but CVD LH (sellers absorbing buy pressure)
    """
    window = DIVERGENCE_WINDOW
    price_slice = df["close"].iloc[-window:]
    cvd_slice   = cvd.iloc[-window:]

    price_min_idx = int(price_slice.argmin())
    price_max_idx = int(price_slice.argmax())
    cvd_min_idx   = int(cvd_slice.argmin())
    cvd_max_idx   = int(cvd_slice.argmax())

    # Bullish: price low is at the end, CVD low is earlier (or higher)
    price_low  = float(price_slice.iloc[-1])
    price_prev = float(price_slice.iloc[price_min_idx])
    cvd_low    = float(cvd_slice.iloc[-1])
    cvd_prev   = float(cvd_slice.iloc[cvd_min_idx])

    cvd_range = float(cvd.iloc[-window:].max() - cvd.iloc[-window:].min()) + 1e-10

    if (price_low <= price_prev * 1.002 and          # price near or at new low
            cvd_low > cvd_prev + cvd_range * MIN_CVD_SWING_PCT):  # CVD higher low
        return "BULLISH"

    # Bearish: price high is at the end, CVD high is earlier (or lower)
    price_high  = float(price_slice.iloc[-1])
    price_phigh = float(price_slice.iloc[price_max_idx])
    cvd_high    = float(cvd_slice.iloc[-1])
    cvd_phigh   = float(cvd_slice.iloc[cvd_max_idx])

    if (price_high >= price_phigh * 0.998 and        # price near or at new high
            cvd_high < cvd_phigh - cvd_range * MIN_CVD_SWING_PCT):  # CVD lower high
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
    long_at_vwap  = last_close <= last_vwap * (1 + VWAP_ZONE_PCT)
    long_cvd_up   = cvd_slope_norm > 0
    long_div      = divergence == "BULLISH"
    long_rsi      = rsi < RSI_LONG_MAX
    long_htf      = trend_1h in ("UP", "NEUTRAL")

    if long_at_vwap and long_cvd_up and long_div and long_rsi and long_htf:
        direction = "LONG"
        reasoning = (f"VWAP bounce LONG. CVD bullish divergence. "
                     f"RSI={rsi:.1f}, ADX={adx:.1f}, 1h={trend_1h}")

    # ── SHORT conditions ──────────────────────────────────────────────────────
    short_at_vwap  = last_close >= last_vwap * (1 - VWAP_ZONE_PCT)
    short_cvd_down = cvd_slope_norm < 0
    short_div      = divergence == "BEARISH"
    short_rsi      = rsi > RSI_SHORT_MIN
    short_htf      = trend_1h in ("DOWN", "NEUTRAL")

    if short_at_vwap and short_cvd_down and short_div and short_rsi and short_htf:
        direction = "SHORT"
        reasoning = (f"VWAP bounce SHORT. CVD bearish divergence. "
                     f"RSI={rsi:.1f}, ADX={adx:.1f}, 1h={trend_1h}")

    if direction is None:
        return None

    # ── Stop / Take ───────────────────────────────────────────────────────────
    if direction == "LONG":
        sl = _swing_low(df_15m["low"], SWING_WINDOW) * 0.9995   # tiny buffer
        tp = last_vwap_up                                         # VWAP +1σ
        if sl >= last_close:
            sl = last_close * 0.985                               # fallback 1.5%
        if tp <= last_close:
            tp = last_close * 1.03
    else:
        sl = _swing_high(df_15m["high"], SWING_WINDOW) * 1.0005
        tp = last_vwap_dn                                         # VWAP -1σ
        if sl <= last_close:
            sl = last_close * 1.015
        if tp >= last_close:
            tp = last_close * 0.97

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
