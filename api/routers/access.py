# -*- coding: utf-8 -*-
"""
Access control: trial (24h) + paid subscription via USDT (TRC-20 / ERC-20 / BEP-20).

Payment identification strategy:
  Each user gets a unique sub-cent suffix based on their telegram_id:
    suffix = (telegram_id % 900) / 10000   →  0.0001 … 0.0900
  Combined with the plan price:
    amount_to_pay = plan_price + suffix

  e.g. user 123456789 picking 3-month plan ($50.97):
    50.97 + (123456789 % 900) / 10000 = 50.97 + 0.0489 = 51.0189 USDT

Background task polls TronGrid every 30s for incoming TRC-20 USDT transfers.
ERC-20/BEP-20 verification is manual (no free on-chain API without a key).
"""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Header
from pydantic import BaseModel

from api.database import get_conn

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/access", tags=["access"])

# ── Config ────────────────────────────────────────────────────────────────────
WALLET_TRC20 = os.environ.get("USDT_WALLET_TRC20", "")
WALLET_ERC20 = os.environ.get("USDT_WALLET_ERC20", "")
WALLET_BEP20 = os.environ.get("USDT_WALLET_BEP20", "")

WALLETS: dict[str, str] = {
    "TRC20": WALLET_TRC20,
    "ERC20": WALLET_ERC20,
    "BEP20": WALLET_BEP20,
}

PLANS: dict[str, tuple[float, int]] = {
    "1m": (float(os.environ.get("PRICE_1M", "19.99")), 30),
    "3m": (float(os.environ.get("PRICE_3M", "50.97")), 90),
    "6m": (float(os.environ.get("PRICE_6M", "89.94")), 180),
}

TRIAL_HOURS    = int(os.environ.get("TRIAL_HOURS", "24"))
TRON_API_KEY   = os.environ.get("TRONGRID_API_KEY", "")

TRON_API_BASE  = "https://api.trongrid.io"
USDT_CONTRACT  = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"   # USDT TRC-20


# ── DB ────────────────────────────────────────────────────────────────────────

def _init_tables() -> None:
    with get_conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS users (
                telegram_id   INTEGER PRIMARY KEY,
                username      TEXT,
                trial_start   REAL,
                paid_until    REAL,
                created_at    REAL DEFAULT (unixepoch())
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id   INTEGER,
                tx_hash       TEXT UNIQUE,
                amount_usdt   REAL,
                network       TEXT,
                plan_id       TEXT,
                confirmed_at  REAL,
                days_granted  INTEGER
            )
        """)
        con.commit()


_init_tables()


def _now() -> float:
    return time.time()


def _get_user(telegram_id: int) -> dict | None:
    with get_conn() as con:
        row = con.execute(
            "SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)
        ).fetchone()
    return dict(row) if row else None


def _upsert_user(telegram_id: int, username: str | None = None) -> dict:
    now = _now()
    with get_conn() as con:
        con.execute("""
            INSERT INTO users (telegram_id, username, trial_start)
            VALUES (?, ?, ?)
            ON CONFLICT(telegram_id) DO UPDATE SET
                username = COALESCE(excluded.username, username)
        """, (telegram_id, username, now))
        con.commit()
        row = con.execute(
            "SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)
        ).fetchone()
    return dict(row)


def _grant_days(
    telegram_id: int,
    days: int,
    tx_hash: str,
    amount: float,
    network: str = "TRC20",
    plan_id: str = "1m",
) -> None:
    now = _now()
    with get_conn() as con:
        row = con.execute(
            "SELECT paid_until FROM users WHERE telegram_id = ?", (telegram_id,)
        ).fetchone()
        current_expiry = row["paid_until"] if row and row["paid_until"] else now
        new_expiry = max(current_expiry, now) + days * 86400

        con.execute(
            "UPDATE users SET paid_until = ? WHERE telegram_id = ?",
            (new_expiry, telegram_id),
        )
        con.execute("""
            INSERT OR IGNORE INTO payments
                (telegram_id, tx_hash, amount_usdt, network, plan_id, confirmed_at, days_granted)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (telegram_id, tx_hash, amount, network, plan_id, now, days))
        con.commit()


def _access_status(user: dict) -> dict:
    now = _now()

    if user.get("paid_until") and user["paid_until"] > now:
        return {
            "status": "active",
            "hours_left": None,
            "expires_at": datetime.fromtimestamp(
                user["paid_until"], tz=timezone.utc
            ).isoformat(),
        }

    if user.get("trial_start"):
        trial_end = user["trial_start"] + TRIAL_HOURS * 3600
        if trial_end > now:
            hours_left = (trial_end - now) / 3600
            return {
                "status": "trial",
                "hours_left": round(hours_left, 1),
                "expires_at": datetime.fromtimestamp(
                    trial_end, tz=timezone.utc
                ).isoformat(),
            }

    return {"status": "expired", "hours_left": 0, "expires_at": None}


def _suffix(telegram_id: int) -> float:
    """Sub-cent suffix unique to this user: 0.0001 … 0.0900."""
    return (telegram_id % 900) / 10000


