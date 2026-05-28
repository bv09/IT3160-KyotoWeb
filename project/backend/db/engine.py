"""Database engine and session factory.

Reads database configuration from environment variables so the app
can run in either JSON-file mode (current) or PostgreSQL/PostGIS mode.
"""
from __future__ import annotations

import logging
import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://kyoto:password@localhost:5432/kyoto_transit",
)
USE_DATABASE = (
    os.environ.get("USE_DATABASE", "false").lower() == "true"
)
POOL_SIZE = int(os.environ.get("DB_POOL_SIZE", "5"))

# ── Engine (lazy, created on first request) ──────────────────────
_engine = None
_session_factory: sessionmaker | None = None


def get_engine(**kwargs):
    """Return the SQLAlchemy engine, creating it on first call."""
    global _engine
    if _engine is None:
        _engine = create_engine(
            DATABASE_URL,
            pool_size=POOL_SIZE,
            future=True,
            **kwargs,
        )
        # Verify connection
        try:
            with _engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Database connection established: %s", DATABASE_URL)
        except Exception:
            logger.exception("Cannot connect to database at %s", DATABASE_URL)
            raise
    return _engine


def get_session_factory() -> sessionmaker:
    """Return the session factory, creating it on first call."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), future=True)
    return _session_factory


def get_session() -> Session:
    """Create and return a new database session.

    The caller is responsible for closing the session.
    """
    return get_session_factory()()


def is_db_enabled() -> bool:
    """Return True if the database layer is active."""
    return USE_DATABASE


def dispose_engine() -> None:
    """Close the engine connection pool (for clean shutdown)."""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("Database engine disposed.")