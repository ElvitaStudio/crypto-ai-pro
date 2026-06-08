# -*- coding: utf-8 -*-
"""
Strategy: VWAP + Linear Regression Channel — from nexusbot.py
"""

import pandas as pd
import pandas_ta as ta

from config import VWAP_CHANNEL as CFG
from core.chart import chart_channel
from core.exchange import fetch_ohlcv
from strategies.base import BaseStrategy


class VwapChannelStrategy(BaseStrategy):

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
            df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
            df.set_index("timestamp", inplace=True)

            df.ta.vwap(append=True)
            if "VWAP_D" not in df.columns:
                return None
            df["vwap"] = df["VWAP_D"]
            df["linreg"] = ta.linreg(df["close"], length=20)
            df["stdev"] = ta.stdev(df["close"], length=20)
            mult = CFG["std_dev_mult"]
            df["upper"] = df["linreg"] + df["stdev"] * mult
            df["lower"] = df["linreg"] - df["stdev"] * mult

            curr = df.iloc[-1]
            slope = df["linreg"].iloc[-1] - df["linreg"].iloc[-5]
            price = curr["close"]

            direction, reason = self._detect(curr, slope)
            if not direction:
                return None

            atr = curr["high"] - curr["low"]
            if direction == "LONG":
                stop = price - atr * 2
                take = curr["linreg"] if (curr["linreg"] - price) > (price - stop) else curr["upper"]
            else:
                stop = price + atr * 2
                take = curr["linreg"] if (price - curr["linreg"]) > (stop - price) else curr["lower"]

            risk_perc = abs(price - stop) / price * 100
            reward_perc = abs(price - take) / price * 100
            if risk_perc == 0:
                return None
            rr = reward_perc / risk_perc
            if rr < CFG["min_rr"]:
                return None

            clean = symbol.split(":")[0]
            msg = (
                f"🌌 NEXUS: STATISTICAL | `{clean}`\n"
                f"Причина: {reason}\n"
                f"📊 Канал: наклон {slope:.4f}\n\n"
                f"⚡ СИГНАЛ: {direction}\n"
                f"🎯 Вход: {price}\n"
                f"🛑 Стоп: {stop:.4f} (-{risk_perc:.2f}%)\n"
                f"💰 Тейк: {take:.4f} (R:R {rr:.2f})"
            )

            chart = chart_channel(clean, df, direction, CFG["timeframe"])

            return {
                "symbol": clean,
                "direction": direction,
                "entry": price,
                "sl": stop,
                "tp": take,
                "message": msg,
                "chart_buf": chart,
                "strategy_name": "VwapChannel",
                "reasoning": reason,
                "features": {},
            }
        except Exception:
            return None

    def _detect(self, curr, slope: float) -> tuple[str | None, str]:
        if slope > 0:
            if curr["close"] < curr["vwap"] and curr["low"] <= curr["lower"] and curr["close"] > curr["open"]:
                return "LONG", "Касание дна канала + ниже VWAP"
        elif slope < 0:
            if curr["close"] > curr["vwap"] and curr["high"] >= curr["upper"] and curr["close"] < curr["open"]:
                return "SHORT", "Касание верха канала + выше VWAP"
        return None, ""
