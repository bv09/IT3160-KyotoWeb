"""Shared types for routing results and constraints."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RoutingConstraints:
    """Parameters that control how the routing algorithm behaves.

    Attributes:
        avoid_routes: List of route_ids to exclude from the search.
        max_transfers: Maximum number of line changes allowed (None = unlimited).
        transfer_penalty_s: Extra cost in seconds added when switching routes.
        prefer_route_id: If set, bias toward staying on this route.
        optimize: Objective function — "time", "distance", or "transfers".
    """

    avoid_routes: list[int] = field(default_factory=list)
    max_transfers: int | None = None
    transfer_penalty_s: float = 180.0  # 3 minutes default
    prefer_route_id: int | None = None
    optimize: str = "time"  # "time" | "distance" | "transfers"


@dataclass
class LegInfo:
    """A single segment of a multi-leg route.

    Attributes:
        leg_type: "walk", "transit", or "transfer".
        from_coord: (lat, lon) of the leg start.
        to_coord: (lat, lon) of the leg end.
        from_name: Human-readable name of the start (stop/entrance name or None).
        to_name: Human-readable name of the end.
        distance_m: Length of this leg in meters.
        time_s: Travel time for this leg in seconds.
        route_id: Transit route id (None for walk/transfer legs).
        route_ref: Short reference like "K" for Karasuma Line (None for non-transit).
        route_name: Full route name (None for non-transit).
        route_colour: CSS colour string (None for non-transit).
        intermediate_stops: Names of stops passed through on this leg.
        geometry: List of (lat, lon) points tracing this leg.
    """

    leg_type: str
    from_coord: tuple[float, float]
    to_coord: tuple[float, float]
    from_name: str | None = None
    to_name: str | None = None
    distance_m: float = 0.0
    time_s: float = 0.0
    route_id: int | None = None
    route_ref: str | None = None
    route_name: str | None = None
    route_colour: str | None = None
    intermediate_stops: list[str] = field(default_factory=list)
    geometry: list[tuple[float, float]] = field(default_factory=list)


@dataclass
class PathResult:
    """Result of a pathfinding operation.

    Attributes:
        path: Ordered list of (coord, name, node_type) tuples from start to end.
        distance_meters: Total distance in meters.
        estimate_time: Total estimated travel time in minutes.
        legs: Structured leg-by-leg breakdown (optional, for v2 API).
        transfers: Number of route changes (0 if single line).
        algorithm: Name of the algorithm that produced this result.
    """

    path: list[tuple[tuple[float, float], str | None, str]]
    distance_meters: float
    estimate_time: float
    legs: list[LegInfo] = field(default_factory=list)
    transfers: int = 0
    algorithm: str = "dijkstra"
