"""Persistence of authenticated customize runs to Firestore.

HTTP-agnostic: this module knows about Firestore and the
CustomizedResume schema, nothing about FastAPI or request/response
plumbing (AR5).
"""

from __future__ import annotations

from datetime import datetime, timezone

from firebase_admin import firestore

from app.schemas import CustomizedResume
from app.services.firebase_admin_app import get_admin_app

CUSTOMIZATIONS_COLLECTION = "customizations"


def save_customization(
    *,
    user_id: str,
    jd_text: str,
    parsed_resume_text: str,
    customized_resume: CustomizedResume,
) -> None:
    """Append a single customization record for `user_id`.

    Raises if the Admin SDK isn't configured or the write itself
    errors. The caller is expected to swallow exceptions so a history
    failure never blocks the customize response.
    """
    get_admin_app()  # ensure SDK initialized
    db = firestore.client()
    db.collection(CUSTOMIZATIONS_COLLECTION).add(
        {
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc),
            "jd_text": jd_text,
            "parsed_resume_text": parsed_resume_text,
            "customized_resume": customized_resume.model_dump(),
        }
    )
