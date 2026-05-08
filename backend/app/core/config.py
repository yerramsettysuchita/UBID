from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Walk up from backend/app/core/ → backend/app/ → backend/ → repo root
_env_file = Path(__file__).parent.parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_env_file), extra="ignore")

    app_name: str = "UBID Platform API"
    debug: bool = False
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://ubid_user:ubid_pass@localhost:5432/ubid_db"
    sync_database_url: str = "postgresql://ubid_user:ubid_pass@localhost:5432/ubid_db"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "ubid-hackathon-secret-change-in-prod-32chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    auto_link_threshold: float = 0.85
    review_threshold: float = 0.50

    synthetic_data_dir: str = "data/synthetic"


settings = Settings()
