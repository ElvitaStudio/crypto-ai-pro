# -*- coding: utf-8 -*-
from pydantic import BaseModel
from typing import Any


class AIVote(BaseModel):
    model: str
    approved: bool
    confidence: int
    reasoning: str


class Signal(BaseModel):
    id: int
    timestamp: float
    strategy: str
    symbol: str
    direction: str
    entry: float
    sl: float
    tp: float
    features: dict[str, Any]
    ai_approved: bool
    ai_votes: list[AIVote]
    ai_summary: str | None
    status: str
    closed_at: float | None
    pnl_pct: float | None


class StrategyStat(BaseModel):
    strategy: str
    total: int
    wins: int
    losses: int
    open: int
    win_rate: float
    avg_pnl: float


class Summary(BaseModel):
    total_signals: int
    total_wins: int
    total_losses: int
    total_open: int
    win_rate: float
    total_pnl: float
    ai_blocked: int


class Setting(BaseModel):
    key: str
    value: str
