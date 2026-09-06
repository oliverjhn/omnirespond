import os
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # OpenAI Configuration
    OPENAI_API_KEY: str
    OPENAI_MODEL_NAME: str = "gpt-5.4-mini-2026-03-17"

    # Kept optional so an existing .env entry does not prevent startup.
    GEMINI_API_KEY: Optional[str] = None

    # Cohere Configuration
    COHERE_API_KEY: str
    COHERE_MODEL_NAME: str = "command-r-plus"

    # Cloudflare R2 Configuration
    R2_ENDPOINT_URL: str
    R2_ACCESS_KEY: str
    R2_SECRET_KEY: str
    BUCKET_NAME: str = "omnirespond-user-documents"

    # Qdrant Configuration
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None

    # API Configuration
    DEFAULT_COLLECTION: str = "unsorted"
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB in bytes

    # Embedding Model Configuration
    DEFAULT_EMBEDDING_MODEL: str = "text-embedding-3-small"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    @field_validator("QDRANT_URL")
    def validate_qdrant_url(cls, v):
        if not v.startswith(("http://", "https://")):
            raise ValueError("QDRANT_URL must start with http:// or https://")
        return v

    @field_validator("ALLOWED_ORIGINS")
    def validate_allowed_origins(cls, v, values):
        # Parse comma-separated string into list
        if isinstance(v, str):
            v = [origin.strip() for origin in v.split(",")]
        env = values.data.get("ENVIRONMENT", "development")
        if env == "production" and "*" in v:
            raise ValueError("Wildcard (*) origin is not allowed in production")
        return v


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Create settings instance
settings = Settings()

# Set environment variables that are required by various libraries
os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY

# Export all settings as module-level variables
OPENAI_API_KEY = settings.OPENAI_API_KEY
OPENAI_MODEL_NAME = settings.OPENAI_MODEL_NAME
R2_ENDPOINT_URL = settings.R2_ENDPOINT_URL
R2_ACCESS_KEY = settings.R2_ACCESS_KEY
R2_SECRET_KEY = settings.R2_SECRET_KEY
BUCKET_NAME = settings.BUCKET_NAME
QDRANT_URL = settings.QDRANT_URL
QDRANT_API_KEY = settings.QDRANT_API_KEY
DEFAULT_COLLECTION = settings.DEFAULT_COLLECTION
DEFAULT_EMBEDDING_MODEL = settings.DEFAULT_EMBEDDING_MODEL
COHERE_API_KEY = settings.COHERE_API_KEY
ENVIRONMENT = settings.ENVIRONMENT
ALLOWED_ORIGINS = settings.ALLOWED_ORIGINS
MAX_UPLOAD_SIZE = settings.MAX_UPLOAD_SIZE


# Validate required settings
def validate_settings():
    required_settings = [
        ("OPENAI_API_KEY", OPENAI_API_KEY),
        ("COHERE_API_KEY", COHERE_API_KEY),
        ("R2_ENDPOINT_URL", R2_ENDPOINT_URL),
        ("R2_ACCESS_KEY", R2_ACCESS_KEY),
        ("R2_SECRET_KEY", R2_SECRET_KEY),
        ("BUCKET_NAME", BUCKET_NAME),
        ("QDRANT_URL", QDRANT_URL),
    ]

    missing_settings = [name for name, value in required_settings if not value]

    if missing_settings:
        raise ValueError(
            f"Missing required settings: {', '.join(missing_settings)}. "
            "Please set these values in your environment or .env file."
        )


# Validate settings on module import
validate_settings()
