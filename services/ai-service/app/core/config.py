from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = Field(default="development", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8010, alias="APP_PORT")
    enable_docs: bool = Field(default=True, alias="ENABLE_DOCS")
    ai_enabled: bool = Field(default=True, alias="AI_ENABLED")
    runtime_provider: str = Field(default="ollama", alias="AI_RUNTIME_PROVIDER")
    default_model: str = Field(default="gemma3:4b", alias="AI_DEFAULT_MODEL")
    runtime_base_url: str = Field(default="http://localhost:11434", alias="AI_RUNTIME_BASE_URL")
    request_timeout_seconds: float = Field(default=20.0, alias="AI_REQUEST_TIMEOUT_SECONDS")
    internal_api_key: str = Field(default="campusops-ai-internal-dev-key", alias="AI_INTERNAL_API_KEY")
    fallback_confidence: float = Field(default=0.25, alias="AI_FALLBACK_CONFIDENCE")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
