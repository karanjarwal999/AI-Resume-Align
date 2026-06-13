"""Persistence of authenticated customize runs to MongoDB.

HTTP-agnostic: this module knows about MongoDB and the CustomizedResume
schema, nothing about FastAPI or request/response plumbing (AR5).

Token verification still flows through Firebase Admin (see app.services.auth).
We deliberately decouple "who is the user" (Firebase Auth) from "where do we
store their history" (MongoDB), so each piece can scale or change
independently.
"""

from __future__ import annotations

from datetime import datetime, timezone

from pymongo import MongoClient
from pymongo.collection import Collection

from app.config import settings
from app.schemas import CustomizedResume

CUSTOMIZATIONS_COLLECTION = "customizations"
_client: MongoClient | None = None


class MongoNotConfiguredError(RuntimeError):
    """Raised when storage is attempted with no MONGO_URI configured."""


def _get_client() -> MongoClient:
    """Lazily build a MongoClient. Pymongo pools internally so one
    per-process is the right shape."""
    global _client
    if _client is not None:
        return _client
    if not settings.mongo_uri:
        raise MongoNotConfiguredError(
            "MONGO_URI is not set. Add it to backend/.env to enable history "
            "persistence."
        )
    _client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5_000)
    return _client


def _collection() -> Collection:
    return _get_client()[settings.mongo_db_name][CUSTOMIZATIONS_COLLECTION]


def save_customization(
    *,
    user_id: str,
    jd_text: str,
    parsed_resume_text: str,
    customized_resume: CustomizedResume,
) -> None:
    """Append a single customization record for `user_id`.

    Raises if MongoDB is not configured or the write itself fails. The
    caller is expected to swallow exceptions so a history failure never
    blocks the customize response.
    """
    _collection().insert_one(
        {
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc),
            "jd_text": jd_text,
            "parsed_resume_text": parsed_resume_text,
            "customized_resume": customized_resume.model_dump(),
        }
    )
