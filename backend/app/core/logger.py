"""
Logger configuration.

Writes to both stdout and a rotating file in backend/logs/.
File rotates at 5 MB, keeps 3 backups.
"""
import logging
from logging.handlers import RotatingFileHandler

from app.core.config import settings


def setup_logging() -> logging.Logger:
    settings.LOG_DIR.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("ml_tools")
    logger.setLevel(settings.LOG_LEVEL)

    if logger.handlers:          # already configured (e.g. reload)
        return logger

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # stdout
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    logger.addHandler(sh)

    # rotating file
    fh = RotatingFileHandler(
        settings.LOG_DIR / "ml_tools.log",
        maxBytes=5 * 1024 * 1024,   # 5 MB
        backupCount=3,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    return logger
