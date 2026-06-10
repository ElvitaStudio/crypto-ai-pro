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
from config import VOLUME_LEVEL, MULTI, VWAP_CHANNEL
from core.signal_formatter import format_signal, format_result

from core import exchange as ex
from core import telegram as tg
from core.tracker import Tracker, Trade
from core.ai_council import council_review
from core.signal_db import save_signal, update_signal_result
from core import signal_gate

from strategies.volume_level import VolumeLevelStrategy
from strategies.multi import MultiStrategy
from strategies.vwap_channel import VwapChannelStrategy



# ── Bot runner ────────────────────────────────────────────────────────────────

class BotRunner:
    def __init__(
        self,
        name: str,
        strategy,
        cfg: dict,
        track: bool = False,
    ) -> None:
        self.name     = name
        self.strategy = strategy
        self.cfg      = cfg
        self.tracker: Tracker | None = None

        if track and "db_file" in cfg and "trades_file" in cfg:
            self.tracker = Tracker(cfg["trades_file"], cfg["db_file"])

    def run(self) -> None:
        print(f"[{self.name}] started")

        coins     = ex.fetch_top_coins(self.cfg["coins_to_scan"])
        iteration = 0

        while True:
            try:
                now = datetime.now().strftime("%H:%M:%S")
                print(f"[{self.name}] scan {now} | coins={len(coins)}")

                # ── Check open trades, send TP/SL results ─────────────────
                if self.tracker:
                    def _on_close(trade, status, msg, _name=self.name):
                        pnl = ((trade.tp - trade.entry) / trade.entry * 100
                               if status == "WIN" else
                               (trade.entry - trade.sl) / trade.entry * -100)
                        result_msg = format_result(trade.symbol, _name, status, round(pnl, 2))
                        tg.notify(UNIFIED_BOT_TOKEN, UNIFIED_RESULTS_CHANNEL, result_msg)
                        update_signal_result(trade.symbol, _name, status, round(pnl, 2))

                    self.tracker.check_all(
                        fetch_price=lambda sym: ex.fetch_ticker(sym + "/USDT" if "/" not in sym else sym)["last"],
                        on_close=_on_close,
                    )

                signals = self.strategy.run_scan(coins)
                print(f"[{self.name}] strategy found {len(signals)} raw signal(s)")
                for sig in signals:
                    # Skip if already tracking this symbol
                    if self.tracker and self.tracker.is_active(sig["symbol"]):
                        continue

                    # ── Quality gate: cooldown + R:R + HTF trends + score ──
                    passed, reason = signal_gate.check(sig)
                    if not passed:
                        print(f"[{self.name}] GATE BLOCKED {sig['symbol']} — {reason}")
                        continue

                    # ── AI Council: unanimous 3/3 ─────────────────────────
                    verdict = council_review(sig)
                    if not verdict.approved:
                        print(f"[{self.name}] AI BLOCKED {sig['symbol']} — {verdict.summary}")
                        continue

                    # ── Build unified message ─────────────────────────────
                    msg = format_signal(sig)
                    badge  = verdict.format_badge()
                    detail = verdict.format_detail()
                    if badge or detail:
                        msg += f"\n\n{badge}{detail}"

                    tg.notify(UNIFIED_BOT_TOKEN, UNIFIED_CHANNEL, msg, sig.get("chart_buf"), sig["symbol"])
                    print(f"[{self.name}] SIGNAL {sig['symbol']} {sig['direction']} | {verdict.summary}")

                    save_signal(self.name, sig, verdict)
                    signal_gate.mark_sent(sig["symbol"])

                    if self.tracker:
                        self.tracker.add(Trade(
                            symbol=sig["symbol"],
                            side=sig["direction"],
                            entry=sig["entry"],
                            tp=sig["tp"],
                            sl=sig["sl"],
                            features=sig.get("features", {}),
                        ))

                iteration += 1
                if iteration % TOP_COINS_REFRESH_INTERVAL == 0:
                    coins = ex.fetch_top_coins(self.cfg["coins_to_scan"])
                    print(f"[{self.name}] coin list refreshed")

                time.sleep(self.cfg["scan_interval_sec"])

            except KeyboardInterrupt:
                print(f"[{self.name}] stopped")
                break
            except Exception as e:
                print(f"[{self.name}] loop error: {e}")
                time.sleep(30)


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    # TitanFractal disabled: 14.7% win rate (19W/110L) — too many losses.
    # Re-enable only after strategy is reworked and backtested.
    runners = [
        BotRunner(name="VolumeLevel", strategy=VolumeLevelStrategy(), cfg=VOLUME_LEVEL, track=True),
        BotRunner(name="Multi",       strategy=MultiStrategy(),        cfg=MULTI,        track=False),
        BotRunner(name="NexusVWAP",   strategy=VwapChannelStrategy(),  cfg=VWAP_CHANNEL, track=False),
    ]

    threads = [threading.Thread(target=r.run, daemon=True, name=r.name) for r in runners]
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
