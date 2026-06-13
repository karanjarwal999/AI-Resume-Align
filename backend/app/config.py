from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # NoDecode disables pydantic-settings' default JSON-decode pass for
    # complex types, so the validator below sees the raw env value and can
    # split on commas instead.
    allowed_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    firebase_admin_credentials_path: str = "firebase-admin.json"
    mongo_uri: str = ""
    mongo_db_name: str = "airesumealign"

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


settings = Settings()
