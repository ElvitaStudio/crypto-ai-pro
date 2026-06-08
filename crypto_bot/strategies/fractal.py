# -*- coding: utf-8 -*-
"""
Strategy: Fractal Level Retest — from titanbot.py
"""

import pandas as pd
import pandas_ta as ta

from config import FRACTAL as CFG
from core.chart import chart_hline
from core.exchange import fetch_ohlcv
from strategies.base import BaseStrategy


class FractalStrategy(BaseStrategy):

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

            # ── Indicators for feature dict & AI context ──────────────────
            df["rsi"] = ta.rsi(df["close"], length=14)
            adx_df    = ta.adx(df["high"], df["low"], df["close"], length=14)
            df["adx"] = adx_df["ADX_14"]
            df["vol_sma"] = df["volume"].rolling(20).mean()

            price = df["close"].iloc[-1]
            open_ = df["open"].iloc[-1]
            levels = self._find_levels(df, CFG["fractal_window"])

            proximity = CFG["level_proximity_perc"]
            recent_threshold = CFG["limit"] - 100
            nearby = [
                lvl for lvl in levels
                if lvl["index"] > recent_threshold
                and abs(price - lvl["price"]) / price * 100 < proximity
            ]
            if not nearby:
                return None

            level = min(nearby, key=lambda x: abs(x["price"] - price))
            lvl_price = level["price"]

            direction, desc = self._detect(df, price, open_, lvl_price, level["type"])
            if not direction:
                return None

            sl_buf = CFG["sl_buffer_perc"] / 100
            rr = CFG["rr_ratio"]
            if direction == "LONG":
                stop = lvl_price * (1 - sl_buf)
                risk = price - stop
                take = price + risk * rr
            else:
                stop = lvl_price * (1 + sl_buf)
                risk = stop - price
                take = price - risk * rr

            if risk <= 0:
                return None

            last      = df.iloc[-1]
            rsi_val   = round(float(last["rsi"]),   2) if pd.notna(last["rsi"])   else 50.0
            adx_val   = round(float(last["adx"]),   2) if pd.notna(last["adx"])   else 0.0
            vol_ratio = round(float(last["volume"] / last["vol_sma"]), 2) if last["vol_sma"] > 0 else 1.0

            clean = symbol.split(":")[0]
            msg = (
                f"🏛 TITAN: PRICE ACTION | `{clean}`\n"
                f"Формация: {desc}\n"
                f"🧱 Уровень: {lvl_price}\n\n"
                f"⚡ СИГНАЛ: {direction}\n"
                f"🎯 Вход: {price}\n"
                f"🛑 Стоп: {stop:.4f}\n"
                f"💰 Тейк: {take:.4f} (R:R 1:{rr:.0f})"
            )

            chart = chart_hline(clean, df, lvl_price, direction, CFG["timeframe"])

            return {
                "symbol": clean,
                "direction": direction,
                "entry": price,
                "sl": stop,
                "tp": take,
                "message": msg,
                "chart_buf": chart,
                "strategy_name": "FractalRetest",
                "reasoning": f"{desc}. RSI={rsi_val}, ADX={adx_val}, VolRatio={vol_ratio}",
                "features": {
                    "rsi":       rsi_val,
                    "adx":       adx_val,
                    "vol_ratio": vol_ratio,
                },
            }
        except Exception:
            return None

    def _detect(self, df, price: float, open_: float, lvl_price: float, lvl_type: str):
        body = abs(price - open_)
        candle_range = df["high"].iloc[-1] - df["low"].iloc[-1]
        strong_candle = body > candle_range * 0.5

        if price > lvl_price and price > open_ and lvl_type == "RESISTANCE" and strong_candle:
            return "LONG", "Ретест зеркального уровня (R → S)"
        if price < lvl_price and price < open_ and lvl_type == "SUPPORT" and strong_candle:
            return "SHORT", "Ретест зеркального уровня (S → R)"
        return None, ""

    def _find_levels(self, df: pd.DataFrame, window: int) -> list[dict]:
        levels = []
        for i in range(window, len(df) - window):
            is_high = all(
                df["high"].iloc[i] > df["high"].iloc[i - j] and df["high"].iloc[i] > df["high"].iloc[i + j]
                for j in range(1, window + 1)
            )
            is_low = all(
                df["low"].iloc[i] < df["low"].iloc[i - j] and df["low"].iloc[i] < df["low"].iloc[i + j]
                for j in range(1, window + 1)
            )
            if is_high:
                levels.append({"price": df["high"].iloc[i], "type": "RESISTANCE", "index": i})
            if is_low:
                levels.append({"price": df["low"].iloc[i], "type": "SUPPORT", "index": i})
        return levels
