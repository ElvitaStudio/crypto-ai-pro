# -*- coding: utf-8 -*-
"""
Telegram Stars payment integration.

Flow:
  1. Frontend → POST /stars/invoice   → receives invoice_link
  2. Frontend → window.Telegram.WebApp.openInvoice(link, cb)
  3. Telegram → POST /webhook/telegram  (pre_checkout_query) → we answer OK
  4. Telegram → POST /webhook/telegram  (successful_payment)  → grant access
  5. Bot sends notification to user in Telegram

Stars amounts (XTR):
  1 month  →  999 Stars
  3 months → 2499 Stars
  6 months → 4499 Stars

Set in .env:
  BOT_TOKEN=123456:ABC-...
  WEBHOOK_URL=https://your-domain.com   (set once via /stars/set-webhook)
"""

import logging
import os

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from api.routers.access import _grant_days, _upsert_user, PLANS

logger = logging.getLogger(__name__)

router = APIRouter(tags=["stars"])

BOT_TOKEN   = os.environ.get("BOT_TOKEN", "")
WEBHOOK_URL = os.environ.get("WEBHOOK_URL", "")   # e.g. https://yourdomain.com
BOT_API     = "https://api.telegram.org"

# Stars per plan (XTR currency)
STARS_PRICES: dict[str, int] = {
    "1m": 999,
    "3m": 2499,
    "6m": 4499,
}

PLAN_LABELS = {
    "1m": "1 месяц — Crypto AI Pro",
    "3m": "3 месяца — Crypto AI Pro",
    "6m": "6 месяцев — Crypto AI Pro",
}


# ── Low-level Bot API helper ──────────────────────────────────────────────────

async def _bot(method: str, **kwargs) -> dict:
    if not BOT_TOKEN:
        raise HTTPException(503, "BOT_TOKEN not configured")
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{BOT_API}/bot{BOT_TOKEN}/{method}",
            json={k: v for k, v in kwargs.items() if v is not None},
        )
    data = resp.json()
    if not data.get("ok"):
        raise HTTPException(500, f"Telegram API error: {data.get('description')}")
    return data["result"]


# ── Create invoice link ───────────────────────────────────────────────────────

class InvoiceRequest(BaseModel):
    plan: str = "3m"


@router.post("/stars/invoice")
async def create_invoice(body: InvoiceRequest, x_telegram_id: int = Header(...)):
    """Create a Telegram Stars invoice link for the given plan."""
    plan = body.plan if body.plan in STARS_PRICES else "3m"
    stars = STARS_PRICES[plan]
    _, days = PLANS[plan]

    # payload encodes both user and plan so we can match on payment
    payload = f"{x_telegram_id}:{plan}"

    link = await _bot(
        "createInvoiceLink",
        title=PLAN_LABELS[plan],
        description=f"Доступ к Crypto AI Pro на {days} дней — все сигналы, AI анализ, автосканер",
        payload=payload,
        currency="XTR",
        prices=[{"label": PLAN_LABELS[plan], "amount": stars}],
    )
    return {"invoice_link": link, "stars": stars, "plan": plan}


# ── Webhook (receives updates from Telegram) ──────────────────────────────────

@router.post("/webhook/telegram")
async def telegram_webhook(request: Request):
    """Handle incoming Telegram bot updates."""
    update = await request.json()
    logger.debug("Telegram update: %s", update)

    # pre_checkout_query → must answer within 10 seconds
    if "pre_checkout_query" in update:
        pcq = update["pre_checkout_query"]
        await _bot("answerPreCheckoutQuery",
                   pre_checkout_query_id=pcq["id"],
                   ok=True)
        return {"ok": True}

    # successful_payment → grant subscription
    if "message" in update:
        msg = update["message"]
        if "successful_payment" in msg:
            payment = msg["successful_payment"]
            payload  = payment.get("invoice_payload", "")
            parts    = payload.split(":")
            if len(parts) == 2:
                try:
                    tg_id   = int(parts[0])
                    plan_id = parts[1]
                    _, days = PLANS.get(plan_id, ("", 30))
                    stars   = payment.get("total_amount", 0)

                    _upsert_user(tg_id)
                    _grant_days(
                        telegram_id=tg_id,
                        days=days,
                        tx_hash=f"stars:{payment.get('telegram_payment_charge_id','')}",
                        amount=float(stars),
                        network="STARS",
                        plan_id=plan_id,
                    )

                    # Notify user
                    await _bot(
                        "sendMessage",
                        chat_id=tg_id,
                        text=(
                            f"✅ *Оплата подтверждена!*\n\n"
                            f"Тариф: {PLAN_LABELS.get(plan_id, plan_id)}\n"
                            f"Доступ открыт на *{days} дней*\n\n"
                            f"Возвращайтесь в приложение 🚀"
                        ),
                        parse_mode="Markdown",
                    )
                    logger.info("Stars payment confirmed: tg_id=%s plan=%s stars=%s", tg_id, plan_id, stars)
                except (ValueError, TypeError) as e:
                    logger.error("Failed to process Stars payment: %s", e)

    return {"ok": True}


# ── Register webhook (call once after deploy) ─────────────────────────────────

@router.post("/stars/set-webhook")
async def set_webhook():
    """Register the bot webhook with Telegram. Call once after deploy."""
    if not WEBHOOK_URL:
        raise HTTPException(400, "WEBHOOK_URL not set in .env")
    url = f"{WEBHOOK_URL}/webhook/telegram"
    result = await _bot("setWebhook", url=url, allowed_updates=["message", "pre_checkout_query"])
    return {"ok": True, "url": url, "result": result}


@router.get("/stars/webhook-info")
async def webhook_info():
    """Check current webhook status."""
    return await _bot("getWebhookInfo")
