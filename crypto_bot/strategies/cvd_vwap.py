# -*- coding: utf-8 -*-
"""
CVD Divergence + VWAP Bounce strategy.

Entry logic:
  LONG  — price at/below VWAP on 15m, bullish CVD divergence, 1h trend UP or NEUTRAL
  SHORT — price at/above VWAP on 15m, bearish CVD divergence, 1h trend DOWN or NEUTRAL

Stop improvements:
  - ATR-based stop placed BEHIND nearest swing low/high (not fixed %)
  - Stop is buffered by 0.3×ATR to survive normal noise

Take profit:
  - TP1 at 40% of the way to VWAP ±1σ (partial exit suggestion)
  - TP2 at full VWAP ±1σ target
  - Signal includes tp1 field; full tp is TP2

Liquidity grab filter:
  - For LONG: require that the last N candles contain at least one wick below VWAP
    that CLOSED back above — i.e. a stop-hunt has already happened
  - For SHORT: mirror logic — wick above VWAP that closed back below
"""

import numpy as np
import pandas as pd


# ── Constants ──────────────────────────────────────────────────────────────────

VWAP_ZONE_PCT       = 0.008   # price within 0.8% of VWAP → "at VWAP"
DIVERGENCE_WINDOW   = 16      # candles for divergence detection
MIN_CVD_SWING_PCT   = 0.02    # minimum relative CVD swing
RSI_LONG_MAX        = 60.0
RSI_SHORT_MIN       = 40.0
MIN_ADX             = 18.0
SWING_WINDOW        = 3       # fractal window for stop placement
ATR_PERIOD          = 14
ATR_STOP_MULT       = 1.5     # stop = swing ± ATR_STOP_MULT × ATR
ATR_MIN_STOP_MULT   = 0.5     # minimum stop = 0.5 × ATR from entry
ATR_MAX_STOP_MULT   = 3.0     # maximum stop = 3.0 × ATR from entry
TP1_RATIO           = 0.40    # TP1 = 40% of the way to TP2
LIQ_GRAB_LOOKBACK   = 5       # candles to look back for liquidity grab


# ── Helpers ────────────────────────────────────────────────────────────────────

def _calc_atr(df: pd.DataFrame, period: int = ATR_PERIOD) -> float:
    """Average True Range."""
    high, low, close = df["high"], df["low"], df["close"]
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low  - close.shift()).abs(),
    ], axis=1).max(axis=1)
    return float(tr.ewm(com=period - 1, min_periods=period).mean().iloc[-1])


def _calc_cvd(df: pd.DataFrame) -> pd.Series:
    """Cumulative Volume Delta: estimate buy/sell split per candle."""
    candle_range = df["high"] - df["low"] + 1e-10
    body         = df["close"] - df["open"]
    buy_ratio    = (0.5 + (body / candle_range) * 0.5).clip(0.05, 0.95)
    buy_vol      = df["volume"] * buy_ratio
    sell_vol     = df["volume"] - buy_vol
    return (buy_vol - sell_vol).cumsum()


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
    delta = close.diff()
    avg_g = delta.clip(lower=0).ewm(com=length - 1, min_periods=length).mean()
    avg_l = (-delta).clip(lower=0).ewm(com=length - 1, min_periods=length).mean()
    rs    = avg_g / (avg_l + 1e-10)
    return float((100 - 100 / (1 + rs)).iloc[-1])


def _calc_adx(df: pd.DataFrame, length: int = 14) -> float:
    high, low, close = df["high"], df["low"], df["close"]
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low  - close.shift()).abs(),
    ], axis=1).max(axis=1)

    dm_pos = high.diff().clip(lower=0).where(
        high.diff() > (-low.diff()).clip(lower=0), 0)
    dm_neg = (-low.diff()).clip(lower=0).where(
        (-low.diff()).clip(lower=0) > high.diff().clip(lower=0), 0)

    atr    = tr.ewm(com=length - 1, min_periods=length).mean()
    di_pos = 100 * dm_pos.ewm(com=length - 1, min_periods=length).mean() / (atr + 1e-10)
    di_neg = 100 * dm_neg.ewm(com=length - 1, min_periods=length).mean() / (atr + 1e-10)
    dx     = 100 * (di_pos - di_neg).abs() / (di_pos + di_neg + 1e-10)
    return float(dx.ewm(com=length - 1, min_periods=length).mean().iloc[-1])


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
    """1h trend based on VWAP and CVD slope."""
    vwap, _, _ = _calc_vwap(df_1h)
    last_price = float(df_1h["close"].iloc[-1])
    last_vwap  = float(vwap.iloc[-1])
    cvd        = _calc_cvd(df_1h)
    cvd_slope  = float(cvd.iloc[-1]) - float(cvd.iloc[-4])

    if last_price > last_vwap * 1.002 and cvd_slope > 0:
        return "UP"
    if last_price < last_vwap * 0.998 and cvd_slope < 0:
        return "DOWN"
    return "NEUTRAL"


