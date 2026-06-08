# -*- coding: utf-8 -*-
import json
from fastapi import APIRouter, HTTPException, Query
from api.database import get_conn
from api.models import Signal, AIVote

router = APIRouter(prefix="/signals", tags=["signals"])


def _row_to_signal(row) -> Signal:
    return Signal(
        id=row["id"],
        timestamp=row["timestamp"],
        strategy=row["strategy"],
        symbol=row["symbol"],
        direction=row["direction"],
        entry=row["entry"],
        sl=row["sl"],
        tp=row["tp"],
        features=json.loads(row["features"] or "{}"),
        ai_approved=bool(row["ai_approved"]),
        ai_votes=[AIVote(**v) for v in json.loads(row["ai_votes"] or "[]")],
        ai_summary=row["ai_summary"],
        status=row["status"],
        closed_at=row["closed_at"],
        pnl_pct=row["pnl_pct"],
    )


@router.get("", response_model=list[Signal])
def list_signals(
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    strategy: str | None = Query(None),
    status: str | None = Query(None),
    direction: str | None = Query(None),
):
    query = "SELECT * FROM signals WHERE 1=1"
    params: list = []
    if strategy:
        query += " AND strategy=?"
        params.append(strategy)
    if status:
        query += " AND status=?"
        params.append(status.upper())
    if direction:
        query += " AND direction=?"
        params.append(direction.upper())
    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params += [limit, offset]

    with get_conn() as con:
        rows = con.execute(query, params).fetchall()
    return [_row_to_signal(r) for r in rows]


@router.get("/{signal_id}", response_model=Signal)
def get_signal(signal_id: int):
    with get_conn() as con:
        row = con.execute("SELECT * FROM signals WHERE id=?", (signal_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Signal not found")
    return _row_to_signal(row)


@router.get("/latest/id")
def latest_id() -> dict:
    with get_conn() as con:
        row = con.execute("SELECT MAX(id) as max_id FROM signals").fetchone()
    return {"max_id": row["max_id"] or 0}
