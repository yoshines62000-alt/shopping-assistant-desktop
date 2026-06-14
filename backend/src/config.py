from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
import json


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(default="postgresql://shopping:shopping@localhost:5432/shopping", alias="DATABASE_URL")
    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")
    cache_ttl_seconds: int = Field(default=300)
    ollama_host: str = Field(default="http://localhost:11434", alias="OLLAMA_HOST")
    ollama_model: str = Field(default="qwen2.5-coder:7b-instruct", alias="OLLAMA_MODEL")
    resale_fee_rate: float = Field(default=0.13)
    background_tasks_enabled: bool = Field(default=True)
    proxy_list: list[str] = Field(default_factory=lambda: [], alias="PROXY_LIST")
    cors_allow_origins: str = Field(default="http://localhost:3000,http://127.0.0.1:3000", alias="CORS_ALLOW_ORIGINS")
    admin_api_key: str = Field(default="", alias="ADMIN_API_KEY")

    def model_post_init(self, __context):
        if not self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace("postgres://", "postgresql://", 1)
        # Parse PROXY_LIST from env if passed as string
        if hasattr(self, 'proxy_list') and isinstance(self.proxy_list, str):
            try:
                self.proxy_list = json.loads(self.proxy_list)  # type: ignore
            except Exception:
                self.proxy_list = []

    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]
        return origins or ["http://localhost:3000"]


settings = Settings()


def get_settings() -> Settings:
    return settings
