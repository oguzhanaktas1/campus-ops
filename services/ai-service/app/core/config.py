from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = Field(default="development", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8010, alias="APP_PORT")
    enable_docs: bool = Field(default=True, alias="ENABLE_DOCS")
    ai_enabled: bool = Field(default=True, alias="AI_ENABLED")
    runtime_provider: str = Field(default="ollama", alias="AI_RUNTIME_PROVIDER")
    default_model: str = Field(
        default="gemma4:e2b",
        validation_alias=AliasChoices("AI_DEFAULT_MODEL", "OLLAMA_MODEL"),
    )
    runtime_base_url: str = Field(
        default="http://localhost:11434",
        validation_alias=AliasChoices("AI_RUNTIME_BASE_URL", "OLLAMA_BASE_URL"),
    )
    runtime_fallback_urls: str = Field(default="", alias="AI_RUNTIME_FALLBACK_URLS")
    fallback_model: str = Field(default="llama3.2:1b", alias="AI_FALLBACK_MODEL")
    request_timeout_seconds: float = Field(default=30.0, alias="AI_REQUEST_TIMEOUT_SECONDS")
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
