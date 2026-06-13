"""Firebase ID token verification.

HTTP-agnostic: callers pass in a raw token string and get back the
Firebase UID (or an InvalidTokenError). Wiring into the FastAPI request
flow lives in app.main.
"""

from __future__ import annotations

from firebase_admin import auth as fb_auth

from app.errors import InvalidTokenError
from app.services.firebase_admin_app import (
    AdminNotConfiguredError,
    get_admin_app,
)


def extract_bearer_token(authorization: str | None) -> str | None:
    """Pull the token out of an `Authorization: Bearer <token>` header.

    Returns None for missing header, missing scheme, or non-Bearer
    scheme so callers can treat those cases as anonymous.
    """
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


def verify_id_token(token: str) -> str:
    """Verify a Firebase ID token and return the user's UID.

    Raises InvalidTokenError for any verification failure -- expired
    tokens, revoked tokens, malformed tokens, and the case where the
    Admin SDK is not configured on this backend.
    """
    try:
        get_admin_app()
    except AdminNotConfiguredError as exc:
        raise InvalidTokenError(
            "Authentication is not available on this server."
        ) from exc

    try:
        decoded = fb_auth.verify_id_token(token)
    except (
        fb_auth.InvalidIdTokenError,
        fb_auth.ExpiredIdTokenError,
        fb_auth.RevokedIdTokenError,
    ) as exc:
        raise InvalidTokenError(
            "Your session is invalid. Please sign in again."
        ) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise InvalidTokenError(
            "Could not verify your session. Please sign in again."
        ) from exc

    uid = decoded.get("uid")
    if not isinstance(uid, str) or not uid:
        raise InvalidTokenError("Session payload is missing a user id.")
    return uid
