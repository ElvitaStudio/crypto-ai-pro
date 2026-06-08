# -*- coding: utf-8 -*-
import json
import requests


def send_message(token: str, chat_id: str, text: str, symbol: str | None = None) -> None:
    reply_markup = _build_keyboard(symbol)
    data: dict = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
    if reply_markup:
        data["reply_markup"] = reply_markup
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=data,
            timeout=10,
        )
    except Exception as e:
        print(f"TG send error: {e}")


def send_photo(
    token: str,
    chat_id: str,
    image_buffer,
    caption: str,
    symbol: str | None = None,
) -> None:
    reply_markup = _build_keyboard(symbol)
    data: dict = {"chat_id": chat_id, "caption": caption, "parse_mode": "Markdown"}
    if reply_markup:
        data["reply_markup"] = reply_markup
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendPhoto",
            data=data,
            files={"photo": ("chart.png", image_buffer, "image/png")},
            timeout=15,
        )
    except Exception as e:
        print(f"TG photo error: {e}")


def notify(
    token: str,
    chat_id: str,
    text: str,
    image_buffer=None,
    symbol: str | None = None,
) -> None:
    if image_buffer:
        send_photo(token, chat_id, image_buffer, text, symbol)
    else:
        send_message(token, chat_id, text, symbol)


def _build_keyboard(symbol: str | None) -> str | None:
    if not symbol:
        return None
    clean = symbol.replace("/", "")
    keyboard = {
        "inline_keyboard": [[
            {"text": "📊 TradingView", "url": f"https://www.tradingview.com/chart?symbol=BINANCE:{clean}.P"},
            {"text": "💰 Binance", "url": f"https://www.binance.com/en/futures/{clean}"},
        ]]
    }
    return json.dumps(keyboard)
