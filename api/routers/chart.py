# -*- coding: utf-8 -*-
"""
Chart data endpoint: OHLCV + Volume Profile + Levels + Zones.
No ccxt import here — calls the crypto_bot exchange module via subprocess
would be complex, so we import ccxt directly (API is a separate process).
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../crypto_bot"))

import ccxt
import numpy as np
import pandas as pd
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/chart", tags=["chart"])

_exchange = ccxt.binance({
    "enableRateLimit": True,
    "options": {"defaultType": "future"},
})


# ── Response models ───────────────────────────────────────────────────────────

class Candle(BaseModel):
    time: int       # unix seconds
    open: float
    high: float
    low: float
    close: float
    volume: float
    delta: float    # buy_vol - sell_vol estimate (positive = bullish)

class VolumeProfileBar(BaseModel):
    price: float    # center of bucket
    volume: float
    buy_vol: float
    sell_vol: float
    is_hvn: bool    # High Volume Node (supply/demand zone)
    is_poc: bool    # Point of Control (max volume)

class Level(BaseModel):
    price: float
    type: str       # "SUPPORT" | "RESISTANCE" | "VAH" | "VAL" | "POC" | "HIGH_24H" | "LOW_24H"
    strength: int   # 1-3

class Zone(BaseModel):
    price_top: float
    price_bot: float
    zone_type: str  # "SUPPLY" | "DEMAND"
    volume: float

class ChartData(BaseModel):
    symbol: str
    timeframe: str
    candles: list[Candle]
    volume_profile: list[VolumeProfileBar]
    levels: list[Level]
    zones: list[Zone]
    poc: float
    vah: float      # Value Area High (70% of volume)
    val: float      # Value Area Low


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fetch_ohlcv(symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
    raw = _exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
    df = pd.DataFrame(raw, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = (df["timestamp"] / 1000).astype(int)
    return df


def _calc_delta(df: pd.DataFrame) -> pd.Series:
    """Estimate buy/sell delta: bullish candle → more buy volume."""
    body_ratio = (df["close"] - df["open"]) / (df["high"] - df["low"] + 1e-10)
    buy_vol = df["volume"] * (0.5 + body_ratio * 0.5).clip(0.05, 0.95)
    sell_vol = df["volume"] - buy_vol
    return buy_vol - sell_vol


def _volume_profile(df: pd.DataFrame, bins: int = 40) -> tuple[list[VolumeProfileBar], float, float, float]:
    price_min = df["low"].min()
    price_max = df["high"].max()
    bucket_size = (price_max - price_min) / bins

    buckets = np.zeros((bins, 3))  # [total, buy, sell]

    body_ratio = ((df["close"] - df["open"]) / (df["high"] - df["low"] + 1e-10)).clip(-1, 1)
    df["buy_vol"] = df["volume"] * (0.5 + body_ratio * 0.5).clip(0.05, 0.95)
    df["sell_vol"] = df["volume"] - df["buy_vol"]

    for _, row in df.iterrows():
        lo_idx = int((row["low"] - price_min) / bucket_size)
        hi_idx = int((row["high"] - price_min) / bucket_size)
        lo_idx = max(0, min(lo_idx, bins - 1))
        hi_idx = max(0, min(hi_idx, bins - 1))
        spread = hi_idx - lo_idx + 1
        for b in range(lo_idx, hi_idx + 1):
            buckets[b][0] += row["volume"] / spread
            buckets[b][1] += row["buy_vol"] / spread
            buckets[b][2] += row["sell_vol"] / spread

    total_vol = buckets[:, 0].sum()
    poc_idx = int(np.argmax(buckets[:, 0]))

    # Value Area: 70% of total volume around POC
    sorted_idx = np.argsort(buckets[:, 0])[::-1]
    cumvol = 0.0
    va_indices = set()
    for i in sorted_idx:
        cumvol += buckets[i][0]
        va_indices.add(i)
        if cumvol >= total_vol * 0.70:
            break
    vah_idx = max(va_indices)
    val_idx = min(va_indices)

    # HVN: top 25% by volume
    hvn_threshold = np.percentile(buckets[:, 0], 75)

    bars = []
    for i in range(bins):
        center = price_min + (i + 0.5) * bucket_size
        bars.append(VolumeProfileBar(
            price=round(center, 6),
            volume=round(float(buckets[i][0]), 4),
            buy_vol=round(float(buckets[i][1]), 4),
            sell_vol=round(float(buckets[i][2]), 4),
            is_hvn=bool(buckets[i][0] >= hvn_threshold),
            is_poc=bool(i == poc_idx),
        ))

    poc_price = price_min + (poc_idx + 0.5) * bucket_size
    vah_price = price_min + (vah_idx + 1) * bucket_size
    val_price = price_min + val_idx * bucket_size

    return bars, round(poc_price, 6), round(vah_price, 6), round(val_price, 6)


def _find_fractal_levels(df: pd.DataFrame, window: int = 5) -> list[Level]:
    levels = []
    for i in range(window, len(df) - window):
        is_high = all(
            df["high"].iloc[i] > df["high"].iloc[i - j] and
            df["high"].iloc[i] > df["high"].iloc[i + j]
            for j in range(1, window + 1)
        )
        is_low = all(
            df["low"].iloc[i] < df["low"].iloc[i - j] and
            df["low"].iloc[i] < df["low"].iloc[i + j]
            for j in range(1, window + 1)
        )
        if is_high:
            levels.append(Level(price=round(float(df["high"].iloc[i]), 6), type="RESISTANCE", strength=1))
        if is_low:
            levels.append(Level(price=round(float(df["low"].iloc[i]), 6), type="SUPPORT", strength=1))
    return levels


def _merge_close_levels(levels: list[Level], tolerance_pct: float = 0.003) -> list[Level]:
    """Merge levels that are within tolerance% of each other, increasing strength."""
    if not levels:
        return []
    merged: list[Level] = []
    sorted_levels = sorted(levels, key=lambda l: l.price)
    current = sorted_levels[0]
    strength = 1

    for lvl in sorted_levels[1:]:
        if abs(lvl.price - current.price) / current.price < tolerance_pct and lvl.type == current.type:
            strength += 1
            # keep midpoint
            current = Level(
                price=round((current.price + lvl.price) / 2, 6),
                type=current.type,
                strength=min(strength, 3),
            )
        else:
            merged.append(Level(price=current.price, type=current.type, strength=min(strength, 3)))
            current = lvl
            strength = 1
    merged.append(Level(price=current.price, type=current.type, strength=min(strength, 3)))
    return merged


def _supply_demand_zones(df: pd.DataFrame, profile: list[VolumeProfileBar]) -> list[Zone]:
    """
    Zones = HVN areas where buy or sell volume dominates.
    Consecutive HVN buckets are merged into a single zone.
    """
    zones: list[Zone] = []
    hvns = [b for b in profile if b.is_hvn]

    # Group consecutive HVN buckets
    if not hvns:
        return []

    bucket_size = hvns[1].price - hvns[0].price if len(hvns) > 1 else 0

    group: list[VolumeProfileBar] = [hvns[0]]
    for bar in hvns[1:]:
        if abs(bar.price - group[-1].price) <= bucket_size * 2:
            group.append(bar)
        else:
            zones.append(_zone_from_group(group))
            group = [bar]
    zones.append(_zone_from_group(group))

    return zones


def _zone_from_group(group: list[VolumeProfileBar]) -> Zone:
    prices = [b.price for b in group]
    total_buy = sum(b.buy_vol for b in group)
    total_sell = sum(b.sell_vol for b in group)
    half_bucket = (max(prices) - min(prices)) / max(len(prices), 1) / 2
    return Zone(
        price_top=round(max(prices) + half_bucket, 6),
        price_bot=round(min(prices) - half_bucket, 6),
        zone_type="DEMAND" if total_buy > total_sell else "SUPPLY",
        volume=round(sum(b.volume for b in group), 4),
    )


# ── Screener endpoint ─────────────────────────────────────────────────────────
# NOTE: must be registered BEFORE /{symbol} to avoid "screener" matching as symbol

class ScreenerCandle(BaseModel):
    o: float
    h: float
    l: float
    c: float
    v: float

class ScreenerItem(BaseModel):
    symbol: str
    price: float
    change24h: float        # percent
    high24h: float
    low24h: float
    volume24h: float        # millions
    rsi: float | None
    adx: float | None
    vol_ratio: float | None
    trend1h: str            # UP / DOWN / NEUTRAL
    candles: list[ScreenerCandle] = []   # last N candles for mini chart


DEFAULT_SCREENER_SYMBOLS = [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT",
    "XRP/USDT", "DOGE/USDT", "ADA/USDT",
]


def _screener_item(args: tuple) -> ScreenerItem | None:
    ccxt_sym, timeframe = args
    try:
        ticker = _exchange.fetch_ticker(ccxt_sym)
        price      = float(ticker["last"] or 0)
        change24h  = float(ticker["percentage"] or 0)
        high24h    = float(ticker["high"] or price)
        low24h     = float(ticker["low"] or price)
        volume24h  = float(ticker["quoteVolume"] or 0)

        # Candles for mini chart (use requested timeframe)
        df_chart = _fetch_ohlcv(ccxt_sym, timeframe, 60)
        mini_candles = [
            ScreenerCandle(o=row["open"], h=row["high"], l=row["low"],
                           c=row["close"], v=row["volume"])
            for _, row in df_chart.tail(50).iterrows()
        ]

        # Indicators always on 1h for consistency
        df = _fetch_ohlcv(ccxt_sym, "1h", 60)

        import pandas_ta as pta
        rsi_s = pta.rsi(df["close"], length=14)
        adx_s = pta.adx(df["high"], df["low"], df["close"])
        rsi     = round(float(rsi_s.iloc[-1]), 1) if rsi_s is not None and not rsi_s.isna().all() else None
        adx_val = round(float(adx_s["ADX_14"].iloc[-1]), 1) if adx_s is not None else None

        vol_sma   = df["volume"].rolling(20).mean().iloc[-1]
        vol_ratio = round(float(df["volume"].iloc[-1] / vol_sma), 2) if vol_sma else None

        ema50 = pta.ema(df["close"], length=50)
        if ema50 is not None and not ema50.isna().all():
            last_close = float(df["close"].iloc[-1])
            last_ema   = float(ema50.iloc[-1])
            if last_close > last_ema * 1.002:
                trend1h = "UP"
            elif last_close < last_ema * 0.998:
                trend1h = "DOWN"
            else:
                trend1h = "NEUTRAL"
        else:
            trend1h = "NEUTRAL"

        base = ccxt_sym.replace("/USDT", "")
        return ScreenerItem(
            symbol=base,
            price=price,
            change24h=round(change24h, 2),
            high24h=high24h,
            low24h=low24h,
            volume24h=round(volume24h / 1_000_000, 2),  # millions
            rsi=rsi,
            adx=adx_val,
            vol_ratio=vol_ratio,
            trend1h=trend1h,
            candles=mini_candles,
        )
    except Exception:
        return None


@router.get("/screener/data", response_model=list[ScreenerItem])
def get_screener(
    symbols: str = Query(
        ",".join(s.replace("/USDT", "") for s in DEFAULT_SCREENER_SYMBOLS),
        description="Comma-separated base tickers, e.g. BTC,ETH,SOL",
    ),
    timeframe: str = Query("5m", description="Candle timeframe for mini chart"),
):
    """Return market snapshot for multiple symbols (price, RSI, ADX, trend, candles)."""
    import concurrent.futures
    tickers = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    args = [(f"{t}/USDT", timeframe) for t in tickers]

    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        results = list(pool.map(_screener_item, args))

    return [r for r in results if r is not None]


# ── Chart endpoint ────────────────────────────────────────────────────────────

@router.get("/{symbol}", response_model=ChartData)
def get_chart(
    symbol: str,
    timeframe: str = Query("15m"),
    limit: int = Query(200, le=500),
):
    try:
        # ccxt uses slash notation
        ccxt_symbol = symbol.replace("-", "/").upper()
        if "/" not in ccxt_symbol:
            ccxt_symbol = ccxt_symbol + "/USDT"

        df = _fetch_ohlcv(ccxt_symbol, timeframe, limit)
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch {symbol}: {e}")

    # Candles + delta
    delta = _calc_delta(df)
    candles = [
        Candle(
            time=int(row["timestamp"]),
            open=row["open"], high=row["high"],
            low=row["low"], close=row["close"],
            volume=row["volume"],
            delta=round(float(delta.iloc[i]), 2),
        )
        for i, row in df.iterrows()
    ]

    # Volume profile
    profile, poc, vah, val = _volume_profile(df)

    # Levels: fractals + VAH/VAL/POC + 24h high/low
    fractal_levels = _find_fractal_levels(df)
    merged = _merge_close_levels(fractal_levels)
    extra_levels = [
        Level(price=poc, type="POC", strength=3),
        Level(price=vah, type="VAH", strength=2),
        Level(price=val, type="VAL", strength=2),
    ]
    try:
        ticker = _exchange.fetch_ticker(ccxt_symbol)
        extra_levels += [
            Level(price=round(ticker["high"], 6), type="HIGH_24H", strength=2),
            Level(price=round(ticker["low"], 6), type="LOW_24H", strength=2),
        ]
    except Exception:
        pass

    all_levels = merged + extra_levels

    # Supply/Demand zones from volume profile
    zones = _supply_demand_zones(df, profile)

    return ChartData(
        symbol=ccxt_symbol,
        timeframe=timeframe,
        candles=candles,
        volume_profile=profile,
        levels=all_levels,
        zones=zones,
        poc=poc,
        vah=vah,
        val=val,
    )

