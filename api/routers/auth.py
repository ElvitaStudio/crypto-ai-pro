# -*- coding: utf-8 -*-
"""
Web authentication: email/password + Google OAuth.
Returns JWT access tokens.
"""

import logging
import os
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from api.auth_deps import (
    create_access_token,
    get_current_web_user,
    hash_password,
    verify_password,
)
from api.database import get_conn

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# ── DB init ───────────────────────────────────────────────────────────────────

def init_web_users_table() -> None:
    with get_conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS web_users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                email         TEXT UNIQUE,
                password_hash TEXT,
                google_id     TEXT UNIQUE,
                display_name  TEXT,
                avatar_url    TEXT,
                trial_start   REAL,
                paid_until    REAL,
                last_reminder_sent REAL,
                created_at    REAL DEFAULT (unixepoch())
            )
        """)
        # Add web_user_id column to payments if it doesn't exist yet
        try:
            con.execute("ALTER TABLE payments ADD COLUMN web_user_id INTEGER")
        except Exception:
            pass  # column already exists
        con.commit()


init_web_users_table()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> float:
    return time.time()


def _get_web_user_by_id(user_id: int) -> dict | None:
    with get_conn() as con:
        row = con.execute(
            "SELECT * FROM web_users WHERE id = ?", (user_id,)
        ).fetchone()
    return dict(row) if row else None


def _get_web_user_by_email(email: str) -> dict | None:
    with get_conn() as con:
        row = con.execute(
            "SELECT * FROM web_users WHERE email = ?", (email.lower(),)
        ).fetchone()
    return dict(row) if row else None


def _get_web_user_by_google(google_id: str) -> dict | None:
    with get_conn() as con:
        row = con.execute(
            "SELECT * FROM web_users WHERE google_id = ?", (google_id,)
        ).fetchone()
    return dict(row) if row else None


def _user_to_response(user: dict) -> dict:
    now = _now()
    return {
        "id": user["id"],
        "email": user["email"],
        "displayName": user["display_name"],
        "avatarUrl": user["avatar_url"],
        "createdAt": user["created_at"],
    }


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    displayName: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    idToken: str


class AuthResponse(BaseModel):
    accessToken: str
    user: dict


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest):
    email = body.email.lower().strip()

    # Validate email format minimally
    if "@" not in email or len(email) < 5:
        raise HTTPException(status_code=400, detail="Invalid email address")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Check if email already taken
    existing = _get_web_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    password_hash = hash_password(body.password)
    now = _now()

    with get_conn() as con:
        cur = con.execute(
            """INSERT INTO web_users (email, password_hash, display_name, trial_start, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (email, password_hash, body.displayName or email.split("@")[0], now, now),
        )
        user_id = cur.lastrowid
        con.commit()
        row = con.execute("SELECT * FROM web_users WHERE id = ?", (user_id,)).fetchone()

    user = dict(row)
    token = create_access_token({"sub": f"web:{user_id}", "email": email})
    return AuthResponse(accessToken=token, user=_user_to_response(user))


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    email = body.email.lower().strip()
    user = _get_web_user_by_email(email)

    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": f"web:{user['id']}", "email": email})
    return AuthResponse(accessToken=token, user=_user_to_response(user))


@router.post("/google", response_model=AuthResponse)
async def google_auth(body: GoogleAuthRequest):
    """Verify Google ID token and upsert user."""
    # Verify token with Google
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.idToken},
            timeout=10.0,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    google_data = resp.json()

    # Verify the token was issued for our app
    if GOOGLE_CLIENT_ID and google_data.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Token audience mismatch")

    google_id = google_data.get("sub")
    email = google_data.get("email", "").lower()
    display_name = google_data.get("name")
    avatar_url = google_data.get("picture")

    if not google_id:
        raise HTTPException(status_code=401, detail="Could not extract Google user ID")

    # Upsert: find by google_id, then by email, then create
    user = _get_web_user_by_google(google_id)

    if not user and email:
        user = _get_web_user_by_email(email)

    now = _now()

    if user:
        # Update google_id / display_name / avatar if changed
        with get_conn() as con:
            con.execute(
                """UPDATE web_users
                   SET google_id = ?, display_name = COALESCE(?, display_name),
                       avatar_url = COALESCE(?, avatar_url)
                   WHERE id = ?""",
                (google_id, display_name, avatar_url, user["id"]),
            )
            con.commit()
        user = _get_web_user_by_id(user["id"])
    else:
        # New user — create with trial
        with get_conn() as con:
            cur = con.execute(
                """INSERT INTO web_users (email, google_id, display_name, avatar_url, trial_start, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (email or None, google_id, display_name, avatar_url, now, now),
            )
            user_id = cur.lastrowid
            con.commit()
        user = _get_web_user_by_id(user_id)

    token = create_access_token({"sub": f"web:{user['id']}", "email": user.get("email", "")})
    return AuthResponse(accessToken=token, user=_user_to_response(user))


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_web_user)):
    return _user_to_response(current_user)
