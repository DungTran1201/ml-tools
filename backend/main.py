"""
ML-Tools — FastAPI Entrypoint

Demo server with endpoints that verify:
  1. Logger writes to console + rotating log file
  2. SQLAlchemy connects to database/app.db and can query it

Run:
    cd backend
    uvicorn main:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.logger import setup_logging
from app.api.endpoints import datasets, models, training, projects, hardware

logger = setup_logging()


import asyncio
from app.services.mock_engine import mock_training_engine_loop, mock_watchdog_loop
from app.services.hardware_daemon import mock_hardware_daemon_loop

# ── Lifespan: startup / shutdown logging ─────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s", settings.PROJECT_NAME)
    logger.info("Database: %s", settings.DATABASE_PATH)
    logger.info("Log file: %s", settings.LOG_DIR / "ml_tools.log")
    
    # Start mock training engine daemon
    engine_task = asyncio.create_task(mock_training_engine_loop())
    # Start mock hardware telemetry daemon
    hardware_task = asyncio.create_task(mock_hardware_daemon_loop())
    # Start watchdog daemon
    watchdog_task = asyncio.create_task(mock_watchdog_loop())
    
    yield
    
    logger.info("Shutting down %s", settings.PROJECT_NAME)
    # Stop daemons
    engine_task.cancel()
    hardware_task.cancel()
    watchdog_task.cancel()
    try:
        await asyncio.gather(engine_task, hardware_task, watchdog_task, return_exceptions=True)
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["Datasets"])
app.include_router(models.router, prefix="/api/models", tags=["Models"])
app.include_router(training.router, prefix="/api/training", tags=["Training"])
app.include_router(hardware.router, prefix="/api/hardware", tags=["Hardware"])

# ── Root ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    """Welcome / landing probe."""
    return {"message": f"Welcome to {settings.PROJECT_NAME}", "docs": "/docs"}


# ── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Basic liveness probe — no DB hit."""
    logger.info("Health check requested")
    return {"status": "ok"}


# ── DB Verification ──────────────────────────────────────────────────────────

@app.get("/db/tables")
def list_tables(db: Session = Depends(get_db)):
    """Return every table in app.db — proves the connection works."""
    logger.info("Listing database tables")
    rows = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name")
    ).fetchall()
    tables = [r[0] for r in rows]
    logger.info("Found %d tables", len(tables))
    return {"count": len(tables), "tables": tables}


@app.get("/db/counts")
def table_counts(db: Session = Depends(get_db)):
    """Row count per table — useful smoke test for seed data."""
    logger.info("Counting rows per table")
    tables = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name")
    ).fetchall()
    counts = {}
    for (name,) in tables:
        row = db.execute(text(f'SELECT COUNT(*) FROM "{name}"')).fetchone()
        counts[name] = row[0]
    logger.info("Row counts: %s", counts)
    return counts


@app.get("/db/pragmas")
def db_pragmas(db: Session = Depends(get_db)):
    """Confirm the SQLite PRAGMAs match schema.sql expectations."""
    logger.info("Checking SQLite PRAGMAs")
    pragmas = {}
    for pragma in ("foreign_keys", "journal_mode", "busy_timeout", "synchronous"):
        val = db.execute(text(f"PRAGMA {pragma}")).fetchone()[0]
        pragmas[pragma] = val
    logger.info("PRAGMAs: %s", pragmas)
    return pragmas
