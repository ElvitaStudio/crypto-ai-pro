# -*- coding: utf-8 -*-
"""
Unified signal message formatter.

All strategies produce a signal dict; this module renders it into
a consistent Telegram message regardless of which strategy fired.
"""

from datetime import datetime, timezone

# ── Strategy display metadata ─────────────────────────────────────────────────

_STRATEGY_META: dict[str, dict] = {
    "VolumeLevel": {
        "icon": "📊",
        "label": "ОБЪЁМ + УРОВЕНЬ",
    },
    "Multi": {
        "icon": "🔫",
        "label": "МУЛЬТИ СНАЙПЕР",
    },
    "NexusVWAP": {
        "icon": "🌌",
        "label": "NEXUS VWAP",
    },
    "VwapChannel": {
        "icon": "🌌",
        "label": "NEXUS VWAP",
    },
    "TitanFractal": {
        "icon": "🏛",
        "label": "ТИТАН ФРАКТАЛ",
    },
    "CvdVwap": {
        "icon": "🌊",
        "label": "CVD + VWAP",
    },
}

_DEFAULT_META = {"icon": "📡", "label": "СИГНАЛ"}


def _fmt_price(price: float) -> str:
    """Smart price formatting: removes trailing zeros, keeps precision."""
    if price >= 1000:
        return f"{price:,.2f}"
    if price >= 1:
        return f"{price:.4f}"
    return f"{price:.6f}"


def _pct(a: float, b: float) -> str:
    return f"{abs(a - b) / b * 100:.2f}%"


def _rr(entry: float, sl: float, tp: float) -> str:
    risk   = abs(entry - sl)
    reward = abs(tp - entry)
    if risk == 0:
        return "?"
    return f"1:{reward / risk:.2f}"


def _trend_icon(trend: str) -> str:
    return {"UP": "⬆️", "DOWN": "⬇️", "NEUTRAL": "➡️"}.get(trend, "❓")


def format_signal(signal: dict) -> str:
    """
    Render a unified Telegram message for a signal dict.

    Expected keys: symbol, direction, entry, sl, tp,
    strategy_name, reasoning, features, htf_trend, htf_trend_4h,
    quality_score, quality_details, ai_votes (optional).
    """
    strategy = signal.get("strategy_name", "unknown")
    meta     = _STRATEGY_META.get(strategy, _DEFAULT_META)

    symbol    = signal["symbol"]
    direction = signal["direction"]
    entry     = signal["entry"]
    sl        = signal["sl"]
    tp        = signal["tp"]

    dir_icon  = "🟢 LONG" if direction == "LONG" else "🔴 SHORT"
    risk_pct  = _pct(entry, sl)
    rwd_pct   = _pct(entry, tp)
    rr        = _rr(entry, sl, tp)

    # ── Indicators ────────────────────────────────────────────────────────────
    features  = signal.get("features", {})
    rsi       = features.get("rsi")
    adx       = features.get("adx")
    vol_ratio = features.get("vol_ratio")

    ind_parts = []
    if rsi       is not None: ind_parts.append(f"RSI `{rsi:.1f}`")
    if adx       is not None: ind_parts.append(f"ADX `{adx:.1f}`")
    if vol_ratio is not None: ind_parts.append(f"Vol `{vol_ratio:.1f}×`")
    indicators = "  ".join(ind_parts) if ind_parts else "—"

    # ── HTF trends ────────────────────────────────────────────────────────────
    t1h = signal.get("htf_trend", "?")
    t4h = signal.get("htf_trend_4h", "?")
    trend_line = f"1h {_trend_icon(t1h)} `{t1h}`   4h {_trend_icon(t4h)} `{t4h}`"

    # ── Quality score ─────────────────────────────────────────────────────────
    score = signal.get("quality_score")
    score_str = f"`{score}/6`" if score is not None else ""

    # ── Reasoning (short) ─────────────────────────────────────────────────────
    reasoning = signal.get("reasoning", "")
    if len(reasoning) > 120:
        reasoning = reasoning[:117] + "…"

    # ── Timestamp ─────────────────────────────────────────────────────────────
    ts = datetime.now(timezone.utc).strftime("%H:%M UTC")

    lines = [
        f"{meta['icon']} *{meta['label']}* | `{symbol}`",
        f"{dir_icon}  ·  {ts}",
        "",
        f"🎯 *Вход:*  `{_fmt_price(entry)}`",
        f"🛑 *Стоп:*  `{_fmt_price(sl)}`  (-{risk_pct})",
        f"💰 *Тейк:*  `{_fmt_price(tp)}`  (+{rwd_pct})",
        f"📐 *R:R:*   {rr}",
        "",
        f"📈 {indicators}",
        f"🔭 Тренд: {trend_line}",
    ]

    if score_str:
        lines.append(f"⭐ Качество: {score_str}")

    if reasoning:
        lines.append("")
        lines.append(f"💡 _{reasoning}_")

    return "\n".join(lines)


def format_result(symbol: str, strategy: str, status: str, pnl_pct: float) -> str:
    """Format a TP/SL result notification."""
    meta = _STRATEGY_META.get(strategy, _DEFAULT_META)

    if status == "WIN":
        header = f"✅ ТЕЙК-ПРОФИТ HIT"
        pnl_str = f"+{pnl_pct:.2f}%"
        color   = "🟢"
    else:
        header = f"❌ СТОП-ЛОСС HIT"
        pnl_str = f"{pnl_pct:.2f}%"
        color   = "🔴"

    ts = datetime.now(timezone.utc).strftime("%H:%M UTC")

    return "\n".join([
        f"{color} *{header}*",
        f"`{symbol}`  ·  {meta['icon']} {meta['label']}  ·  {ts}",
        f"P&L: *{pnl_str}*",
    ])