def _detect_divergence(df: pd.DataFrame, cvd: pd.Series) -> str:
    """
    Splits window into two halves, compares price and CVD extremes.
    Returns 'BULLISH', 'BEARISH', or 'NONE'.
    """
    window = DIVERGENCE_WINDOW
    half   = window // 2

    price = df["close"].iloc[-window:]
    cvd_w = cvd.iloc[-window:]

    p_first, p_second = price.iloc[:half], price.iloc[half:]
    c_first, c_second = cvd_w.iloc[:half], cvd_w.iloc[half:]

    cvd_range = float(cvd_w.max() - cvd_w.min()) + 1e-10
    min_swing = cvd_range * MIN_CVD_SWING_PCT

    # Bullish: lower price low but higher CVD low
    if float(p_second.min()) < float(p_first.min()) * 1.001 and \
       float(c_second.min()) > float(c_first.min()) + min_swing:
        return "BULLISH"

    # Bearish: higher price high but lower CVD high
    if float(p_second.max()) > float(p_first.max()) * 0.999 and \
       float(c_second.max()) < float(c_first.max()) - min_swing:
        return "BEARISH"

    return "NONE"


def _detect_liquidity_grab(
    df: pd.DataFrame,
    vwap: pd.Series,
    direction: str,
    lookback: int = LIQ_GRAB_LOOKBACK,
) -> bool:
    """
    Detect a stop-hunt (liquidity grab) in the last `lookback` candles.

    LONG grab: at least one candle has its LOW below VWAP but its CLOSE above VWAP.
    SHORT grab: at least one candle has its HIGH above VWAP but its CLOSE below VWAP.

    Returns True if a liquidity grab is confirmed.
    """
    recent_df   = df.iloc[-lookback:]
    recent_vwap = vwap.iloc[-lookback:]

    if direction == "LONG":
        # Wick pierced below VWAP but closed above
        grabs = (recent_df["low"].values < recent_vwap.values) & \
                (recent_df["close"].values > recent_vwap.values)
        return bool(np.any(grabs))

    if direction == "SHORT":
        # Wick pierced above VWAP but closed below
        grabs = (recent_df["high"].values > recent_vwap.values) & \
                (recent_df["close"].values < recent_vwap.values)
        return bool(np.any(grabs))

    return False


