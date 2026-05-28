"""SubwayGraph — Transit network graph for Kyoto.

Encapsulates the entire graph data structure (adjacency list, node map,
stop map) in a single class instead of using global variables.

.. versionchanged:: 2.0
   Added route-aware edge metadata, edge type tracking, and route
   information maps.  The core 3-tuple adjacency format
   ``(neighbor_id, distance_m, time_min)`` is preserved for backward
   compatibility.  New metadata is stored in parallel structures
   (``edge_meta``, ``route_map``, ``stop_routes``).
"""
from __future__ import annotations

from dataclasses import dataclass, field

COORD_PRECISION = 7  # Decimal places when rounding coordinates


@dataclass
class RouteInfo:
    """Metadata about a transit route (e.g., Karasuma Line).

    Attributes:
        osm_id: The OSM relation id for this route.
        ref: Short reference code (e.g., "K").
        name: Full route name (e.g., "Karasuma Line").
        route_type: "subway", "bus", "tram", etc.
        colour: CSS colour string (e.g., "#00AA00").
        network: Transit network name.
        operator: Operating company name.
        from_stop: Name of the first stop.
        to_stop: Name of the last stop.
    """

    osm_id: int = 0
    ref: str = ""
    name: str = ""
    route_type: str = "subway"
    colour: str | None = None
    network: str | None = None
    operator: str | None = None
    from_stop: str | None = None
    to_stop: str | None = None


@dataclass
class EdgeMeta:
    """Extended metadata for an edge, stored alongside the adjacency list.

    Attributes:
        edge_type: "subway", "walk", "transfer", "entrance".
        route_id: Route id this edge belongs to (None for walk/transfer).
    """

    edge_type: str = "subway"
    route_id: int | None = None


