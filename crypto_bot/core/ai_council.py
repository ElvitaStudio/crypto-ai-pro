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


_SYSTEM_PROMPT = """You are a professional crypto futures trading analyst.
You will receive a trading signal with market data and must decide if it is worth trading.
Respond ONLY with valid JSON in this exact format:
{
  "approved": true or false,
  "confidence": 0-100,
  "reasoning": "one sentence explanation"
}"""


def _build_user_prompt(signal: dict) -> str:
    return f"""Trading Signal Analysis Request:

Symbol: {signal['symbol']}
Direction: {signal['direction']}
Entry: {signal['entry']}
Stop Loss: {signal['sl']}
Take Profit: {signal['tp']}
Strategy: {signal.get('strategy_name', 'unknown')}

Market Features:
{json.dumps(signal.get('features', {}), indent=2)}

Signal Reasoning:
{signal.get('reasoning', 'N/A')}

Analyze this signal considering:
1. Risk/reward ratio
2. Signal quality based on the features
3. Whether the direction makes sense given RSI, ADX, volume ratio

Should this signal be traded? Respond with JSON only."""


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
    approved = passed > total / 2  # strict majority

    summary = f"{passed}/{total} models approved"
    return CouncilVerdict(approved=approved, votes=votes, summary=summary)
