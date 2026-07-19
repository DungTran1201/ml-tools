"""
SQLAlchemy database connection.

Connects to the existing SQLite database at database/app.db.
Enables foreign keys and WAL mode to match the schema.sql PRAGMAs.
"""
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},   # SQLite + FastAPI threads
    echo=False,
)


# Match the PRAGMAs from schema.sql so every connection behaves identically.
@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, _connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA busy_timeout = 5000")
    cursor.execute("PRAGMA synchronous = NORMAL")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency – yields a session, auto-closes after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