class SubwayGraph:
    """Weighted directed graph representing the Kyoto transit network.

    Attributes:
        adjacency: ``node_id -> [(neighbor_id, distance_m, travel_time_min), ...]``
        node_map: Bidirectional mapping ``(lat, lon) <-> node_id``.
        stop_map: ``(lat, lon)`` or ``node_id`` -> stop name.
        entrance_map: ``(lat, lon)`` or ``node_id`` -> entrance name.
        way_map: ``node_id -> [way_id, ...]`` — which OSM ways touch this node.
        blocked_node: ``node_id -> True`` if the node is blocked.

        edge_meta: ``(from_id, to_id) -> EdgeMeta`` — extended edge info.
        route_map: ``route_id -> RouteInfo`` — metadata for each route.
        stop_routes: ``node_id -> [route_id, ...]`` — routes serving each stop.
    """

    def __init__(self):
        # ── Core (backward-compatible) ───────────────────────────
        self.adjacency: dict[int, list[tuple[int, float, float]]] = {}
        self.node_map: dict = {}  # (lat,lon) -> node_id AND node_id -> (lat,lon)
        self.stop_map: dict = {}  # (lat,lon) or node_id -> stop name
        self.entrance_map: dict = {}  # (lat,lon) or node_id -> entrance name
        self.way_map: dict[int, list[int]] = {}  # node_id -> [way_id, ...]
        self.blocked_node: dict[int, bool] = {}  # node_id -> True

        # ── Extended (new in v2) ─────────────────────────────────
        self.edge_meta: dict[tuple[int, int], EdgeMeta] = {}
        self.route_map: dict[int, RouteInfo] = {}  # route_id -> RouteInfo
        self.stop_routes: dict[int, list[int]] = {}  # stop_node_id -> [route_id, ...]

    # ── Node management ──────────────────────────────────────────

    def ensure_node(self, node_id: int) -> None:
        """Ensure *node_id* exists in the adjacency list."""
        if node_id not in self.adjacency:
            self.adjacency[node_id] = []

    def register_node_coord(self, node_id: int, lat: float, lon: float) -> None:
        """Register the bidirectional mapping between *node_id* and *(lat, lon)*."""
        coord = (round(lat, COORD_PRECISION), round(lon, COORD_PRECISION))
        if coord not in self.node_map:
            self.node_map[coord] = node_id
        if node_id not in self.node_map:
            self.node_map[node_id] = coord

    def register_stop(self, node_id: int, lat: float, lon: float, name: str) -> None:
        """Register a named stop/station for *node_id*."""
        coord = (round(lat, COORD_PRECISION), round(lon, COORD_PRECISION))
        if coord not in self.stop_map:
            self.stop_map[coord] = name
        if node_id not in self.stop_map:
            self.stop_map[node_id] = name

    def register_entrance(self, node_id: int, lat: float, lon: float, name: str) -> None:
        """Register a subway entrance for *node_id*."""
        coord = (round(lat, COORD_PRECISION), round(lon, COORD_PRECISION))
        if coord not in self.entrance_map:
            self.entrance_map[coord] = name
        if node_id not in self.entrance_map:
            self.entrance_map[node_id] = name

    def register_way(self, node_id: int, way_id: int) -> None:
        """Record that *node_id* is part of OSM way *way_id*."""
        if node_id not in self.way_map:
            self.way_map[node_id] = []
            self.way_map[node_id].append(way_id)

    # ── Edge management ──────────────────────────────────────────

    def add_edge(
        self,
        from_id: int,
        to_id: int,
        distance: float,
        time: float,
        edge_type: str = "subway",
        route_id: int | None = None,
    ) -> None:
        """Add a directed edge from *from_id* to *to_id*.

        Args:
            from_id: Source node id.
            to_id: Target node id.
            distance: Edge length in meters.
            time: Travel time in minutes.
            edge_type: "subway", "walk", "transfer", or "entrance".
            route_id: The transit route this edge belongs to (optional).
        """
        self.ensure_node(from_id)
        self.ensure_node(to_id)
        # Avoid duplicate edges
        if not any(neighbor == to_id for neighbor, _, _ in self.adjacency[from_id]):
            self.adjacency[from_id].append((to_id, distance, time))
            self.edge_meta[(from_id, to_id)] = EdgeMeta(
                edge_type=edge_type, route_id=route_id
            )

    def add_undirected_edge(
        self,
        node1: int,
        node2: int,
        distance: float,
        time: float,
        edge_type: str = "walk",
        route_id: int | None = None,
    ) -> None:
        """Add a bidirectional edge between *node1* and *node2*."""
        self.add_edge(node1, node2, distance, time, edge_type, route_id)
        self.add_edge(node2, node1, distance, time, edge_type, route_id)

    # ── Route management (new in v2) ─────────────────────────────

    def register_route(self, route_id: int, info: RouteInfo) -> None:
        """Register metadata for a transit route."""
        self.route_map[route_id] = info

    def register_stop_route(self, stop_id: int, route_id: int) -> None:
        """Record that *route_id* serves *stop_id*."""
        if stop_id not in self.stop_routes:
            self.stop_routes[stop_id] = []
        if route_id not in self.stop_routes[stop_id]:
            self.stop_routes[stop_id].append(route_id)

    # ── Query helpers ────────────────────────────────────────────

    def get_node_by_coord(self, lat: float, lon: float) -> int | None:
        """Look up a node_id from coordinates. Returns None if not found."""
        coord = (round(lat, COORD_PRECISION), round(lon, COORD_PRECISION))
        result = self.node_map.get(coord)
        return result if isinstance(result, int) else None

    def get_coord_by_node(self, node_id: int) -> tuple[float, float] | None:
        """Look up coordinates from a node_id. Returns None if not found."""
        result = self.node_map.get(node_id)
        return result if isinstance(result, tuple) else None

    def get_stop_name(self, node_id: int) -> str | None:
        """Look up the stop name for *node_id*. Returns None if not a stop."""
        return self.stop_map.get(node_id)

    def get_entrance_name(self, node_id: int) -> str | None:
        """Look up the entrance name for *node_id*. Returns None if not an entrance."""
        return self.entrance_map.get(node_id)

    def get_way_id(self, node_id: int) -> list[int] | None:
        """Return the list of way_ids for *node_id*, or None."""
        return self.way_map.get(node_id, None)

    def get_edge_meta(self, from_id: int, to_id: int) -> EdgeMeta | None:
        """Return extended metadata for the edge from *from_id* → *to_id*."""
        return self.edge_meta.get((from_id, to_id))

    def get_route_info(self, route_id: int) -> RouteInfo | None:
        """Return metadata for a transit route."""
        return self.route_map.get(route_id)

    def get_routes_for_stop(self, stop_id: int) -> list[int]:
        """Return the list of route_ids that serve *stop_id*."""
        return self.stop_routes.get(stop_id, [])

    # ── Statistics ───────────────────────────────────────────────

    @property
    def node_count(self) -> int:
        """Number of nodes in the graph."""
        return len(self.adjacency)

    @property
    def edge_count(self) -> int:
        """Total number of directed edges."""
        return sum(len(neighbors) for neighbors in self.adjacency.values())

    @property
    def route_count(self) -> int:
        """Number of registered transit routes."""
        return len(self.route_map)

    def __repr__(self) -> str:
        return (
            f"SubwayGraph(nodes={self.node_count}, "
            f"edges={self.edge_count}, "
            f"routes={self.route_count})"
        )
