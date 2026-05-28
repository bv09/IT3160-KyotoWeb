"""Graph Builder — materializes a SubwayGraph from the database.

Reads edges, stops, routes, and blocked nodes from PostgreSQL/PostGIS
and constructs an in-memory SubwayGraph suitable for routing algorithms.
Provides functions for both full graph materialization and incremental
block-state synchronization.
"""

from __future__ import annotations

import logging

from backend.db.engine import get_session
from backend.db.repository import (
    EdgeRecord,
    get_all_edges,
    get_all_routes,
    get_blocked_stop_ids,
    get_route_stops,
    get_stops_by_ids,
)
from backend.models.graph import RouteInfo, SubwayGraph

logger = logging.getLogger(__name__)


def build_graph_from_database() -> SubwayGraph:
    """Construct a complete in-memory transit graph from the database.

    Returns:
        A SubwayGraph with adjacency, node/stop maps, route metadata,
        edge metadata, and blocked-node state populated.
    """
    session = get_session()
    try:
        graph = SubwayGraph()

        # ── Edges ────────────────────────────────────────────────
        edges = get_all_edges(session)
        logger.info("Loading %d edges from database...", len(edges))

        # Collect all unique stop ids referenced by edges
        all_stop_ids = {e.from_id for e in edges} | {e.to_id for e in edges}

        # ── Stops ────────────────────────────────────────────────
        stops = get_stops_by_ids(session, all_stop_ids)
        stop_by_id = {s.id: s for s in stops}
        logger.info("Loaded %d stops.", len(stops))

        # Register nodes and named stops
        for s in stops:
            if s.stop_type == "stop_position":
                graph.register_stop(s.id, s.lat, s.lon, s.name_en or s.name)
            elif s.stop_type == "entrance":
                graph.register_entrance(s.id, s.lat, s.lon, s.name_en or s.name)
            graph.register_node_coord(s.id, s.lat, s.lon)

        # ── Populate adjacency ───────────────────────────────────
        subway_edge_count = 0
        for e in edges:
            time_min = e.travel_time_s / 60.0  # convert seconds to minutes

            if e.edge_type == "subway":
                graph.add_edge(
                    e.from_id, e.to_id, e.distance_m, time_min,
                    edge_type=e.edge_type, route_id=e.route_id,
                )
                subway_edge_count += 1
            else:
                graph.add_undirected_edge(
                    e.from_id, e.to_id, e.distance_m, time_min,
                    edge_type=e.edge_type,
                    route_id=e.route_id,
                )

            # Register way_id for both nodes (for frontend visualization)
            if e.route_id is not None:
                graph.register_way(e.from_id, e.route_id)
                graph.register_way(e.to_id, e.route_id)

        logger.info(
            "Populated %d edges (%d subway, %d walk, transfer, entrance).",
            len(edges), subway_edge_count, len(edges) - subway_edge_count,
        )

        # ── Routes ───────────────────────────────────────────────
        routes = get_all_routes(session)
        for r in routes:
            graph.register_route(r.id, RouteInfo(
                osm_id=r.osm_id,
                ref=r.ref,
                name=r.name,
                route_type=r.route_type,
                colour=r.colour,
                network=r.network,
                operator=r.operator,
                from_stop=r.from_stop,
                to_stop=r.to_stop,
            ))
            route_stops = get_route_stops(session, r.id)
            for rs in route_stops:
                graph.register_stop_route(rs.stop_id, r.id)

        logger.info("Registered %d routes.", len(routes))

        # ── Blocked nodes ────────────────────────────────────────
        blocked_ids = get_blocked_stop_ids(session)
        for bid in blocked_ids:
            graph.blocked_node[bid] = True

        logger.info("Applied %d blocked stops.", len(blocked_ids))

        return graph
    finally:
        session.close()


def sync_blocked_nodes(graph: SubwayGraph) -> int:
    """Synchronize blocked-node state from the database into an
    already-loaded graph.  Useful after admin toggles.

    Returns:
        Number of blocked nodes applied.
    """
    session = get_session()
    try:
        blocked_ids = get_blocked_stop_ids(session)

        # Clear existing block state
        graph.blocked_node.clear()

        count = 0
        for bid in blocked_ids:
            graph.blocked_node[bid] = True
            count += 1

        return count
    finally:
        session.close()