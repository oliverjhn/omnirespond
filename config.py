import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # OpenAI Configuration
    OPENAI_API_KEY: str
    OPENAI_MODEL_NAME: str = "gpt-4o-mini"

    # Gemini Configuration
    GEMINI_API_KEY: str
    GEMINI_MODEL_NAME: str = "gemini-2.0-flash"

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

    # Embedding Model Configuration
    DEFAULT_EMBEDDING_MODEL: str = "text-embedding-3-small"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    @field_validator("QDRANT_URL")
    def validate_qdrant_url(cls, v):
        if not v.startswith(("http://", "https://")):
            raise ValueError("QDRANT_URL must start with http:// or https://")
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
GEMINI_API_KEY = settings.GEMINI_API_KEY
GEMINI_MODEL_NAME = settings.GEMINI_MODEL_NAME
COHERE_API_KEY = settings.COHERE_API_KEY


# Validate required settings
def validate_settings():
    required_settings = [
        ("OPENAI_API_KEY", OPENAI_API_KEY),
        ("GEMINI_API_KEY", GEMINI_API_KEY),
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
