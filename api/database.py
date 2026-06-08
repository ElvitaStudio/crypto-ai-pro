# -*- coding: utf-8 -*-
import os
import sqlite3

DB_PATH = os.environ.get("SIGNALS_DB_PATH", os.path.join(os.path.dirname(__file__), "../data/signals.db"))


def get_conn() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con
