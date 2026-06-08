# -*- coding: utf-8 -*-
from fastapi import APIRouter
from pydantic import BaseModel
from api.database import get_conn

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    updates: dict[str, str]


@router.get("")
def get_settings() -> dict[str, str]:
    with get_conn() as con:
        rows = con.execute("SELECT key, value FROM settings").fetchall()
    return {r["key"]: r["value"] for r in rows}


@router.put("")
def update_settings(body: SettingsUpdate) -> dict[str, str]:
    with get_conn() as con:
        for key, value in body.updates.items():
            con.execute(
                "INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, value),
            )
    return body.updates
