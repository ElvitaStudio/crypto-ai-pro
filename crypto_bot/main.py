# -*- coding: utf-8 -*-
"""
Main runner: launches all active strategies in parallel threads.
All signals are sent to a single unified Telegram channel in a consistent format.
"""

import matplotlib
matplotlib.use("Agg")  # non-interactive backend — required for background threads on macOS

import sys
import time
import threading
from datetime import datetime

from config import UNIFIED_BOT_TOKEN, UNIFIED_CHANNEL, UNIFIED_RESULTS_CHANNEL
from config import TOP_COINS_REFRESH_INTERVAL
from core.signal_formatter import format_signal, format_result

from core import exchange as ex
from core import telegram as tg
from core.tracker import Tracker, Trade
from core.ai_council import council_review
from core.signal_db import save_signal, update_signal_result
from core import signal_gate

from strategies.cvd_vwap import generate_signal as cvd_vwap_signal



# ── CvdVwap runner (dual-timeframe — needs custom scan loop) ─────────────────

class CvdVwapRunner:
    """
    Dedicated runner for CvdVwap strategy.
    Fetches 15m + 1h OHLCV for each coin and calls generate_signal().
    """

    NAME = "CvdVwap"
    SCAN_INTERVAL = 60          # seconds between scans
    COINS_TO_SCAN = 40
    CANDLES_15M   = 100
    CANDLES_1H    = 60

    def __init__(self) -> None:
        self.tracker = Tracker("data/trades_cvdvwap.json", "data/signals.db")

    def _fetch_df(self, symbol: str, timeframe: str, limit: int):
        import ccxt
        import pandas as pd
        exchange = ccxt.binance({"enableRateLimit": True, "options": {"defaultType": "future"}, "timeout": 30_000})
        raw = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        df  = pd.DataFrame(raw, columns=["timestamp", "open", "high", "low", "close", "volume"])
        return df

    def run(self) -> None:
        print(f"[{self.NAME}] started")
        coins     = ex.fetch_top_coins(self.COINS_TO_SCAN)
        iteration = 0

        while True:
            try:
                now = datetime.now().strftime("%H:%M:%S")
                print(f"[{self.NAME}] scan {now} | coins={len(coins)}")

                # Check open trades
                def _on_close(trade, status, _=None):
                    pnl = ((trade.tp - trade.entry) / trade.entry * 100
                           if status == "WIN" else
                           (trade.entry - trade.sl) / trade.entry * -100)
                    result_msg = format_result(trade.symbol, self.NAME, status, round(pnl, 2))
                    tg.notify(UNIFIED_BOT_TOKEN, UNIFIED_RESULTS_CHANNEL, result_msg)
                    update_signal_result(trade.symbol, self.NAME, status, round(pnl, 2))

                self.tracker.check_all(
                    fetch_price=lambda sym: ex.fetch_ticker(sym + "/USDT" if "/" not in sym else sym)["last"],
                    on_close=_on_close,
                )

                signals_found = 0
                for coin in coins:
                    # Normalise: "BTC/USDT" or "BTC" → "BTC/USDT"
                    symbol = coin.split(":")[0]   # strip :USDT suffix if present
                    if "/" not in symbol:
                        symbol = f"{symbol}/USDT"
                    if self.tracker.is_active(symbol):
                        continue
                    try:
                        df_15m = self._fetch_df(symbol, "15m", self.CANDLES_15M)
                        df_1h  = self._fetch_df(symbol, "1h",  self.CANDLES_1H)
                        sig    = cvd_vwap_signal(symbol, df_15m, df_1h)
                    except Exception as e:
                        print(f"[{self.NAME}] fetch error {symbol}: {e}")
                        continue

                    if sig is None:
                        continue

                    signals_found += 1
                    passed, reason = signal_gate.check(sig)
                    if not passed:
                        print(f"[{self.NAME}] GATE BLOCKED {symbol} — {reason}")
                        continue

                    verdict = council_review(sig)
                    if not verdict.approved:
                        print(f"[{self.NAME}] AI BLOCKED {symbol} — {verdict.summary}")
                        continue

                    msg   = format_signal(sig)
                    badge  = verdict.format_badge()
                    detail = verdict.format_detail()
                    if badge or detail:
                        msg += f"\n\n{badge}{detail}"

                    tg.notify(UNIFIED_BOT_TOKEN, UNIFIED_CHANNEL, msg, None, symbol)
                    print(f"[{self.NAME}] SIGNAL {symbol} {sig['direction']} | {verdict.summary}")

                    save_signal(self.NAME, sig, verdict)
                    signal_gate.mark_sent(symbol)

                    self.tracker.add(Trade(
                        symbol=symbol,
                        side=sig["direction"],
                        entry=sig["entry"],
                        tp=sig["tp"],
                        sl=sig["sl"],
                        features=sig.get("features", {}),
                    ))

                print(f"[{self.NAME}] raw signals found: {signals_found}")

                iteration += 1
                if iteration % TOP_COINS_REFRESH_INTERVAL == 0:
                    coins = ex.fetch_top_coins(self.COINS_TO_SCAN)

                time.sleep(self.SCAN_INTERVAL)

            except KeyboardInterrupt:
                print(f"[{self.NAME}] stopped")
                break
            except Exception as e:
                print(f"[{self.NAME}] loop error: {e}")
                time.sleep(30)


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    cvd_runner = CvdVwapRunner()
    threads = [threading.Thread(target=cvd_runner.run, daemon=True, name="CvdVwap")]
    for i, t in enumerate(threads):
        t.start()
        print(f"Thread started: {t.name}")
        if i < len(threads) - 1:
            time.sleep(5)   # stagger startup so threads don't hammer Binance simultaneously

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        print("Shutting down...")
        sys.exit(0)


if __name__ == "__main__":
    main()