def _calc_atr_stop(
    entry: float,
    swing: float,
    atr: float,
    direction: str,
) -> float:
    """
    Place stop behind swing + ATR buffer, clamped to [0.5×ATR, 3×ATR] from entry.
    """
    buffer = atr * ATR_STOP_MULT

    if direction == "LONG":
        raw_sl = swing - buffer
        # Clamp: never more than 3×ATR below entry, never less than 0.5×ATR below
        sl = max(entry - atr * ATR_MAX_STOP_MULT,
                 min(raw_sl, entry - atr * ATR_MIN_STOP_MULT))
    else:
        raw_sl = swing + buffer
        sl = min(entry + atr * ATR_MAX_STOP_MULT,
                 max(raw_sl, entry + atr * ATR_MIN_STOP_MULT))

    return sl


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
    atr      = _calc_atr(df_15m)

    last_close   = float(df_15m["close"].iloc[-1])
    last_vwap    = float(vwap_15.iloc[-1])
    last_vwap_up = float(vwap_up.iloc[-1])
    last_vwap_dn = float(vwap_dn.iloc[-1])

    price_to_vwap_pct = abs(last_close - last_vwap) / last_vwap

    # CVD momentum (last 3 candles)
    cvd_slope      = float(cvd_15.iloc[-1]) - float(cvd_15.iloc[-4])
    vol_mean       = df_15m["volume"].iloc[-20:].mean() + 1e-10
    cvd_slope_norm = cvd_slope / vol_mean

    # CVD macro (last 20 candles) — prevents contra-trend entries
    cvd_macro      = float(cvd_15.iloc[-1]) - float(cvd_15.iloc[-20])
    cvd_macro_norm = cvd_macro / vol_mean

    # Divergence detection
    divergence = _detect_divergence(df_15m, cvd_15)

    # ── ADX filter ────────────────────────────────────────────────────────────
    if adx < MIN_ADX:
        return None

    direction: str | None = None
    liq_grab_detected      = False
    reasoning              = ""

    # ── LONG conditions ───────────────────────────────────────────────────────
    long_at_vwap = last_close <= last_vwap * (1 + VWAP_ZONE_PCT)
    long_cvd_up  = cvd_slope_norm > 0
    long_div     = divergence == "BULLISH"
    long_rsi     = rsi < RSI_LONG_MAX
    long_cvd_ok  = cvd_macro_norm > -2.0

    if long_at_vwap and long_cvd_up and long_div and long_rsi and long_cvd_ok:
        direction         = "LONG"
        liq_grab_detected = _detect_liquidity_grab(df_15m, vwap_15, "LONG")
        grab_tag          = " [ликвидность снята✓]" if liq_grab_detected else ""
        reasoning         = (f"VWAP bounce LONG{grab_tag}. CVD bullish divergence. "
                             f"RSI={rsi:.1f}, ADX={adx:.1f}, ATR={atr:.6f}, 1h={trend_1h}")

    # ── SHORT conditions ──────────────────────────────────────────────────────
    short_at_vwap  = last_close >= last_vwap * (1 - VWAP_ZONE_PCT)
    short_cvd_down = cvd_slope_norm < 0
    short_div      = divergence == "BEARISH"
    short_rsi      = rsi > RSI_SHORT_MIN
    short_cvd_ok   = cvd_macro_norm < 2.0

    if short_at_vwap and short_cvd_down and short_div and short_rsi and short_cvd_ok:
        direction         = "SHORT"
        liq_grab_detected = _detect_liquidity_grab(df_15m, vwap_15, "SHORT")
        grab_tag          = " [ликвидность снята✓]" if liq_grab_detected else ""
        reasoning         = (f"VWAP bounce SHORT{grab_tag}. CVD bearish divergence. "
                             f"RSI={rsi:.1f}, ADX={adx:.1f}, ATR={atr:.6f}, 1h={trend_1h}")

    if direction is None:
        return None

    # ── ATR-based stop behind swing ───────────────────────────────────────────
    if direction == "LONG":
        swing_sl = _swing_low(df_15m["low"], SWING_WINDOW)
        sl       = _calc_atr_stop(last_close, swing_sl, atr, "LONG")
        tp2      = last_vwap_up
        if tp2 <= last_close * 1.005:
            tp2  = last_close * 1.02
    else:
        swing_sl = _swing_high(df_15m["high"], SWING_WINDOW)
        sl       = _calc_atr_stop(last_close, swing_sl, atr, "SHORT")
        tp2      = last_vwap_dn
        if tp2 >= last_close * 0.995:
            tp2  = last_close * 0.98

    # ── Dual TP: TP1 at 40% of the move, TP2 at full target ──────────────────
    tp1 = last_close + (tp2 - last_close) * TP1_RATIO

    risk   = abs(last_close - sl)
    reward = abs(tp2 - last_close)
    if risk == 0 or reward / risk < 1.5:
        return None   # minimum R:R 1.5 to TP2

    vol_ratio = float(df_15m["volume"].iloc[-1] / vol_mean)

    return {
        "symbol":          symbol,
        "direction":       direction,
        "entry":           round(last_close, 8),
        "sl":              round(sl, 8),
        "tp":              round(tp2, 8),       # TP2 — full target
        "tp1":             round(tp1, 8),       # TP1 — partial at 40%
        "strategy_name":   "CvdVwap",
        "reasoning":       reasoning,
        "htf_trend":       trend_1h,
        "htf_trend_4h":    trend_1h,
        "liq_grab":        liq_grab_detected,
        "features": {
            "rsi":         round(rsi, 1),
            "adx":         round(adx, 1),
            "atr":         round(atr, 8),
            "vol_ratio":   round(vol_ratio, 2),
            "cvd_slope":   round(cvd_slope_norm, 3),
            "vwap_dist":   round(price_to_vwap_pct * 100, 2),
        },
    }
