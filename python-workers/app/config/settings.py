from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # RabbitMQ
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672"

    # PostgreSQL
    database_url: str = "postgresql://postgres:postgres@localhost:5432/campusops"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Resend
    resend_api_key: str = ""
    resend_from: str = "CampusFlow <noreply@campusflow.com.tr>"

    # Supabase storage
    supabase_url: str = ""
    supabase_key: str = ""
    storage_bucket: str = "campusops-files"

    # Frontend (bildirimler için URL)
    frontend_url: str = "http://localhost:3000"

    # App
    env: str = "development"
    log_level: str = "INFO"


settings = Settings()
