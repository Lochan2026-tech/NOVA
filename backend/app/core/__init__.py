"""
Chronova Configuration
======================
Central configuration using Pydantic Settings.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""

    # Application
    app_name: str = "Chronova"
    app_version: str = "1.0.0"
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Paths
    base_dir: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parent.parent.parent.parent if Path(__file__).resolve().parent.parent.name == "app" else Path(__file__).resolve().parent.parent
    )

    @property
    def project_root(self) -> Path:
        p = Path(__file__).resolve().parent.parent.parent
        return p.parent if p.name == "backend" else p

    @property
    def data_dir(self) -> Path:
        return self.project_root / "data"

    @property
    def archive_dir(self) -> Path:
        return self.project_root / "archive"

    @property
    def results_dir(self) -> Path:
        return self.project_root / "results"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "chronova.db"

    @property
    def database_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.db_path}"

    # Security
    allowed_extensions: list[str] = Field(default_factory=lambda: [
        ".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".css", ".json",
        ".md", ".txt", ".yaml", ".yml", ".toml", ".cfg", ".ini",
        ".xml", ".csv", ".sql", ".sh", ".bat", ".ps1",
        ".c", ".cpp", ".h", ".hpp", ".java", ".go", ".rs",
        ".jpg", ".jpeg", ".png", ".gif", ".svg", ".ico",
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".zip", ".tar", ".gz", ".rar", ".7z",
        ".mp3", ".mp4", ".wav", ".avi", ".mkv",
        ".log", ".env", ".gitignore", ".dockerignore",
    ])

    # Scan limits
    max_file_size_mb: int = 500
    max_scan_files: int = 100000
    scan_timeout_seconds: int = 300

    # Privacy
    default_analysis_mode: str = "metadata"  # metadata | structural | content-aware
    content_analysis_opt_in: bool = False

    # Ollama (optional AI)
    ollama_enabled: bool = False
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    model_config = {
        "env_prefix": "CHRONOVA_",
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()


# Module-level singleton for convenience
settings = get_settings()
