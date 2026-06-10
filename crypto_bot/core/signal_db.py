# -*- coding: utf-8 -*-
"""
Shared SQLite writer. Called by BotRunner after each signal.
The same .db file is read by the FastAPI backend.
"""

import json
import os
import sqlite3
import time

DB_PATH = os.environ.get("SIGNALS_DB_PATH", os.path.join(os.path.dirname(__file__), "../../data/signals.db"))


def _conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    with _conn() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS signals (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp   REAL    NOT NULL,
                strategy    TEXT    NOT NULL,
                symbol      TEXT    NOT NULL,
                direction   TEXT    NOT NULL,
                entry       REAL    NOT NULL,
                sl          REAL    NOT NULL,
                tp          REAL    NOT NULL,
                features    TEXT,
                ai_approved INTEGER NOT NULL DEFAULT 1,
                ai_votes    TEXT,
                ai_summary  TEXT,
                status      TEXT    NOT NULL DEFAULT 'OPEN',
                closed_at   REAL,
                pnl_pct     REAL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            INSERT OR IGNORE INTO settings VALUES ('volume_level_enabled', 'true');
            INSERT OR IGNORE INTO settings VALUES ('multi_enabled', 'true');
            INSERT OR IGNORE INTO settings VALUES ('vwap_channel_enabled', 'true');
            INSERT OR IGNORE INTO settings VALUES ('fractal_enabled', 'true');
            INSERT OR IGNORE INTO settings VALUES ('ai_council_enabled', 'true');
            INSERT OR IGNORE INTO settings VALUES ('volume_level_coins', '40');
            INSERT OR IGNORE INTO settings VALUES ('multi_coins', '80');
            INSERT OR IGNORE INTO settings VALUES ('vwap_channel_coins', '60');
            INSERT OR IGNORE INTO settings VALUES ('fractal_coins', '50');
        """)


def save_signal(strategy: str, sig: dict, verdict) -> int:
    """Returns the new row id."""
    with _conn() as con:
        cur = con.execute(
            """INSERT INTO signals
               (timestamp, strategy, symbol, direction, entry, sl, tp,
                features, ai_approved, ai_votes, ai_summary)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                time.time(),
                strategy,
                sig["symbol"],
                sig["direction"],
                sig["entry"],
                sig["sl"],
                sig["tp"],
                json.dumps(sig.get("features", {})),
                1 if verdict.approved else 0,
                json.dumps([
                    {"model": v.model, "approved": v.approved,
                     "confidence": v.confidence, "reasoning": v.reasoning}
                    for v in verdict.votes
                ]),
                verdict.summary,
            ),
        )
        return cur.lastrowid


def update_signal_result(symbol: str, strategy: str, status: str, pnl_pct: float) -> None:
    with _conn() as con:
        con.execute(
            """UPDATE signals SET status=?, closed_at=?, pnl_pct=?
               WHERE id=(
                 SELECT id FROM signals
                 WHERE symbol=? AND strategy=? AND status='OPEN'
                 ORDER BY timestamp DESC LIMIT 1
               )""",
            (status, time.time(), pnl_pct, symbol, strategy),
        )


init_db()