def _payment_amounts(telegram_id: int) -> dict[str, float]:
    """Return {plan_id: unique_amount} for all plans."""
    sfx = _suffix(telegram_id)
    return {pid: round(price + sfx, 4) for pid, (price, _) in PLANS.items()}


# ── Routes ────────────────────────────────────────────────────────────────────

class StartTrialRequest(BaseModel):
    telegram_id: int
    username: str | None = None


@router.post("/trial")
def start_trial(body: StartTrialRequest):
    user = _get_user(body.telegram_id) or _upsert_user(body.telegram_id, body.username)
    status = _access_status(user)
    return {
        "telegram_id": body.telegram_id,
        **status,
        "trial_hours": TRIAL_HOURS,
        "payment_amounts": _payment_amounts(body.telegram_id),
        "wallets": WALLETS,
        "plans": {pid: {"price": p, "days": d} for pid, (p, d) in PLANS.items()},
    }


@router.get("/check")
def check_access(x_telegram_id: int = Header(...)):
    user = _get_user(x_telegram_id) or _upsert_user(x_telegram_id)
    status = _access_status(user)
    amounts = _payment_amounts(x_telegram_id)
    return {
        "telegram_id": x_telegram_id,
        **status,
        # legacy single-amount fields (frontend uses these)
        "payment_amount": amounts["3m"],
        "wallet": WALLET_TRC20,
        "price_usdt": PLANS["3m"][0],
        # extended fields
        "payment_amounts": amounts,
        "wallets": WALLETS,
    }


@router.get("/payment-info")
def payment_info(
    x_telegram_id: int = Header(...),
    plan: str = "3m",
    network: str = "TRC20",
):
    """Get payment details for the paywall screen."""
    if plan not in PLANS:
        plan = "3m"
    if network not in WALLETS:
        network = "TRC20"

    price, days = PLANS[plan]
    amount = round(price + _suffix(x_telegram_id), 4)
    wallet = WALLETS[network]

    return {
        "wallet": wallet,
        "network": network,
        "currency": "USDT",
        "amount": amount,
        "amount_display": f"{amount:.4f}",
        "plan": plan,
        "days": days,
        "price": price,
    }


# ── TronGrid payment polling ──────────────────────────────────────────────────

async def _poll_tron_transactions() -> None:
    if not WALLET_TRC20:
        logger.warning("USDT_WALLET_TRC20 not set — TRC-20 polling disabled")
        return

    logger.info("Starting TronGrid payment poller for %s", WALLET_TRC20)

    with get_conn() as con:
        rows = con.execute("SELECT tx_hash FROM payments").fetchall()

    seen_hashes: set[str] = {r["tx_hash"] for r in rows}
    headers = {"TRON-PRO-API-KEY": TRON_API_KEY} if TRON_API_KEY else {}

    # Pre-build amount lookup: {rounded_amount_str → (telegram_id, plan_id, days)}
    def _build_lookup() -> dict[str, tuple[int, str, int]]:
        lookup: dict[str, tuple[int, str, int]] = {}
        with get_conn() as con:
            rows = con.execute("SELECT telegram_id FROM users").fetchall()
        for row in rows:
            tg_id = row["telegram_id"]
            sfx = _suffix(tg_id)
            for pid, (price, days) in PLANS.items():
                key = f"{round(price + sfx, 4):.4f}"
                lookup[key] = (tg_id, pid, days)
        return lookup

    while True:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{TRON_API_BASE}/v1/accounts/{WALLET_TRC20}/transactions/trc20",
                    params={"only_confirmed": "true", "limit": 50},
                    headers=headers,
                )
                if resp.status_code != 200:
                    logger.warning("TronGrid %s: %s", resp.status_code, resp.text[:200])
                    await asyncio.sleep(60)
                    continue

                txs = resp.json().get("data", [])
                lookup = _build_lookup()

                for tx in txs:
                    tx_hash = tx.get("transaction_id", "")
                    if not tx_hash or tx_hash in seen_hashes:
                        continue

                    to_addr   = tx.get("to", "")
                    raw_value = int(tx.get("value", 0))
                    decimals  = int(tx.get("token_info", {}).get("decimals", 6))
                    token_id  = tx.get("token_info", {}).get("address", "")

                    if token_id != USDT_CONTRACT:
                        continue
                    if to_addr != WALLET_TRC20:
                        continue

                    amount     = raw_value / (10 ** decimals)
                    amount_key = f"{amount:.4f}"
                    match      = lookup.get(amount_key)

                    if match:
                        tg_id, plan_id, days = match
                        _grant_days(tg_id, days, tx_hash, amount, "TRC20", plan_id)
                        seen_hashes.add(tx_hash)
                        logger.info(
                            "Payment confirmed: telegram_id=%s plan=%s amount=%.4f tx=%s",
                            tg_id, plan_id, amount, tx_hash[:16],
                        )
                    else:
                        logger.debug("Unknown payment amount=%.4f tx=%s", amount, tx_hash[:16])

        except Exception as exc:
            logger.error("TronGrid poll error: %s", exc)

        await asyncio.sleep(30)
