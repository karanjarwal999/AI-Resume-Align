"""Per-user saved resume persistence (one document per user).

HTTP-agnostic: this module owns the MongoDB plumbing for the
`saved_resumes` collection. The HTTP routes in `app.main` deal with
auth and shape; this module deals with reads/writes only.

Sibling of `history.py` -- shares the same MongoDB client, but keeps
the two concerns (per-user "latest resume" vs append-only customize
log) in separate collections so neither query path can collide.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pymongo.collection import Collection

from app.config import settings
from app.services.history import _get_client

SAVED_RESUMES_COLLECTION = "saved_resumes"


def _collection() -> Collection:
    coll = _get_client()[settings.mongo_db_name][SAVED_RESUMES_COLLECTION]
    # Unique index on user_id enforces the "one saved resume per user"
    # invariant at the DB level. create_index is idempotent and cheap;
    # pymongo caches the call internally so this doesn't hit the wire
    # on every request.
    coll.create_index("user_id", unique=True)
    return coll


def get_saved(user_id: str) -> dict[str, Any] | None:
    """Return the saved-resume doc for `user_id`, or None if absent.

    Returned shape (when present):
        {"parsed_text": str, "file_name": str,
         "file_size_bytes": int, "updated_at": datetime}
    """
    doc = _collection().find_one({"user_id": user_id})
    if doc is None:
        return None
    return {
        "parsed_text": doc.get("parsed_text", ""),
        "file_name": doc.get("file_name", ""),
        "file_size_bytes": int(doc.get("file_size_bytes", 0)),
        "updated_at": doc["updated_at"],
    }


def upsert_saved(
    *,
    user_id: str,
    parsed_text: str,
    file_name: str,
    file_size_bytes: int,
) -> dict[str, Any]:
    """Replace `user_id`'s saved resume with the supplied content.

    Atomic upsert: any prior document for this user is overwritten in a
    single write. Returns the metadata that the HTTP layer surfaces to
    the client.
    """
    now = datetime.now(timezone.utc)
    _collection().update_one(
        {"user_id": user_id},
        {
            "$set": {
                "user_id": user_id,
                "parsed_text": parsed_text,
                "file_name": file_name,
                "file_size_bytes": file_size_bytes,
                "updated_at": now,
            }
        },
        upsert=True,
    )
    return {
        "file_name": file_name,
        "file_size_bytes": file_size_bytes,
        "updated_at": now,
    }
