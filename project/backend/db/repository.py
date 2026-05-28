"""Data access methods for the routing database.

Provides a clean API for querying stops, routes, edges, and persisting
admin actions.  All methods accept a ``Session`` argument so the caller
controls transaction boundaries.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.db.models import (
    BlockedStop,
    Edge,
    Route,
    RouteStop,
    Stop,
    StopArea,
    StopAreaMember,
)

logger = logging.getLogger(__name__)


# ── Stop queries ─────────────────────────────────────────────────

def get_stop_by_id(session: Session, stop_id: int) -> Stop | None:
    """Return a single stop by its internal id."""
    return session.get(Stop, stop_id)


def get_stop_by_osm_id(session: Session, osm_id: int) -> Stop | None:
    """Return a single stop by its OSM node id."""
    return session.scalar(
        select(Stop).where(Stop.osm_id == osm_id)
    )


def get_stops_by_ids(session: Session, stop_ids: Iterable[int]) -> list[Stop]:
    """Return stops matching a list of internal ids."""
    ids = list(stop_ids)
    if not ids:
        return []
    return list(
        session.scalars(select(Stop).where(Stop.id.in_(ids)))
    )


def search_stops(
    session: Session,
    name: str = "",
    stop_type: str | None = None,
    mode: str | None = None,
    limit: int = 50,
) -> list[Stop]:
    """Search stops by name (case-insensitive LIKE)."""
    q = select(Stop)
    if name:
        q = q.where(
            (Stop.name.ilike(f"%{name}%"))
            | (Stop.name_en.ilike(f"%{name}%"))
        )
    if stop_type:
        q = q.where(Stop.stop_type == stop_type)
    if mode:
        q = q.where(Stop.mode == mode)
    q = q.limit(limit)
    return list(session.scalars(q))


def get_stops_in_bbox(
    session: Session,
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    limit: int = 500,
) -> list[Stop]:
    """Return stops within a bounding box."""
    return list(
        session.scalars(
            select(Stop)
            .where(
                Stop.lat.between(min_lat, max_lat),
                Stop.lon.between(min_lon, max_lon),
            )
            .limit(limit)
        )
    )


# ── Route queries ────────────────────────────────────────────────

def get_route_by_id(session: Session, route_id: int) -> Route | None:
    """Return a route by internal id."""
    return session.get(Route, route_id)


def get_route_by_osm_id(session: Session, osm_id: int) -> Route | None:
    """Return a route by OSM relation id."""
    return session.scalar(
        select(Route).where(Route.osm_id == osm_id)
    )


def get_all_routes(
    session: Session, route_type: str | None = None, limit: int = 200
) -> list[Route]:
    """Return all routes, optionally filtered by type."""
    q = select(Route)
    if route_type:
        q = q.where(Route.route_type == route_type)
    q = q.limit(limit)
    return list(session.scalars(q))


def get_route_stops(
    session: Session, route_id: int
) -> list[RouteStop]:
    """Return the ordered stops for a route."""
    return list(
        session.scalars(
            select(RouteStop)
            .where(RouteStop.route_id == route_id)
            .order_by(RouteStop.sequence)
        )
    )


def get_routes_for_stop(session: Session, stop_id: int) -> list[Route]:
    """Return all routes that serve a given stop."""
    subq = (
        select(RouteStop.route_id)
        .where(RouteStop.stop_id == stop_id)
        .distinct()
        .subquery()
    )
    return list(
        session.scalars(
            select(Route).where(Route.id.in_(select(subq)))
        )
    )


# ── Edge queries (graph loading) ─────────────────────────────────

@dataclass
class EdgeRecord:
    """Lightweight edge record for building an in-memory graph."""

    from_id: int
    to_id: int
    distance_m: float
    travel_time_s: float
    edge_type: str
    route_id: int | None = None


def get_all_edges(session: Session) -> list[EdgeRecord]:
    """Return all non-blocked edges for graph construction."""
    rows = session.execute(
        select(
            Edge.from_stop_id,
            Edge.to_stop_id,
            Edge.distance_m,
            Edge.travel_time_s,
            Edge.edge_type,
            Edge.route_id,
        ).where(Edge.is_blocked == False)
    ).all()

    return [
        EdgeRecord(
            from_id=r.from_stop_id,
            to_id=r.to_stop_id,
            distance_m=r.distance_m,
            travel_time_s=r.travel_time_s,
            edge_type=r.edge_type,
            route_id=r.route_id,
        )
        for r in rows
    ]


def get_edge_count(session: Session) -> int:
    """Return the total number of edges."""
    return session.scalar(select(func.count()).select_from(Edge)) or 0


# ── Admin operations ─────────────────────────────────────────────

def block_stop(session: Session, stop_id: int, reason: str = "") -> BlockedStop:
    """Mark a stop as blocked.  Creates a ``BlockedStop`` record."""
    existing = session.scalar(
        select(BlockedStop).where(BlockedStop.stop_id == stop_id)
    )
    if existing is not None:
        return existing

    blocked = BlockedStop(stop_id=stop_id, reason=reason)
    session.add(blocked)
    session.commit()
    return blocked


def unblock_stop(session: Session, stop_id: int) -> bool:
    """Remove a block from a stop.  Returns True if a block was removed."""
    blocked = session.scalar(
        select(BlockedStop).where(BlockedStop.stop_id == stop_id)
    )
    if blocked is None:
        return False
    session.delete(blocked)
    session.commit()
    return True


def unblock_all(session: Session) -> int:
    """Remove all blocks.  Returns the count of removed blocks."""
    rows = session.execute(select(BlockedStop)).scalars().all()
    count = len(list(rows))
    session.query(BlockedStop).delete()
    session.commit()
    return count


def get_blocked_stop_ids(session: Session) -> list[int]:
    """Return the list of currently blocked stop ids."""
    rows = session.execute(select(BlockedStop.stop_id)).all()
    return [r.stop_id for r in rows]


# ── Stop Area queries ────────────────────────────────────────────

def get_stop_area_by_id(session: Session, area_id: int) -> StopArea | None:
    """Return a stop area by internal id."""
    return session.get(StopArea, area_id)


def get_stop_area_members(
    session: Session, area_id: int
) -> list[StopAreaMember]:
    """Return all members of a stop area."""
    return list(
        session.scalars(
            select(StopAreaMember).where(
                StopAreaMember.stop_area_id == area_id
            )
        )
    )


# ── Statistics ───────────────────────────────────────────────────

def get_statistics(session: Session) -> dict:
    """Return summary statistics about the database."""
    return {
        "stops": session.scalar(select(func.count()).select_from(Stop)) or 0,
        "routes": session.scalar(select(func.count()).select_from(Route)) or 0,
        "edges": session.scalar(select(func.count()).select_from(Edge)) or 0,
        "stop_areas": session.scalar(select(func.count()).select_from(StopArea)) or 0,
        "blocked_stops": session.scalar(
            select(func.count()).select_from(BlockedStop)
        ) or 0,
    }