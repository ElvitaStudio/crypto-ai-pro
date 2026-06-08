# -*- coding: utf-8 -*-
import asyncio
import json
import time
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api.database import get_conn
from api.routers import signals, stats, settings, chart, access, stars, admin
from api.routers.signals import _row_to_signal
from api.routers.access import _poll_tron_transactions


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_poll_tron_transactions())
    yield
    task.cancel()


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

    # Send last 20 signals immediately on connect
    with get_conn() as con:
        rows = con.execute("SELECT * FROM signals ORDER BY timestamp DESC LIMIT 20").fetchall()
    initial = [_row_to_signal(r).model_dump() for r in reversed(rows)]
    await websocket.send_text(json.dumps({"type": "init", "data": initial}))

    last_id: int = initial[-1]["id"] if initial else 0

    try:
        while True:
            await asyncio.sleep(2)
            with get_conn() as con:
                rows = con.execute(
                    "SELECT * FROM signals WHERE id > ? ORDER BY id ASC",
                    (last_id,),
                ).fetchall()
            if rows:
                new_signals = [_row_to_signal(r).model_dump() for r in rows]
                last_id = new_signals[-1]["id"]
                await websocket.send_text(json.dumps({"type": "new", "data": new_signals}))
    except WebSocketDisconnect:
        pass
