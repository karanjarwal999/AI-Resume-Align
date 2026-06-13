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
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import DESCENDING, MongoClient
from pymongo.collection import Collection

from app.config import settings
from app.schemas import CustomizedResume

CUSTOMIZATIONS_COLLECTION = "customizations"
DEFAULT_HISTORY_LIMIT = 50
JD_PREVIEW_CHARS = 80

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


def _build_jd_preview(jd_text: str) -> str:
    snippet = jd_text[:JD_PREVIEW_CHARS]
    return f"{snippet}…" if len(jd_text) > JD_PREVIEW_CHARS else snippet


def list_customizations(
    *, user_id: str, limit: int = DEFAULT_HISTORY_LIMIT
) -> list[dict[str, Any]]:
    """Return up to `limit` customization previews for `user_id`,
    newest-first. Never includes another user's rows -- the filter is
    enforced here, not at the HTTP layer."""
    cursor = (
        _collection()
        .find(
            {"user_id": user_id},
            projection={"timestamp": 1, "jd_text": 1},
        )
        .sort("timestamp", DESCENDING)
        .limit(limit)
    )
    return [
        {
            "id": str(doc["_id"]),
            "timestamp": doc["timestamp"],
            "jd_preview": _build_jd_preview(doc.get("jd_text", "")),
        }
        for doc in cursor
    ]


def get_customization(
    *, user_id: str, customization_id: str
) -> dict[str, Any] | None:
    """Return the full customization doc if it exists AND belongs to
    `user_id`. Returns None for unknown id, malformed id, or another
    user's id -- callers translate None into a 404."""
    try:
        oid = ObjectId(customization_id)
    except (InvalidId, TypeError):
        return None
    doc = _collection().find_one({"_id": oid, "user_id": user_id})
    if doc is None:
        return None
    cr = doc.get("customized_resume", {}) or {}
    # Pre-2026-06-13 records were written before `name` and `education`
    # joined the schema. Backfill placeholders that satisfy the strict
    # min_length=1 constraints so HistoryDetail still validates and the
    # legacy row renders as a clearly-marked stub instead of 500-ing.
    cr.setdefault("name", "Candidate")
    if not cr.get("education"):
        cr["education"] = ["(not recorded in this customization)"]
    return {
        "id": str(doc["_id"]),
        "timestamp": doc["timestamp"],
        "jd_text": doc.get("jd_text", ""),
        "customized_resume": cr,
    }
