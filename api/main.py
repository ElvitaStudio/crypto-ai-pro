# -*- coding: utf-8 -*-
import asyncio
import json
import time
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

import ccxt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api.database import get_conn
from api.routers import signals, stats, settings, chart, access, stars, admin
from api.routers.signals import _row_to_signal
from api.routers.access import _poll_tron_transactions, _send_expiry_reminders

logger = logging.getLogger("api.main")

# ── Exchange for price monitoring ─────────────────────────────────────────────
_exchange = ccxt.binance({
    "enableRateLimit": True,
    "options": {"defaultType": "future"},
})

# ── WebSocket connection manager ──────────────────────────────────────────────
_ws_clients: set[WebSocket] = set()


async def _broadcast(msg: dict) -> None:
    """Send a JSON message to all connected WS clients."""
    dead: set[WebSocket] = set()
    text = json.dumps(msg)
    for ws in list(_ws_clients):
        try:
            await ws.send_text(text)
        except Exception:
            dead.add(ws)
    _ws_clients.difference_update(dead)


# ── TP/SL price monitor ───────────────────────────────────────────────────────
MONITOR_INTERVAL = 30   # seconds between price checks


async def _monitor_open_signals() -> None:
    """
    Every MONITOR_INTERVAL seconds:
    - Fetch all OPEN signals from DB
    - Get current price from Binance
    - If LONG and price >= TP  → WIN
    - If LONG and price <= SL  → LOSS
    - If SHORT and price <= TP → WIN
    - If SHORT and price >= SL → LOSS
    - Broadcast updated signal via WebSocket
    """
    while True:
        await asyncio.sleep(MONITOR_INTERVAL)
        try:
            with get_conn() as con:
                rows = con.execute(
                    "SELECT * FROM signals WHERE status='OPEN'"
                ).fetchall()

            if not rows:
                continue

            # Group by symbol to batch price fetches
            symbols = list({r["symbol"] for r in rows})
            prices: dict[str, float] = {}
            for sym in symbols:
                try:
                    ticker = await asyncio.get_event_loop().run_in_executor(
                        None, lambda s=sym: _exchange.fetch_ticker(s)
                    )
                    prices[sym] = float(ticker["last"])
                except Exception as e:
                    logger.warning("Price fetch failed for %s: %s", sym, e)

            now = time.time()
            for row in rows:
                sym = row["symbol"]
                price = prices.get(sym)
                if price is None:
                    continue

                direction = row["direction"]
                tp = row["tp"]
                sl = row["sl"]
                entry = row["entry"]

                # Determine if TP or SL was hit
                new_status: str | None = None
                if direction == "LONG":
                    if price >= tp:
                        new_status = "WIN"
                    elif price <= sl:
                        new_status = "LOSS"
                else:  # SHORT
                    if price <= tp:
                        new_status = "WIN"
                    elif price >= sl:
                        new_status = "LOSS"

                if new_status is None:
                    continue

                pnl = (
                    (price - entry) / entry * 100
                    if direction == "LONG"
                    else (entry - price) / entry * 100
                )

                with get_conn() as con:
                    con.execute(
                        "UPDATE signals SET status=?, closed_at=?, pnl_pct=? WHERE id=?",
                        (new_status, now, round(pnl, 2), row["id"]),
                    )

                # Re-fetch updated row and push to WS clients
                with get_conn() as con:
                    updated_row = con.execute(
                        "SELECT * FROM signals WHERE id=?", (row["id"],)
                    ).fetchone()
                if updated_row:
                    signal_data = _row_to_signal(updated_row).model_dump()
                    await _broadcast({"type": "update", "data": signal_data})
                    logger.info(
                        "Signal #%d %s → %s @ %.6f (pnl %.2f%%)",
                        row["id"], sym, new_status, price, pnl
                    )

        except Exception as e:
            logger.exception("_monitor_open_signals error: %s", e)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    t1 = asyncio.create_task(_poll_tron_transactions())
    t2 = asyncio.create_task(_send_expiry_reminders())
    t3 = asyncio.create_task(_monitor_open_signals())
    yield
    t1.cancel()
    t2.cancel()
    t3.cancel()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Crypto Signals API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(signals.router)
app.include_router(stats.router)
app.include_router(settings.router)
app.include_router(chart.router)
app.include_router(access.router)
app.include_router(stars.router)
app.include_router(admin.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "timestamp": time.time()}


# ── WebSocket: live signal feed ───────────────────────────────────────────────

@app.websocket("/ws/signals")
async def ws_signals(websocket: WebSocket):
    await websocket.accept()
    _ws_clients.add(websocket)

    # Send last 20 signals immediately on connect
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM signals ORDER BY timestamp DESC LIMIT 20"
        ).fetchall()
    initial = [_row_to_signal(r).model_dump() for r in reversed(rows)]
    await websocket.send_text(json.dumps({"type": "init", "data": initial}))

    last_id: int = initial[-1]["id"] if initial else 0

    try:
        while True:
            await asyncio.sleep(2)
            with get_conn() as con:
                new_rows = con.execute(
                    "SELECT * FROM signals WHERE id > ? ORDER BY id ASC",
                    (last_id,),
                ).fetchall()
            if new_rows:
                new_signals = [_row_to_signal(r).model_dump() for r in new_rows]
                last_id = new_signals[-1]["id"]
                await websocket.send_text(
                    json.dumps({"type": "new", "data": new_signals})
                )
    except WebSocketDisconnect:
        pass
    finally:
        _ws_clients.discard(websocket)
