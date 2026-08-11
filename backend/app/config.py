import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"
    redis_stream: str = "raw-news"

    llm_provider: str = "openai-compatible"
    llm_base_url: str = "https://router.huggingface.co/v1"
    llm_model: str = "meta-llama/Llama-3.3-70B-Instruct"
    llm_api_key: str

    embedding_provider: str = "huggingface"
    embedding_base_url: str = "https://router.huggingface.co/hf-inference"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_api_key: str
    embedding_dimensions: int = 384

    poll_interval_seconds: int = 300

    @property
    def asyncpg_url(self) -> str:
        return self.database_url.replace("postgresql+asyncpg://", "postgresql://")

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

RSS_POLL_INTERVAL = int(os.environ.get("RSS_POLL_INTERVAL", 300))  # seconds
