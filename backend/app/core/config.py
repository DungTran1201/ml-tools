"""
ML-Tools backend application settings.

Resolves the database path relative to the project root so it works
regardless of the working directory used to launch uvicorn.
"""
from pathlib import Path
from pydantic_settings import BaseSettings

# project root = backend/../  →  c:\Users\PC\Desktop\ml-tools
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "ML-Tools API"
    DATABASE_PATH: Path = _PROJECT_ROOT / "database" / "app.db"
    LOG_DIR: Path = _PROJECT_ROOT / "backend" / "logs"
    LOG_LEVEL: str = "INFO"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.DATABASE_PATH}"

settings = Settings()
