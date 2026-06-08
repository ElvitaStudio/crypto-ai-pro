# -*- coding: utf-8 -*-
from fastapi import APIRouter
from api.database import get_conn
from api.models import StrategyStat, Summary

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary", response_model=Summary)
def get_summary():
    with get_conn() as con:
        rows = con.execute("SELECT status, pnl_pct, ai_approved FROM signals").fetchall()

    total = len(rows)
    wins = sum(1 for r in rows if r["status"] == "WIN")
    losses = sum(1 for r in rows if r["status"] == "LOSS")
    open_ = sum(1 for r in rows if r["status"] == "OPEN")
    ai_blocked = sum(1 for r in rows if not r["ai_approved"])
    pnl_vals = [r["pnl_pct"] for r in rows if r["pnl_pct"] is not None]
    total_pnl = round(sum(pnl_vals), 2)
    closed = wins + losses
    win_rate = round(wins / closed * 100, 1) if closed > 0 else 0.0

    return Summary(
        total_signals=total,
        total_wins=wins,
        total_losses=losses,
        total_open=open_,
        win_rate=win_rate,
        total_pnl=total_pnl,
        ai_blocked=ai_blocked,
    )


@router.get("/strategies", response_model=list[StrategyStat])
def get_strategies():
    with get_conn() as con:
        rows = con.execute(
            "SELECT strategy, status, pnl_pct FROM signals"
        ).fetchall()

    buckets: dict[str, list] = {}
    for r in rows:
        buckets.setdefault(r["strategy"], []).append(r)

    result = []
    for strategy, items in buckets.items():
        wins = sum(1 for r in items if r["status"] == "WIN")
        losses = sum(1 for r in items if r["status"] == "LOSS")
        open_ = sum(1 for r in items if r["status"] == "OPEN")
        closed = wins + losses
        win_rate = round(wins / closed * 100, 1) if closed > 0 else 0.0
        pnl_vals = [r["pnl_pct"] for r in items if r["pnl_pct"] is not None]
        avg_pnl = round(sum(pnl_vals) / len(pnl_vals), 2) if pnl_vals else 0.0
        result.append(StrategyStat(
            strategy=strategy,
            total=len(items),
            wins=wins,
            losses=losses,
            open=open_,
            win_rate=win_rate,
            avg_pnl=avg_pnl,
        ))

    result.sort(key=lambda s: s.total, reverse=True)
    return result
