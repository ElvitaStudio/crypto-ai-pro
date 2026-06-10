# -*- coding: utf-8 -*-
import threading
import time
import ccxt
from config import EXCHANGE_TYPE, RATE_LIMIT

_exchange: ccxt.binance | None = None
_exchange_lock = threading.Lock()

# Shared coin list cache — fetched once, shared across all strategy threads
_coins_cache: list[str] = []
_coins_lock  = threading.Lock()
_coins_fetched_at: float = 0
_COINS_TTL = 1800  # refresh every 30 min


def get_exchange() -> ccxt.binance:
    global _exchange
    if _exchange is None:
        with _exchange_lock:
            if _exchange is None:
                _exchange = ccxt.binance({
                    "enableRateLimit": RATE_LIMIT,
                    "timeout": 30_000,   # 30 s hard timeout per request
                    "options": {"defaultType": EXCHANGE_TYPE},
                })
    return _exchange


def fetch_ohlcv(symbol: str, timeframe: str, limit: int) -> list:
    return get_exchange().fetch_ohlcv(symbol, timeframe, limit=limit)


def fetch_ticker(symbol: str) -> dict:
    return get_exchange().fetch_ticker(symbol)


def fetch_top_coins(limit: int) -> list[str]:
    """
    Returns top USDT futures pairs by volume.
    Uses a shared cache (TTL=30 min) so only one thread ever calls fetch_tickers().
    All other threads get the cached list instantly.
    """
    global _coins_cache, _coins_fetched_at

    now = time.time()
    if _coins_cache and (now - _coins_fetched_at) < _COINS_TTL:
        # Return the largest slice requested — cache always stores full list
        return _coins_cache[:limit]

    with _coins_lock:
        # Double-checked locking: another thread may have refreshed while we waited
        now = time.time()
        if _coins_cache and (now - _coins_fetched_at) < _COINS_TTL:
            return _coins_cache[:limit]

        tickers = get_exchange().fetch_tickers()
        pairs = [
            {"symbol": s, "vol": d["quoteVolume"] or 0}
            for s, d in tickers.items()
            if "/USDT" in s and d.get("quoteVolume") and s.isascii()
        ]
        pairs.sort(key=lambda x: x["vol"], reverse=True)
        _coins_cache = [p["symbol"] for p in pairs[:200]]  # cache top-200
        _coins_fetched_at = time.time()
        return _coins_cache[:limit]
