# -*- coding: utf-8 -*-
"""
Strategy: Multi (Sniper / Trend Pullback / SFP) — from multibot.py
"""

import pandas as pd
import pandas_ta as ta

from config import MULTI as CFG
from core.chart import chart_hline
from core.exchange import fetch_ohlcv, fetch_ticker
from strategies.base import BaseStrategy


class MultiStrategy(BaseStrategy):

    def run_scan(self, symbols: list[str]) -> list[dict]:
        signals = []
        for symbol in symbols:
            result = self._analyze(symbol)
            if result:
                signals.append(result)
        return signals

    def _analyze(self, symbol: str) -> dict | None:
        try:
            ohlcv = fetch_ohlcv(symbol, CFG["timeframe"], CFG["limit"])
            if not ohlcv:
                return None

            df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
            df["rsi"] = ta.rsi(df["close"], length=14)
            bb = ta.bbands(df["close"], length=20, std=2)
            df["upper"] = bb["BBU_20_2.0"]
            df["lower"] = bb["BBL_20_2.0"]
            df["ema20"] = ta.ema(df["close"], length=20)
            df["ema50"] = ta.ema(df["close"], length=50)
            df["ema200"] = ta.ema(df["close"], length=200)
            adx_df = ta.adx(df["high"], df["low"], df["close"], length=14)
            df["adx"] = adx_df["ADX_14"]

            curr = df.iloc[-1]
            prev = df.iloc[-2]
            price = curr["close"]

            ticker = fetch_ticker(symbol)
            h24, l24 = ticker["high"], ticker["low"]

            signal, direction, strat_name, reason, level = self._detect(curr, prev, price, h24, l24)
            if not signal:
                return None

            atr = prev["high"] - prev["low"]
            if direction == "LONG":
                stop = price - atr * 1.5
                take = price + atr * 4.5
            else:
                stop = price + atr * 1.5
                take = price - atr * 4.5

            risk_perc = abs(price - stop) / price * 100
            if not (CFG["risk_min_perc"] < risk_perc < CFG["risk_max_perc"]):
                return None

            clean = symbol.split(":")[0]
            icon = "🟢" if direction == "LONG" else "🔴"
            msg = (
                f"{icon} {strat_name} | `{clean}`\n"
                f"Причина: {reason}\n\n"
                f"📊 ВХОД: {price}\n"
                f"🛑 Стоп: {stop:.4f} ({risk_perc:.2f}%)\n"
                f"💰 Тейк: {take:.4f} (R:R 1:3)"
            )

            df_chart = self._load_chart_df(symbol)
            chart = chart_hline(clean, df_chart, level, direction, CFG["chart_timeframe"]) if df_chart is not None and level else None

            return {
                "symbol": clean,
                "direction": direction,
                "entry": price,
                "sl": stop,
                "tp": take,
                "message": msg,
                "chart_buf": chart,
                "strategy_name": strat_name,
                "reasoning": reason,
                "features": {},
            }
        except Exception:
            return None

    def _detect(self, curr, prev, price, h24, l24):
        rsi_ob = CFG["rsi_overbought"]
        rsi_os = CFG["rsi_oversold"]
        adx_min = CFG["adx_trend_min"]

        # Sniper SHORT
        if prev["close"] > prev["upper"] and prev["rsi"] > rsi_ob and curr["close"] < prev["close"]:
            return True, "SHORT", "🔫 SNIPER (Разворот)", f"Вылет за BB + RSI {prev['rsi']:.1f}", prev["upper"]

        # Sniper LONG
        if prev["close"] < prev["lower"] and prev["rsi"] < rsi_os and curr["close"] > prev["close"]:
            return True, "LONG", "🔫 SNIPER (Отскок)", f"Прокол дна BB + RSI {prev['rsi']:.1f}", prev["lower"]

        # Trend pullback LONG
        if (curr["ema20"] > curr["ema50"] > curr["ema200"]) and curr["adx"] > adx_min:
            if curr["low"] <= curr["ema20"] and curr["close"] > curr["ema20"]:
                return True, "LONG", "🌊 TREND (Pullback)", f"Trend. ADX {curr['adx']:.1f}. Откат к EMA20", curr["ema20"]

        # SFP SHORT
        if prev["high"] > h24 and curr["close"] < h24:
            return True, "SHORT", "🐋 SFP (Ликвидность)", "Ложный пробой 24h High", h24

        # SFP LONG
        if prev["low"] < l24 and curr["close"] > l24:
            return True, "LONG", "🐋 SFP (Ликвидность)", "Ложный пробой 24h Low", l24

        return False, None, None, None, None

    def _load_chart_df(self, symbol: str) -> pd.DataFrame | None:
        try:
            ohlcv = fetch_ohlcv(symbol, CFG["chart_timeframe"], 100)
            df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
            df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
            df.set_index("timestamp", inplace=True)
            return df
        except Exception:
            return None
