# -*- coding: utf-8 -*-
"""
Admin panel API.

Authentication: Bearer token = ADMIN_TOKEN from .env
Set ADMIN_TOKEN=your_secret in .env

Endpoints:
  POST /admin/login                  → returns token
  GET  /admin/users                  → list all users
  POST /admin/users/{id}/vip         → grant/revoke VIP
  POST /admin/broadcast              → send message to selected users
  GET  /admin/payment-methods        → list payment methods
  POST /admin/payment-methods        → add method
  PUT  /admin/payment-methods/{id}   → update method
  DELETE /admin/payment-methods/{id} → delete method
"""

import logging
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from api.database import get_conn

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "changeme")
BOT_TOKEN   = os.environ.get("BOT_TOKEN", "")
BOT_API     = "https://api.telegram.org"

security = HTTPBearer()


# ── Auth ──────────────────────────────────────────────────────────────────────

def _require_admin(creds: Annotated[HTTPAuthorizationCredentials, Depends(security)]):
    if creds.credentials != ADMIN_TOKEN:
        raise HTTPException(401, "Invalid admin token")


class LoginRequest(BaseModel):
    password: str


@router.post("/login")
def login(body: LoginRequest):
    if body.password != ADMIN_TOKEN:
        raise HTTPException(401, "Wrong password")
    return {"token": ADMIN_TOKEN}


# ── DB init ───────────────────────────────────────────────────────────────────

