# -*- coding: utf-8 -*-
"""
AI Council: sends each signal to multiple AI models via OpenRouter.
Each model votes PASS or FAIL. Majority wins.

Usage:
    from core.ai_council import council_review
    verdict = council_review(signal)
    if verdict.approved:
        send_signal(...)
"""

import json
import concurrent.futures
from dataclasses import dataclass

import requests

from config import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    AI_COUNCIL_MODELS,
    AI_COUNCIL_ENABLED,
    AI_COUNCIL_TIMEOUT_SEC,
)


@dataclass
class ModelVote:
    model: str
    approved: bool
    reasoning: str
    confidence: int  # 0-100


@dataclass
class CouncilVerdict:
    approved: bool
    votes: list[ModelVote]
    summary: str

    def format_badge(self) -> str:
        """Returns a compact badge like: AI: ✅✅❌ (2/3)"""
        icons = "".join("✅" if v.approved else "❌" for v in self.votes)
        passed = sum(1 for v in self.votes if v.approved)
        total = len(self.votes)
        return f"AI: {icons} ({passed}/{total})"

    def format_detail(self) -> str:
        """Returns a detailed breakdown for the Telegram message."""
        lines = ["", "🤖 *AI Совет:*"]
        for v in self.votes:
            icon = "✅" if v.approved else "❌"
            short_name = v.model.split("/")[-1]
            lines.append(f"{icon} `{short_name}` ({v.confidence}%): {v.reasoning}")
        return "\n".join(lines)


_SYSTEM_PROMPT = """You are a senior crypto futures trading analyst with 10+ years experience.
You evaluate trading signals with an EXTREMELY strict quality filter — only approve the very best setups.
Reject signals when: RSI contradicts direction, trend is unclear, R:R is below 3.0, or HTF trend opposes the trade.
You must be conservative — when in doubt, reject. Only clearly exceptional setups deserve approval.

Respond ONLY with valid JSON in this exact format:
{
  "approved": true or false,
  "confidence": 0-100,
  "reasoning": "one concise sentence explaining your decision"
}"""


def _fmt_features(features: dict) -> str:
    if not features:
        return "  (no indicator data)"
    lines = []
    labels = {
        "rsi":       "RSI(14)",
        "adx":       "ADX(14)",
        "vol_ratio": "Volume ratio (×avg)",
        "btc_corr":  "BTC correlation",
        "dist_ema":  "Distance from EMA-200",
    }
    for k, v in features.items():
        label = labels.get(k, k)
        lines.append(f"  {label}: {v}")
    return "\n".join(lines)


def _build_user_prompt(signal: dict) -> str:
    entry  = signal['entry']
    sl     = signal['sl']
    tp     = signal['tp']
    risk   = abs(entry - sl)
    reward = abs(tp - entry)
    rr     = round(reward / risk, 2) if risk else 0

    htf_trend = signal.get("htf_trend", "unknown")
    direction = signal['direction']

    trend_note = ""
    if htf_trend == "UP":
        trend_note = "✅ Aligned with HTF trend" if direction == "LONG" else "⚠️ COUNTER-TREND (HTF is UP, signal is SHORT)"
    elif htf_trend == "DOWN":
        trend_note = "✅ Aligned with HTF trend" if direction == "SHORT" else "⚠️ COUNTER-TREND (HTF is DOWN, signal is LONG)"
    else:
        trend_note = "Neutral / unknown HTF trend"

    return f"""=== TRADING SIGNAL FOR REVIEW ===

Symbol:    {signal['symbol']}
Direction: {direction}
Strategy:  {signal.get('strategy_name', 'unknown')}

Price levels:
  Entry:      {entry}
  Stop Loss:  {sl}  ({abs(sl - entry) / entry * 100:.2f}% risk)
  Take Profit:{tp}  (+{abs(tp - entry) / entry * 100:.2f}% reward)
  R:R ratio:  1:{rr}

Higher timeframe trends:
  1h EMA-50: {htf_trend}  → {trend_note}
  4h EMA-50: {signal.get('htf_trend_4h', 'unknown')}

Quality gate score: {signal.get('quality_score', '?')}/6
{chr(10).join('  ' + d for d in signal.get('quality_details', []))}

Indicator readings:
{_fmt_features(signal.get('features', {}))}

Signal reasoning from strategy:
  {signal.get('reasoning', 'N/A')}

=== YOUR TASK ===
Decide if this signal is worth trading. Be VERY strict — only the best setups deserve approval.
Key checks:
  1. RSI supports direction? (LONG needs RSI < 58, SHORT needs RSI > 42)
  2. ADX ≥ 25? (confirmed strong trend)
  3. Volume above normal? (vol_ratio > 1.5)
  4. Both 1h AND 4h HTF trend aligned?
  5. R:R ≥ 3.0? (higher is better)

Approve ONLY if all 5 checks are clearly satisfied. Respond with JSON only."""


def _ask_model(model: str, prompt: str) -> ModelVote:
    try:
        resp = requests.post(
            OPENROUTER_BASE_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/crypto-bot",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 200,
            },
            timeout=AI_COUNCIL_TIMEOUT_SEC,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()

        # Strip markdown code fences if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        data = json.loads(content)
        return ModelVote(
            model=model,
            approved=bool(data.get("approved", False)),
            reasoning=str(data.get("reasoning", ""))[:120],
            confidence=int(data.get("confidence", 50)),
        )

    except Exception as e:
        print(f"[AI Council] {model} error: {e}")
        # On error: abstain (counts as FAIL to be conservative)
        return ModelVote(model=model, approved=False, reasoning=f"error: {e}", confidence=0)


def council_review(signal: dict) -> CouncilVerdict:
    """
    Runs all models in parallel and returns a CouncilVerdict.
    If AI_COUNCIL_ENABLED is False, returns an auto-approved verdict.
    """
    if not AI_COUNCIL_ENABLED or not OPENROUTER_API_KEY:
        return CouncilVerdict(
            approved=True,
            votes=[],
            summary="AI Council disabled — auto-approved",
        )

    prompt = _build_user_prompt(signal)

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(AI_COUNCIL_MODELS)) as pool:
        futures = {pool.submit(_ask_model, model, prompt): model for model in AI_COUNCIL_MODELS}
        votes = [f.result() for f in concurrent.futures.as_completed(futures)]

    # Sort to keep display order consistent with config
    model_order = {m: i for i, m in enumerate(AI_COUNCIL_MODELS)}
    votes.sort(key=lambda v: model_order.get(v.model, 99))

    passed = sum(1 for v in votes if v.approved)
    total = len(votes)
    approved = passed == total  # unanimous: ALL models must approve

    summary = f"{passed}/{total} models approved"
    return CouncilVerdict(approved=approved, votes=votes, summary=summary)
