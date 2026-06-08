# -*- coding: utf-8 -*-
"""
Trade tracker: persists open trades to JSON, logs results to CSV.
Each strategy instance creates its own Tracker with separate files.
"""

import csv
import json
import os
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Callable


@dataclass
class Trade:
    symbol: str
    side: str           # "LONG" | "SHORT"
    entry: float
    tp: float
    sl: float
    start_time: float = field(default_factory=time.time)
    features: dict = field(default_factory=dict)


def format_duration(seconds: float) -> str:
    s = int(seconds)
    if s < 60:
        return f"{s} сек"
    if s < 3600:
        return f"{s // 60} мин {s % 60} сек"
    return f"{s // 3600} ч {(s % 3600) // 60} мин"


class Tracker:
    def __init__(self, trades_file: str, db_file: str) -> None:
        os.makedirs(os.path.dirname(trades_file), exist_ok=True)
        os.makedirs(os.path.dirname(db_file), exist_ok=True)
        self._trades_file = trades_file
        self._db_file = db_file
        self._trades: list[Trade] = []
        self._load()

    # ── public interface ──────────────────────────────────────

    def is_active(self, symbol: str) -> bool:
        return any(t.symbol == symbol for t in self._trades)

    def add(self, trade: Trade) -> None:
        self._trades.append(trade)
        self._save()

    def check_all(
        self,
        fetch_price: Callable[[str], float],
        on_close: Callable[[Trade, str, str], None],
    ) -> None:
        """
        Checks every open trade against current price.
        Calls on_close(trade, status, message) when TP or SL is hit.
        status: "WIN" | "LOSS"
        """
        closed: list[Trade] = []
        for trade in self._trades:
            try:
                price = fetch_price(trade.symbol)
                result = self._evaluate(trade, price)
                if result:
                    status, msg = result
                    on_close(trade, status, msg)
                    self._log(trade, 1 if status == "WIN" else 0)
                    closed.append(trade)
            except Exception as e:
                print(f"tracker check error {trade.symbol}: {e}")

        if closed:
            self._trades = [t for t in self._trades if t not in closed]
            self._save()

    # ── private ───────────────────────────────────────────────

    def _evaluate(self, trade: Trade, price: float) -> tuple[str, str] | None:
        dur = format_duration(time.time() - trade.start_time)
        if trade.side == "LONG":
            if price >= trade.tp:
                pct = (price - trade.entry) / trade.entry * 100
                return "WIN", (
                    f"✅ TAKE PROFIT: `{trade.symbol}`\n"
                    f"📈 Прибыль: `+{pct:.2f}%`\n"
                    f"⏱ Время: `{dur}`\n"
                    f"💰 Выход: `{price}`"
                )
            if price <= trade.sl:
                pct = (trade.entry - price) / trade.entry * 100
                return "LOSS", (
                    f"❌ STOP LOSS: `{trade.symbol}`\n"
                    f"📉 Убыток: `-{pct:.2f}%`\n"
                    f"⏱ Время: `{dur}`\n"
                    f"💀 Выход: `{price}`"
                )
        else:  # SHORT
            if price <= trade.tp:
                pct = (trade.entry - price) / trade.entry * 100
                return "WIN", (
                    f"✅ TAKE PROFIT: `{trade.symbol}`\n"
                    f"📉 Прибыль: `+{pct:.2f}%`\n"
                    f"⏱ Время: `{dur}`\n"
                    f"💰 Выход: `{price}`"
                )
            if price >= trade.sl:
                pct = (price - trade.entry) / trade.entry * 100
                return "LOSS", (
                    f"❌ STOP LOSS: `{trade.symbol}`\n"
                    f"📈 Убыток: `-{pct:.2f}%`\n"
                    f"⏱ Время: `{dur}`\n"
                    f"💀 Выход: `{price}`"
                )
        return None

    def _log(self, trade: Trade, result: int) -> None:
        file_exists = os.path.isfile(self._db_file)
        try:
            with open(self._db_file, mode="a", newline="") as f:
                writer = csv.writer(f)
                if not file_exists:
                    writer.writerow([
                        "Date", "Symbol", "Side", "Price",
                        "Vol_Ratio", "RSI", "ADX", "BTC_Corr", "Dist_EMA",
                        "Duration_Sec", "RESULT",
                    ])
                ft = trade.features
                writer.writerow([
                    datetime.now(), trade.symbol, trade.side, trade.entry,
                    ft.get("vol_ratio", 0), ft.get("rsi", 0), ft.get("adx", 0),
                    ft.get("btc_corr", 0), ft.get("dist_ema", 0),
                    round(time.time() - trade.start_time, 2), result,
                ])
        except Exception as e:
            print(f"tracker log error: {e}")

    def _save(self) -> None:
        try:
            with open(self._trades_file, "w") as f:
                json.dump([asdict(t) for t in self._trades], f, indent=2)
        except Exception as e:
            print(f"tracker save error: {e}")

    def _load(self) -> None:
        if not os.path.exists(self._trades_file):
            return
        try:
            with open(self._trades_file) as f:
                raw = json.load(f)
            self._trades = [Trade(**r) for r in raw]
            print(f"📂 Loaded {len(self._trades)} active trades from {self._trades_file}")
        except Exception as e:
            print(f"tracker load error: {e}")
            self._trades = []
