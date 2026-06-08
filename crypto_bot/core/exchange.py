# -*- coding: utf-8 -*-
import ccxt
from config import EXCHANGE_TYPE, RATE_LIMIT

_exchange: ccxt.binance | None = None


def get_exchange() -> ccxt.binance:
    global _exchange
    if _exchange is None:
        _exchange = ccxt.binance({
            "enableRateLimit": RATE_LIMIT,
            "options": {"defaultType": EXCHANGE_TYPE},
        })
    return _exchange


def fetch_ohlcv(symbol: str, timeframe: str, limit: int) -> list:
    return get_exchange().fetch_ohlcv(symbol, timeframe, limit=limit)


def fetch_ticker(symbol: str) -> dict:
    return get_exchange().fetch_ticker(symbol)


def fetch_top_coins(limit: int) -> list[str]:
    tickers = get_exchange().fetch_tickers()
    pairs = [
        {"symbol": s, "vol": d["quoteVolume"]}
        for s, d in tickers.items()
        if "/USDT" in s and d["quoteVolume"] and s.isascii()
    ]
    pairs.sort(key=lambda x: x["vol"], reverse=True)
    return [p["symbol"] for p in pairs[:limit]]
