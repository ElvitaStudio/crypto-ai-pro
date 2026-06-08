# -*- coding: utf-8 -*-
"""
Strategy: Volume Anomaly + 24h Level Breakout (from bot.py v6.0)
Signals: VOLUME | LEVEL_HIGH | LEVEL_LOW
AI filter: RSI / ADX / volume ratio thresholds per direction
"""

import pandas as pd
import pandas_ta as ta

from config import VOLUME_LEVEL as CFG
from core.chart import chart_hline
from core.exchange import fetch_ohlcv, fetch_ticker
from strategies.base import BaseStrategy


class VolumeLevelStrategy(BaseStrategy):

    def run_scan(self, symbols: list[str]) -> list[dict]:
        btc_close = self._get_btc_close()
        signals = []
        for symbol in symbols:
            result = self._analyze(symbol, btc_close)
            if result:
                signals.append(result)
        return signals

    # ── private ───────────────────────────────────────────────

    def _analyze(self, symbol: str, btc_close: pd.Series) -> dict | None:
        try:
            ohlcv = fetch_ohlcv(symbol, CFG["timeframe"], CFG["limit"])
            if not ohlcv:
                return None

            df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
            df["RSI"] = ta.rsi(df["close"], length=14)
            df["ADX"] = ta.adx(df["high"], df["low"], df["close"])["ADX_14"]
            df["EMA_200"] = ta.ema(df["close"], length=200)
            df["Vol_SMA"] = df["volume"].rolling(20).mean()

            last = df.iloc[-1]
            avg_vol = df["volume"].iloc[:-5].mean()
            price_change = abs((last["close"] - last["open"]) / last["open"]) * 100

            ticker = fetch_ticker(symbol)
            high_24h = ticker["high"]
            low_24h = ticker["low"]
            dist_high = abs((high_24h - last["close"]) / last["close"]) * 100
            dist_low = abs((low_24h - last["close"]) / last["close"]) * 100

            signal_type, direction, level, entry, stop = self._detect_signal(
                df, last, avg_vol, price_change, high_24h, low_24h, dist_high, dist_low
            )
            if not signal_type:
                return None

            rsi = last["RSI"]
            adx = last["ADX"]
            vol_ratio = last["volume"] / last["Vol_SMA"] if last["Vol_SMA"] > 0 else 0

            if not self._ai_filter(direction, rsi, adx, vol_ratio, symbol):
                return None

            risk = abs(entry - stop) or entry * 0.005
            tp = entry + risk * 3 if direction == "LONG" else entry - risk * 3

            clean = symbol.split(":")[0]
            dist = min(dist_high, dist_low)
            icon = "🟢" if direction == "LONG" else "🔴"
            titles = {
                "VOLUME": "АНОМАЛИЯ ОБЪЕМА",
                "LEVEL_HIGH": "ПРОБОЙ ХАЯ 24H",
                "LEVEL_LOW": "ПРОБОЙ ЛОЯ 24H",
            }
            msg = (
                f"{icon} {titles[signal_type]} | `{clean}`\n"
                f"Цена: {last['close']}\n"
                f"Дистанция: {dist:.2f}%\n\n"
                f"📊 **СЕТАП ({direction}):**\n"
                f"🚪 Вход: {entry}\n"
                f"🛑 Стоп: {stop} (Риск: {risk / entry * 100:.2f}%)\n"
                f"💰 Тейк: {tp:.4f} (R:R 1:3)"
            )

            df_chart = self._load_chart_df(symbol)
            chart = chart_hline(clean, df_chart, level, direction, CFG["chart_timeframe"]) if df_chart is not None else None

            min_len = min(len(df), len(btc_close))
            corr = pd.Series(df["close"].iloc[-min_len:].values).corr(pd.Series(btc_close.iloc[-min_len:].values))
            ema_200 = last["EMA_200"]
            dist_ema = (last["close"] - ema_200) / ema_200 if pd.notna(ema_200) else 0

            return {
                "symbol": clean,
                "direction": direction,
                "entry": entry,
                "sl": stop,
                "tp": tp,
                "message": msg,
                "chart_buf": chart,
                "strategy_name": "VolumeLevel",
                "reasoning": f"{signal_type} signal. RSI={rsi:.1f}, ADX={adx:.1f}, VolRatio={vol_ratio:.2f}",
                "features": {
                    "vol_ratio": round(vol_ratio, 2),
                    "rsi": round(rsi, 2),
                    "adx": round(adx, 2),
                    "btc_corr": round(corr, 2),
                    "dist_ema": round(dist_ema, 4),
                },
            }
        except Exception:
            return None

    def _detect_signal(self, df, last, avg_vol, price_change, high_24h, low_24h, dist_high, dist_low):
        vol_mult = CFG["vol_multiplier"]
        price_thr = CFG["price_change_perc"]
        level_dist = CFG["level_distance_perc"]

        if last["volume"] > avg_vol * vol_mult and price_change >= price_thr:
            direction = "LONG" if last["close"] > last["open"] else "SHORT"
            stop = df["low"].iloc[-1] if direction == "LONG" else df["high"].iloc[-1]
            return "VOLUME", direction, last["close"], last["close"], stop

        if dist_high <= level_dist and last["close"] > df["close"].iloc[-2]:
            stop = df["low"].iloc[-3:].min()
            return "LEVEL_HIGH", "LONG", high_24h, high_24h, stop

        if dist_low <= level_dist and last["close"] < df["close"].iloc[-2]:
            stop = df["high"].iloc[-3:].max()
            return "LEVEL_LOW", "SHORT", low_24h, low_24h, stop

        return None, None, None, None, None

    def _ai_filter(self, direction: str, rsi: float, adx: float, vol_ratio: float, symbol: str) -> bool:
        c = CFG
        if direction == "LONG":
            ok = rsi < c["long_rsi_max"] and adx < c["long_adx_max"] and c["long_vol_ratio_min"] < vol_ratio < c["long_vol_ratio_max"]
            if not ok:
                print(f"🤖 AI Blocked LONG: {symbol} (RSI={rsi:.1f}, ADX={adx:.1f})")
            return ok
        else:
            ok = c["short_rsi_min"] < rsi < c["short_rsi_max"] and adx < c["short_adx_max"] and c["short_vol_ratio_min"] < vol_ratio < c["short_vol_ratio_max"]
            if not ok:
                print(f"🤖 AI Blocked SHORT: {symbol} (RSI={rsi:.1f}, ADX={adx:.1f})")
            return ok

    def _load_chart_df(self, symbol: str) -> pd.DataFrame | None:
        try:
            ohlcv = fetch_ohlcv(symbol, CFG["chart_timeframe"], CFG["chart_limit"])
            df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
            df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
            df.set_index("timestamp", inplace=True)
            return df
        except Exception:
            return None

    def _get_btc_close(self) -> pd.Series:
        try:
            bars = fetch_ohlcv("BTC/USDT", CFG["timeframe"], 200)
            return pd.DataFrame(bars, columns=["t", "o", "h", "l", "close", "v"])["close"]
        except Exception:
            return pd.Series([0] * 200)
