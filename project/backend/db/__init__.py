"""Database layer for Kyoto transit routing.

Provides ORM models (:mod:`backend.db.models`), a session factory
(:mod:`backend.db.engine`), and typed data-access methods
(:mod:`backend.db.repository`).

Usage::

    from backend.db.engine import get_session, is_db_enabled
    from backend.db.repository import get_all_edges, search_stops

    if is_db_enabled():
        with get_session() as session:
            stops = search_stops(session, name="Kyoto")
"""