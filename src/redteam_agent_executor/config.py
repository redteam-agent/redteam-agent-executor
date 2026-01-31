"""Configuration for RedTeam Agent Executor"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Executor service configuration."""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8001

    # Security
    INTERNAL_API_KEY: str  # For service-to-service auth
    ALLOWED_TARGET_DOMAINS: str = "*"  # Comma-separated, or * for all

    # Execution limits
    MAX_COMMAND_TIMEOUT: int = 300  # Maximum timeout in seconds
    MAX_OUTPUT_SIZE_MB: int = 10  # Maximum output size
    MAX_CONCURRENT_EXECUTIONS: int = 10

    # Rate limiting
    RATE_LIMIT_PER_SESSION: int = 100  # Commands per minute per session

    # GCP (for Cloud Run executor)
    GCP_PROJECT_ID: str | None = None
    GCP_CREDENTIALS_JSON: str | None = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
