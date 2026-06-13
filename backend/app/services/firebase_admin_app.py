"""Lazy bootstrap for the Firebase Admin SDK.

Initialized on first use so the backend boots without crashing when the
service-account JSON is missing (anonymous customize flow still works).
Auth + history modules both import get_admin_app() before calling into
the admin APIs.
"""

from __future__ import annotations

import os

import firebase_admin
from firebase_admin import credentials

from app.config import settings

_app: firebase_admin.App | None = None


class AdminNotConfiguredError(RuntimeError):
    """Raised when admin SDK use is attempted but no creds file exists."""


def get_admin_app() -> firebase_admin.App:
    global _app
    if _app is not None:
        return _app

    path = settings.firebase_admin_credentials_path
    if not path or not os.path.exists(path):
        raise AdminNotConfiguredError(
            f"Firebase Admin credentials file not found at {path!r}. "
            "Generate one at Firebase console -> Project settings -> "
            "Service accounts and place it in backend/."
        )
    cred = credentials.Certificate(path)
    _app = firebase_admin.initialize_app(cred)
    return _app