def _init_admin_tables() -> None:
    with get_conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS payment_methods (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                network     TEXT NOT NULL,
                currency    TEXT NOT NULL DEFAULT 'USDT',
                address     TEXT NOT NULL,
                label       TEXT,
                fee_info    TEXT,
                is_active   INTEGER DEFAULT 1,
                created_at  REAL DEFAULT (unixepoch())
            )
        """)
        con.commit()
        # Seed default methods if table is empty
        count = con.execute("SELECT COUNT(*) FROM payment_methods").fetchone()[0]
        if count == 0:
            defaults = [
                ("TRC20", "USDT", os.environ.get("USDT_WALLET_TRC20", ""),
                 "TRC-20 (Tron)", "~$1"),
                ("ERC20", "USDT", os.environ.get("USDT_WALLET_ERC20", ""),
                 "ERC-20 (Ethereum)", "~$5-15"),
                ("BEP20", "USDT", os.environ.get("USDT_WALLET_BEP20", ""),
                 "BEP-20 (BSC)", "~$0.5"),
            ]
            for net, cur, addr, label, fee in defaults:
                if addr:
                    con.execute(
                        "INSERT INTO payment_methods (network, currency, address, label, fee_info) VALUES (?,?,?,?,?)",
                        (net, cur, addr, label, fee),
                    )
            con.commit()


_init_admin_tables()


def _now() -> float:
    return time.time()


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(_=Depends(_require_admin)):
    now = _now()
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM users ORDER BY created_at DESC"
        ).fetchall()
    users = []
    for r in rows:
        row = dict(r)
        paid_until = row.get("paid_until")
        if paid_until and paid_until > now:
            vip_status = "active"
            vip_until  = datetime.fromtimestamp(paid_until, tz=timezone.utc).strftime("%d.%m.%Y %H:%M")
        else:
            vip_status = "expired" if paid_until else "none"
            vip_until  = None

        trial_start = row.get("trial_start")
        trial_end   = None
        if trial_start:
            te = trial_start + 24 * 3600
            trial_end = datetime.fromtimestamp(te, tz=timezone.utc).strftime("%d.%m.%Y %H:%M")

        users.append({
            "telegram_id": row["telegram_id"],
            "username":    row.get("username"),
            "vip_status":  vip_status,
            "vip_until":   vip_until,
            "trial_end":   trial_end,
            "created_at":  datetime.fromtimestamp(row["created_at"], tz=timezone.utc).strftime("%d.%m.%Y %H:%M") if row.get("created_at") else None,
        })
    return {"users": users, "total": len(users)}


class GrantVipRequest(BaseModel):
    days: int


@router.post("/users/{telegram_id}/vip")
def grant_vip(telegram_id: int, body: GrantVipRequest, _=Depends(_require_admin)):
    """Grant VIP access for N days. days=0 revokes VIP."""
    now = _now()
    with get_conn() as con:
        row = con.execute(
            "SELECT paid_until FROM users WHERE telegram_id = ?", (telegram_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "User not found")

        if body.days == 0:
            new_expiry = 0.0
        else:
            current = row["paid_until"] if row["paid_until"] and row["paid_until"] > now else now
            new_expiry = current + body.days * 86400

        con.execute(
            "UPDATE users SET paid_until = ? WHERE telegram_id = ?",
            (new_expiry, telegram_id),
        )
        con.commit()

    if body.days == 0:
        return {"ok": True, "message": "VIP revoked"}

    until = datetime.fromtimestamp(new_expiry, tz=timezone.utc).strftime("%d.%m.%Y %H:%M")
    return {"ok": True, "message": f"VIP granted until {until}", "paid_until": new_expiry}


# ── Broadcast ─────────────────────────────────────────────────────────────────

async def _send_telegram_message(chat_id: int, text: str) -> bool:
    if not BOT_TOKEN:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{BOT_API}/bot{BOT_TOKEN}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            )
            return r.json().get("ok", False)
    except Exception as e:
        logger.error("sendMessage error for %s: %s", chat_id, e)
        return False


async def _send_telegram_document(chat_id: int, file_bytes: bytes, filename: str, caption: str = "") -> bool:
    if not BOT_TOKEN:
        return False
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{BOT_API}/bot{BOT_TOKEN}/sendDocument",
                data={"chat_id": str(chat_id), "caption": caption, "parse_mode": "HTML"},
                files={"document": (filename, file_bytes)},
            )
            return r.json().get("ok", False)
    except Exception as e:
        logger.error("sendDocument error for %s: %s", chat_id, e)
        return False


@router.post("/broadcast")
async def broadcast(
    text: str = Form(...),
    target_ids: str = Form("all"),     # "all" or comma-separated telegram_ids
    files: list[UploadFile] = File(default=[]),
    _=Depends(_require_admin),
):
    """Send broadcast message to selected users. Attach up to 5 files."""
    if len(files) > 5:
        raise HTTPException(400, "Max 5 files allowed")

    # Resolve recipients
    with get_conn() as con:
        if target_ids.strip() == "all":
            rows = con.execute("SELECT telegram_id FROM users").fetchall()
            ids  = [r["telegram_id"] for r in rows]
        else:
            raw = [s.strip() for s in target_ids.split(",") if s.strip()]
            ids = [int(x) for x in raw if x.isdigit()]

    if not ids:
        raise HTTPException(400, "No recipients")

    # Read file contents once
    file_data: list[tuple[bytes, str]] = []
    for f in files:
        content = await f.read()
        file_data.append((content, f.filename or "file"))

    sent = 0
    failed = 0

    for chat_id in ids:
        ok = await _send_telegram_message(chat_id, text)
        # Send files to this user
        for file_bytes, filename in file_data:
            await _send_telegram_document(chat_id, file_bytes, filename)
        if ok:
            sent += 1
        else:
            failed += 1

    return {
        "ok": True,
        "sent": sent,
        "failed": failed,
        "total": len(ids),
    }


@router.get("/users/count")
def users_count(_=Depends(_require_admin)):
    with get_conn() as con:
        total = con.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        vip   = con.execute(
            "SELECT COUNT(*) FROM users WHERE paid_until > ?", (_now(),)
        ).fetchone()[0]
    return {"total": total, "vip": vip, "trial": total - vip}


# ── Payment methods ───────────────────────────────────────────────────────────

@router.get("/payment-methods")
def get_payment_methods(_=Depends(_require_admin)):
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM payment_methods ORDER BY id"
        ).fetchall()
    return {"methods": [dict(r) for r in rows]}


class PaymentMethodBody(BaseModel):
    network:  str
    currency: str = "USDT"
    address:  str
    label:    str = ""
    fee_info: str = ""
    is_active: bool = True


@router.post("/payment-methods")
def add_payment_method(body: PaymentMethodBody, _=Depends(_require_admin)):
    with get_conn() as con:
        cur = con.execute(
            "INSERT INTO payment_methods (network, currency, address, label, fee_info, is_active) VALUES (?,?,?,?,?,?)",
            (body.network, body.currency, body.address, body.label, body.fee_info, int(body.is_active)),
        )
        con.commit()
    return {"ok": True, "id": cur.lastrowid}


@router.put("/payment-methods/{method_id}")
def update_payment_method(method_id: int, body: PaymentMethodBody, _=Depends(_require_admin)):
    with get_conn() as con:
        con.execute(
            "UPDATE payment_methods SET network=?, currency=?, address=?, label=?, fee_info=?, is_active=? WHERE id=?",
            (body.network, body.currency, body.address, body.label, body.fee_info, int(body.is_active), method_id),
        )
        con.commit()
    return {"ok": True}


@router.delete("/payment-methods/{method_id}")
def delete_payment_method(method_id: int, _=Depends(_require_admin)):
    with get_conn() as con:
        con.execute("DELETE FROM payment_methods WHERE id = ?", (method_id,))
        con.commit()
    return {"ok": True}
