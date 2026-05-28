"""SQLAlchemy ORM models for Kyoto transit routing.

Tables mirror the OSM Public Transport Schema (stop_position,
platform, stop_area, route, route_master) plus internal routing
tables (edges, blocked_stops).

When GeoAlchemy2 is not available (no PostGIS driver), the spatial
columns fall back to plain floats so the module can still be imported
for development without a PostgreSQL server.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, relationship

try:
    from geoalchemy2 import Geography
    from geoalchemy2.shape import from_shape, to_shape
    from shapely.geometry import Point, LineString as ShapelyLine

    GEO_AVAILABLE = True
except ImportError:
    GEO_AVAILABLE = False


def _geom_column(geometry_type: str = "POINT"):
    """Return a Geography column type or fall back to None if not available."""
    if GEO_AVAILABLE:
        return Geography(geometry_type=geometry_type, srid=4326)
    return None


def _point(lat: float, lon: float):
    """Create a WKT point or (lon, lat) tuple."""
    if GEO_AVAILABLE:
        return from_shape(Point(lon, lat), srid=4326)
    return None


def _linestring(coords: list[tuple[float, float]]):
    """Create a WKT linestring from [(lat, lon), ...] pairs."""
    if GEO_AVAILABLE:
        pts = [(lon, lat) for lat, lon in coords]
        return from_shape(ShapelyLine(pts), srid=4326)
    return None


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


# ── Stops ────────────────────────────────────────────────────────

class Stop(Base):
    """A transit stop position, platform, or station entrance.

    Maps to OSM nodes tagged ``public_transport=stop_position``,
    ``public_transport=platform``, or ``railway=subway_entrance``.
    """

    __tablename__ = "stops"

    id: Mapped[int] = Column(Integer, primary_key=True, autoincrement=True)
    osm_id: Mapped[int] = Column(Integer, unique=True, nullable=False, index=True)
    name: Mapped[str] = Column(String(255), nullable=False, default="")
    name_en: Mapped[str] = Column(String(255), nullable=False, default="")

    #: One of: stop_position, platform, entrance, station
    stop_type: Mapped[str] = Column(String(32), nullable=False, default="stop_position")
    #: Primary transit mode: subway, bus, tram, etc.
    mode: Mapped[str] = Column(String(32), nullable=False, default="subway")

    lat: Mapped[float] = Column(Float, nullable=False)
    lon: Mapped[float] = Column(Float, nullable=False)

    #: PostGIS POINT (EPSG:4326)
    geom = Column(_geom_column("POINT"))

    wheelchair: Mapped[bool] = Column(Boolean, default=False)
    network: Mapped[str | None] = Column(String(128))
    operator: Mapped[str | None] = Column(String(128))
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:
        return f"Stop(id={self.id}, osm_id={self.osm_id}, name='{self.name}', type={self.stop_type})"


# ── Routes ───────────────────────────────────────────────────────

class Route(Base):
    """A transit route (OSM ``route`` relation).

    Represents one direction/variant of a service.  The ordered list of
    stops is in ``RouteStop``.
    """

    __tablename__ = "routes"

    id: Mapped[int] = Column(Integer, primary_key=True, autoincrement=True)
    osm_id: Mapped[int] = Column(Integer, unique=True, nullable=False, index=True)
    ref: Mapped[str] = Column(String(16), nullable=False, default="")
    name: Mapped[str] = Column(String(255), nullable=False, default="")
    route_type: Mapped[str] = Column(String(32), nullable=False, default="subway")
    colour: Mapped[str | None] = Column(String(16))
    network: Mapped[str | None] = Column(String(128))
    operator: Mapped[str | None] = Column(String(128))
    from_stop: Mapped[str] = Column(String(255), default="")
    to_stop: Mapped[str] = Column(String(255), default="")
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    route_stops: Mapped[list[RouteStop]] = relationship(back_populates="route", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"Route(id={self.id}, ref='{self.ref}', name='{self.name}', type={self.route_type})"


class RouteStop(Base):
    """Ordered stop within a transit route.

    Each row represents one stop in a route direction/variant, with
    its sequence number and role.
    """

    __tablename__ = "route_stops"

    id: Mapped[int] = Column(Integer, primary_key=True, autoincrement=True)
    route_id: Mapped[int] = Column(
        Integer, ForeignKey("routes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stop_id: Mapped[int] = Column(
        Integer, ForeignKey("stops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence: Mapped[int] = Column(Integer, nullable=False)
    #: Role from OSM relation: stop, platform, stop_exit_only, stop_entry_only
    role: Mapped[str] = Column(String(32), nullable=False, default="stop")

    # Relationships
    route: Mapped[Route] = relationship(back_populates="route_stops")
    stop: Mapped[Stop] = relationship(lazy="joined")

    def __repr__(self) -> str:
        return f"RouteStop(route_id={self.route_id}, stop_id={self.stop_id}, seq={self.sequence})"


# ── Stop Areas ───────────────────────────────────────────────────

class StopArea(Base):
    """A logical group of stops (OSM ``stop_area`` relation).

    Links stop_positions and platforms that form a named transit stop.
    """

    __tablename__ = "stop_areas"

    id: Mapped[int] = Column(Integer, primary_key=True, autoincrement=True)
    osm_id: Mapped[int] = Column(Integer, unique=True, nullable=False, index=True)
    name: Mapped[str] = Column(String(255), nullable=False, default="")
    name_en: Mapped[str] = Column(String(255), nullable=False, default="")

    #: Centroid coordinates
    lat: Mapped[float] = Column(Float, nullable=False)
    lon: Mapped[float] = Column(Float, nullable=False)
    geom = Column(_geom_column("POINT"))

    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    members: Mapped[list[StopAreaMember]] = relationship(back_populates="stop_area", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"StopArea(id={self.id}, osm_id={self.osm_id}, name='{self.name}')"


class StopAreaMember(Base):
    """Member of a stop_area relation."""

    __tablename__ = "stop_area_members"

    id: Mapped[int] = Column(Integer, primary_key=True, autoincrement=True)
    stop_area_id: Mapped[int] = Column(
        Integer, ForeignKey("stop_areas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stop_id: Mapped[int] = Column(
        Integer, ForeignKey("stops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: Role in the stop_area: stop, platform, entrance, etc.
    role: Mapped[str] = Column(String(32), nullable=False, default="stop")

    # Relationships
    stop_area: Mapped[StopArea] = relationship(back_populates="members")
    stop: Mapped[Stop] = relationship(lazy="joined")

    def __repr__(self) -> str:
        return f"StopAreaMember(area_id={self.stop_area_id}, stop_id={self.stop_id})"


# ── Edges (Pre-computed Graph) ───────────────────────────────────

class Edge(Base):
    """Pre-computed edge in the transit routing graph.

    Edges are materialized during OSM import so the graph can be
    loaded from the database without re-parsing OSM data.
    """

    __tablename__ = "edges"

    id: Mapped[int] = Column(Integer, primary_key=True, autoincrement=True)
    from_stop_id: Mapped[int] = Column(
        Integer, ForeignKey("stops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    to_stop_id: Mapped[int] = Column(
        Integer, ForeignKey("stops.id", ondelete="CASCADE"), nullable=False, index=True
    )

    #: Line geometry of the edge (PostGIS LINESTRING)
    geom = Column(_geom_column("LINESTRING"))

    distance_m: Mapped[float] = Column(Float, nullable=False, default=0.0)
    travel_time_s: Mapped[float] = Column(Float, nullable=False, default=0.0)

    #: One of: subway, walk, transfer, entrance
    edge_type: Mapped[str] = Column(String(32), nullable=False, default="subway")
    route_id: Mapped[int | None] = Column(
        Integer, ForeignKey("routes.id", ondelete="SET NULL"), nullable=True, index=True
    )

    is_blocked: Mapped[bool] = Column(Boolean, default=False)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    from_stop: Mapped[Stop] = relationship(foreign_keys=[from_stop_id], lazy="joined")
    to_stop: Mapped[Stop] = relationship(foreign_keys=[to_stop_id], lazy="joined")
    route: Mapped[Route | None] = relationship(lazy="joined")

    def __repr__(self) -> str:
        return f"Edge(from={self.from_stop_id}, to={self.to_stop_id}, type={self.edge_type})"


# ── Blocked Stops ────────────────────────────────────────────────

class BlockedStop(Base):
    """Persisted record of admin-blocked stops."""

    __tablename__ = "blocked_stops"

    id: Mapped[int] = Column(Integer, primary_key=True, autoincrement=True)
    stop_id: Mapped[int] = Column(
        Integer, ForeignKey("stops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reason: Mapped[str] = Column(Text, default="")
    blocked_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationship
    stop: Mapped[Stop] = relationship(lazy="joined")

    def __repr__(self) -> str:
        return f"BlockedStop(stop_id={self.stop_id}, blocked_at={self.blocked_at})"